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
  maxGuests: number;
  durationMinutes: number;
  image: string;
  features: string[];
}

export interface ItineraryItem {
  id: string;
  activityId?: string;
  title: string;
  location: 'Villa' | 'Hotel';
  category: EventCategory;
  date: string;
  time: string;
  guests: number;
  notes: string;
  calculatedPrice: number;
  basePrice?: number;
  pricePerGuest?: number;
  venueId?: string;
  durationMinutes?: number;
  /** Package pillar. Absent is treated as 'event' for backwards compatibility. */
  kind?: LineKind;
}

/** A bookable room category offered by a specific venue. */
export interface RoomType {
  id: string;
  venueId: string;
  name: string;
  sleeps: number;
  ratePerNight: number;
  count: number;
  description?: string;
}

/** A lodging line item in the package. */
export interface StayItem {
  id: string;
  venueId: string;
  roomTypeId: string;
  checkIn: string;
  nights: number;
  rooms: number;
  guests: number;
  ratePerNight: number;
  notes?: string;
}

/** A point-to-point transfer line item in the package. */
export interface TransferItem {
  id: string;
  fromVenueId: string;
  toVenueId: string;
  mode: TransferMode;
  date: string;
  time: string;
  pax: number;
  price: number;
  notes?: string;
}

export interface Venue {
  id: string;
  name: string;
  type: 'Villa' | 'Hotel';
  lat: number;
  lng: number;
  x: number;
  y: number;
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
