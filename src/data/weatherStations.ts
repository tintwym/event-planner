/** Shared micro-station estimates for known Villa & Vale venues */

export type StationFallback = {
  match: string;
  stationName: string;
  stationLat: number;
  stationLng: number;
  humidity: number;
  windSpeed: string;
};

export const STATION_FALLBACKS: StationFallback[] = [
  {
    match: 'villa cimbrone',
    stationName: 'Ravello cliff micro-station',
    stationLat: 40.6473,
    stationLng: 14.6111,
    humidity: 68,
    windSpeed: '18 km/h',
  },
  {
    match: 'villa treville',
    stationName: 'Positano cliffside gauge',
    stationLat: 40.6277,
    stationLng: 14.4994,
    humidity: 72,
    windSpeed: '22 km/h',
  },
  {
    match: 'villa astor',
    stationName: 'Sorrento terrace station',
    stationLat: 40.6315,
    stationLng: 14.3734,
    humidity: 64,
    windSpeed: '14 km/h',
  },
  {
    match: 'belmond hotel caruso',
    stationName: 'Caruso terrace AWS',
    stationLat: 40.6506,
    stationLng: 14.6128,
    humidity: 70,
    windSpeed: '20 km/h',
  },
  {
    match: 'le sirenuse',
    stationName: 'Positano harbour AWS',
    stationLat: 40.6291,
    stationLng: 14.4855,
    humidity: 74,
    windSpeed: '16 km/h',
  },
  {
    match: 'grand hotel excelsior vittoria',
    stationName: 'Sorrento clifftop AWS',
    stationLat: 40.6293,
    stationLng: 14.3752,
    humidity: 66,
    windSpeed: '15 km/h',
  },
];

export function matchStationFallback(location: string): StationFallback | undefined {
  const key = location.trim().toLowerCase();
  return STATION_FALLBACKS.find((s) => key.includes(s.match));
}

function nextWeekdayLabels(count = 3): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
  }
  return labels;
}

export type WeatherEstimatePayload = {
  locationName: string;
  stationName: string;
  stationLat: number | null;
  stationLng: number | null;
  currentTemp: number;
  condition: string;
  humidity: number;
  windSpeed: string;
  forecast: { day: string; temp: number; condition: string }[];
};

/** Honest estimate: known venues get coords; others omit fake Amalfi pins */
export function buildWeatherEstimate(location: string): WeatherEstimatePayload {
  const station = matchStationFallback(location);
  const days = nextWeekdayLabels(3);
  return {
    locationName: `${location} (Estimate)`,
    stationName: station?.stationName ?? 'Regional estimate (no station pin)',
    stationLat: station?.stationLat ?? null,
    stationLng: station?.stationLng ?? null,
    currentTemp: 28,
    condition: 'Sunny',
    humidity: station?.humidity ?? 65,
    windSpeed: station?.windSpeed ?? '12 km/h',
    forecast: [
      { day: days[0] || 'Day 1', temp: 29, condition: 'Sunny' },
      { day: days[1] || 'Day 2', temp: 30, condition: 'Partly Cloudy' },
      { day: days[2] || 'Day 3', temp: 27, condition: 'Sunny' },
    ],
  };
}

export function finiteCoord(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mergeWeatherPayload(
  base: WeatherEstimatePayload,
  overlay: Partial<WeatherEstimatePayload> | Record<string, unknown>
): WeatherEstimatePayload {
  const o = overlay as Partial<WeatherEstimatePayload>;
  return {
    locationName:
      typeof o.locationName === 'string' && o.locationName.trim()
        ? o.locationName
        : base.locationName,
    stationName:
      typeof o.stationName === 'string' && o.stationName.trim()
        ? o.stationName
        : base.stationName,
    stationLat: finiteCoord(o.stationLat) ?? base.stationLat,
    stationLng: finiteCoord(o.stationLng) ?? base.stationLng,
    currentTemp:
      typeof o.currentTemp === 'number' && Number.isFinite(o.currentTemp)
        ? o.currentTemp
        : base.currentTemp,
    condition: typeof o.condition === 'string' && o.condition ? o.condition : base.condition,
    humidity:
      typeof o.humidity === 'number' && Number.isFinite(o.humidity) ? o.humidity : base.humidity,
    windSpeed:
      typeof o.windSpeed === 'string' && o.windSpeed.trim() ? o.windSpeed : base.windSpeed,
    forecast: Array.isArray(o.forecast) && o.forecast.length > 0 ? o.forecast : base.forecast,
  };
}
