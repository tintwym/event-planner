import { EventCategory, ItineraryItem } from '../types';

/** Default event length used for overlap detection when duration is not stored */
export function defaultDurationHours(category: EventCategory): number {
  switch (category) {
    case 'Weddings':
      return 3;
    case 'Dinners':
      return 2.5;
    case 'Activities':
    default:
      return 2;
  }
}

/** Parse "HH:MM" into minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const clamped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Absolute window as minutes from an epoch day 0 = item.date */
export function getItemWindow(item: ItineraryItem): {
  start: number;
  end: number;
  crossesMidnight: boolean;
} {
  const start = timeToMinutes(item.time);
  const end = start + Math.round(defaultDurationHours(item.category) * 60);
  return { start, end, crossesMidnight: end >= 24 * 60 };
}

export function formatTimeRange(item: ItineraryItem): string {
  const { start, end, crossesMidnight } = getItemWindow(item);
  const endLabel = formatMinutes(end);
  return crossesMidnight
    ? `${formatMinutes(start)}–${endLabel} (+1 day)`
    : `${formatMinutes(start)}–${endLabel}`;
}

/** Shift YYYY-MM-DD by whole days in local calendar math */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export interface ScheduleConflict {
  aId: string;
  bId: string;
  aTitle: string;
  bTitle: string;
  date: string;
  location: string;
}

type TimedSlot = {
  item: ItineraryItem;
  /** Absolute minutes from a shared epoch for sorting/overlap */
  absStart: number;
  absEnd: number;
};

function dateToEpochDay(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Same-venue overlaps, including overnight spill into the next calendar day */
export function findConflicts(items: ItineraryItem[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const byLocation = new Map<string, TimedSlot[]>();

  for (const item of items) {
    const day = dateToEpochDay(item.date);
    const { start, end } = getItemWindow(item);
    const slot: TimedSlot = {
      item,
      absStart: day * 24 * 60 + start,
      absEnd: day * 24 * 60 + end,
    };
    const list = byLocation.get(item.location) ?? [];
    list.push(slot);
    byLocation.set(item.location, list);
  }

  for (const [, group] of byLocation) {
    const sorted = [...group].sort(
      (a, b) => a.absStart - b.absStart || a.item.id.localeCompare(b.item.id)
    );
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (a.absStart < b.absEnd && b.absStart < a.absEnd) {
          conflicts.push({
            aId: a.item.id,
            bId: b.item.id,
            aTitle: a.item.title,
            bTitle: b.item.title,
            date: a.item.date,
            location: a.item.location,
          });
        }
      }
    }
  }

  return conflicts;
}

export function conflictedItemCount(conflicts: ScheduleConflict[]): number {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.aId);
    ids.add(c.bId);
  }
  return ids.size;
}

export function itemHasConflict(itemId: string, conflicts: ScheduleConflict[]): boolean {
  return conflicts.some((c) => c.aId === itemId || c.bId === itemId);
}

export type DayGroup = {
  date: string;
  items: ItineraryItem[];
};

export function groupByDate(items: ItineraryItem[]): DayGroup[] {
  const map = new Map<string, ItineraryItem[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayItems]) => ({
      date,
      items: [...dayItems].sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || a.title.localeCompare(b.title)
      ),
    }));
}

export function sortItineraryChronologically(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return timeToMinutes(a.time) - timeToMinutes(b.time) || a.title.localeCompare(b.title);
  });
}

export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
