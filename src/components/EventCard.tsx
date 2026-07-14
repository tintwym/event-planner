import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Tag, Plus, Check, ImageOff } from 'lucide-react';
import { EventActivity } from '../types';

interface EventCardProps {
  activity: EventActivity;
  onAddToItinerary: (activity: EventActivity) => void;
  isAdded: boolean;
  key?: string | number;
}

export default function EventCard({ activity, onAddToItinerary, isAdded }: EventCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const previewFeatures = activity.features.slice(0, 3);
  const extraCount = Math.max(0, activity.features.length - previewFeatures.length);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3 }}
      className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-lg transition-colors duration-300 hover:border-gold-premium/40 flex flex-col h-full"
      id={`event-card-${activity.id}`}
    >
      <div className="relative h-48 overflow-hidden bg-dark-bg shrink-0">
        {!imgFailed ? (
          <img
            src={activity.image}
            alt={activity.title}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2 bg-dark-input text-dark-text-tertiary"
            aria-hidden="true"
          >
            <ImageOff className="w-8 h-8 opacity-60" />
            <span className="text-[11px] uppercase tracking-wider font-bold">Image unavailable</span>
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 bg-dark-bg/85 backdrop-blur-md text-gold-premium border border-dark-border text-xs font-semibold px-2.5 py-1 rounded-full shadow-md">
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />
            {activity.category}
          </span>
          <span className="inline-flex items-center gap-1 bg-gold-premium/90 text-[#0A0A0A] text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            {activity.location}
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-serif text-lg font-bold text-dark-text-primary tracking-tight leading-snug mb-2">
          {activity.title}
        </h3>

        <p className="text-dark-text-secondary text-sm leading-relaxed mb-4 line-clamp-3">
          {activity.description}
        </p>

        <ul className="space-y-1.5 mb-4">
          {previewFeatures.map((feature, idx) => (
            <li
              key={idx}
              className="flex items-start gap-1.5 text-xs text-dark-text-secondary leading-normal"
            >
              <Check className="w-3.5 h-3.5 text-gold-premium shrink-0 mt-0.5" aria-hidden="true" />
              <span className="line-clamp-1">{feature}</span>
            </li>
          ))}
          {extraCount > 0 && (
            <li className="text-[11px] text-dark-text-tertiary font-medium pl-5">
              +{extraCount} more inclusions
            </li>
          )}
        </ul>

        <div className="mt-auto pt-4 border-t border-dark-border flex items-baseline justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-dark-text-secondary">
              Base Cost
            </p>
            <p className="font-mono text-lg font-bold text-gold-premium">
              ${activity.basePrice.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-dark-text-secondary">
              Per Guest
            </p>
            <p className="font-mono text-sm font-medium text-dark-text-secondary">
              +${activity.pricePerGuest}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToItinerary(activity)}
          disabled={isAdded}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 ${
            isAdded
              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60 cursor-not-allowed shadow-none'
              : 'bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] shadow-lg cursor-pointer'
          }`}
          id={`add-to-itinerary-btn-${activity.id}`}
        >
          {isAdded ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" /> Added to Itinerary
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" aria-hidden="true" /> Add to Itinerary
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
