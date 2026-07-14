import { EventActivity } from '../types';

export const CATALOG_ACTIVITIES: EventActivity[] = [
  // --- WEDDINGS ---
  {
    id: 'w1',
    title: 'Oceanfront Sunset Ceremony',
    description: 'A breathtaking exchange of vows on a cliffside pavilion overlooking the azure sea. Styled with lush white orchids and soft linen drapes as the sun dips below the horizon.',
    location: 'Hotel',
    category: 'Weddings',
    basePrice: 5000,
    pricePerGuest: 85,
    maxGuests: 120,
    durationMinutes: 180,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600',
    features: [
      'Floral arch & complete ceremonial setup',
      'Oceanfront altar with seating for up to 120 guests',
      'Professional sound system & acoustic guitarist',
      'Champagne toast immediately following the vows',
      'Event coordination & photography coordination'
    ]
  },
  {
    id: 'w2',
    title: 'Intimate Glasshouse Vows',
    description: 'Exchange your promises in an enchanted, climate-controlled glass sanctuary nestled in a hidden forest garden. Lit with thousands of hanging fairy lights and scented candles.',
    location: 'Villa',
    category: 'Weddings',
    basePrice: 4200,
    pricePerGuest: 75,
    maxGuests: 60,
    durationMinutes: 150,
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=600',
    features: [
      'Exclusive private garden glasshouse hire',
      'Bespoke botanical installations and lighting design',
      'Seating for up to 60 guests',
      'Violin and cello classical duo',
      'Gourmet hors d’oeuvres served post-ceremony'
    ]
  },
  {
    id: 'w3',
    title: 'Grand Ballroom Imperial Reception',
    description: 'An opulent gala reception held in the historic grand ballroom. Features double-height ceilings, crystal chandeliers, a grand stage, and a seamless blend of luxury and style.',
    location: 'Hotel',
    category: 'Weddings',
    basePrice: 7500,
    pricePerGuest: 120,
    maxGuests: 250,
    durationMinutes: 300,
    image: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&q=80&w=600',
    features: [
      'Pre-function cocktail lobby access',
      'Luxurious table linens, porcelain, and silverware',
      'Premium custom lighting design and dancefloor',
      '7-tier ceremonial display wedding cake',
      'Full stage with audio/visual for live band or DJ'
    ]
  },
  {
    id: 'w4',
    title: 'Boho Garden Union',
    description: 'A charming, whimsical garden celebration under a magnificent ancient banyan tree. Features cozy macramé styling, woven carpets, low-slung lounge tables, and a relaxed luxury vibe.',
    location: 'Villa',
    category: 'Weddings',
    basePrice: 3500,
    pricePerGuest: 60,
    maxGuests: 80,
    durationMinutes: 240,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=600',
    features: [
      'Villa private courtyard and garden lawns',
      'Bohemian chic teepee canopy and floral installations',
      'Low-seating picnic lounges with plush cushions',
      'Acoustic singer-songwriter live set',
      'Artisanal grazing tables and craft gin bar'
    ]
  },

  // --- DINNERS ---
  {
    id: 'd1',
    title: 'Candlelit Beachside Cabana',
    description: 'The ultimate romantic dinner. A private, beautifully styled bamboo canopy set directly on the sand, surrounded by lanterns and the soothing sound of crashing waves.',
    location: 'Hotel',
    category: 'Dinners',
    basePrice: 600,
    pricePerGuest: 150,
    maxGuests: 12,
    durationMinutes: 150,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=600',
    features: [
      'Dedicated private butler service',
      'Curated 5-course signature seafood tasting menu',
      'Premium wine pairings selected by our sommelier',
      'Private classical violinist playing during dinner',
      'Path of fire torches and fresh rose petals on the sand'
    ]
  },
  {
    id: 'd2',
    title: 'Infinity Poolside BBQ Feast',
    description: 'An energetic, chic open-air barbecue adjacent to the glowing infinity pool. Features active live grilling stations, floating neon pool installations, and premium mixology.',
    location: 'Villa',
    category: 'Dinners',
    basePrice: 850,
    pricePerGuest: 90,
    maxGuests: 40,
    durationMinutes: 180,
    image: 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&q=80&w=600',
    features: [
      'Private master grill chefs preparing food live',
      'Premium Wagyu cuts, rock lobsters, and organic skewers',
      'Unlimited standard open bar for 3 hours',
      'Floating lantern pool display',
      'Ambient lounge DJ set with custom lighting'
    ]
  },
  {
    id: 'd3',
    title: 'Sommelier Wine Cellar Dinner',
    description: 'An intimate, highly exclusive dining experience hosted within our underground stone cellar. Dine surrounded by dusty vintages and historic architecture.',
    location: 'Hotel',
    category: 'Dinners',
    basePrice: 1200,
    pricePerGuest: 200,
    maxGuests: 14,
    durationMinutes: 150,
    image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&q=80&w=600',
    features: [
      'Sommelier-guided flight of 6 rare vintage wines',
      'Degustation menu designed to pair with ancient vintages',
      'Cozy stone fireplace and timber candlelight setting',
      'Max capacity of 14 guests for supreme privacy',
      'Handcrafted artisan chocolates and digestifs'
    ]
  },
  {
    id: 'd4',
    title: 'Private Chef Garden Trellis Feast',
    description: 'An exquisite farm-to-table dinner set under a blooming jasmine trellis. Delight in seasonal, completely organic courses harvested and prepared on-site by your private chef.',
    location: 'Villa',
    category: 'Dinners',
    basePrice: 500,
    pricePerGuest: 110,
    maxGuests: 20,
    durationMinutes: 150,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=600',
    features: [
      'Custom seasonal menu tailored to dietary preferences',
      'Show-cooking explanation of local ingredients by the chef',
      'Sustainably sourced ingredients from local farms',
      'Fairy lights & rustic floral table runners',
      'Fresh botanical mocktails and natural biodynamic wines'
    ]
  },

  // --- RECREATION ACTIVITIES ---
  {
    id: 'a1',
    title: 'Sunrise Poolside Yoga',
    description: 'Awaken your body and mind with a rejuvenating vinyasa flow on floating wooden decks over our cliffside pools, guided by an expert yogi as the sky turns pastel.',
    location: 'Villa',
    category: 'Activities',
    basePrice: 150,
    pricePerGuest: 25,
    maxGuests: 16,
    durationMinutes: 90,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=600',
    features: [
      'Private 90-minute expert-led yoga and meditation session',
      'High-quality yoga mats, blocks, and linen towels provided',
      'Cold-pressed green juices and coconut water',
      'Aromatherapy calming mist treatment',
      'Sound bath integration using crystal singing bowls'
    ]
  },
  {
    id: 'a2',
    title: 'Tropical Mixology Masterclass',
    description: 'Unleash your inner bartender! Stand behind our spectacular beachfront bamboo bar and learn to create, shake, and garnish signature tropical cocktails from award-winning mixologists.',
    location: 'Hotel',
    category: 'Activities',
    basePrice: 200,
    pricePerGuest: 35,
    maxGuests: 12,
    durationMinutes: 120,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=600',
    features: [
      'Interactive 2-hour hands-on mixology session',
      'Learn to balance spirits, bitters, and fresh local flora',
      'Create and consume 3 unique craft cocktails',
      'Take-home premium steel shaker set & recipe book',
      'Platters of artisan woodfired flatbreads & dips'
    ]
  },
  {
    id: 'a3',
    title: 'Aromatherapy SPA & Sea-Facing Pavilion',
    description: 'Indulge in absolute luxury. A customized massage and facial therapy session performed by expert therapists inside an open-air pavilion hanging over the coastal rocks.',
    location: 'Hotel',
    category: 'Activities',
    basePrice: 300,
    pricePerGuest: 95,
    maxGuests: 8,
    durationMinutes: 120,
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=600',
    features: [
      '60-minute therapeutic massage using custom oil blends',
      '30-minute organic herbal facial and head therapy',
      'Private sea-facing jacuzzi soak with cold hibiscus tea',
      'Soft robes, organic linen towels, and slippers',
      'Access to relaxation steam room and sauna'
    ]
  },
  {
    id: 'a4',
    title: 'Private Yacht Charter & Snorkeling',
    description: 'Sail away on a gorgeous 45-foot catamaran. Snorkel with turtles, paddleboard in turquoise lagoons, and enjoy gourmet platters on the open deck with ocean breezes.',
    location: 'Both',
    category: 'Activities',
    basePrice: 1800,
    pricePerGuest: 110,
    maxGuests: 20,
    durationMinutes: 240,
    image: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&q=80&w=600',
    features: [
      '4-hour private catamaran cruise with experienced captain and crew',
      'Snorkeling gear, double kayaks, and paddleboards',
      'Sumptuous cold seafood and charcuterie board',
      'Free-flowing prosecco, beer, and soft drinks',
      'Stops at secluded tropical white-sand islands'
    ]
  },
  {
    id: 'a5',
    title: 'In-Water Floating Breakfast',
    description: 'Wake up to ultimate indulgence. A grand breakfast served on a handwoven floating tray inside your private infinity pool, styled with fresh orchids and champagne.',
    location: 'Villa',
    category: 'Activities',
    basePrice: 180,
    pricePerGuest: 45,
    maxGuests: 4,
    durationMinutes: 90,
    image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&q=80&w=600',
    features: [
      'Handcrafted floating wicker tray matching pool aesthetics',
      'Freshly baked pastries, sliced seasonal tropical fruits',
      'Smoked salmon bagels, avocado toast, and eggs Benedict',
      'Premium French press coffee or organic matcha latte',
      'Chilled half-bottle of premium champagne'
    ]
  },
  {
    id: 'a6',
    title: 'Alfresco Garden Cinema',
    description: 'Watch your favorite movies under a blanket of stars. Relax on oversized canvas beanbags on the manicured villa lawn, with gourmet popcorn and high-definition surround sound.',
    location: 'Villa',
    category: 'Activities',
    basePrice: 250,
    pricePerGuest: 15,
    maxGuests: 30,
    durationMinutes: 150,
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=600',
    features: [
      'Huge 150-inch professional outdoor projection screen',
      'Ultra-comfy double-layered beanbags and blankets',
      'Unlimited sweet & salty gourmet stove-popped popcorn',
      'Chilled vintage soda bar and gourmet candy baskets',
      'Wireless high-fidelity headphones or full surround speakers'
    ]
  }
];
