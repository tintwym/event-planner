/** Outdoor-event risk thresholds for humidity & wind (travel / hospitality practice) */

export type RiskLevel = 'ok' | 'caution' | 'high';

export interface WeatherRiskPill {
  id: 'humidity' | 'wind';
  label: string;
  level: RiskLevel;
  /** Short chip text */
  chip: string;
  /** Full explanation for tooltip / accessibility */
  detail: string;
}

/** Parse wind strings like "14 km/h", "12km/h", "8 mph" into km/h */
export function parseWindKmh(windSpeed: unknown): number | null {
  if (typeof windSpeed === 'number' && Number.isFinite(windSpeed)) return windSpeed;
  if (typeof windSpeed !== 'string') return null;
  const match = windSpeed.trim().match(/([\d.]+)\s*(km\/h|kph|mph|m\/s)?/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (match[2] || 'km/h').toLowerCase();
  if (unit === 'mph') return value * 1.60934;
  if (unit === 'm/s') return value * 3.6;
  return value;
}

/**
 * Humidity: ≥60% guest discomfort / floral stress (caution); ≥75% high for outdoor events.
 * Wind: ≥20 km/h canopy & décor stress (caution); ≥40 km/h high risk for outdoor ceremonies.
 */
export function evaluateOutdoorWeatherRisks(
  humidity: unknown,
  windSpeed: unknown
): WeatherRiskPill[] {
  const pills: WeatherRiskPill[] = [];
  const hum = typeof humidity === 'number' ? humidity : Number(humidity);
  const wind = parseWindKmh(windSpeed);

  if (Number.isFinite(hum)) {
    if (hum >= 75) {
      pills.push({
        id: 'humidity',
        label: 'Humidity',
        level: 'high',
        chip: 'High humidity',
        detail:
          `Humidity is ${Math.round(hum)}% (≥75%). Guests may feel sticky; fresh florals and paper stationery degrade faster. Prefer shaded or indoor backup for outdoor ceremonies.`,
      });
    } else if (hum >= 60) {
      pills.push({
        id: 'humidity',
        label: 'Humidity',
        level: 'caution',
        chip: 'Elevated humidity',
        detail:
          `Humidity is ${Math.round(hum)}% (60–74%). Mild discomfort and dew risk for seating/linens. Keep cooling, shade, and a covered contingency in the run-of-show.`,
      });
    }
  }

  if (wind !== null) {
    const rounded = Math.round(wind);
    if (wind >= 40) {
      pills.push({
        id: 'wind',
        label: 'Wind',
        level: 'high',
        chip: 'Strong wind',
        detail:
          `Wind ~${rounded} km/h (≥40). High risk for arches, canopies, candles, and AV. Strongly favor sheltered venues or postpone exposed outdoor segments.`,
      });
    } else if (wind >= 20) {
      pills.push({
        id: 'wind',
        label: 'Wind',
        level: 'caution',
        chip: 'Breezy',
        detail:
          `Wind ~${rounded} km/h (20–39). Napkins, veils, and lightweight décor can shift. Weight floral bases and secure fabrics for terrace or cliffside setups.`,
      });
    }
  }

  return pills;
}

export function formatStationCoordinates(lat: unknown, lng: unknown): string | null {
  const la = typeof lat === 'number' ? lat : Number(lat);
  const ln = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const ns = la >= 0 ? 'N' : 'S';
  const ew = ln >= 0 ? 'E' : 'W';
  return `${Math.abs(la).toFixed(4)}°${ns}, ${Math.abs(ln).toFixed(4)}°${ew}`;
}
