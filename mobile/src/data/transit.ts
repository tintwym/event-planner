/** Coastal drive estimates between Amalfi venues (display labels + minutes) */

export type TransitInfo = { distance: string; duration: string; minutes: number };

export const TRANSIT_MATRIX: Record<string, Record<string, TransitInfo>> = {
  v1: {
    v2: { distance: '22 km', duration: '45 mins', minutes: 45 },
    v3: { distance: '31 km', duration: '1 hr', minutes: 60 },
    h1: { distance: '2.5 km', duration: '8 mins', minutes: 8 },
    h2: { distance: '20 km', duration: '40 mins', minutes: 40 },
    h3: { distance: '29 km', duration: '55 mins', minutes: 55 },
  },
  v2: {
    v1: { distance: '22 km', duration: '45 mins', minutes: 45 },
    v3: { distance: '16 km', duration: '35 mins', minutes: 35 },
    h1: { distance: '21 km', duration: '40 mins', minutes: 40 },
    h2: { distance: '4 km', duration: '12 mins', minutes: 12 },
    h3: { distance: '15 km', duration: '30 mins', minutes: 30 },
  },
  v3: {
    v1: { distance: '31 km', duration: '1 hr', minutes: 60 },
    v2: { distance: '16 km', duration: '35 mins', minutes: 35 },
    h1: { distance: '30 km', duration: '55 mins', minutes: 55 },
    h2: { distance: '15 km', duration: '30 mins', minutes: 30 },
    h3: { distance: '1.2 km', duration: '5 mins', minutes: 5 },
  },
  h1: {
    v1: { distance: '2.5 km', duration: '8 mins', minutes: 8 },
    v2: { distance: '21 km', duration: '40 mins', minutes: 40 },
    v3: { distance: '30 km', duration: '55 mins', minutes: 55 },
    h2: { distance: '19 km', duration: '38 mins', minutes: 38 },
    h3: { distance: '28 km', duration: '50 mins', minutes: 50 },
  },
  h2: {
    v1: { distance: '20 km', duration: '40 mins', minutes: 40 },
    v2: { distance: '4 km', duration: '12 mins', minutes: 12 },
    v3: { distance: '15 km', duration: '30 mins', minutes: 30 },
    h1: { distance: '19 km', duration: '38 mins', minutes: 38 },
    h3: { distance: '14 km', duration: '28 mins', minutes: 28 },
  },
  h3: {
    v1: { distance: '29 km', duration: '55 mins', minutes: 55 },
    v2: { distance: '15 km', duration: '30 mins', minutes: 30 },
    v3: { distance: '1.2 km', duration: '5 mins', minutes: 5 },
    h1: { distance: '28 km', duration: '50 mins', minutes: 50 },
    h2: { distance: '14 km', duration: '28 mins', minutes: 28 },
  },
};

export function getTransit(fromId: string, toId: string): TransitInfo {
  return (
    TRANSIT_MATRIX[fromId]?.[toId] ?? {
      distance: '10 km',
      duration: '20 mins',
      minutes: 20,
    }
  );
}
