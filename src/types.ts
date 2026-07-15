export type EventLocation = 'Villa' | 'Hotel' | 'Both';
export type EventCategory = 'Weddings' | 'Dinners' | 'Activities';

/** Which package pillar an itinerary item belongs to. Absent = 'event' (legacy). */
export type LineKind = 'event' | 'experience';

/** Bookable transfer vehicle classes between venues. */
export type TransferMode = 'sedan' | 'van' | 'yacht' | 'helicopter';

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
  /** Package pillar. Absent is treated as 'event' for backwards compatibility. */
  kind?: LineKind;
}

/** A bookable room category offered by a specific venue. */
export interface RoomType {
  id: string;
  venueId: string;
  name: string;
  /** Guests one room of this type comfortably sleeps */
  sleeps: number;
  ratePerNight: number;
  /** Rooms of this type available at the venue */
  count: number;
  description?: string;
}

/** A lodging line item in the package. */
export interface StayItem {
  id: string;
  venueId: string;
  roomTypeId: string;
  /** ISO check-in date (YYYY-MM-DD) */
  checkIn: string;
  nights: number;
  rooms: number;
  guests: number;
  /** Snapshot of the nightly rate at time of selection */
  ratePerNight: number;
  notes?: string;
}

/** A point-to-point transfer line item in the package. */
export interface TransferItem {
  id: string;
  fromVenueId: string;
  toVenueId: string;
  mode: TransferMode;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Departure time HH:MM */
  time: string;
  pax: number;
  /** Snapshot of the computed price */
  price: number;
  notes?: string;
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
