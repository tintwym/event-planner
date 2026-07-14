import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, Info, Users, Calendar, Clock, ChevronRight } from 'lucide-react';
import { ItineraryItem, Venue } from '../types';
import { VENUES } from '../data/venues';

interface VenueMapProps {
  itinerary: ItineraryItem[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

// Distance and travel time lookup matrix between venues
const TRANSIT_MATRIX: Record<string, Record<string, { distance: string; duration: string }>> = {
  v1: {
    v2: { distance: '22 km', duration: '45 mins' },
    v3: { distance: '31 km', duration: '1 hr' },
    h1: { distance: '2.5 km', duration: '8 mins' },
    h2: { distance: '20 km', duration: '40 mins' },
    h3: { distance: '29 km', duration: '55 mins' },
  },
  v2: {
    v1: { distance: '22 km', duration: '45 mins' },
    v3: { distance: '16 km', duration: '35 mins' },
    h1: { distance: '21 km', duration: '40 mins' },
    h2: { distance: '4 km', duration: '12 mins' },
    h3: { distance: '15 km', duration: '30 mins' },
  },
  v3: {
    v1: { distance: '31 km', duration: '1 hr' },
    v2: { distance: '16 km', duration: '35 mins' },
    h1: { distance: '30 km', duration: '55 mins' },
    h2: { distance: '15 km', duration: '30 mins' },
    h3: { distance: '1.2 km', duration: '5 mins' },
  },
  h1: {
    v1: { distance: '2.5 km', duration: '8 mins' },
    v2: { distance: '21 km', duration: '40 mins' },
    v3: { distance: '30 km', duration: '55 mins' },
    h2: { distance: '19 km', duration: '38 mins' },
    h3: { distance: '28 km', duration: '50 mins' },
  },
  h2: {
    v1: { distance: '20 km', duration: '40 mins' },
    v2: { distance: '4 km', duration: '12 mins' },
    v3: { distance: '15 km', duration: '30 mins' },
    h1: { distance: '19 km', duration: '38 mins' },
    h3: { distance: '14 km', duration: '28 mins' },
  },
  h3: {
    v1: { distance: '29 km', duration: '55 mins' },
    v2: { distance: '15 km', duration: '30 mins' },
    v3: { distance: '1.2 km', duration: '5 mins' },
    h1: { distance: '28 km', duration: '50 mins' },
    h2: { distance: '14 km', duration: '28 mins' },
  },
};

export default function VenueMap({ itinerary, selectedDate, onSelectDate }: VenueMapProps) {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(VENUES[0]);

  // Extract unique dates that have scheduled events for easy filtering
  const scheduledDates = Array.from(new Set(itinerary.map((item) => item.date))).sort();

  // Get chronological events scheduled for the current selected date
  const activeDayEvents = itinerary
    .filter((item) => item.date === selectedDate && item.venueId)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Determine transit routes connecting venues scheduled on this date
  const routes: Array<{ from: Venue; to: Venue; info: { distance: string; duration: string } }> = [];
  for (let i = 0; i < activeDayEvents.length - 1; i++) {
    const fromVenue = VENUES.find((v) => v.id === activeDayEvents[i].venueId);
    const toVenue = VENUES.find((v) => v.id === activeDayEvents[i + 1].venueId);
    if (fromVenue && toVenue && fromVenue.id !== toVenue.id) {
      const transitInfo = TRANSIT_MATRIX[fromVenue.id]?.[toVenue.id] || {
        distance: '10 km',
        duration: '20 mins',
      };
      routes.push({
        from: fromVenue,
        to: toVenue,
        info: transitInfo,
      });
    }
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg flex flex-col gap-5" id="venue-map-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-border pb-4">
        <div>
          <h2 className="font-serif font-light text-lg text-dark-text-primary flex items-center gap-2">
            <Navigation className="w-5 h-5 text-gold-premium" /> Interactive Venue Map
          </h2>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mt-0.5">Amalfi Coast Route &amp; Transit Planner</p>
        </div>

        {/* Date Filter Pills */}
        {scheduledDates.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full sm:max-w-xs scrollbar-none">
            {scheduledDates.map((date) => (
              <button
                key={date}
                onClick={() => onSelectDate(date)}
                className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border cursor-pointer shrink-0 transition-colors ${
                  selectedDate === date
                    ? 'bg-gold-premium border-gold-premium text-[#0A0A0A]'
                    : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                }`}
              >
                {date.substring(5)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* MAP CONTAINER (Col 7) */}
        <div className="lg:col-span-8 relative bg-[#0D0D0E] rounded-xl overflow-hidden border border-dark-border h-[400px]">
          {/* Legend indicators */}
          <div className="absolute top-3 left-3 z-10 bg-[#0D0D0E]/80 backdrop-blur-xs border border-dark-border rounded px-2.5 py-1.5 space-y-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gold-premium" />
              <span>Villas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-amber-500" />
              <span>Hotels</span>
            </div>
          </div>

          {/* SVG Map Canvas */}
          <svg
            viewBox="0 0 800 500"
            className="w-full h-full select-none"
            aria-label="Amalfi Coast Map Chart"
          >
            {/* Draw Sea background grid */}
            <defs>
              <pattern id="map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff" strokeOpacity="0.015" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />

            {/* Land Mass Silhouette */}
            <path
              d="M0,0 L800,0 L800,100 Q700,120 620,130 T450,220 T280,240 T150,90 T0,70 Z"
              fill="#141416"
              stroke="#262529"
              strokeWidth="2"
            />

            {/* Coastline Path */}
            <path
              d="M0,70 Q150,90 280,240 T450,220 T620,130 T800,100"
              fill="none"
              stroke="var(--color-gold-premium, #C5A267)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeOpacity="0.6"
            />

            {/* Major towns label points */}
            <g className="text-[10px] font-serif italic fill-slate-500 font-bold">
              <circle cx="150" cy="85" r="3" fill="#334155" />
              <text x="140" y="75">Sorrento</text>

              <circle cx="350" cy="225" r="3" fill="#334155" />
              <text x="330" y="215">Positano</text>

              <circle cx="530" cy="210" r="3" fill="#334155" />
              <text x="510" y="200">Amalfi</text>

              <circle cx="650" cy="140" r="3" fill="#334155" />
              <text x="635" y="130">Ravello</text>
            </g>

            {/* Scheduled route transit paths */}
            {routes.map((route, idx) => (
              <g key={idx}>
                {/* Dotted path connecting the venues */}
                <path
                  d={`M${route.from.x},${route.from.y} L${route.to.x},${route.to.y}`}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
                {/* Arrow indicator at midpoint */}
                <circle
                  cx={(route.from.x + route.to.x) / 2}
                  cy={(route.from.y + route.to.y) / 2}
                  r="6"
                  fill="#F59E0B"
                />
              </g>
            ))}

            {/* Venue Pins */}
            {VENUES.map((venue) => {
              const isSelected = selectedVenue?.id === venue.id;
              const hasEventOnSelectedDate = activeDayEvents.some((e) => e.venueId === venue.id);

              return (
                <g
                  key={venue.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedVenue(venue)}
                >
                  {/* Outer Pulsing Aura if venue has an event scheduled today */}
                  {hasEventOnSelectedDate && (
                    <circle
                      cx={venue.x}
                      cy={venue.y}
                      r="16"
                      fill={venue.type === 'Villa' ? '#C5A267' : '#F59E0B'}
                      fillOpacity="0.2"
                      className="animate-ping"
                    />
                  )}

                  {/* Pin Circle Anchor */}
                  <circle
                    cx={venue.x}
                    cy={venue.y}
                    r={isSelected ? 10 : 7}
                    fill={
                      isSelected
                        ? '#C5A267'
                        : venue.type === 'Villa'
                        ? 'var(--color-dark-bg, #0A0A0A)'
                        : '#F59E0B'
                    }
                    stroke={venue.type === 'Villa' ? '#C5A267' : '#F59E0B'}
                    strokeWidth="2"
                    className="transition-all duration-300"
                  />

                  {/* Inner center dot for unselected pins */}
                  {!isSelected && (
                    <circle cx={venue.x} cy={venue.y} r="2.5" fill="#ffffff" />
                  )}

                  {/* Small Venue Tag text */}
                  {isSelected && (
                    <g>
                      <rect
                        x={venue.x - 50}
                        y={venue.y - 32}
                        width="100"
                        height="18"
                        rx="4"
                        fill="#0D0D0E"
                        stroke="#C5A267"
                        strokeWidth="1"
                        fillOpacity="0.9"
                      />
                      <text
                        x={venue.x}
                        y={venue.y - 20}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {venue.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* DETAILS SIDE PANEL (Col 4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Active Date schedule summary */}
          <div className="bg-[#121214] p-4 rounded-xl border border-dark-border space-y-3">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Route Sequence ({selectedDate})</span>
            {activeDayEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No events scheduled on this date.</p>
            ) : (
              <div className="space-y-2.5">
                {activeDayEvents.map((item, idx) => {
                  const venue = VENUES.find((v) => v.id === item.venueId);
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-gold-premium text-[#0A0A0A] flex items-center justify-center font-mono font-bold text-[9px]">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <span className="text-xs font-semibold text-dark-text-primary block leading-tight">{item.title}</span>
                          <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">{venue?.name || item.location}</span>
                        </div>
                        <span className="text-[9px] font-mono text-gold-premium font-bold flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> {item.time}
                        </span>
                      </div>
                      
                      {/* Render travel segment information below if there's a next venue */}
                      {idx < activeDayEvents.length - 1 && activeDayEvents[idx + 1].venueId !== item.venueId && (
                        <div className="pl-6 border-l border-dashed border-dark-border py-1 flex items-center gap-1.5 text-[9px] font-bold text-amber-500 uppercase">
                          <Navigation className="w-2.5 h-2.5" />
                          <span>
                            SS163 Drive: {
                              TRANSIT_MATRIX[item.venueId!]?.[activeDayEvents[idx+1].venueId!]?.duration || '20 mins'
                            } ({
                              TRANSIT_MATRIX[item.venueId!]?.[activeDayEvents[idx+1].venueId!]?.distance || '8 km'
                            })
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Venue info drawer */}
          <AnimatePresence mode="wait">
            {selectedVenue && (
              <motion.div
                key={selectedVenue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-dark-card border border-dark-border p-4 rounded-xl flex-1 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest font-black text-gold-premium">{selectedVenue.type} Selection</span>
                      <h3 className="font-serif text-base font-semibold text-dark-text-primary mt-0.5">{selectedVenue.name}</h3>
                    </div>
                    <span className="flex items-center gap-1 bg-dark-bg border border-dark-border px-2 py-0.5 rounded text-[9px] font-mono text-slate-400 font-bold">
                      <Users className="w-3 h-3 text-gold-premium" /> Max {selectedVenue.capacity}
                    </span>
                  </div>

                  <p className="text-xs text-dark-text-secondary leading-relaxed font-light">
                    {selectedVenue.description}
                  </p>

                  {/* Scheduled items at this specific venue overall */}
                  <div className="pt-3 border-t border-dark-border/40">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block mb-2">Booked Sessions</span>
                    {itinerary.filter((i) => i.venueId === selectedVenue.id).length === 0 ? (
                      <p className="text-[10px] text-slate-600 italic">No scheduled events at this location.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {itinerary
                          .filter((i) => i.venueId === selectedVenue.id)
                          .map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-[10px] bg-dark-bg p-1.5 rounded border border-dark-border/40">
                              <span className="font-medium text-slate-300">{item.title}</span>
                              <span className="font-mono text-gold-premium">{item.date} @ {item.time}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 border-t border-dark-border/40 mt-4">
                  <Info className="w-3.5 h-3.5 text-gold-premium" /> Coordinates: {selectedVenue.lat.toFixed(4)}° N, {selectedVenue.lng.toFixed(4)}° E
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
