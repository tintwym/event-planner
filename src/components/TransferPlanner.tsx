import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Car, ArrowRight, Users, Calendar, Clock, Plus, Sparkles } from 'lucide-react';
import { TransferItem, TransferMode } from '../types';
import { VENUES } from '../data/venues';
import { TRANSFER_MODES, getTransferMode, priceTransfer } from '../data/transfers';
import { getTransit } from '../data/transit';

interface TransferPlannerProps {
  onAddTransfer: (transfer: Omit<TransferItem, 'id'>) => void;
  onAutoSuggest: () => void;
  suggestionCount: number;
}

function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function TransferPlanner({
  onAddTransfer,
  onAutoSuggest,
  suggestionCount,
}: TransferPlannerProps) {
  const [fromVenueId, setFromVenueId] = useState(VENUES[0]?.id ?? '');
  const [toVenueId, setToVenueId] = useState(VENUES[1]?.id ?? '');
  const [mode, setMode] = useState<TransferMode>('sedan');
  const [date, setDate] = useState(localTodayISO);
  const [time, setTime] = useState('12:00');
  const [pax, setPax] = useState(2);
  const [success, setSuccess] = useState(false);
  const [sameVenueError, setSameVenueError] = useState(false);
  const successTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const sameVenue = fromVenueId === toVenueId;
  const transit = sameVenue ? null : getTransit(fromVenueId, toVenueId);
  const modeInfo = getTransferMode(mode);
  const previewPrice = sameVenue ? 0 : priceTransfer(fromVenueId, toVenueId, mode, pax);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sameVenue) {
      setSameVenueError(true);
      return;
    }
    setSameVenueError(false);
    onAddTransfer({
      fromVenueId,
      toVenueId,
      mode,
      date,
      time,
      pax: Math.max(1, pax),
      price: priceTransfer(fromVenueId, toVenueId, mode, Math.max(1, pax)),
    });
    setSuccess(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg"
      id="transfer-planner-panel"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-gold-premium/10 rounded-lg">
          <Car className="w-4 h-4 text-gold-premium" aria-hidden="true" />
        </div>
        <div>
          <h4 className="font-serif font-bold text-dark-text-primary leading-none">Add Transfer</h4>
          <p className="text-[11px] text-dark-text-tertiary mt-0.5 uppercase tracking-wider font-semibold">
            Coastal drives, yacht &amp; helicopter transfers
          </p>
        </div>
      </div>

      {suggestionCount > 0 && (
        <button
          type="button"
          onClick={onAutoSuggest}
          className="w-full mb-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-gold-premium/40 text-gold-premium hover:bg-gold-premium/10"
          id="transfer-autosuggest-btn"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Auto-add {suggestionCount} transfer
          {suggestionCount === 1 ? '' : 's'} between my venues
        </button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="transfer-from-select"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              From
            </label>
            <select
              value={fromVenueId}
              onChange={(e) => setFromVenueId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
              id="transfer-from-select"
            >
              {VENUES.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#121212] text-dark-text-primary">
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="transfer-to-select"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              To
            </label>
            <select
              value={toVenueId}
              onChange={(e) => setToVenueId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
              id="transfer-to-select"
            >
              {VENUES.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#121212] text-dark-text-primary">
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="transfer-mode-select"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Vehicle
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as TransferMode)}
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
            id="transfer-mode-select"
          >
            {TRANSFER_MODES.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#121212] text-dark-text-primary">
                {m.label} (up to {m.capacity})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-dark-text-tertiary mt-1 italic leading-snug">{modeInfo.note}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label
              htmlFor="transfer-date-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <Calendar className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Date
            </label>
            <input
              type="date"
              min={localTodayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="transfer-date-input"
            />
          </div>
          <div>
            <label
              htmlFor="transfer-time-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <Clock className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-2 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="transfer-time-input"
            />
          </div>
          <div>
            <label
              htmlFor="transfer-pax-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <Users className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Pax
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={pax}
              onChange={(e) => setPax(Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-full px-2 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-mono font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="transfer-pax-input"
            />
          </div>
        </div>

        <p className="text-[11px] font-mono text-dark-text-secondary flex flex-wrap items-center gap-1.5">
          <ArrowRight className="w-3 h-3 text-gold-premium" aria-hidden="true" />
          {sameVenue ? (
            <span className="text-rose-500">Choose two different venues</span>
          ) : (
            <>
              {transit?.duration} · {transit?.distance} ={' '}
              <span className="text-gold-premium font-bold">${previewPrice.toLocaleString()}</span>
            </>
          )}
        </p>

        <AnimatePresence>
          {sameVenueError && sameVenue && (
            <motion.p
              key="transfer-err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-rose-500 font-semibold"
              role="alert"
            >
              Origin and destination must be different venues.
            </motion.p>
          )}
          {success && (
            <motion.div
              key="transfer-success"
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              role="status"
              aria-live="polite"
              className="text-center text-xs text-emerald-500 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg overflow-hidden"
            >
              Transfer added to your package!
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={sameVenue}
          className="w-full py-2.5 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          id="transfer-submit-btn"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Transfer
        </motion.button>
      </form>
    </motion.div>
  );
}
