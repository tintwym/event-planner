import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import {
  buildWeatherEstimate,
  mergeWeatherPayload,
  type WeatherEstimatePayload,
} from "./src/data/weatherStations";

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

  function getFallbackWeather(location: string): WeatherEstimatePayload {
    return buildWeatherEstimate(location);
  }

  // Avoid burning free-tier quota on every page reload / HMR
  type WeatherPayload = WeatherEstimatePayload;
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
          const data = mergeWeatherPayload(getFallbackWeather(location), cached.data);
          // Gemini is never live-grounded — always surface as an estimate
          return res.json({
            success: false,
            fallback: true,
            error:
              "Model weather estimate (not a live station feed). Use for planning context only.",
            data,
          });
        }
      }

      if (now < weatherQuotaCooldownUntil) {
        const data = mergeWeatherPayload(
          getFallbackWeather(location),
          cached?.data ?? {}
        );
        return res.json({
          success: false,
          fallback: true,
          error: "Weather API rate limit reached. Showing an estimate — try again shortly.",
          data,
        });
      }

      const ai = getGemini();
      const promptText = `Provide a realistic seasonal weather estimate and 3-day outlook for "${location}" (not live observations). Temperatures in Celsius. Include a plausible nearest automatic weather station name plus stationLat/stationLng near the villa/hotel or town. Wind as a string with km/h. Return only JSON matching the schema.`;

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
      const parsedData = JSON.parse(textOutput) as Partial<WeatherPayload>;
      const data = mergeWeatherPayload(getFallbackWeather(location), parsedData);
      weatherCache.set(cacheKey, {
        data,
        cachedAt: now,
        fallback: true,
      });
      res.json({
        success: false,
        fallback: true,
        error:
          "Model weather estimate (not a live station feed). Use for planning context only.",
        data,
      });
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
