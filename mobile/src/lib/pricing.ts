import { ItineraryItem, StayItem, TransferItem } from '../types';

/** Deposit required to reserve a package (share of the grand total). */
export const DEPOSIT_PCT = 0.25;

export function stayLineTotal(stay: StayItem): number {
  const nights = Math.max(1, Math.round(stay.nights || 1));
  const rooms = Math.max(1, Math.round(stay.rooms || 1));
  const rate = Math.max(0, stay.ratePerNight || 0);
  return rate * nights * rooms;
}

export function transferLineTotal(transfer: TransferItem): number {
  return Math.max(0, Math.round(transfer.price || 0));
}

export function isExperience(item: ItineraryItem): boolean {
  return item.kind === 'experience';
}

export interface PackageTotals {
  eventsTotal: number;
  experiencesTotal: number;
  staysTotal: number;
  transfersTotal: number;
  grandTotal: number;
  depositPct: number;
  deposit: number;
  roomNights: number;
  eventCount: number;
  experienceCount: number;
  stayCount: number;
  transferCount: number;
  itemCount: number;
}

export function computePackageTotals(input: {
  itinerary: ItineraryItem[];
  stays: StayItem[];
  transfers: TransferItem[];
}): PackageTotals {
  const { itinerary, stays, transfers } = input;

  let eventsTotal = 0;
  let experiencesTotal = 0;
  let eventCount = 0;
  let experienceCount = 0;
  for (const item of itinerary) {
    if (isExperience(item)) {
      experiencesTotal += item.calculatedPrice;
      experienceCount += 1;
    } else {
      eventsTotal += item.calculatedPrice;
      eventCount += 1;
    }
  }

  let staysTotal = 0;
  let roomNights = 0;
  for (const stay of stays) {
    staysTotal += stayLineTotal(stay);
    roomNights += Math.max(1, Math.round(stay.nights || 1)) * Math.max(1, Math.round(stay.rooms || 1));
  }

  let transfersTotal = 0;
  for (const transfer of transfers) {
    transfersTotal += transferLineTotal(transfer);
  }

  const grandTotal = eventsTotal + experiencesTotal + staysTotal + transfersTotal;

  return {
    eventsTotal,
    experiencesTotal,
    staysTotal,
    transfersTotal,
    grandTotal,
    depositPct: DEPOSIT_PCT,
    deposit: Math.round(grandTotal * DEPOSIT_PCT),
    roomNights,
    eventCount,
    experienceCount,
    stayCount: stays.length,
    transferCount: transfers.length,
    itemCount: itinerary.length + stays.length + transfers.length,
  };
}
