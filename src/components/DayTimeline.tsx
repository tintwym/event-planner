import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import { ItineraryItem } from '../types';
import {
  DayGroup,
  ScheduleConflict,
  TransitGap,
  conflictedItemCount,
  formatDisplayDate,
  formatTimeRange,
  itemHasConflict,
  itemHasTransitGap,
} from '../lib/schedule';

interface DayTimelineProps {
  groups: DayGroup[];
  conflicts: ScheduleConflict[];
  transitGaps?: TransitGap[];
}

export default function DayTimeline({
  groups,
  conflicts,
  transitGaps = [],
}: DayTimelineProps) {
  if (groups.length === 0) return null;

  const conflictedEvents = conflictedItemCount(conflicts);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
      id="day-timeline-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif font-light text-base text-dark-text-primary">Day Timeline</h3>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mt-0.5">
            Catalog durations · venue overlaps &amp; tight coastal drives flagged
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {conflictedEvents > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded"
              role="status"
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              {conflictedEvents} venue conflict{conflictedEvents === 1 ? '' : 's'}
            </motion.span>
          )}
          {transitGaps.length > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 bg-sky-500/10 border border-sky-500/30 px-2 py-1 rounded"
              role="status"
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              {transitGaps.length} tight drive{transitGaps.length === 1 ? '' : 's'}
            </motion.span>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 overflow-hidden"
          aria-label="Schedule conflicts"
        >
          {conflicts.map((c) => (
            <li key={`${c.aId}-${c.bId}`} className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">{formatDisplayDate(c.date)}</span> at {c.location}:{' '}
              <span className="font-medium">{c.aTitle}</span> overlaps{' '}
              <span className="font-medium">{c.bTitle}</span>
            </li>
          ))}
        </motion.ul>
      )}

      {transitGaps.length > 0 && (
        <ul
          className="space-y-1.5 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3"
          aria-label="Transit gaps"
        >
          {transitGaps.map((g) => (
            <li key={`${g.fromId}-${g.toId}`} className="text-xs text-sky-900 dark:text-sky-200">
              <span className="font-semibold">{formatDisplayDate(g.date)}</span>:{' '}
              <span className="font-medium">{g.fromTitle}</span> →{' '}
              <span className="font-medium">{g.toTitle}</span> needs {g.travelLabel} drive;{' '}
              {g.availableMinutes < 0
                ? 'events overlap before travel'
                : `only ${g.availableMinutes} min gap`}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-5">
        {groups.map((group, gi) => (
          <div key={group.date}>
            <DayColumn
              group={group}
              conflicts={conflicts}
              transitGaps={transitGaps}
              index={gi}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function DayColumn({
  group,
  conflicts,
  transitGaps,
  index,
}: {
  group: DayGroup;
  conflicts: ScheduleConflict[];
  transitGaps: TransitGap[];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="space-y-2"
    >
      <h4 className="text-xs font-bold uppercase tracking-widest text-gold-premium">
        {formatDisplayDate(group.date)}
      </h4>
      <div className="relative pl-4 space-y-3 border-l border-dark-border ml-1.5">
        {group.items.map((item) => (
          <div key={item.id}>
            <TimelineRow
              item={item}
              conflicted={itemHasConflict(item.id, conflicts)}
              tightTransit={itemHasTransitGap(item.id, transitGaps)}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function TimelineRow({
  item,
  conflicted,
  tightTransit,
}: {
  item: ItineraryItem;
  conflicted: boolean;
  tightTransit: boolean;
}) {
  return (
    <div className="relative">
      <span
        className={`absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
          conflicted
            ? 'bg-amber-400 border-amber-600'
            : tightTransit
              ? 'bg-sky-400 border-sky-600'
              : 'bg-gold-premium border-gold-hover'
        }`}
        aria-hidden
      />
      <div
        className={`rounded-lg border px-3 py-2 ${
          conflicted
            ? 'border-amber-500/40 bg-amber-500/5'
            : tightTransit
              ? 'border-sky-500/40 bg-sky-500/5'
              : 'border-dark-border bg-dark-card/60'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 font-mono text-dark-text-secondary">
            <Clock className="w-3 h-3 text-gold-premium" aria-hidden />
            {formatTimeRange(item)}
          </span>
          <span className="font-semibold text-dark-text-primary">{item.title}</span>
          <span className="inline-flex items-center gap-1 text-dark-text-tertiary">
            <MapPin className="w-3 h-3" aria-hidden />
            {item.location}
          </span>
          {conflicted && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              Venue overlap
            </span>
          )}
          {tightTransit && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-300">
              Drive too short
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
