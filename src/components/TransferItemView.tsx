import React from 'react';
import { motion } from 'motion/react';
import { Car, ArrowRight, Users, Calendar, Clock, Trash2, Navigation } from 'lucide-react';
import { TransferItem, TransferMode } from '../types';
import { VENUES } from '../data/venues';
import { TRANSFER_MODES, getTransferMode } from '../data/transfers';
import { getTransit } from '../data/transit';
import { transferLineTotal } from '../lib/pricing';

interface TransferItemViewProps {
  transfer: TransferItem;
  onUpdate: (id: string, patch: Partial<TransferItem>) => void;
  onRemove: (id: string) => void;
  key?: string | number;
}

function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function TransferItemView({ transfer, onUpdate, onRemove }: TransferItemViewProps) {
  const fromVenue = VENUES.find((v) => v.id === transfer.fromVenueId);
  const toVenue = VENUES.find((v) => v.id === transfer.toVenueId);
  const modeInfo = getTransferMode(transfer.mode);
  const transit = getTransit(transfer.fromVenueId, transfer.toVenueId);
  const today = localTodayISO();
  const minDate = transfer.date < today ? transfer.date : today;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="bg-dark-card border border-dark-border rounded-xl p-4 shadow-md relative"
      id={`transfer-item-${transfer.id}`}
    >
      <button
        type="button"
        onClick={() => onRemove(transfer.id)}
        className="absolute top-4 right-4 text-dark-text-tertiary hover:text-rose-400 hover:bg-rose-950/30 p-1.5 rounded-lg transition-colors cursor-pointer"
        title="Remove transfer"
        aria-label="Remove transfer"
        id={`remove-transfer-btn-${transfer.id}`}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="flex flex-wrap items-center gap-2 mb-3 pr-8">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/25">
          <Car className="w-3 h-3" aria-hidden="true" /> Transfer
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-dark-text-secondary">
          <Navigation className="w-3 h-3 text-gold-premium" aria-hidden="true" />
          {transit.duration} · {transit.distance}
        </span>
      </div>

      <h4 className="font-serif font-bold text-dark-text-primary tracking-tight leading-tight pr-8 mb-4 flex flex-wrap items-center gap-1.5">
        {fromVenue?.name ?? 'Origin'}
        <ArrowRight className="w-4 h-4 text-gold-premium" aria-hidden="true" />
        {toVenue?.name ?? 'Destination'}
      </h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="col-span-2 sm:col-span-1">
          <label
            htmlFor={`transfer-mode-${transfer.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Car className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Vehicle
          </label>
          <select
            value={transfer.mode}
            onChange={(e) => onUpdate(transfer.id, { mode: e.target.value as TransferMode })}
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
            id={`transfer-mode-${transfer.id}`}
          >
            {TRANSFER_MODES.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#121212] text-dark-text-primary">
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`transfer-date-${transfer.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Calendar className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Date
          </label>
          <input
            type="date"
            min={minDate}
            value={transfer.date}
            onChange={(e) => onUpdate(transfer.id, { date: e.target.value })}
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
            id={`transfer-date-${transfer.id}`}
          />
        </div>
        <div>
          <label
            htmlFor={`transfer-time-${transfer.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Clock className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Time
          </label>
          <input
            type="time"
            value={transfer.time}
            onChange={(e) => onUpdate(transfer.id, { time: e.target.value })}
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
            id={`transfer-time-${transfer.id}`}
          />
        </div>
        <div>
          <label
            htmlFor={`transfer-pax-${transfer.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Users className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Pax
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={transfer.pax}
            onChange={(e) =>
              onUpdate(transfer.id, { pax: Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 1)) })
            }
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium font-mono"
            id={`transfer-pax-${transfer.id}`}
          />
        </div>
      </div>

      <div className="bg-dark-bg p-2.5 rounded-lg border border-dark-border flex items-center justify-between text-xs font-mono">
        <div className="text-dark-text-secondary text-[11px]">{modeInfo.label}</div>
        <div className="font-bold text-dark-text-secondary">
          Total:{' '}
          <span className="text-gold-premium font-bold">
            ${transferLineTotal(transfer).toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
