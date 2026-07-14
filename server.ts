import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));

  // Allow Expo / mobile clients on other origins during development
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  let aiClient: GoogleGenAI | null = null;
  function getGemini(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY environment variable is required. Configure it in Settings > Secrets."
        );
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  /** Approximate micro-station coords for known villa/hotel microclimates */
  const STATION_FALLBACKS: Record<
    string,
    { stationName: string; stationLat: number; stationLng: number; humidity: number; windSpeed: string }
  > = {
    "villa cimbrone": {
      stationName: "Ravello cliff micro-station",
      stationLat: 40.6473,
      stationLng: 14.6111,
      humidity: 68,
      windSpeed: "18 km/h",
    },
    "villa treville": {
      stationName: "Positano cliffside gauge",
      stationLat: 40.6277,
      stationLng: 14.4994,
      humidity: 72,
      windSpeed: "22 km/h",
    },
    "villa astor": {
      stationName: "Sorrento terrace station",
      stationLat: 40.6315,
      stationLng: 14.3734,
      humidity: 64,
      windSpeed: "14 km/h",
    },
    "belmond hotel caruso": {
      stationName: "Caruso terrace AWS",
      stationLat: 40.6506,
      stationLng: 14.6128,
      humidity: 70,
      windSpeed: "20 km/h",
    },
    "le sirenuse": {
      stationName: "Positano harbour AWS",
      stationLat: 40.6291,
      stationLng: 14.4855,
      humidity: 74,
      windSpeed: "16 km/h",
    },
    "grand hotel excelsior vittoria": {
      stationName: "Sorrento clifftop AWS",
      stationLat: 40.6293,
      stationLng: 14.3752,
      humidity: 66,
      windSpeed: "15 km/h",
    },
  };

  function getFallbackWeather(location: string) {
    const key = location.trim().toLowerCase();
    const matched = Object.entries(STATION_FALLBACKS).find(([name]) => key.includes(name));
    const station = matched?.[1];
    return {
      locationName: `${location} (Estimate)`,
      stationName: station?.stationName ?? "Nearest regional AWS (estimate)",
      stationLat: station?.stationLat ?? 40.634,
      stationLng: station?.stationLng ?? 14.6026,
      currentTemp: 28,
      condition: "Sunny",
      humidity: station?.humidity ?? 65,
      windSpeed: station?.windSpeed ?? "12 km/h",
      forecast: [
        { day: "Tue", temp: 29, condition: "Sunny" },
        { day: "Wed", temp: 30, condition: "Partly Cloudy" },
        { day: "Thu", temp: 27, condition: "Sunny" },
      ],
    };
  }

  // Avoid burning free-tier quota on every page reload / HMR
  type WeatherPayload = ReturnType<typeof getFallbackWeather>;
  const weatherCache = new Map<
    string,
    { data: WeatherPayload; cachedAt: number; fallback: boolean }
  >();
  const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for live data
  const WEATHER_FALLBACK_TTL_MS = 45 * 1000; // short TTL so Retry can re-hit Gemini
  let weatherQuotaCooldownUntil = 0;

  const weatherSchema = {
    type: Type.OBJECT,
    properties: {
      locationName: {
        type: Type.STRING,
        description: "Proper formatted location name, e.g. Amalfi Coast, Italy",
      },
      stationName: {
        type: Type.STRING,
        description:
          "Nearest weather / AWS station name for micro-climate context, e.g. 'Ravello cliff AWS'",
      },
      stationLat: {
        type: Type.NUMBER,
        description: "Latitude of that weather station in decimal degrees (WGS84)",
      },
      stationLng: {
        type: Type.NUMBER,
        description: "Longitude of that weather station in decimal degrees (WGS84)",
      },
      currentTemp: {
        type: Type.NUMBER,
        description: "Current temperature as integer in Celsius",
      },
      condition: {
        type: Type.STRING,
        description: "E.g. Sunny, Partly Cloudy, Rain, Overcast",
      },
      humidity: { type: Type.NUMBER, description: "Humidity % as integer" },
      windSpeed: {
        type: Type.STRING,
        description: "Wind speed with units, e.g. '14 km/h'",
      },
      forecast: {
        type: Type.ARRAY,
        description: "3-day forecast",
        items: {
          type: Type.OBJECT,
          properties: {
            day: {
              type: Type.STRING,
              description: "Abbreviated day, e.g. Sat, Sun, Mon",
            },
            temp: { type: Type.NUMBER, description: "High temperature in Celsius" },
            condition: {
              type: Type.STRING,
              description: "Sunny, Rain, Cloudy, etc.",
            },
          },
          required: ["day", "temp", "condition"],
        },
      },
    },
    required: [
      "locationName",
      "stationName",
      "stationLat",
      "stationLng",
      "currentTemp",
      "condition",
      "humidity",
      "windSpeed",
      "forecast",
    ],
  };

  app.get("/api/weather", async (req, res) => {
    let location = "Amalfi Coast, Italy";
    try {
      location = (req.query.location as string) || "Amalfi Coast, Italy";
      const cacheKey = location.trim().toLowerCase();
      const cached = weatherCache.get(cacheKey);
      const now = Date.now();

      if (cached) {
        const ttl = cached.fallback ? WEATHER_FALLBACK_TTL_MS : WEATHER_CACHE_TTL_MS;
        if (now - cached.cachedAt < ttl) {
          const fallback = getFallbackWeather(location);
          const data = {
            ...fallback,
            ...cached.data,
            stationName: cached.data.stationName || fallback.stationName,
            stationLat:
              typeof cached.data.stationLat === "number"
                ? cached.data.stationLat
                : fallback.stationLat,
            stationLng:
              typeof cached.data.stationLng === "number"
                ? cached.data.stationLng
                : fallback.stationLng,
          };
          return res.json({
            success: !cached.fallback,
            fallback: cached.fallback,
            error: cached.fallback
              ? "Live weather unavailable. Showing a cached estimate."
              : undefined,
            data,
          });
        }
      }

      if (now < weatherQuotaCooldownUntil) {
        const data = cached?.data ?? getFallbackWeather(location);
        return res.json({
          success: false,
          fallback: true,
          error: "Weather API rate limit reached. Showing an estimate — try again shortly.",
          data,
        });
      }

      const ai = getGemini();
      const promptText = `Provide a realistic current weather snapshot and 3-day forecast for "${location}". Temperatures in Celsius. Include the nearest realistic automatic weather station (AWS) for micro-climate context: stationName plus precise stationLat and stationLng (decimal degrees near the villa/hotel or town, not a city centroid far inland). Wind as a string with km/h. Return only JSON matching the schema. Use typical seasonal coastal conditions if live data is unavailable.`;

      // Use Flash-Lite — separate free-tier quota from the exhausted Flash pool
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: weatherSchema,
        },
      });

      const textOutput = response.text?.trim() || "{}";
      const parsedData = JSON.parse(textOutput) as WeatherPayload;
      const fallback = getFallbackWeather(location);
      const data: WeatherPayload = {
        ...fallback,
        ...parsedData,
        stationName: parsedData.stationName || fallback.stationName,
        stationLat:
          typeof parsedData.stationLat === "number"
            ? parsedData.stationLat
            : fallback.stationLat,
        stationLng:
          typeof parsedData.stationLng === "number"
            ? parsedData.stationLng
            : fallback.stationLng,
      };
      weatherCache.set(cacheKey, {
        data,
        cachedAt: now,
        fallback: false,
      });
      res.json({ success: true, fallback: false, data });
    } catch (error: any) {
      const message = String(error?.message || error);
      const isQuota =
        message.includes("429") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("quota");

      if (isQuota) {
        const retryMatch = message.match(/retry in ([\d.]+)s/i);
        const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
        weatherQuotaCooldownUntil = Date.now() + retrySeconds * 1000;
      }

      console.warn(
        `Gemini Weather API failed for ${location}. Using fallback weather mock. (${message})`
      );

      const data = getFallbackWeather(location);
      weatherCache.set(location.trim().toLowerCase(), {
        data,
        cachedAt: Date.now(),
        fallback: true,
      });

      res.json({
        success: false,
        fallback: true,
        error: isQuota
          ? "Weather API quota exceeded. Showing an estimate."
          : "Live weather unavailable. Showing an estimate.",
        data,
      });
    }
  });

  app.post("/api/gemini/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ success: false, error: "Prompt is required" });
      }

      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: {
          parts: [
            {
              text: `${prompt}. Ultra-luxurious, premium wedding/dinner/event mood board concept, photorealistic, architectural digest style, warm lighting.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });

      let imageUrl = "";
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64 = part.inlineData.data;
            const mime = part.inlineData.mimeType || "image/png";
            imageUrl = `data:${mime};base64,${base64}`;
            break;
          }
        }
      }

      if (imageUrl) {
        res.json({ success: true, imageUrl });
      } else {
        res
          .status(500)
          .json({ success: false, error: "Gemini did not return any image data." });
      }
    } catch (error: any) {
      console.error(`Error generating mood board image: ${error.message || error}`);
      res
        .status(500)
        .json({ success: false, error: error.message || "Failed to generate image" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[Full-Stack Server] Server active at http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`
    );
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
