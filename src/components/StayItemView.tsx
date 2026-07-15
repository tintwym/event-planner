import React from 'react';
import { motion } from 'motion/react';
import { BedDouble, Moon, Users, Calendar, Trash2, MapPin } from 'lucide-react';
import { StayItem } from '../types';
import { VENUES } from '../data/venues';
import { getRoomType } from '../data/stays';
import { stayLineTotal } from '../lib/pricing';
import { addDaysISO, formatDisplayDate } from '../lib/schedule';

interface StayItemViewProps {
  stay: StayItem;
  onUpdate: (id: string, patch: Partial<StayItem>) => void;
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

export default function StayItemView({ stay, onUpdate, onRemove }: StayItemViewProps) {
  const venue = VENUES.find((v) => v.id === stay.venueId);
  const roomType = getRoomType(stay.roomTypeId);
  const nights = Math.max(1, Math.round(stay.nights || 1));
  const rooms = Math.max(1, Math.round(stay.rooms || 1));
  const maxRooms = roomType?.count ?? 99;
  const maxGuests = roomType ? roomType.sleeps * rooms : 99;
  const checkOut = addDaysISO(stay.checkIn, nights);
  const today = localTodayISO();
  const minDate = stay.checkIn < today ? stay.checkIn : today;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="bg-dark-card border border-dark-border rounded-xl p-4 shadow-md relative"
      id={`stay-item-${stay.id}`}
    >
      <button
        type="button"
        onClick={() => onRemove(stay.id)}
        className="absolute top-4 right-4 text-dark-text-tertiary hover:text-rose-400 hover:bg-rose-950/30 p-1.5 rounded-lg transition-colors cursor-pointer"
        title="Remove stay"
        aria-label={`Remove stay at ${venue?.name ?? 'venue'}`}
        id={`remove-stay-btn-${stay.id}`}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="flex flex-wrap items-center gap-2 mb-3 pr-8">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
          <BedDouble className="w-3 h-3" aria-hidden="true" /> Stay
        </span>
        <span className="inline-flex items-center gap-1 bg-dark-bg text-dark-text-secondary border border-dark-border text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
          <MapPin className="w-3 h-3 text-gold-premium" aria-hidden="true" />
          {venue?.name ?? 'Venue'}
        </span>
      </div>

      <h4 className="font-serif font-bold text-dark-text-primary tracking-tight leading-tight pr-8 mb-1">
        {roomType?.name ?? 'Room'}
      </h4>
      <p className="text-[11px] text-dark-text-tertiary font-mono mb-4">
        {formatDisplayDate(stay.checkIn)} → {formatDisplayDate(checkOut)}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label
            htmlFor={`stay-checkin-${stay.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Calendar className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Check-in
          </label>
          <input
            type="date"
            min={minDate}
            value={stay.checkIn}
            onChange={(e) => onUpdate(stay.id, { checkIn: e.target.value })}
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
            id={`stay-checkin-${stay.id}`}
          />
        </div>
        <div>
          <label
            htmlFor={`stay-nights-${stay.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Moon className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Nights
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={nights}
            onChange={(e) =>
              onUpdate(stay.id, { nights: Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 1)) })
            }
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium font-mono"
            id={`stay-nights-${stay.id}`}
          />
        </div>
        <div>
          <label
            htmlFor={`stay-rooms-${stay.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <BedDouble className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Rooms
          </label>
          <input
            type="number"
            min={1}
            max={maxRooms}
            value={rooms}
            onChange={(e) =>
              onUpdate(stay.id, { rooms: Math.min(maxRooms, Math.max(1, parseInt(e.target.value, 10) || 1)) })
            }
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium font-mono"
            id={`stay-rooms-${stay.id}`}
          />
        </div>
        <div>
          <label
            htmlFor={`stay-guests-${stay.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Users className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Guests
          </label>
          <input
            type="number"
            min={1}
            max={maxGuests}
            value={stay.guests}
            onChange={(e) =>
              onUpdate(stay.id, {
                guests: Math.min(maxGuests, Math.max(1, parseInt(e.target.value, 10) || 1)),
              })
            }
            className="w-full px-2 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium font-mono"
            id={`stay-guests-${stay.id}`}
          />
        </div>
      </div>

      <div className="bg-dark-bg p-2.5 rounded-lg border border-dark-border flex items-center justify-between text-xs font-mono">
        <div className="text-dark-text-secondary text-[11px]">
          ${stay.ratePerNight.toLocaleString()}/night × {nights} × {rooms}
        </div>
        <div className="font-bold text-dark-text-secondary">
          Total:{' '}
          <span className="text-gold-premium font-bold">${stayLineTotal(stay).toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
}
