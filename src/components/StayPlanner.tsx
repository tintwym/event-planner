import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BedDouble, Moon, Users, Calendar, Plus, Home, Palmtree } from 'lucide-react';
import { StayItem } from '../types';
import { VENUES } from '../data/venues';
import { roomTypesForVenue, getRoomType } from '../data/stays';
import { stayLineTotal } from '../lib/pricing';

interface StayPlannerProps {
  onAddStay: (stay: Omit<StayItem, 'id'>) => void;
}

function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function StayPlanner({ onAddStay }: StayPlannerProps) {
  const [venueId, setVenueId] = useState(VENUES[0]?.id ?? '');
  const roomTypes = useMemo(() => roomTypesForVenue(venueId), [venueId]);
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? '');
  const [checkIn, setCheckIn] = useState(localTodayISO);
  const [nights, setNights] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [success, setSuccess] = useState(false);
  const successTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  // Keep room type valid whenever the venue changes
  useEffect(() => {
    const next = roomTypesForVenue(venueId);
    setRoomTypeId((prev) => (next.some((r) => r.id === prev) ? prev : next[0]?.id ?? ''));
  }, [venueId]);

  const venue = VENUES.find((v) => v.id === venueId);
  const roomType = getRoomType(roomTypeId);
  const maxRooms = roomType?.count ?? 1;
  const maxGuests = roomType ? roomType.sleeps * Math.max(1, rooms) : 99;

  const previewTotal = roomType
    ? stayLineTotal({
        id: 'preview',
        venueId,
        roomTypeId,
        checkIn,
        nights,
        rooms,
        guests,
        ratePerNight: roomType.ratePerNight,
      })
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!venue || !roomType) return;
    const safeRooms = Math.min(maxRooms, Math.max(1, rooms));
    const safeGuests = Math.min(roomType.sleeps * safeRooms, Math.max(1, guests));
    onAddStay({
      venueId,
      roomTypeId,
      checkIn,
      nights: Math.max(1, nights),
      rooms: safeRooms,
      guests: safeGuests,
      ratePerNight: roomType.ratePerNight,
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
      id="stay-planner-panel"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-gold-premium/10 rounded-lg">
          <BedDouble className="w-4 h-4 text-gold-premium" aria-hidden="true" />
        </div>
        <div>
          <h4 className="font-serif font-bold text-dark-text-primary leading-none">Add Accommodation</h4>
          <p className="text-[11px] text-dark-text-tertiary mt-0.5 uppercase tracking-wider font-semibold">
            Reserve rooms or a full villa buyout
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="stay-venue-select"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Property
          </label>
          <select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
            id="stay-venue-select"
          >
            {VENUES.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#121212] text-dark-text-primary">
                {v.type}: {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="stay-room-select"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Room Type
          </label>
          <select
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
            id="stay-room-select"
          >
            {roomTypes.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#121212] text-dark-text-primary">
                {r.name} — ${r.ratePerNight.toLocaleString()}/night (sleeps {r.sleeps})
              </option>
            ))}
          </select>
          {roomType?.description && (
            <p className="text-[11px] text-dark-text-tertiary mt-1 italic leading-snug">
              {roomType.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label
              htmlFor="stay-nights-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <Moon className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Nights
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={nights}
              onChange={(e) => setNights(Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-mono font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="stay-nights-input"
            />
          </div>
          <div>
            <label
              htmlFor="stay-rooms-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <BedDouble className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Rooms
            </label>
            <input
              type="number"
              min="1"
              max={maxRooms}
              value={rooms}
              onChange={(e) => setRooms(Math.min(maxRooms, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-mono font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="stay-rooms-input"
            />
          </div>
          <div>
            <label
              htmlFor="stay-guests-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <Users className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Guests
            </label>
            <input
              type="number"
              min="1"
              max={maxGuests}
              value={guests}
              onChange={(e) => setGuests(Math.min(maxGuests, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-mono font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="stay-guests-input"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="stay-checkin-input"
            className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
          >
            <Calendar className="w-3.5 h-3.5 text-gold-premium" aria-hidden="true" /> Check-in Date
          </label>
          <input
            type="date"
            min={localTodayISO()}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
            id="stay-checkin-input"
          />
        </div>

        <p className="text-[11px] font-mono text-dark-text-secondary flex items-center gap-1.5">
          {venue?.type === 'Villa' ? (
            <Home className="w-3 h-3 text-gold-premium" aria-hidden="true" />
          ) : (
            <Palmtree className="w-3 h-3 text-gold-premium" aria-hidden="true" />
          )}
          {nights} night{nights === 1 ? '' : 's'} × {rooms} room{rooms === 1 ? '' : 's'} ={' '}
          <span className="text-gold-premium font-bold">${previewTotal.toLocaleString()}</span>
        </p>

        <AnimatePresence>
          {success && (
            <motion.div
              key="stay-success"
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              role="status"
              aria-live="polite"
              className="text-center text-xs text-emerald-500 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg overflow-hidden"
            >
              Stay added to your package!
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={!roomType}
          className="w-full py-2.5 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          id="stay-submit-btn"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Stay
        </motion.button>
      </form>
    </motion.div>
  );
}
