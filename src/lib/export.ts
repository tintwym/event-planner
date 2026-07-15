import { ItineraryItem, StayItem, TransferItem } from '../types';
import { VENUES } from '../data/venues';
import { getRoomType } from '../data/stays';
import { getTransferMode } from '../data/transfers';
import { getTransit } from '../data/transit';
import { stayLineTotal, transferLineTotal } from './pricing';
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

function venueNameById(venueId: string): string {
  return VENUES.find((v) => v.id === venueId)?.name ?? venueId;
}

/** YYYY-MM-DD → YYYYMMDD for ICS DATE values */
function icsDateValue(isoDate: string): string {
  return isoDate.replace(/-/g, '');
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

export function buildIcsCalendar(
  plannerName: string,
  items: ItineraryItem[],
  stays: StayItem[] = [],
  transfers: TransferItem[] = []
): string {
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
    const kindLabel = item.kind === 'experience' ? 'Experience' : 'Event';
    const descriptionParts = [
      `Type: ${kindLabel} — ${item.category}`,
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

  for (const stay of stays) {
    const roomType = getRoomType(stay.roomTypeId);
    const venueName = venueNameById(stay.venueId);
    const nights = Math.max(1, Math.round(stay.nights || 1));
    const rooms = Math.max(1, Math.round(stay.rooms || 1));
    const checkOut = addDaysISO(stay.checkIn, nights);
    const descriptionParts = [
      `Stay: ${venueName}`,
      `Room: ${roomType?.name ?? stay.roomTypeId} × ${rooms}`,
      `Nights: ${nights} (check-out ${checkOut})`,
      `Guests: ${stay.guests}`,
      `Estimate: $${stayLineTotal(stay).toLocaleString()}`,
    ];
    if (stay.notes?.trim()) descriptionParts.push(`Notes: ${stay.notes.trim()}`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${stay.id}@villa-vale`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDateValue(stay.checkIn)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDateValue(checkOut)}`);
    lines.push(`SUMMARY:${escapeIcsText(`Stay · ${roomType?.name ?? 'Room'} at ${venueName}`)}`);
    lines.push(`LOCATION:${escapeIcsText(`${venueName} — Villa & Vale, Amalfi Coast`)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);
    lines.push('END:VEVENT');
  }

  for (const transfer of transfers) {
    const modeInfo = getTransferMode(transfer.mode);
    const transit = getTransit(transfer.fromVenueId, transfer.toVenueId);
    const fromName = venueNameById(transfer.fromVenueId);
    const toName = venueNameById(transfer.toVenueId);
    const start = timeToMinutes(transfer.time);
    const end = start + transit.minutes;
    const descriptionParts = [
      `Transfer: ${fromName} → ${toName}`,
      `Mode: ${modeInfo.label}`,
      `Drive: ${transit.duration} (${transit.distance})`,
      `Passengers: ${transfer.pax}`,
      `Estimate: $${transferLineTotal(transfer).toLocaleString()}`,
    ];
    if (transfer.notes?.trim()) descriptionParts.push(`Notes: ${transfer.notes.trim()}`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${transfer.id}@villa-vale`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;TZID=${ICS_TZID}:${toIcsLocal(transfer.date, start)}`);
    lines.push(`DTEND;TZID=${ICS_TZID}:${toIcsLocal(transfer.date, end)}`);
    lines.push(`SUMMARY:${escapeIcsText(`Transfer · ${fromName} → ${toName} (${modeInfo.label})`)}`);
    lines.push(`LOCATION:${escapeIcsText(`${fromName} → ${toName} — Amalfi Coast`)}`);
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

export function downloadIcs(
  plannerName: string,
  items: ItineraryItem[],
  stays: StayItem[] = [],
  transfers: TransferItem[] = []
) {
  const safeName = plannerName.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'villa-vale-agenda';
  const ics = buildIcsCalendar(plannerName, items, stays, transfers);
  downloadTextFile(`${safeName}.ics`, ics, 'text/calendar;charset=utf-8');
}

export function buildAgendaPlainText(
  plannerName: string,
  items: ItineraryItem[],
  stays: StayItem[] = [],
  transfers: TransferItem[] = []
): string {
  const sorted = [...items].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return timeToMinutes(a.time) - timeToMinutes(b.time);
  });

  const eventsTotal = sorted.reduce((sum, i) => sum + i.calculatedPrice, 0);
  const staysTotal = stays.reduce((sum, s) => sum + stayLineTotal(s), 0);
  const transfersTotal = transfers.reduce((sum, t) => sum + transferLineTotal(t), 0);
  const total = eventsTotal + staysTotal + transfersTotal;

  const lines: string[] = [
    'Villa & Vale — Package Agenda',
    plannerName,
    `Generated: ${new Date().toLocaleString()}`,
    `Timezone: ${ICS_TZID}`,
    `Estimated total: $${total.toLocaleString()}`,
    '',
  ];

  if (sorted.length > 0) {
    lines.push('— Events & Experiences —');
    for (const item of sorted) {
      const mins = getItemDurationMinutes(item);
      const hoursLabel = mins % 60 === 0 ? `${mins / 60}h` : `${(mins / 60).toFixed(1)}h`;
      const kindLabel = item.kind === 'experience' ? 'Experience' : item.category;
      lines.push(`${formatDisplayDate(item.date)} · ${item.time} (~${hoursLabel})`);
      lines.push(`${item.title} @ ${venueLabel(item)}`);
      lines.push(`${kindLabel} · ${item.guests} guests · $${item.calculatedPrice.toLocaleString()}`);
      if (item.notes.trim()) lines.push(`Notes: ${item.notes.trim()}`);
      lines.push('');
    }
  }

  if (stays.length > 0) {
    lines.push('— Stays —');
    const sortedStays = [...stays].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    for (const stay of sortedStays) {
      const roomType = getRoomType(stay.roomTypeId);
      const nights = Math.max(1, Math.round(stay.nights || 1));
      const rooms = Math.max(1, Math.round(stay.rooms || 1));
      const checkOut = addDaysISO(stay.checkIn, nights);
      lines.push(`${formatDisplayDate(stay.checkIn)} → ${formatDisplayDate(checkOut)} (${nights} night${nights === 1 ? '' : 's'})`);
      lines.push(`${roomType?.name ?? 'Room'} × ${rooms} @ ${venueNameById(stay.venueId)}`);
      lines.push(`${stay.guests} guests · $${stayLineTotal(stay).toLocaleString()}`);
      if (stay.notes?.trim()) lines.push(`Notes: ${stay.notes.trim()}`);
      lines.push('');
    }
  }

  if (transfers.length > 0) {
    lines.push('— Transfers —');
    const sortedTransfers = [...transfers].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    });
    for (const transfer of sortedTransfers) {
      const modeInfo = getTransferMode(transfer.mode);
      const transit = getTransit(transfer.fromVenueId, transfer.toVenueId);
      lines.push(`${formatDisplayDate(transfer.date)} · ${transfer.time}`);
      lines.push(`${venueNameById(transfer.fromVenueId)} → ${venueNameById(transfer.toVenueId)} (${modeInfo.label})`);
      lines.push(`${transit.duration} · ${transfer.pax} pax · $${transferLineTotal(transfer).toLocaleString()}`);
      if (transfer.notes?.trim()) lines.push(`Notes: ${transfer.notes.trim()}`);
      lines.push('');
    }
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
  stays?: StayItem[];
  transfers?: TransferItem[];
  total: number;
  deposit?: number;
}

const MAILTO_SAFE_LIMIT = 1800;

export function buildInquiryPackageText(payload: InquiryPayload): string {
  return [
    `Inquiry from ${payload.name} <${payload.email}>`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.message?.trim() ? `Message:\n${payload.message.trim()}` : null,
    '',
    '--- Package ---',
    buildAgendaPlainText(payload.plannerName, payload.items, payload.stays, payload.transfers),
    `Grand total estimate: $${payload.total.toLocaleString()}`,
    typeof payload.deposit === 'number'
      ? `Reservation deposit (25%): $${payload.deposit.toLocaleString()}`
      : null,
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

  const lineCount =
    payload.items.length + (payload.stays?.length ?? 0) + (payload.transfers?.length ?? 0);
  const shortBody = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    '',
    payload.message?.trim() || null,
    '',
    `Package: ${lineCount} items · est. $${payload.total.toLocaleString()}`,
    '(Full package was copied to your clipboard — please paste it below.)',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    href: `mailto:${toAddress}?subject=${subject}&body=${encodeURIComponent(shortBody)}`,
    truncated: true,
  };
}
