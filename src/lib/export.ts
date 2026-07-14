import { ItineraryItem } from '../types';
import {
  addDaysISO,
  defaultDurationHours,
  formatDisplayDate,
  getItemWindow,
  timeToMinutes,
} from './schedule';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local wall time → ICS floating local datetime YYYYMMDDTHHMMSS */
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

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
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
  ];

  for (const item of items) {
    const { start, end } = getItemWindow(item);
    const descriptionParts = [
      `Category: ${item.category}`,
      `Venue: ${item.location}`,
      `Guests: ${item.guests}`,
      `Estimate: $${item.calculatedPrice.toLocaleString()}`,
    ];
    if (item.notes.trim()) descriptionParts.push(`Notes: ${item.notes.trim()}`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.id}@villa-vale`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${toIcsLocal(item.date, start)}`);
    lines.push(`DTEND:${toIcsLocal(item.date, end)}`);
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
    lines.push(`LOCATION:${escapeIcsText(`${item.location} — Villa & Vale`)}`);
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
    `Estimated total: $${total.toLocaleString()}`,
    '',
  ];

  for (const item of sorted) {
    const hours = defaultDurationHours(item.category);
    lines.push(`${formatDisplayDate(item.date)} · ${item.time} (~${hours}h)`);
    lines.push(`${item.title} @ ${item.location}`);
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
