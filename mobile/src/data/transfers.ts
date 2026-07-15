import { TransferMode } from '../types';
import { getTransit } from './transit';

export interface TransferModeInfo {
  id: TransferMode;
  label: string;
  /** Seats per vehicle — parties larger than this need multiple vehicles */
  capacity: number;
  /** Flat dispatch/base fee per vehicle */
  base: number;
  /** Marginal cost per minute of travel per vehicle */
  perMinute: number;
  note: string;
}

export const TRANSFER_MODES: TransferModeInfo[] = [
  {
    id: 'sedan',
    label: 'Chauffeured Sedan',
    capacity: 3,
    base: 120,
    perMinute: 3.5,
    note: 'Mercedes S-Class or equivalent, private driver',
  },
  {
    id: 'van',
    label: 'Luxury Van',
    capacity: 7,
    base: 180,
    perMinute: 4.5,
    note: 'Mercedes V-Class for larger parties & luggage',
  },
  {
    id: 'yacht',
    label: 'Private Yacht Transfer',
    capacity: 12,
    base: 1500,
    perMinute: 20,
    note: 'Scenic coastal sea transfer, weather permitting',
  },
  {
    id: 'helicopter',
    label: 'Helicopter',
    capacity: 5,
    base: 3500,
    perMinute: 60,
    note: 'Fastest point-to-point, panoramic coastal flight',
  },
];

export function getTransferMode(id: TransferMode): TransferModeInfo {
  return TRANSFER_MODES.find((m) => m.id === id) ?? TRANSFER_MODES[0];
}

/** Vehicles required to move `pax` guests with a given mode. */
export function transferVehicleCount(mode: TransferMode, pax: number): number {
  const info = getTransferMode(mode);
  return Math.max(1, Math.ceil(Math.max(1, pax) / info.capacity));
}

/** Deterministic transfer estimate: (base + perMinute × drive) × vehicles. */
export function priceTransfer(
  fromId: string,
  toId: string,
  mode: TransferMode,
  pax: number
): number {
  const info = getTransferMode(mode);
  const transit = getTransit(fromId, toId);
  const vehicles = transferVehicleCount(mode, pax);
  return Math.round((info.base + info.perMinute * transit.minutes) * vehicles);
}
