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
