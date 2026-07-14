import { EventCategory, ItineraryItem } from '../types';
import { getTransit } from '../data/transit';

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

export function defaultDurationMinutes(category: EventCategory): number {
  return Math.round(defaultDurationHours(category) * 60);
}

/** Prefer item.durationMinutes, else category default */
export function getItemDurationMinutes(item: ItineraryItem): number {
  if (
    typeof item.durationMinutes === 'number' &&
    Number.isFinite(item.durationMinutes) &&
    item.durationMinutes > 0
  ) {
    return Math.round(item.durationMinutes);
  }
  return defaultDurationMinutes(item.category);
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
  const end = start + getItemDurationMinutes(item);
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

export interface TransitGap {
  fromId: string;
  toId: string;
  fromTitle: string;
  toTitle: string;
  date: string;
  travelMinutes: number;
  availableMinutes: number;
  travelLabel: string;
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

/** Same physical venue overlaps (by venueId), including overnight spill */
export function findConflicts(items: ItineraryItem[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const byVenue = new Map<string, TimedSlot[]>();

  for (const item of items) {
    if (!item.venueId) continue;
    const day = dateToEpochDay(item.date);
    const { start, end } = getItemWindow(item);
    const slot: TimedSlot = {
      item,
      absStart: day * 24 * 60 + start,
      absEnd: day * 24 * 60 + end,
    };
    const list = byVenue.get(item.venueId) ?? [];
    list.push(slot);
    byVenue.set(item.venueId, list);
  }

  for (const [, group] of byVenue) {
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

/** Consecutive same-day venue changes with insufficient drive time */
export function findTransitGaps(items: ItineraryItem[]): TransitGap[] {
  const gaps: TransitGap[] = [];
  const byDate = new Map<string, ItineraryItem[]>();

  for (const item of items) {
    if (!item.venueId) continue;
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }

  for (const [date, dayItems] of byDate) {
    const sorted = [...dayItems].sort(
      (a, b) =>
        timeToMinutes(a.time) - timeToMinutes(b.time) || a.id.localeCompare(b.id)
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i];
      const to = sorted[i + 1];
      if (!from.venueId || !to.venueId || from.venueId === to.venueId) continue;
      const { end: fromEnd } = getItemWindow(from);
      const toStart = timeToMinutes(to.time);
      // If next starts before prior ends, venue conflict already covers same venue;
      // for travel, measure gap from prior end to next start (may be negative).
      const available = toStart - fromEnd;
      const transit = getTransit(from.venueId, to.venueId);
      if (available < transit.minutes) {
        gaps.push({
          fromId: from.id,
          toId: to.id,
          fromTitle: from.title,
          toTitle: to.title,
          date,
          travelMinutes: transit.minutes,
          availableMinutes: available,
          travelLabel: transit.duration,
        });
      }
    }
  }

  return gaps;
}

export function itemHasTransitGap(itemId: string, gaps: TransitGap[]): boolean {
  return gaps.some((g) => g.fromId === itemId || g.toId === itemId);
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidTimeHM(value: string): boolean {
  return TIME_HM.test(value);
}

export function parseISODateToDate(value: string): Date {
  if (!isValidISODate(value)) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateToISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseTimeToDate(value: string, base = new Date()): Date {
  const d = new Date(base);
  if (!isValidTimeHM(value)) {
    d.setHours(14, 0, 0, 0);
    return d;
  }
  const [h, m] = value.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function dateToTimeHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
