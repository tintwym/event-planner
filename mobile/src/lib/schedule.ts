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

export function itemHasConflict(itemId: string, conflicts: ScheduleConflict[]): boolean {
  return conflicts.some((c) => c.aId === itemId || c.bId === itemId);
}

export function sortItineraryChronologically(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return timeToMinutes(a.time) - timeToMinutes(b.time) || a.title.localeCompare(b.title);
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
