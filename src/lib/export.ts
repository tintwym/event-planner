import { ItineraryItem } from '../types';
import { VENUES } from '../data/venues';
import {
  addDaysISO,
  formatDisplayDate,
  getItemDurationMinutes,
  getItemWindow,
  timeToMinutes,
} from './schedule';

const ICS_TZID = 'Europe/Rome';

function venueLabel(item: ItineraryItem): string {
  const venue = item.venueId ? VENUES.find((v) => v.id === item.venueId) : undefined;
  return venue ? `${venue.name} (${item.location})` : item.location;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local wall time in Europe/Rome floating form YYYYMMDDTHHMMSS (paired with TZID) */
function toIcsLocal(date: string, minutesFromMidnight: number): string {
  const dayOffset = Math.floor(minutesFromMidnight / (24 * 60));
  const mins = ((minutesFromMidnight % (24 * 60)) + 24 * 60) % (24 * 60);
  const targetDate = dayOffset === 0 ? date : addDaysISO(date, dayOffset);
  const [y, mo, d] = targetDate.split('-');
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${y}${mo}${d}T${pad(h)}${pad(m)}00`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545 fold on UTF-8 octets without splitting code points */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const budget = first ? 75 : 74;
    let end = Math.min(offset + budget, bytes.length);
    if (end < bytes.length) {
      while (end > offset && (bytes[end] & 0xc0) === 0x80) end--;
      if (end > offset && bytes[end] >= 0xc0) {
        // ending on a lead byte with incomplete trail — exclude the lead
        end--;
        while (end > offset && (bytes[end] & 0xc0) === 0x80) end--;
      }
    }
    if (end <= offset) end = Math.min(offset + 1, bytes.length);
    const chunk = decoder.decode(bytes.subarray(offset, end));
    parts.push(first ? chunk : ` ${chunk}`);
    offset = end;
    first = false;
  }
  return parts.join('\r\n');
}

/** Minimal Europe/Rome VTIMEZONE (CET / CEST) for calendar clients */
function europeRomeVTimezone(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${ICS_TZID}`,
    'X-LIC-LOCATION:Europe/Rome',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

export function buildIcsCalendar(plannerName: string, items: ItineraryItem[]): string {
  const stamp = new Date();
  const dtStamp = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Villa & Vale//Event Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(plannerName)}`,
    `X-WR-TIMEZONE:${ICS_TZID}`,
    ...europeRomeVTimezone(),
  ];

  for (const item of items) {
    const { start, end } = getItemWindow(item);
    const descriptionParts = [
      `Category: ${item.category}`,
      `Venue: ${venueLabel(item)}`,
      `Guests: ${item.guests}`,
      `Estimate: $${item.calculatedPrice.toLocaleString()}`,
    ];
    if (item.notes.trim()) descriptionParts.push(`Notes: ${item.notes.trim()}`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.id}@villa-vale`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;TZID=${ICS_TZID}:${toIcsLocal(item.date, start)}`);
    lines.push(`DTEND;TZID=${ICS_TZID}:${toIcsLocal(item.date, end)}`);
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
    lines.push(`LOCATION:${escapeIcsText(`${venueLabel(item)} — Villa & Vale, Amalfi Coast`)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadIcs(plannerName: string, items: ItineraryItem[]) {
  const safeName = plannerName.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'villa-vale-agenda';
  const ics = buildIcsCalendar(plannerName, items);
  downloadTextFile(`${safeName}.ics`, ics, 'text/calendar;charset=utf-8');
}

export function buildAgendaPlainText(plannerName: string, items: ItineraryItem[]): string {
  const sorted = [...items].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return timeToMinutes(a.time) - timeToMinutes(b.time);
  });

  const total = sorted.reduce((sum, i) => sum + i.calculatedPrice, 0);
  const lines: string[] = [
    'Villa & Vale — Event Agenda',
    plannerName,
    `Generated: ${new Date().toLocaleString()}`,
    `Timezone: ${ICS_TZID}`,
    `Estimated total: $${total.toLocaleString()}`,
    '',
  ];

  for (const item of sorted) {
    const mins = getItemDurationMinutes(item);
    const hoursLabel = mins % 60 === 0 ? `${mins / 60}h` : `${(mins / 60).toFixed(1)}h`;
    lines.push(`${formatDisplayDate(item.date)} · ${item.time} (~${hoursLabel})`);
    lines.push(`${item.title} @ ${venueLabel(item)}`);
    lines.push(`${item.category} · ${item.guests} guests · $${item.calculatedPrice.toLocaleString()}`);
    if (item.notes.trim()) lines.push(`Notes: ${item.notes.trim()}`);
    lines.push('');
  }

  return lines.join('\n');
}

export interface InquiryPayload {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  plannerName: string;
  items: ItineraryItem[];
  total: number;
}

const MAILTO_SAFE_LIMIT = 1800;

export function buildInquiryPackageText(payload: InquiryPayload): string {
  return [
    `Inquiry from ${payload.name} <${payload.email}>`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.message?.trim() ? `Message:\n${payload.message.trim()}` : null,
    '',
    '--- Agenda ---',
    buildAgendaPlainText(payload.plannerName, payload.items),
    `Grand total estimate: $${payload.total.toLocaleString()}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/**
 * Build mailto URL. If body would exceed safe URL length, use a short body
 * and return `truncated: true` so the UI can copy the full package instead.
 */
export function buildInquiryMailto(
  payload: InquiryPayload,
  toAddress = 'events@villaandvale.com'
): { href: string; truncated: boolean } {
  const subject = encodeURIComponent(`Inquiry: ${payload.plannerName} — Villa & Vale`);
  const fullBody = buildInquiryPackageText(payload);
  const encodedFull = encodeURIComponent(fullBody);
  const baseLen = `mailto:${toAddress}?subject=${subject}&body=`.length;

  if (baseLen + encodedFull.length <= MAILTO_SAFE_LIMIT) {
    return { href: `mailto:${toAddress}?subject=${subject}&body=${encodedFull}`, truncated: false };
  }

  const shortBody = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    '',
    payload.message?.trim() || null,
    '',
    `Agenda: ${payload.items.length} items · est. $${payload.total.toLocaleString()}`,
    '(Full agenda was copied to your clipboard — please paste it below.)',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    href: `mailto:${toAddress}?subject=${subject}&body=${encodeURIComponent(shortBody)}`,
    truncated: true,
  };
}
