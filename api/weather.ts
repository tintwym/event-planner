import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildWeatherEstimate,
  mergeWeatherPayload,
  type WeatherEstimatePayload,
} from '../src/data/weatherStations';

type WeatherPayload = WeatherEstimatePayload;

// Warm-instance cache to avoid burning free-tier quota on repeat requests
const weatherCache = new Map<string, { data: WeatherPayload; cachedAt: number }>();
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
let weatherQuotaCooldownUntil = 0;

let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}

const weatherSchema = {
  type: Type.OBJECT,
  properties: {
    locationName: {
      type: Type.STRING,
      description: 'Proper formatted location name, e.g. Amalfi Coast, Italy',
    },
    stationName: {
      type: Type.STRING,
      description:
        "Nearest weather / AWS station name for micro-climate context, e.g. 'Ravello cliff AWS'",
    },
    stationLat: {
      type: Type.NUMBER,
      description: 'Latitude of that weather station in decimal degrees (WGS84)',
    },
    stationLng: {
      type: Type.NUMBER,
      description: 'Longitude of that weather station in decimal degrees (WGS84)',
    },
    currentTemp: {
      type: Type.NUMBER,
      description: 'Current temperature as integer in Celsius',
    },
    condition: {
      type: Type.STRING,
      description: 'E.g. Sunny, Partly Cloudy, Rain, Overcast',
    },
    humidity: { type: Type.NUMBER, description: 'Humidity % as integer' },
    windSpeed: {
      type: Type.STRING,
      description: "Wind speed with units, e.g. '14 km/h'",
    },
    forecast: {
      type: Type.ARRAY,
      description: '3-day forecast',
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING, description: 'Abbreviated day, e.g. Sat, Sun, Mon' },
          temp: { type: Type.NUMBER, description: 'High temperature in Celsius' },
          condition: { type: Type.STRING, description: 'Sunny, Rain, Cloudy, etc.' },
        },
        required: ['day', 'temp', 'condition'],
      },
    },
  },
  required: [
    'locationName',
    'stationName',
    'stationLat',
    'stationLng',
    'currentTemp',
    'condition',
    'humidity',
    'windSpeed',
    'forecast',
  ],
};

const ESTIMATE_NOTE =
  'Model weather estimate (not a live station feed). Use for planning context only.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rawLoc = req.query.location;
  const location = (Array.isArray(rawLoc) ? rawLoc[0] : rawLoc) || 'Amalfi Coast, Italy';
  const fallback = () => buildWeatherEstimate(location);

  try {
    const cacheKey = location.trim().toLowerCase();
    const now = Date.now();

    const cached = weatherCache.get(cacheKey);
    if (cached && now - cached.cachedAt < WEATHER_CACHE_TTL_MS) {
      return res.json({
        success: false,
        fallback: true,
        error: ESTIMATE_NOTE,
        data: mergeWeatherPayload(fallback(), cached.data),
      });
    }

    if (now < weatherQuotaCooldownUntil) {
      return res.json({
        success: false,
        fallback: true,
        error: 'Weather API rate limit reached. Showing an estimate — try again shortly.',
        data: mergeWeatherPayload(fallback(), cached?.data ?? {}),
      });
    }

    const ai = getGemini();
    const promptText = `Provide a realistic seasonal weather estimate and 3-day outlook for "${location}" (not live observations). Temperatures in Celsius. Include a plausible nearest automatic weather station name plus stationLat/stationLng near the villa/hotel or town. Wind as a string with km/h. Return only JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: weatherSchema,
      },
    });

    const textOutput = response.text?.trim() || '{}';
    const parsedData = JSON.parse(textOutput) as Partial<WeatherPayload>;
    const data = mergeWeatherPayload(fallback(), parsedData);
    weatherCache.set(cacheKey, { data, cachedAt: now });

    return res.json({ success: false, fallback: true, error: ESTIMATE_NOTE, data });
  } catch (error: any) {
    const message = String(error?.message || error);
    const isQuota =
      message.includes('429') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('quota');

    if (isQuota) {
      const retryMatch = message.match(/retry in ([\d.]+)s/i);
      const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
      weatherQuotaCooldownUntil = Date.now() + retrySeconds * 1000;
    }

    return res.json({
      success: false,
      fallback: true,
      error: isQuota
        ? 'Weather API quota exceeded. Showing an estimate.'
        : 'Live weather unavailable. Showing an estimate.',
      data: fallback(),
    });
  }
}
