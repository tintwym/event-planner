import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import { ItineraryItem } from '../types';
import {
  DayGroup,
  ScheduleConflict,
  conflictedItemCount,
  formatDisplayDate,
  formatTimeRange,
  itemHasConflict,
} from '../lib/schedule';

interface DayTimelineProps {
  groups: DayGroup[];
  conflicts: ScheduleConflict[];
}

export default function DayTimeline({ groups, conflicts }: DayTimelineProps) {
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
            Estimated windows · same-venue overlaps flagged
          </p>
        </div>
        {conflictedEvents > 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded"
            role="status"
          >
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            {conflictedEvents} event{conflictedEvents === 1 ? '' : 's'} conflict
          </motion.span>
        )}
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

      <div className="space-y-5">
        {groups.map((group, gi) => (
          <DayColumn key={group.date} group={group} conflicts={conflicts} index={gi} />
        ))}
      </div>
    </motion.div>
  );
}

function DayColumn({
  group,
  conflicts,
  index,
}: {
  group: DayGroup;
  conflicts: ScheduleConflict[];
  index: number;
  key?: string | number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      aria-labelledby={`timeline-day-${group.date}`}
    >
      <h4
        id={`timeline-day-${group.date}`}
        className="text-[11px] uppercase tracking-wider font-bold text-gold-premium mb-2"
      >
        {formatDisplayDate(group.date)}
      </h4>
      <ol className="relative border-l border-dark-border ml-2 space-y-3">
        {group.items.map((item, ii) => (
          <TimelineRow
            key={item.id}
            item={item}
            conflicted={itemHasConflict(item.id, conflicts)}
            index={ii}
          />
        ))}
      </ol>
    </motion.section>
  );
}

function TimelineRow({
  item,
  conflicted,
  index,
}: {
  item: ItineraryItem;
  conflicted: boolean;
  index: number;
  key?: string | number;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.28 }}
      className="pl-4 relative"
    >
      <span
        className={`absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
          conflicted ? 'bg-amber-400 border-amber-600' : 'bg-gold-premium border-gold-hover'
        }`}
        aria-hidden="true"
      />
      <div
        className={`rounded-lg border px-3 py-2 transition-colors duration-300 ${
          conflicted
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-dark-border bg-dark-bg'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-dark-text-secondary">
          <span className="inline-flex items-center gap-1 font-bold text-dark-text-primary">
            <Clock className="w-3 h-3 text-gold-premium" aria-hidden="true" />
            {formatTimeRange(item)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gold-premium" aria-hidden="true" />
            {item.location}
          </span>
          {conflicted && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Conflict
            </span>
          )}
        </div>
        <p className="font-serif text-sm text-dark-text-primary mt-1 leading-snug">{item.title}</p>
      </div>
    </motion.li>
  );
}
