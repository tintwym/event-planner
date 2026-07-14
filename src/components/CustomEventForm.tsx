import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Calendar, Clock, Plus } from 'lucide-react';
import { ItineraryItem, EventCategory } from '../types';
import { defaultDurationMinutes } from '../lib/schedule';
import { VENUES } from '../data/venues';

interface CustomEventFormProps {
  onAddCustomItem: (item: Omit<ItineraryItem, 'id'>) => void;
}

function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CustomEventForm({ onAddCustomItem }: CustomEventFormProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('Activities');
  const [location, setLocation] = useState<'Villa' | 'Hotel'>('Villa');
  const [baseCost, setBaseCost] = useState<number>(150);
  const [pricePerGuest, setPricePerGuest] = useState<number>(25);
  const [guests, setGuests] = useState<number>(2);
  const [date, setDate] = useState(localTodayISO);
  const [time, setTime] = useState('14:00');
  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState(false);
  const [venueId, setVenueId] = useState('');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  useEffect(() => {
    const firstMatching = VENUES.find((v) => v.type === location);
    setVenueId(firstMatching ? firstMatching.id : '');
  }, [location]);

  const estimatedTotal = baseCost + pricePerGuest * guests;
  const minDate = localTodayISO();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const venue = venueId ? VENUES.find((v) => v.id === venueId) : undefined;
    const guestCount = venue ? Math.min(guests, venue.capacity) : guests;

    onAddCustomItem({
      title: title.trim(),
      category,
      location,
      date,
      time,
      guests: guestCount,
      notes,
      basePrice: baseCost,
      pricePerGuest,
      calculatedPrice: baseCost + pricePerGuest * guestCount,
      venueId: venueId || undefined,
      durationMinutes: defaultDurationMinutes(category),
    });

    setTitle('');
    setNotes('');
    setSuccessMessage(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMessage(false), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg"
      id="custom-event-form-container"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-gold-premium/10 rounded-lg">
          <Sparkles className="w-4 h-4 text-gold-premium" aria-hidden="true" />
        </div>
        <div>
          <h4 className="font-serif font-bold text-dark-text-primary leading-none">Bespoke Activity</h4>
          <p className="text-[11px] text-dark-text-tertiary mt-0.5 uppercase tracking-wider font-semibold">
            Design your own custom agenda item
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="custom-event-title-input"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Activity Name
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g., Private Heli-pad Sunset Champagne"
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
            id="custom-event-title-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="custom-event-category-select"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as EventCategory)}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="custom-event-category-select"
            >
              <option value="Weddings">Weddings</option>
              <option value="Dinners">Dinners</option>
              <option value="Activities">Activities</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="custom-event-location-select"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              Location
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as 'Villa' | 'Hotel')}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="custom-event-location-select"
            >
              <option value="Villa">At Villa</option>
              <option value="Hotel">At Hotel</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="custom-event-venue-select"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Specific Venue
          </label>
          <select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
            id="custom-event-venue-select"
          >
            <option value="" className="bg-[#121212] text-dark-text-tertiary">Select a historic venue...</option>
            {VENUES.filter((v) => v.type === location).map((v) => (
              <option key={v.id} value={v.id} className="bg-[#121212] text-dark-text-primary">
                {v.name} (Max {v.capacity} guests)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label
              htmlFor="custom-event-cost-input"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              Base ($)
            </label>
            <input
              type="number"
              min="0"
              value={baseCost}
              onChange={(e) => setBaseCost(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-mono font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="custom-event-cost-input"
            />
          </div>

          <div>
            <label
              htmlFor="custom-event-ppg-input"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              Per Guest
            </label>
            <input
              type="number"
              min="0"
              value={pricePerGuest}
              onChange={(e) => setPricePerGuest(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-mono font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="custom-event-ppg-input"
            />
          </div>

          <div>
            <label
              htmlFor="custom-event-guests-input"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              Guests
            </label>
            <input
              type="number"
              min="1"
              value={guests}
              onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-mono font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="custom-event-guests-input"
            />
          </div>
        </div>

        <p className="text-[11px] font-mono text-dark-text-secondary">
          Estimated total:{' '}
          <span className="text-gold-premium font-bold">${estimatedTotal.toLocaleString()}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="custom-event-date-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-gold-premium" aria-hidden="true" /> Date
            </label>
            <input
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="custom-event-date-input"
            />
          </div>

          <div>
            <label
              htmlFor="custom-event-time-input"
              className="flex text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1 items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5 text-gold-premium" aria-hidden="true" /> Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
              id="custom-event-time-input"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="custom-event-notes-input"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Bespoke Setup Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add specific setup requests, decoration styles, or specific dining needs."
            rows={2}
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium resize-none"
            id="custom-event-notes-input"
          />
        </div>

        <AnimatePresence>
          {successMessage && (
            <motion.div
              key="custom-success"
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              role="status"
              aria-live="polite"
              className="text-center text-xs text-emerald-500 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg overflow-hidden"
              id="custom-event-success-alert"
            >
              Custom event added successfully!
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          className="w-full py-2.5 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
          id="custom-event-submit-btn"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Custom Activity
        </motion.button>
      </form>
    </motion.div>
  );
}
