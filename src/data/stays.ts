import { RoomType } from '../types';

/**
 * Nightly room inventory per venue. Rates are indicative luxury tariffs (EUR/USD
 * range) used for package estimates — final pricing is confirmed on inquiry.
 */
export const ROOM_TYPES: RoomType[] = [
  // Villa Cimbrone (v1)
  { id: 'v1-garden', venueId: 'v1', name: 'Garden Suite', sleeps: 2, ratePerNight: 780, count: 6, description: 'Frescoed suite opening onto the botanical gardens.' },
  { id: 'v1-terrace', venueId: 'v1', name: 'Terrace of Infinity Suite', sleeps: 2, ratePerNight: 1450, count: 3, description: 'Clifftop suite with private sea-view terrace.' },
  { id: 'v1-villa', venueId: 'v1', name: 'Full Villa Buyout', sleeps: 18, ratePerNight: 9800, count: 1, description: 'Exclusive use of the entire historic estate.' },

  // Villa Treville (v2)
  { id: 'v2-positano', venueId: 'v2', name: 'Positano Room', sleeps: 2, ratePerNight: 920, count: 5, description: 'Hand-painted room overlooking the bay.' },
  { id: 'v2-zeffirelli', venueId: 'v2', name: 'Zeffirelli Suite', sleeps: 3, ratePerNight: 1780, count: 2, description: 'The director’s former private quarters.' },
  { id: 'v2-villa', venueId: 'v2', name: 'Full Estate Buyout', sleeps: 20, ratePerNight: 12500, count: 1, description: 'Private cliffside residence, fully staffed.' },

  // Villa Astor (v3)
  { id: 'v3-roman', venueId: 'v3', name: 'Roman Garden Room', sleeps: 2, ratePerNight: 690, count: 8, description: 'Room amid the botanical park and Roman ruins.' },
  { id: 'v3-seaview', venueId: 'v3', name: 'Sorrento Sea-View Suite', sleeps: 2, ratePerNight: 1240, count: 4, description: 'Clifftop suite above the Bay of Naples.' },
  { id: 'v3-villa', venueId: 'v3', name: 'Full Villa Buyout', sleeps: 16, ratePerNight: 8600, count: 1, description: 'Exclusive use of the grand seaside villa.' },

  // Belmond Hotel Caruso (h1)
  { id: 'h1-deluxe', venueId: 'h1', name: 'Deluxe Sea-View Room', sleeps: 2, ratePerNight: 1100, count: 20, description: 'Palace room with framed sea views.' },
  { id: 'h1-junior', venueId: 'h1', name: 'Junior Suite', sleeps: 3, ratePerNight: 1950, count: 10, description: 'Suite above the terraced olive groves.' },
  { id: 'h1-belvedere', venueId: 'h1', name: 'Belvedere Suite', sleeps: 4, ratePerNight: 3600, count: 3, description: 'Signature suite by the infinity pool.' },

  // Le Sirenuse (h2)
  { id: 'h2-classic', venueId: 'h2', name: 'Classic Room', sleeps: 2, ratePerNight: 950, count: 22, description: 'Iconic room in the heart of Positano.' },
  { id: 'h2-superior', venueId: 'h2', name: 'Superior Sea-View', sleeps: 2, ratePerNight: 1520, count: 12, description: 'Balcony over the coloured cliffside houses.' },
  { id: 'h2-suite', venueId: 'h2', name: 'Master Suite', sleeps: 4, ratePerNight: 3200, count: 4, description: 'Expansive suite with panoramic terrace.' },

  // Grand Hotel Excelsior Vittoria (h3)
  { id: 'h3-classic', venueId: 'h3', name: 'Classic Room', sleeps: 2, ratePerNight: 620, count: 30, description: 'Historic room in the clifftop park.' },
  { id: 'h3-deluxe', venueId: 'h3', name: 'Deluxe Bay-View', sleeps: 2, ratePerNight: 980, count: 18, description: 'Room overlooking the Bay of Naples.' },
  { id: 'h3-caruso', venueId: 'h3', name: 'Caruso Suite', sleeps: 4, ratePerNight: 2600, count: 5, description: 'Landmark suite with grand terrace.' },
];

export function roomTypesForVenue(venueId: string): RoomType[] {
  return ROOM_TYPES.filter((r) => r.venueId === venueId);
}

export function getRoomType(roomTypeId: string): RoomType | undefined {
  return ROOM_TYPES.find((r) => r.id === roomTypeId);
}
