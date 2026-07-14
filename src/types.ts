export type EventLocation = 'Villa' | 'Hotel' | 'Both';
export type EventCategory = 'Weddings' | 'Dinners' | 'Activities';

export interface EventActivity {
  id: string;
  title: string;
  description: string;
  location: EventLocation;
  category: EventCategory;
  basePrice: number;
  pricePerGuest: number;
  /** Soft capacity limit for guest count validation */
  maxGuests: number;
  /** Planned event length for conflicts, timeline, and calendar export */
  durationMinutes: number;
  image: string;
  features: string[];
}

export interface ItineraryItem {
  id: string;
  activityId?: string; // empty for fully custom events
  title: string;
  location: 'Villa' | 'Hotel';
  category: EventCategory;
  date: string;
  time: string;
  guests: number;
  notes: string;
  calculatedPrice: number;
  /** Persisted for custom events so guest edits reprice correctly */
  basePrice?: number;
  pricePerGuest?: number;
  /** Specific historic venue assigned to the event */
  venueId?: string;
  /** When set, overrides category default duration for schedule / ICS */
  durationMinutes?: number;
}

export interface Venue {
  id: string;
  name: string;
  type: 'Villa' | 'Hotel';
  lat: number;
  lng: number;
  x: number; // for SVG visualization coordinates
  y: number; // for SVG visualization coordinates
  description: string;
  capacity: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  targetBudget: number;
  avatar: string;
}
