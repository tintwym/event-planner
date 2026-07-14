import React from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Clock,
  Users,
  FileText,
  Trash2,
  MapPin,
  Tag,
  Home,
  Palmtree,
  AlertTriangle,
} from 'lucide-react';
import { ItineraryItem, EventActivity } from '../types';
import { VENUES } from '../data/venues';

interface ItineraryItemViewProps {
  item: ItineraryItem;
  associatedActivity?: EventActivity;
  onUpdate: (id: string, patch: Partial<ItineraryItem>) => void;
  onRemove: (id: string) => void;
  allowLocationSwitch?: boolean;
  hasConflict?: boolean;
  hasTransitGap?: boolean;
  key?: string | number;
}

function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ItineraryItemView({
  item,
  associatedActivity,
  onUpdate,
  onRemove,
  allowLocationSwitch = false,
  hasConflict = false,
  hasTransitGap = false,
}: ItineraryItemViewProps) {
  const selectedVenue = item.venueId ? VENUES.find((v) => v.id === item.venueId) : undefined;
  const maxGuests = Math.min(
    associatedActivity?.maxGuests ?? 500,
    selectedVenue?.capacity ?? Number.POSITIVE_INFINITY
  );
  const overCapacity = Boolean(selectedVenue && item.guests > selectedVenue.capacity);
  const today = localTodayISO();
  const minDate = item.date < today ? item.date : today;

  const pushUpdate = (patch: Partial<ItineraryItem>) => {
    onUpdate(item.id, patch);
  };

  const basePrice = associatedActivity
    ? associatedActivity.basePrice
    : (item.basePrice ?? item.calculatedPrice);
  const pricePerGuest = associatedActivity
    ? associatedActivity.pricePerGuest
    : (item.pricePerGuest ?? 0);

  const categoryBadgeStyles = {
    Weddings: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25',
    Dinners: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/25',
    Activities: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`bg-dark-card border rounded-xl p-4 shadow-md relative ${
        hasConflict || hasTransitGap || overCapacity
          ? 'border-amber-500/50'
          : 'border-dark-border'
      }`}
      id={`itinerary-item-${item.id}`}
    >
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="absolute top-4 right-4 text-dark-text-tertiary hover:text-rose-400 hover:bg-rose-950/30 p-1.5 rounded-lg transition-colors cursor-pointer"
        title="Remove activity"
        aria-label={`Remove ${item.title} from itinerary`}
        id={`remove-itinerary-btn-${item.id}`}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="flex flex-wrap items-center gap-2 mb-3 pr-8">
        {hasConflict && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Schedule conflict
          </span>
        )}
        {hasTransitGap && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Tight transit
          </span>
        )}
        {overCapacity && selectedVenue && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30"
            title={`${selectedVenue.name} holds up to ${selectedVenue.capacity} guests`}
          >
            <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Over capacity (
            {selectedVenue.capacity})
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
            categoryBadgeStyles[item.category] ||
            'bg-dark-input text-dark-text-secondary border border-dark-border'
          }`}
        >
          <Tag className="w-3 h-3" aria-hidden="true" />
          {item.category}
        </span>
        {allowLocationSwitch ? (
          <div className="inline-flex items-center gap-1 bg-dark-bg border border-dark-border rounded-md p-0.5">
            <button
              type="button"
              aria-pressed={item.location === 'Villa'}
              onClick={() => pushUpdate({ location: 'Villa' })}
              className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer ${
                item.location === 'Villa'
                  ? 'bg-gold-premium text-[#0A0A0A]'
                  : 'text-dark-text-secondary hover:text-dark-text-primary'
              }`}
            >
              <Home className="w-3 h-3" aria-hidden="true" /> Villa
            </button>
            <button
              type="button"
              aria-pressed={item.location === 'Hotel'}
              onClick={() => pushUpdate({ location: 'Hotel' })}
              className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer ${
                item.location === 'Hotel'
                  ? 'bg-gold-premium text-[#0A0A0A]'
                  : 'text-dark-text-secondary hover:text-dark-text-primary'
              }`}
            >
              <Palmtree className="w-3 h-3" aria-hidden="true" /> Hotel
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 bg-dark-bg text-dark-text-secondary border border-dark-border text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
            <MapPin className="w-3 h-3 text-gold-premium" aria-hidden="true" />
            {item.location}
          </span>
        )}
      </div>

      <h4 className="font-serif font-bold text-dark-text-primary tracking-tight leading-tight pr-8 mb-4">
        {item.title}
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label
            htmlFor={`itinerary-date-input-${item.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Calendar className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Date
          </label>
          <input
            type="date"
            min={minDate}
            value={item.date}
            onChange={(e) => pushUpdate({ date: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
            id={`itinerary-date-input-${item.id}`}
          />
        </div>

        <div>
          <label
            htmlFor={`itinerary-time-input-${item.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Clock className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Time
          </label>
          <input
            type="time"
            value={item.time}
            onChange={(e) => pushUpdate({ time: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
            id={`itinerary-time-input-${item.id}`}
          />
        </div>

        <div>
          <label
            htmlFor={`itinerary-guests-input-${item.id}`}
            className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
          >
            <Users className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Guests
            <span className="normal-case font-medium text-dark-text-tertiary">(max {maxGuests})</span>
          </label>
          <input
            type="number"
            min={1}
            max={maxGuests}
            value={item.guests}
            onChange={(e) =>
              pushUpdate({
                guests: Math.min(maxGuests, Math.max(1, parseInt(e.target.value, 10) || 1)),
              })
            }
            className="w-full px-2.5 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium font-mono"
            id={`itinerary-guests-input-${item.id}`}
          />
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor={`itinerary-venue-input-${item.id}`}
          className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
        >
          <MapPin className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Specific Venue
        </label>
        <select
          value={item.venueId || ''}
          onChange={(e) => pushUpdate({ venueId: e.target.value || undefined })}
          className="w-full px-2.5 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium cursor-pointer"
          id={`itinerary-venue-input-${item.id}`}
        >
          <option value="" className="bg-[#121212] text-dark-text-tertiary">Select a historic venue...</option>
          {VENUES.filter((v) => v.type === item.location).map((v) => (
            <option key={v.id} value={v.id} className="bg-[#121212] text-dark-text-primary">
              {v.name} (Max {v.capacity} guests)
            </option>
          ))}
        </select>
        {overCapacity && selectedVenue && (
          <p className="mt-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-300" role="status">
            {selectedVenue.name} holds up to {selectedVenue.capacity} guests. Your party is{' '}
            {item.guests}.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor={`itinerary-notes-input-${item.id}`}
          className="flex text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mb-1 items-center gap-1"
        >
          <FileText className="w-3 h-3 text-gold-premium" aria-hidden="true" /> Custom Requests / Notes
        </label>
        <textarea
          value={item.notes}
          onChange={(e) => pushUpdate({ notes: e.target.value })}
          placeholder="E.g., Dietary preferences, floral decorations, seating style..."
          rows={2}
          className="w-full px-3 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium resize-none"
          id={`itinerary-notes-input-${item.id}`}
        />
      </div>

      <div className="bg-dark-bg p-2.5 rounded-lg border border-dark-border flex items-center justify-between text-xs font-mono">
        <div className="text-dark-text-secondary text-[11px]">
          {associatedActivity || (item.pricePerGuest ?? 0) > 0 ? (
            <>
              Base ${basePrice.toLocaleString()} + ({item.guests} × ${pricePerGuest})
            </>
          ) : (
            <span>Custom Estimate</span>
          )}
        </div>
        <div className="font-bold text-dark-text-secondary">
          Total:{' '}
          <span className="text-gold-premium font-bold">
            ${item.calculatedPrice.toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
