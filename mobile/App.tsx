import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
  StatusBar,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATALOG_ACTIVITIES } from './src/data/catalog';
import { EXPERIENCES } from './src/data/experiences';
import {
  EventActivity,
  ItineraryItem,
  EventCategory,
  UserProfile,
  LineKind,
  StayItem,
  TransferItem,
  TransferMode,
} from './src/types';
import { VENUES } from './src/data/venues';
import { MOCK_PROFILES } from './src/data/profiles';
import { roomTypesForVenue, getRoomType } from './src/data/stays';
import { TRANSFER_MODES, getTransferMode, priceTransfer } from './src/data/transfers';
import { computePackageTotals, stayLineTotal, transferLineTotal } from './src/lib/pricing';
import {
  addDaysISO,
  dateToISODate,
  dateToTimeHM,
  defaultDurationMinutes,
  findConflicts,
  findTransitGaps,
  formatDisplayDate,
  formatTimeRange,
  isValidISODate,
  isValidTimeHM,
  itemHasConflict,
  itemHasTransitGap,
  parseISODateToDate,
  parseTimeToDate,
  sortItineraryChronologically,
} from './src/lib/schedule';
import {
  evaluateOutdoorWeatherRisks,
  formatStationCoordinates,
} from './src/lib/weatherRisk';
import { buildWeatherEstimate } from './src/data/weatherStations';
import { getTransit } from './src/data/transit';

const MAP_VIEWBOX = { w: 800, h: 500 };
const MOOD_IMAGE_KEY = 'villa_hotel_mood_board_img';
const MOOD_PROMPT_KEY = 'villa_hotel_mood_board_prompt';
const FALLBACK_IMAGE = require('./assets/icon.png');

function weatherIconName(condition: string): keyof typeof Ionicons.glyphMap {
  const c = (condition || '').toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return 'thunderstorm-outline';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'rainy-outline';
  if (c.includes('snow') || c.includes('sleet')) return 'snow-outline';
  if (c.includes('cloud') || c.includes('overcast') || c.includes('fog') || c.includes('mist')) {
    return 'cloudy-outline';
  }
  if (c.includes('partly') || c.includes('broken')) return 'partly-sunny-outline';
  return 'sunny-outline';
}

const getApiUrl = () => {
  // Physical devices: set EXPO_PUBLIC_API_URL to your machine LAN IP, e.g. http://192.168.1.10:3000
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Catalog + curated experiences share the EventActivity shape for lookups. */
const ALL_ACTIVITIES: EventActivity[] = [...CATALOG_ACTIVITIES, ...EXPERIENCES];

function isValidItineraryItem(item: unknown): item is ItineraryItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.calculatedPrice === 'number' &&
    Number.isFinite(row.calculatedPrice) &&
    typeof row.guests === 'number' &&
    Number.isFinite(row.guests) &&
    typeof row.date === 'string' &&
    isValidISODate(row.date) &&
    typeof row.time === 'string' &&
    isValidTimeHM(row.time) &&
    (row.location === 'Villa' || row.location === 'Hotel') &&
    (row.category === 'Weddings' || row.category === 'Dinners' || row.category === 'Activities')
  );
}

function isValidStayItem(item: unknown): item is StayItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.venueId === 'string' &&
    typeof row.roomTypeId === 'string' &&
    typeof row.checkIn === 'string' &&
    isValidISODate(row.checkIn) &&
    typeof row.nights === 'number' &&
    Number.isFinite(row.nights) &&
    typeof row.rooms === 'number' &&
    Number.isFinite(row.rooms) &&
    typeof row.ratePerNight === 'number' &&
    Number.isFinite(row.ratePerNight)
  );
}

function normalizeStayItem(stay: StayItem): StayItem {
  const roomType = getRoomType(stay.roomTypeId);
  const rooms = Math.max(1, Math.round(stay.rooms || 1));
  const maxGuests = roomType ? roomType.sleeps * rooms : Number.POSITIVE_INFINITY;
  return {
    ...stay,
    nights: Math.min(60, Math.max(1, Math.round(stay.nights || 1))),
    rooms: roomType ? Math.min(roomType.count, rooms) : rooms,
    guests: Math.min(maxGuests, Math.max(1, Math.round(stay.guests || 1))),
    ratePerNight: roomType ? roomType.ratePerNight : Math.max(0, stay.ratePerNight || 0),
    notes: typeof stay.notes === 'string' ? stay.notes : undefined,
  };
}

function isValidTransferItem(item: unknown): item is TransferItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.fromVenueId === 'string' &&
    typeof row.toVenueId === 'string' &&
    row.fromVenueId !== row.toVenueId &&
    typeof row.mode === 'string' &&
    typeof row.date === 'string' &&
    isValidISODate(row.date) &&
    typeof row.time === 'string' &&
    isValidTimeHM(row.time) &&
    typeof row.pax === 'number' &&
    Number.isFinite(row.pax) &&
    typeof row.price === 'number' &&
    Number.isFinite(row.price)
  );
}

function normalizeTransferItem(transfer: TransferItem): TransferItem {
  const pax = Math.min(200, Math.max(1, Math.round(transfer.pax || 1)));
  const mode = getTransferMode(transfer.mode).id;
  return {
    ...transfer,
    mode,
    pax,
    price: priceTransfer(transfer.fromVenueId, transfer.toVenueId, mode, pax),
    notes: typeof transfer.notes === 'string' ? transfer.notes : undefined,
  };
}

function repriceItem(item: ItineraryItem): ItineraryItem {
  const associated = item.activityId
    ? ALL_ACTIVITIES.find((a) => a.id === item.activityId)
    : undefined;
  const venue = item.venueId ? VENUES.find((v) => v.id === item.venueId) : undefined;
  const maxGuests = Math.min(
    associated?.maxGuests ?? 500,
    venue?.capacity ?? Number.POSITIVE_INFINITY
  );
  const guests = Math.min(maxGuests, Math.max(1, item.guests));
  let calculatedPrice = item.calculatedPrice;
  let durationMinutes =
    typeof item.durationMinutes === 'number' &&
    Number.isFinite(item.durationMinutes) &&
    item.durationMinutes > 0
      ? Math.round(item.durationMinutes)
      : defaultDurationMinutes(item.category);

  if (associated) {
    calculatedPrice = associated.basePrice + associated.pricePerGuest * guests;
    durationMinutes = associated.durationMinutes;
  } else if (typeof item.basePrice === 'number' && Number.isFinite(item.basePrice)) {
    const ppg =
      typeof item.pricePerGuest === 'number' && Number.isFinite(item.pricePerGuest)
        ? Math.max(0, item.pricePerGuest)
        : 0;
    const base = Math.max(0, item.basePrice);
    calculatedPrice = base + ppg * guests;
  }
  return { ...item, guests, calculatedPrice, durationMinutes };
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

function App() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mobileEmail, setMobileEmail] = useState('');
  const [mobilePassword, setMobilePassword] = useState('');
  const [mobileAuthTab, setMobileAuthTab] = useState<'signin' | 'register'>('signin');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState('Bespoke Wedding Client');
  const [regBudget, setRegBudget] = useState('100000');
  const [mobileErrors, setMobileErrors] = useState<Record<string, string>>({});

  const [selectedLocation, setSelectedLocation] = useState<'All' | 'Villa' | 'Hotel'>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | EventCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogMode, setCatalogMode] = useState<'events' | 'experiences'>('events');
  const [activeTab, setActiveTab] = useState(0); // 0 Catalog, 1 Itinerary, 2 Map, 3 AI/Weather, 4 Summary

  // Itinerary state (events + experiences)
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  // Package add-ons kept in their own arrays so they never affect event scheduling.
  const [stays, setStays] = useState<StayItem[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [plannerName, setPlannerName] = useState('Signature Occasion');
  const [isHydrating, setIsHydrating] = useState(true);
  const hydrateGeneration = React.useRef(0);

  // Stay creation modal state
  const [stayModalVisible, setStayModalVisible] = useState(false);
  const [stayVenueId, setStayVenueId] = useState(VENUES[0]?.id ?? '');
  const [stayRoomTypeId, setStayRoomTypeId] = useState(roomTypesForVenue(VENUES[0]?.id ?? '')[0]?.id ?? '');
  const [stayCheckIn, setStayCheckIn] = useState(todayISO);
  const [stayNights, setStayNights] = useState('2');
  const [stayRooms, setStayRooms] = useState('1');
  const [stayGuests, setStayGuests] = useState('2');

  // Transfer creation modal state
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferFromId, setTransferFromId] = useState(VENUES[0]?.id ?? '');
  const [transferToId, setTransferToId] = useState(VENUES[1]?.id ?? '');
  const [transferMode, setTransferMode] = useState<TransferMode>('sedan');
  const [transferDate, setTransferDate] = useState(todayISO);
  const [transferTime, setTransferTime] = useState('12:00');
  const [transferPax, setTransferPax] = useState('2');

  // Custom Event Form State
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<EventCategory>('Weddings');
  const [customLocation, setCustomLocation] = useState<'Villa' | 'Hotel'>('Villa');
  const [customVenueId, setCustomVenueId] = useState('');
  const [customBasePrice, setCustomBasePrice] = useState('500');
  const [customPricePerGuest, setCustomPricePerGuest] = useState('25');
  const [customGuests, setCustomGuests] = useState('20');
  const [customDate, setCustomDate] = useState(todayISO);
  const [customTime, setCustomTime] = useState('18:00');
  const [customNotes, setCustomNotes] = useState('');
  const [weatherWarning, setWeatherWarning] = useState<string | null>(null);

  // Interactive Venue Map states
  const [selectedVenue, setSelectedVenue] = useState<any>(VENUES[0]);
  const [mapSelectedDate, setMapSelectedDate] = useState(todayISO());

  useEffect(() => {
    const firstMatching = VENUES.find((v) => v.type === customLocation);
    setCustomVenueId(firstMatching ? firstMatching.id : '');
  }, [customLocation]);

  // Keep the selected stay room type valid whenever the property changes
  useEffect(() => {
    const next = roomTypesForVenue(stayVenueId);
    setStayRoomTypeId((prev) => (next.some((r) => r.id === prev) ? prev : next[0]?.id ?? ''));
  }, [stayVenueId]);

  // Rename Modal State
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [tempPlannerName, setTempPlannerName] = useState('');

  // Weather state
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [destination, setDestination] = useState('Amalfi Coast, Italy');
  const [tempDestination, setTempDestination] = useState('Amalfi Coast, Italy');

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiImageUrl, setAiImageUrl] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [guestDrafts, setGuestDrafts] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [pickerTarget, setPickerTarget] = useState<null | {
    scope: 'item' | 'custom';
    id?: string;
    field: 'date' | 'time';
  }>(null);

  // Load state whenever currentUser changes (gate saves until hydration finishes)
  useEffect(() => {
    const userId = currentUser ? currentUser.id : 'guest';
    const generation = ++hydrateGeneration.current;
    setIsHydrating(true);
    setItinerary([]);
    setStays([]);
    setTransfers([]);

    const loadState = async () => {
      try {
        const savedItinerary = await AsyncStorage.getItem(`villa_hotel_itinerary_${userId}`);
        if (generation !== hydrateGeneration.current) return;

        if (savedItinerary) {
          const parsed = JSON.parse(savedItinerary);
          if (Array.isArray(parsed)) {
            setItinerary(
              parsed
                .filter(isValidItineraryItem)
                .map((item: ItineraryItem) =>
                  repriceItem({
                    ...item,
                    guests: Math.max(1, item.guests),
                    notes: typeof item.notes === 'string' ? item.notes : '',
                  })
                )
            );
          } else {
            setItinerary([]);
          }
        } else {
          setItinerary([]);
        }

        const savedStays = await AsyncStorage.getItem(`villa_hotel_stays_${userId}`);
        if (generation !== hydrateGeneration.current) return;
        if (savedStays) {
          const parsed = JSON.parse(savedStays);
          setStays(Array.isArray(parsed) ? parsed.filter(isValidStayItem).map(normalizeStayItem) : []);
        } else {
          setStays([]);
        }

        const savedTransfers = await AsyncStorage.getItem(`villa_hotel_transfers_${userId}`);
        if (generation !== hydrateGeneration.current) return;
        if (savedTransfers) {
          const parsed = JSON.parse(savedTransfers);
          setTransfers(
            Array.isArray(parsed) ? parsed.filter(isValidTransferItem).map(normalizeTransferItem) : []
          );
        } else {
          setTransfers([]);
        }

        const savedName = await AsyncStorage.getItem(`villa_hotel_planner_name_${userId}`);
        if (generation !== hydrateGeneration.current) return;
        setPlannerName(savedName || (currentUser ? `${currentUser.name}'s Celebration` : 'Signature Occasion'));
      } catch (e) {
        if (generation !== hydrateGeneration.current) return;
        console.error('Failed to load state from AsyncStorage', e);
        setItinerary([]);
        setStays([]);
        setTransfers([]);
        setPlannerName(currentUser ? `${currentUser.name}'s Celebration` : 'Signature Occasion');
      } finally {
        if (generation === hydrateGeneration.current) {
          setIsHydrating(false);
        }
      }
    };
    loadState();
  }, [currentUser]);

  // Fetch weather once on start + restore mood board
  useEffect(() => {
    fetchWeather('Amalfi Coast, Italy');
    (async () => {
      try {
        const [img, prompt] = await Promise.all([
          AsyncStorage.getItem(MOOD_IMAGE_KEY),
          AsyncStorage.getItem(MOOD_PROMPT_KEY),
        ]);
        if (img) setAiImageUrl(img);
        if (prompt) setAiPrompt(prompt);
      } catch (e) {
        console.error('Failed to load mood board', e);
      }
    })();
  }, []);

  // Persist via effect (updater stays pure for concurrent/Strict Mode safety)
  const saveItinerary = (
    updater: ItineraryItem[] | ((prev: ItineraryItem[]) => ItineraryItem[])
  ) => {
    if (isHydrating) return;
    setItinerary((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  useEffect(() => {
    if (isHydrating) return;
    const userId = currentUser ? currentUser.id : 'guest';
    const timer = setTimeout(() => {
      AsyncStorage.setItem(`villa_hotel_itinerary_${userId}`, JSON.stringify(itinerary)).catch(
        (e) => console.error('Failed to save itinerary', e)
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [itinerary, currentUser, isHydrating]);

  useEffect(() => {
    if (isHydrating) return;
    const userId = currentUser ? currentUser.id : 'guest';
    const timer = setTimeout(() => {
      AsyncStorage.setItem(`villa_hotel_stays_${userId}`, JSON.stringify(stays)).catch((e) =>
        console.error('Failed to save stays', e)
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [stays, currentUser, isHydrating]);

  useEffect(() => {
    if (isHydrating) return;
    const userId = currentUser ? currentUser.id : 'guest';
    const timer = setTimeout(() => {
      AsyncStorage.setItem(`villa_hotel_transfers_${userId}`, JSON.stringify(transfers)).catch((e) =>
        console.error('Failed to save transfers', e)
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [transfers, currentUser, isHydrating]);

  const applyGuestItineraryToUser = async (userId: string) => {
    try {
      const guestRaw = await AsyncStorage.getItem('villa_hotel_itinerary_guest');
      if (!guestRaw) return;
      const guestItems = JSON.parse(guestRaw);
      if (!Array.isArray(guestItems) || guestItems.length === 0) return;

      const userRaw = await AsyncStorage.getItem(`villa_hotel_itinerary_${userId}`);
      const userItems = userRaw ? JSON.parse(userRaw) : [];
      if (Array.isArray(userItems) && userItems.length > 0) {
        Alert.alert(
          'Guest itinerary kept separate',
          'You already have a saved itinerary on this account. Guest items were not overwritten.'
        );
        return;
      }

      await AsyncStorage.setItem(`villa_hotel_itinerary_${userId}`, JSON.stringify(guestItems));
      await AsyncStorage.removeItem('villa_hotel_itinerary_guest');
      const guestName = await AsyncStorage.getItem('villa_hotel_planner_name_guest');
      if (guestName) {
        await AsyncStorage.setItem(`villa_hotel_planner_name_${userId}`, guestName);
        await AsyncStorage.removeItem('villa_hotel_planner_name_guest');
      }

      // Carry over package add-ons alongside the itinerary
      const guestStays = await AsyncStorage.getItem('villa_hotel_stays_guest');
      if (guestStays) {
        await AsyncStorage.setItem(`villa_hotel_stays_${userId}`, guestStays);
        await AsyncStorage.removeItem('villa_hotel_stays_guest');
      }
      const guestTransfers = await AsyncStorage.getItem('villa_hotel_transfers_guest');
      if (guestTransfers) {
        await AsyncStorage.setItem(`villa_hotel_transfers_${userId}`, guestTransfers);
        await AsyncStorage.removeItem('villa_hotel_transfers_guest');
      }
    } catch (e) {
      console.error('Failed to migrate guest itinerary', e);
    }
  };

  const promptGuestMigration = async (user: UserProfile, then: () => void) => {
    try {
      const guestRaw = await AsyncStorage.getItem('villa_hotel_itinerary_guest');
      let guestCount = 0;
      try {
        const parsed = guestRaw ? JSON.parse(guestRaw) : [];
        guestCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        guestCount = 0;
      }

      const finish = async (migrate: boolean) => {
        if (migrate) await applyGuestItineraryToUser(user.id);
        then();
      };

      if (guestCount > 0) {
        Alert.alert(
          'Bring guest itinerary?',
          `You have ${guestCount} guest event(s). Move them onto this account if it is empty?`,
          [
            { text: 'Keep separate', style: 'cancel', onPress: () => finish(false) },
            { text: 'Bring over', onPress: () => finish(true) },
          ]
        );
      } else {
        await finish(false);
      }
    } catch (e) {
      console.error(e);
      then();
    }
  };

  // Weather API call with request sequencing to ignore stale responses
  const weatherRequestId = React.useRef(0);
  const fetchWeather = async (loc: string) => {
    const requestId = ++weatherRequestId.current;
    setWeatherLoading(true);
    setWeatherWarning(null);
    const softFallback = (label: string, message: string) => {
      setWeatherWarning(message);
      setWeatherData(buildWeatherEstimate(label));
    };
    try {
      const res = await fetch(`${getApiUrl()}/api/weather?location=${encodeURIComponent(loc)}`);
      const json = await res.json();
      if (requestId !== weatherRequestId.current) return;
      if (json.data) {
        setWeatherData(json.data);
        setDestination(json.data.locationName || loc);
        if (json.fallback || !json.success) {
          setWeatherWarning(json.error || 'Live weather unavailable. Showing an estimate.');
        } else {
          setWeatherWarning(null);
        }
      } else {
        softFallback(loc, json.error || 'Live weather unavailable. Showing an estimate.');
      }
    } catch (e) {
      if (requestId !== weatherRequestId.current) return;
      console.error('Error fetching weather', e);
      softFallback(
        loc,
        `Offline or unreachable API (${getApiUrl()}). Showing an estimate. Set EXPO_PUBLIC_API_URL on a physical device.`
      );
    } finally {
      if (requestId === weatherRequestId.current) {
        setWeatherLoading(false);
      }
    }
  };

  // AI Image generation
  const generateMoodBoard = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Prompt Required', 'Please enter a visual concept or theme description.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/gemini/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const json = await res.json();
      if (json.success && json.imageUrl) {
        setAiImageUrl(json.imageUrl);
        await AsyncStorage.setItem(MOOD_IMAGE_KEY, json.imageUrl);
        await AsyncStorage.setItem(MOOD_PROMPT_KEY, aiPrompt.trim());
      } else {
        Alert.alert('Generation Failed', json.error || 'Gemini did not return any image data.');
      }
    } catch (e) {
      console.error('Error generating image', e);
      Alert.alert('Connection Error', 'Failed to generate visual theme. Check if the server is running.');
    } finally {
      setAiLoading(false);
    }
  };

  // Add a catalog event or curated experience to the itinerary
  const addActivity = (activity: EventActivity, kind: LineKind = 'event') => {
    const guests = Math.min(10, activity.maxGuests);
    const targetLoc = activity.location === 'Both' ? 'Villa' : activity.location;
    const defaultVenue = VENUES.find((v) => v.type === targetLoc);

    const newItem: ItineraryItem = {
      id: createId(`itinerary-${activity.id}`),
      activityId: activity.id,
      title: activity.title,
      location: targetLoc,
      category: activity.category,
      kind,
      date: todayISO(),
      time: kind === 'experience' ? '16:00' : '14:00',
      guests,
      notes: '',
      basePrice: activity.basePrice,
      pricePerGuest: activity.pricePerGuest,
      calculatedPrice: activity.basePrice + activity.pricePerGuest * guests,
      venueId: defaultVenue ? defaultVenue.id : undefined,
      durationMinutes: activity.durationMinutes,
    };

    let added = false;
    saveItinerary((prev) => {
      if (prev.some((item) => item.activityId === activity.id)) {
        return prev;
      }
      added = true;
      return [...prev, newItem];
    });
    const label = kind === 'experience' ? 'experience' : 'itinerary';
    if (added) {
      Alert.alert('Success', `${activity.title} added to ${label}.`);
    } else {
      Alert.alert('Already Added', `This ${kind} is already in your plan.`);
    }
  };

  // ----- Stay handlers -----
  const addStay = () => {
    const roomType = getRoomType(stayRoomTypeId);
    if (!roomType) {
      Alert.alert('Select a room', 'Please choose a valid room type.');
      return;
    }
    if (!isValidISODate(stayCheckIn)) {
      Alert.alert('Invalid date', 'Enter a check-in date as YYYY-MM-DD.');
      return;
    }
    const nights = Math.min(60, Math.max(1, parseInt(stayNights.replace(/[^\d]/g, ''), 10) || 1));
    const rooms = Math.min(roomType.count, Math.max(1, parseInt(stayRooms.replace(/[^\d]/g, ''), 10) || 1));
    const guests = Math.min(
      roomType.sleeps * rooms,
      Math.max(1, parseInt(stayGuests.replace(/[^\d]/g, ''), 10) || 1)
    );
    const newStay: StayItem = {
      id: createId('stay'),
      venueId: stayVenueId,
      roomTypeId: stayRoomTypeId,
      checkIn: stayCheckIn,
      nights,
      rooms,
      guests,
      ratePerNight: roomType.ratePerNight,
    };
    setStays((prev) => [...prev, newStay]);
    setStayModalVisible(false);
    setStayNights('2');
    setStayRooms('1');
    setStayGuests('2');
    Alert.alert('Success', 'Stay added to your package.');
  };

  const removeStay = (id: string) => {
    Alert.alert('Remove stay?', 'This removes the accommodation from your package.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setStays((prev) => prev.filter((s) => s.id !== id)),
      },
    ]);
  };

  // ----- Transfer handlers -----
  const addTransfer = () => {
    if (transferFromId === transferToId) {
      Alert.alert('Choose two venues', 'Origin and destination must be different.');
      return;
    }
    if (!isValidISODate(transferDate)) {
      Alert.alert('Invalid date', 'Enter a transfer date as YYYY-MM-DD.');
      return;
    }
    if (!isValidTimeHM(transferTime)) {
      Alert.alert('Invalid time', 'Enter a pickup time as HH:MM.');
      return;
    }
    const pax = Math.min(200, Math.max(1, parseInt(transferPax.replace(/[^\d]/g, ''), 10) || 1));
    const newTransfer: TransferItem = {
      id: createId('transfer'),
      fromVenueId: transferFromId,
      toVenueId: transferToId,
      mode: transferMode,
      date: transferDate,
      time: transferTime,
      pax,
      price: priceTransfer(transferFromId, transferToId, transferMode, pax),
    };
    setTransfers((prev) => [...prev, newTransfer]);
    setTransferModalVisible(false);
    setTransferPax('2');
    Alert.alert('Success', 'Transfer added to your package.');
  };

  const removeTransfer = (id: string) => {
    Alert.alert('Remove transfer?', 'This removes the transfer from your package.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setTransfers((prev) => prev.filter((t) => t.id !== id)),
      },
    ]);
  };

  // Remove item from itinerary
  const removeItineraryItem = (id: string) => {
    Alert.alert('Remove event?', 'This removes the item from your itinerary.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => saveItinerary((prev) => prev.filter((item) => item.id !== id)),
      },
    ]);
  };

  // Update itinerary item guest/price
  const updateItineraryItem = (id: string, updates: Partial<ItineraryItem>) => {
    saveItinerary((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        let merged = { ...item, ...updates };
        if (updates.location && updates.location !== item.location) {
          const firstMatching = VENUES.find((v) => v.type === updates.location);
          merged.venueId = firstMatching ? firstMatching.id : undefined;
        }
        const beforeGuests = item.guests;
        merged = repriceItem(merged);
        if (merged.guests < beforeGuests || (updates.venueId && merged.guests < (updates.guests ?? beforeGuests))) {
          const venue = merged.venueId ? VENUES.find((v) => v.id === merged.venueId) : undefined;
          if (venue && beforeGuests > venue.capacity) {
            Alert.alert(
              'Guests adjusted',
              `${venue.name} holds up to ${venue.capacity} guests. Party size set to ${merged.guests}.`
            );
          }
        }
        return merged;
      })
    );
  };

  // Add custom activity
  const addCustomActivity = () => {
    if (!customTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for the custom event.');
      return;
    }

    if (!isValidISODate(customDate) || !isValidTimeHM(customTime)) {
      Alert.alert('Invalid schedule', 'Choose a valid date and time for the custom event.');
      return;
    }

    const base = parseFloat(customBasePrice);
    const ppg = parseFloat(customPricePerGuest);
    if (!Number.isFinite(base) || base < 0 || !Number.isFinite(ppg) || ppg < 0) {
      Alert.alert('Invalid price', 'Base and per-guest prices must be finite numbers ≥ 0.');
      return;
    }
    if (base > 1_000_000 || ppg > 1_000_000) {
      Alert.alert('Invalid price', 'Prices look unrealistically high. Please check the amounts.');
      return;
    }

    const venue = customVenueId ? VENUES.find((v) => v.id === customVenueId) : undefined;
    let guestsNum = Math.max(1, parseInt(customGuests, 10) || 1);
    if (venue) guestsNum = Math.min(guestsNum, venue.capacity);

    const newItem: ItineraryItem = {
      id: createId('itinerary-custom'),
      title: customTitle.trim(),
      location: customLocation,
      category: customCategory,
      date: customDate,
      time: customTime,
      guests: guestsNum,
      notes: customNotes,
      basePrice: base,
      pricePerGuest: ppg,
      calculatedPrice: base + ppg * guestsNum,
      venueId: customVenueId || undefined,
      durationMinutes: defaultDurationMinutes(customCategory),
    };

    saveItinerary((prev) => [...prev, newItem]);
    setCustomTitle('');
    setCustomNotes('');
    setCustomModalVisible(false);
    Alert.alert('Success', 'Bespoke custom event added to itinerary.');
  };

  // Edit planner name (works for guest and signed-in users)
  const savePlannerName = async () => {
    const next = tempPlannerName.trim();
    if (!next) {
      Alert.alert('Name required', 'Enter a name for this occasion.');
      return;
    }
    const userId = currentUser ? currentUser.id : 'guest';
    setPlannerName(next);
    try {
      await AsyncStorage.setItem(`villa_hotel_planner_name_${userId}`, next);
      setRenameModalVisible(false);
    } catch (e) {
      console.error('Failed to save planner name', e);
      Alert.alert('Save failed', 'Could not persist the occasion name.');
    }
  };

  // Filter activities for catalog tab
  const catalogSource = catalogMode === 'experiences' ? EXPERIENCES : CATALOG_ACTIVITIES;
  const filteredActivities = catalogSource.filter(a => {
    const matchesLoc = selectedLocation === 'All' || a.location === selectedLocation || a.location === 'Both';
    const matchesCat = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLoc && matchesCat && matchesSearch;
  });

  // Calculate totals
  const totals = useMemo(
    () => computePackageTotals({ itinerary, stays, transfers }),
    [itinerary, stays, transfers]
  );
  const totalCost = totals.grandTotal;
  const peakGuests = itinerary.reduce((max, item) => Math.max(max, item.guests), 0);

  // Live previews for the stay/transfer creation modals
  const stayRoomTypePreview = getRoomType(stayRoomTypeId);
  const stayNightsNum = Math.max(1, parseInt(stayNights.replace(/[^\d]/g, ''), 10) || 1);
  const stayRoomsNum = Math.max(1, parseInt(stayRooms.replace(/[^\d]/g, ''), 10) || 1);
  const stayPreviewTotal = stayRoomTypePreview
    ? stayRoomTypePreview.ratePerNight * stayNightsNum * stayRoomsNum
    : 0;
  const stayRoomTypesForVenue = roomTypesForVenue(stayVenueId);
  const transferSameVenue = transferFromId === transferToId;
  const transferPaxNum = Math.max(1, parseInt(transferPax.replace(/[^\d]/g, ''), 10) || 1);
  const transferPreviewPrice = transferSameVenue
    ? 0
    : priceTransfer(transferFromId, transferToId, transferMode, transferPaxNum);
  const conflicts = useMemo(() => findConflicts(itinerary), [itinerary]);
  const transitGaps = useMemo(() => findTransitGaps(itinerary), [itinerary]);
  const chronologicalItinerary = useMemo(
    () => sortItineraryChronologically(itinerary),
    [itinerary]
  );
  const weatherRiskPills = useMemo(
    () =>
      weatherData
        ? evaluateOutdoorWeatherRisks(weatherData.humidity, weatherData.windSpeed)
        : [],
    [weatherData]
  );
  const weatherStationCoords = useMemo(
    () =>
      weatherData
        ? formatStationCoordinates(weatherData.stationLat, weatherData.stationLng)
        : null,
    [weatherData]
  );
  const targetBudget = currentUser?.targetBudget ?? 0;
  const budgetDelta = targetBudget > 0 ? targetBudget - totalCost : null;

  // Category totals for summary chart
  const getCategoryTotal = (cat: EventCategory) => {
    return itinerary.filter(item => item.category === cat).reduce((sum, item) => sum + item.calculatedPrice, 0);
  };
  const weddingsCost = getCategoryTotal('Weddings');
  const dinnersCost = getCategoryTotal('Dinners');
  const activitiesCost = getCategoryTotal('Activities');
  const chartTotal = weddingsCost + dinnersCost + activitiesCost;

  // Custom segmented progress bar percentages
  const wedPct = chartTotal > 0 ? (weddingsCost / chartTotal) * 100 : 0;
  const dinPct = chartTotal > 0 ? (dinnersCost / chartTotal) * 100 : 0;
  const actPct = chartTotal > 0 ? (activitiesCost / chartTotal) * 100 : 0;

  const handleMobileSignIn = async () => {
    setMobileErrors({});
    const emailVal = mobileEmail.trim();
    const passVal = mobilePassword.trim();
    const newErrors: Record<string, string> = {};

    if (!emailVal) {
      newErrors.email = 'Please enter your email address.';
    }
    if (!passVal) {
      newErrors.password = 'Please enter your password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setMobileErrors(newErrors);
      return;
    }

    const emailLower = emailVal.toLowerCase();
    let found = MOCK_PROFILES.find((p) => p.email.toLowerCase() === emailLower);

    if (!found) {
      try {
        const customStr = await AsyncStorage.getItem('villa_hotel_custom_profiles');
        if (customStr) {
          const parsed = JSON.parse(customStr);
          if (Array.isArray(parsed)) {
            found = parsed.find((p) => p.email.toLowerCase() === emailLower);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (found) {
      await promptGuestMigration(found, () => {
        setCurrentUser(found);
        setShowLoginModal(false);
        setMobileEmail('');
        setMobilePassword('');
      });
    } else {
      setMobileErrors({
        email: 'This email is not registered. Please sign up using the Register tab or choose a Quick-Login profile below.',
      });
    }
  };

  const handleMobileRegister = async () => {
    setMobileErrors({});
    const nameVal = regName.trim();
    const emailVal = regEmail.trim();
    const budgetVal = parseFloat(regBudget);
    const newErrors: Record<string, string> = {};

    if (!nameVal) {
      newErrors.regName = 'Please enter your full name.';
    }
    if (!emailVal) {
      newErrors.regEmail = 'Please enter your email address.';
    }
    if (isNaN(budgetVal) || budgetVal <= 0) {
      newErrors.regBudget = 'Please enter a valid target budget greater than $0.';
    }

    if (Object.keys(newErrors).length > 0) {
      setMobileErrors(newErrors);
      return;
    }

    const emailLower = emailVal.toLowerCase();

    // Check duplicate
    const isMock = MOCK_PROFILES.some((p) => p.email.toLowerCase() === emailLower);
    let customProfiles: UserProfile[] = [];
    try {
      const customStr = await AsyncStorage.getItem('villa_hotel_custom_profiles');
      if (customStr) {
        const parsed = JSON.parse(customStr);
        if (Array.isArray(parsed)) customProfiles = parsed;
      }
    } catch (e) {
      console.error(e);
    }

    const isCustom = customProfiles.some((p) => p.email.toLowerCase() === emailLower);
    if (isMock || isCustom) {
      setMobileErrors({
        regEmail: 'This email address is already registered. Please Sign In instead.',
      });
      return;
    }

    const newProfile: UserProfile = {
      id: `custom_${Date.now()}`,
      name: nameVal,
      email: emailLower,
      role: regRole,
      targetBudget: budgetVal,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
    };

    try {
      customProfiles.push(newProfile);
      await AsyncStorage.setItem('villa_hotel_custom_profiles', JSON.stringify(customProfiles));
      await promptGuestMigration(newProfile, () => {
        setCurrentUser(newProfile);
        setShowLoginModal(false);
        setRegName('');
        setRegEmail('');
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save new profile. Please try again.');
    }
  };

  if (!isStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ScrollView contentContainerStyle={styles.landingContainer}>
          {/* Logo Brand Icon */}
          <View style={styles.landingLogoCircle}>
            <Text style={styles.landingLogoText}>V</Text>
          </View>

          <Text style={styles.landingBrandTitle}>VILLA & VALE</Text>
          <Text style={styles.landingSlogan}>Resorts &amp; Celebrations</Text>
          
          <View style={styles.landingGoldDivider} />

          <Text style={styles.landingDesc}>
            Explore our curated catalog of weddings, seaside dinners, and luxury excursions, and model your event itinerary with live weather grounding and Gemini visual theme concept rendering.
          </Text>

          {/* Highlights grid */}
          <View style={styles.landingGrid}>
            <View style={styles.landingGridItem}>
              <Ionicons name="compass-outline" size={20} color="#c5a267" />
              <Text style={styles.landingGridTitle}>Curated Catalogs</Text>
              <Text style={styles.landingGridDesc}>High-end weddings, dinners, and excursions at elite Italian venues.</Text>
            </View>
            <View style={styles.landingGridItem}>
              <Ionicons name="create-outline" size={20} color="#c5a267" />
              <Text style={styles.landingGridTitle}>Bespoke Setup</Text>
              <Text style={styles.landingGridDesc}>Custom base prices, multipliers, and direct notes for coordination.</Text>
            </View>
            <View style={styles.landingGridItem}>
              <Ionicons name="color-palette-outline" size={20} color="#c5a267" />
              <Text style={styles.landingGridTitle}>Gemini AI Concepts</Text>
              <Text style={styles.landingGridDesc}>Prompt Gemini models to visualize concepts instantly.</Text>
            </View>
            <View style={styles.landingGridItem}>
              <Ionicons name="cloudy-outline" size={20} color="#c5a267" />
              <Text style={styles.landingGridTitle}>Live Forecasts</Text>
              <Text style={styles.landingGridDesc}>Micro-climate weather intelligence embedded into schedules.</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.landingCta} onPress={() => setIsStarted(true)}>
            <Text style={styles.landingCtaText}>Begin Planning Journey</Text>
            <Ionicons name="arrow-forward" size={14} color="#000" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandTitle}>VILLA & VALE</Text>
          <TouchableOpacity onPress={() => { setTempPlannerName(plannerName); setRenameModalVisible(true); }} style={styles.plannerNameRow} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={styles.plannerName} numberOfLines={1} ellipsizeMode="tail">
              {plannerName}
            </Text>
            <Ionicons name="create-outline" size={13} color="#c5a267" style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {currentUser ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderColor: '#222', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, marginRight: 10 }}>
              <Image source={{ uri: currentUser.avatar }} style={{ width: 18, height: 18, borderRadius: 9, marginRight: 6 }} />
              <TouchableOpacity onPress={() => setCurrentUser(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="log-out-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowLoginModal(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ backgroundColor: '#111', borderColor: '#222', borderWidth: 1, padding: 10, borderRadius: 10, marginRight: 10 }}
            >
              <Ionicons name="log-in-outline" size={16} color="#c5a267" />
            </TouchableOpacity>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.headerCostLabel}>Est. Budget</Text>
            <Text style={styles.headerCost}>${totalCost.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Main Tabs Container */}
      <View style={{ flex: 1 }}>
        {activeTab === 0 && (
          <View style={styles.tabContent}>
            {/* Catalog Filter Controls */}
            <View style={styles.filterSection}>
              {/* Events vs Experiences toggle */}
              <View style={styles.catalogModeRow}>
                <TouchableOpacity
                  onPress={() => setCatalogMode('events')}
                  style={[styles.catalogModeBtn, catalogMode === 'events' && styles.catalogModeBtnActive]}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={13}
                    color={catalogMode === 'events' ? '#000' : '#c5a267'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.catalogModeText, catalogMode === 'events' && styles.catalogModeTextActive]}>
                    Events
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCatalogMode('experiences')}
                  style={[styles.catalogModeBtn, catalogMode === 'experiences' && styles.catalogModeBtnActive]}
                >
                  <Ionicons
                    name="compass-outline"
                    size={13}
                    color={catalogMode === 'experiences' ? '#000' : '#c5a267'}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.catalogModeText,
                      catalogMode === 'experiences' && styles.catalogModeTextActive,
                    ]}
                  >
                    Experiences
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {/* Location Selectors */}
                <TouchableOpacity
                  onPress={() => setSelectedLocation('All')}
                  style={[styles.filterTag, selectedLocation === 'All' && styles.filterTagActive]}
                >
                  <Text style={[styles.filterTagText, selectedLocation === 'All' && styles.filterTagTextActive]}>All Venues</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedLocation('Villa')}
                  style={[styles.filterTag, selectedLocation === 'Villa' && styles.filterTagActive]}
                >
                  <Text style={[styles.filterTagText, selectedLocation === 'Villa' && styles.filterTagTextActive]}>Villas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedLocation('Hotel')}
                  style={[styles.filterTag, selectedLocation === 'Hotel' && styles.filterTagActive]}
                >
                  <Text style={[styles.filterTagText, selectedLocation === 'Hotel' && styles.filterTagTextActive]}>Hotels</Text>
                </TouchableOpacity>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterRow, { marginTop: 8 }]}>
                {/* Category Selectors */}
                <TouchableOpacity
                  onPress={() => setSelectedCategory('All')}
                  style={[styles.filterTag, selectedCategory === 'All' && styles.filterTagActive]}
                >
                  <Text style={[styles.filterTagText, selectedCategory === 'All' && styles.filterTagTextActive]}>All Events</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedCategory('Weddings')}
                  style={[styles.filterTag, selectedCategory === 'Weddings' && styles.filterTagActive]}
                >
                  <Text style={[styles.filterTagText, selectedCategory === 'Weddings' && styles.filterTagTextActive]}>Weddings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedCategory('Dinners')}
                  style={[styles.filterTag, selectedCategory === 'Dinners' && styles.filterTagActive]}
                >
                  <Text style={[styles.filterTagText, selectedCategory === 'Dinners' && styles.filterTagTextActive]}>Dinners</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedCategory('Activities')}
                  style={[styles.filterTag, selectedCategory === 'Activities' && styles.filterTagActive]}
                >
                  <Text style={[styles.filterTagText, selectedCategory === 'Activities' && styles.filterTagTextActive]}>Activities</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Search input */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={15} color="#888" style={{ marginRight: 6 }} />
                <TextInput
                  placeholder="Search curated activities..."
                  placeholderTextColor="#666"
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* Catalog Grid List */}
            <ScrollView contentContainerStyle={styles.scrollList}>
              {filteredActivities.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="compass-outline" size={32} color="#666" />
                  <Text style={styles.emptyStateText}>No activities matching filters.</Text>
                </View>
              ) : (
                filteredActivities.map(activity => {
                  const isAdded = itinerary.some(item => item.activityId === activity.id);
                  const imageBroken = brokenImages[activity.id];
                  return (
                    <View key={activity.id} style={styles.card}>
                      <Image
                        source={imageBroken ? FALLBACK_IMAGE : { uri: activity.image }}
                        style={styles.cardImage}
                        defaultSource={FALLBACK_IMAGE}
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [activity.id]: true }))
                        }
                      />
                      <View style={styles.cardBadgeRow}>
                        <Text style={styles.cardBadge}>{activity.category.toUpperCase()}</Text>
                        <Text style={[styles.cardBadge, { backgroundColor: '#1c1917', color: '#c5a267', marginLeft: 6 }]}>
                          {activity.location.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>{activity.title}</Text>
                        <Text style={styles.cardDesc}>{activity.description}</Text>
                        
                        <View style={styles.cardMetaRow}>
                          <Text style={styles.cardPriceInfo}>
                            Base: ${activity.basePrice} | +${activity.pricePerGuest}/guest · max {activity.maxGuests}
                          </Text>
                        </View>
                        {activity.features.slice(0, 2).map((feat) => (
                          <Text key={feat} style={styles.cardFeatureLine}>
                            · {feat}
                          </Text>
                        ))}

                        <TouchableOpacity
                          style={[styles.addButton, isAdded && styles.addButtonActive]}
                          disabled={isAdded}
                          onPress={() => {
                            if (!isAdded) addActivity(activity, catalogMode === 'experiences' ? 'experience' : 'event');
                          }}
                        >
                          <Ionicons name={isAdded ? "checkmark-circle-outline" : "add-outline"} size={16} color={isAdded ? "#4ade80" : "#000000"} />
                          <Text style={[styles.addButtonText, isAdded && styles.addButtonTextActive]}>
                            {isAdded
                              ? catalogMode === 'experiences' ? 'Added to Package' : 'Added to Itinerary'
                              : catalogMode === 'experiences' ? 'Add to Package' : 'Add to Itinerary'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {activeTab === 1 && (
          <KeyboardAvoidingView
            style={styles.tabContent}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={88}
          >
            <View style={styles.itineraryHeader}>
              <Text style={styles.sectionTitle}>Your Package</Text>
              <TouchableOpacity style={styles.bespokeButton} onPress={() => setCustomModalVisible(true)}>
                <Ionicons name="add-outline" size={14} color="#000" />
                <Text style={styles.bespokeButtonText}>Custom Event</Text>
              </TouchableOpacity>
            </View>

            {/* Package add-on actions */}
            <View style={styles.packageActionRow}>
              <TouchableOpacity
                style={styles.packageActionBtn}
                onPress={() => setStayModalVisible(true)}
              >
                <Ionicons name="bed-outline" size={15} color="#c5a267" />
                <Text style={styles.packageActionText}>Add Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.packageActionBtn}
                onPress={() => setTransferModalVisible(true)}
              >
                <Ionicons name="car-sport-outline" size={15} color="#c5a267" />
                <Text style={styles.packageActionText}>Add Transfer</Text>
              </TouchableOpacity>
            </View>

            {conflicts.length > 0 && (
              <View style={styles.conflictBanner}>
                <Ionicons name="warning-outline" size={16} color="#f59e0b" />
                <Text style={styles.conflictBannerText}>
                  {conflicts.length} schedule conflict{conflicts.length === 1 ? '' : 's'} at the same venue
                </Text>
              </View>
            )}
            {transitGaps.length > 0 && (
              <View style={[styles.conflictBanner, { borderColor: '#38bdf8' }]}>
                <Ionicons name="car-outline" size={16} color="#38bdf8" />
                <Text style={[styles.conflictBannerText, { color: '#7dd3fc' }]}>
                  {transitGaps.length} coastal drive{transitGaps.length === 1 ? '' : 's'} too tight
                </Text>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollList} keyboardShouldPersistTaps="handled">
              {chronologicalItinerary.length === 0 && stays.length === 0 && transfers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={36} color="#666" />
                  <Text style={styles.emptyStateText}>Your package is empty.</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Add events or experiences from the catalog, or add a stay or transfer above.
                  </Text>
                </View>
              ) : (
                chronologicalItinerary.map(item => {
                  const hasConflict = itemHasConflict(item.id, conflicts);
                  const hasTransitGap = itemHasTransitGap(item.id, transitGaps);
                  const venue = item.venueId ? VENUES.find((v) => v.id === item.venueId) : undefined;
                  const overCapacity = venue ? item.guests > venue.capacity : false;
                  return (
                  <View
                    key={item.id}
                    style={[
                      styles.itineraryCard,
                      (hasConflict || hasTransitGap) && styles.itineraryCardConflict,
                    ]}
                  >
                    <View style={styles.itineraryCardHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.itineraryCardTitle}>{item.title}</Text>
                        <Text style={styles.itineraryCardMeta}>
                          {item.category} • {item.location} · {formatTimeRange(item)}
                        </Text>
                        {hasConflict && (
                          <Text style={styles.conflictChip}>Overlaps another event here</Text>
                        )}
                        {hasTransitGap && (
                          <Text style={styles.conflictChip}>Coastal drive too short</Text>
                        )}
                        {overCapacity && venue && (
                          <Text style={styles.conflictChip}>
                            Over {venue.name} capacity ({venue.capacity})
                          </Text>
                        )}
                        {CATALOG_ACTIVITIES.find((a) => a.id === item.activityId)?.location ===
                          'Both' && (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                              onPress={() => updateItineraryItem(item.id, { location: 'Villa' })}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 6,
                                backgroundColor:
                                  item.location === 'Villa' ? '#c5a267' : '#1a1a1a',
                                borderWidth: 1,
                                borderColor: '#2a2a2a',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: item.location === 'Villa' ? '#000' : '#aaa',
                                }}
                              >
                                Villa
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => updateItineraryItem(item.id, { location: 'Hotel' })}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 6,
                                backgroundColor:
                                  item.location === 'Hotel' ? '#c5a267' : '#1a1a1a',
                                borderWidth: 1,
                                borderColor: '#2a2a2a',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: item.location === 'Hotel' ? '#000' : '#aaa',
                                }}
                              >
                                Hotel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => removeItineraryItem(item.id)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{ padding: 8 }}
                        accessibilityLabel="Remove event"
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Inputs to customize details */}
                    <View style={styles.itineraryInputsRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.inputLabel}>Date</Text>
                        <TouchableOpacity
                          style={styles.inlineInput}
                          onPress={() => setPickerTarget({ scope: 'item', id: item.id, field: 'date' })}
                        >
                          <Text style={styles.pickerValueText}>{item.date}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.inputLabel}>Time</Text>
                        <TouchableOpacity
                          style={styles.inlineInput}
                          onPress={() => setPickerTarget({ scope: 'item', id: item.id, field: 'time' })}
                        >
                          <Text style={styles.pickerValueText}>{item.time}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Guests</Text>
                        <TextInput
                          style={styles.inlineInput}
                          keyboardType="number-pad"
                          value={guestDrafts[item.id] ?? String(item.guests)}
                          onChangeText={(text) =>
                            setGuestDrafts((prev) => ({ ...prev, [item.id]: text }))
                          }
                          onBlur={() => {
                            const raw = guestDrafts[item.id];
                            if (raw === undefined) return;
                            const val = Math.max(1, parseInt(raw.replace(/[^\d]/g, ''), 10) || 1);
                            updateItineraryItem(item.id, { guests: val });
                            setGuestDrafts((prev) => {
                              const next = { ...prev };
                              delete next[item.id];
                              return next;
                            });
                          }}
                        />
                      </View>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.inputLabel}>Venue Assignment</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingVertical: 4 }}
                        style={{ flexDirection: 'row', marginTop: 4 }}
                      >
                        {VENUES.filter((v) => v.type === item.location).map((v) => (
                          <TouchableOpacity
                            key={v.id}
                            onPress={() => updateItineraryItem(item.id, { venueId: v.id })}
                            style={[
                              styles.venuePillMobile,
                              item.venueId === v.id && styles.venuePillMobileActive,
                              { marginRight: 8 }
                            ]}
                          >
                            <Text
                              style={[
                                styles.venuePillMobileText,
                                item.venueId === v.id && styles.venuePillMobileTextActive,
                              ]}
                            >
                              {v.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.inputLabel}>Notes</Text>
                      <TextInput
                        style={[styles.inlineInput, { height: 40, textAlignVertical: 'top' }]}
                        multiline
                        placeholder="Add custom notes or requests..."
                        placeholderTextColor="#555"
                        value={item.notes}
                        onChangeText={(text) => updateItineraryItem(item.id, { notes: text })}
                      />
                    </View>

                    <View style={styles.itineraryCostRow}>
                      <Text style={styles.itineraryCostLabel}>Calculated Price</Text>
                      <Text style={styles.itineraryCostVal}>${item.calculatedPrice.toLocaleString()}</Text>
                    </View>
                  </View>
                  );
                })
              )}

              {/* Stays */}
              {stays.length > 0 && (
                <>
                  <Text style={styles.packageSectionLabel}>Accommodation</Text>
                  {stays.map((stay) => {
                    const venue = VENUES.find((v) => v.id === stay.venueId);
                    const roomType = getRoomType(stay.roomTypeId);
                    return (
                      <View key={stay.id} style={styles.itineraryCard}>
                        <View style={styles.itineraryCardHeader}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.itineraryCardTitle}>{roomType?.name ?? 'Room'}</Text>
                            <Text style={styles.itineraryCardMeta}>
                              {venue?.name ?? 'Venue'} · {formatDisplayDate(stay.checkIn)} →{' '}
                              {formatDisplayDate(addDaysISO(stay.checkIn, Math.max(1, Math.round(stay.nights))))}
                            </Text>
                            <Text style={styles.itineraryCardMeta}>
                              {stay.nights} night{stay.nights === 1 ? '' : 's'} · {stay.rooms} room
                              {stay.rooms === 1 ? '' : 's'} · {stay.guests} guest{stay.guests === 1 ? '' : 's'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeStay(stay.id)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{ padding: 8 }}
                            accessibilityLabel="Remove stay"
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.itineraryCostRow}>
                          <Text style={styles.itineraryCostLabel}>
                            ${stay.ratePerNight.toLocaleString()}/night
                          </Text>
                          <Text style={styles.itineraryCostVal}>${stayLineTotal(stay).toLocaleString()}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              {/* Transfers */}
              {transfers.length > 0 && (
                <>
                  <Text style={styles.packageSectionLabel}>Transfers</Text>
                  {transfers.map((transfer) => {
                    const fromVenue = VENUES.find((v) => v.id === transfer.fromVenueId);
                    const toVenue = VENUES.find((v) => v.id === transfer.toVenueId);
                    const modeInfo = getTransferMode(transfer.mode);
                    return (
                      <View key={transfer.id} style={styles.itineraryCard}>
                        <View style={styles.itineraryCardHeader}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.itineraryCardTitle}>
                              {fromVenue?.name ?? 'Origin'} → {toVenue?.name ?? 'Destination'}
                            </Text>
                            <Text style={styles.itineraryCardMeta}>
                              {modeInfo.label} · {formatDisplayDate(transfer.date)} · {transfer.time} ·{' '}
                              {transfer.pax} pax
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeTransfer(transfer.id)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{ padding: 8 }}
                            accessibilityLabel="Remove transfer"
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.itineraryCostRow}>
                          <Text style={styles.itineraryCostLabel}>Coastal transfer</Text>
                          <Text style={styles.itineraryCostVal}>
                            ${transferLineTotal(transfer).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {activeTab === 2 && (
          <ScrollView contentContainerStyle={[styles.scrollList, styles.tabContent]}>
            <Text style={styles.sectionTitle}>Amalfi Venues & Route Map</Text>
            
            {/* Date Filter Pills */}
            <View style={{ marginBottom: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {Array.from(new Set(itinerary.map((item) => item.date))).sort().map((date) => (
                  <TouchableOpacity
                    key={date}
                    onPress={() => setMapSelectedDate(date)}
                    style={[
                      styles.filterTag,
                      mapSelectedDate === date && styles.filterTagActive,
                      { marginRight: 8 }
                    ]}
                  >
                    <Text style={[
                      styles.filterTagText,
                      mapSelectedDate === date && styles.filterTagTextActive
                    ]}>
                      {date.substring(5)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Stylized Coastal Map Visualizer */}
            <View style={styles.mapCardMobile}>
              {/* Coastline visual line */}
              <View style={styles.mapCoastlineLine} />
              
              {/* Town labels */}
              <View style={[styles.townLabelMobile, { left: '8%', top: '15%' }]}>
                <Text style={styles.townLabelTextMobile}>Sorrento</Text>
              </View>
              <View style={[styles.townLabelMobile, { left: '32%', top: '48%' }]}>
                <Text style={styles.townLabelTextMobile}>Positano</Text>
              </View>
              <View style={[styles.townLabelMobile, { left: '55%', top: '42%' }]}>
                <Text style={styles.townLabelTextMobile}>Amalfi</Text>
              </View>
              <View style={[styles.townLabelMobile, { left: '76%', top: '10%' }]}>
                <Text style={styles.townLabelTextMobile}>Ravello</Text>
              </View>

              {/* Venue Pins — positions from venue x/y (web viewBox 800×500) */}
              {VENUES.map((venue) => {
                const isSelected = selectedVenue?.id === venue.id;
                const hasEventToday = itinerary.some(
                  (e) => e.date === mapSelectedDate && e.venueId === venue.id
                );
                const pinStyle = {
                  left: `${(venue.x / MAP_VIEWBOX.w) * 100}%` as `${number}%`,
                  top: `${(venue.y / MAP_VIEWBOX.h) * 100}%` as `${number}%`,
                };

                return (
                  <TouchableOpacity
                    key={venue.id}
                    onPress={() => setSelectedVenue(venue)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.mapPinMobile,
                      pinStyle,
                      isSelected && styles.mapPinMobileSelected,
                    ]}
                  >
                    {hasEventToday && (
                      <View style={[
                        styles.mapPinPulse,
                        { backgroundColor: venue.type === 'Villa' ? '#c5a267' : '#f59e0b' }
                      ]} />
                    )}
                    <View style={[
                      styles.mapPinDot,
                      { backgroundColor: isSelected ? '#c5a267' : (venue.type === 'Villa' ? '#000' : '#f59e0b') },
                      { borderColor: venue.type === 'Villa' ? '#c5a267' : '#f59e0b' }
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Venue info card */}
            {selectedVenue && (
              <View style={styles.venueDetailsCardMobile}>
                <View style={styles.venueDetailsHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.venueTypeLabel}>{selectedVenue.type.toUpperCase()}</Text>
                    <Text style={styles.venueNameText}>{selectedVenue.name}</Text>
                  </View>
                  <View style={styles.venueCapacityBadge}>
                    <Text style={styles.venueCapacityText}>Max {selectedVenue.capacity}</Text>
                  </View>
                </View>
                <Text style={styles.venueDescriptionText}>{selectedVenue.description}</Text>
                
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#222' }}>
                  <Text style={styles.bookingsLabel}>
                    Bookings on {mapSelectedDate.substring(5)}
                  </Text>
                  {itinerary.filter(
                    (item) => item.venueId === selectedVenue.id && item.date === mapSelectedDate
                  ).length === 0 ? (
                    <Text style={styles.noBookingsText}>No sessions on this date at this location.</Text>
                  ) : (
                    itinerary
                      .filter(
                        (item) => item.venueId === selectedVenue.id && item.date === mapSelectedDate
                      )
                      .map((item) => (
                        <View key={item.id} style={styles.bookingRow}>
                          <Text style={styles.bookingTitle}>{item.title}</Text>
                          <Text style={styles.bookingTime}>{item.date} @ {item.time}</Text>
                        </View>
                      ))
                  )}
                </View>
              </View>
            )}

            {/* Daily Routing Sequencer */}
            <View style={styles.routeContainerMobile}>
              <Text style={styles.routeSectionTitle}>Transit Sequence ({mapSelectedDate})</Text>
              {itinerary.filter((i) => i.date === mapSelectedDate && i.venueId).length === 0 ? (
                <Text style={styles.noBookingsText}>No events scheduled on this date.</Text>
              ) : (
                itinerary
                  .filter((i) => i.date === mapSelectedDate && i.venueId)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((item, idx, arr) => {
                    const venue = VENUES.find((v) => v.id === item.venueId);
                    const nextItem = arr[idx + 1];
                    const nextVenue = nextItem ? VENUES.find((v) => v.id === nextItem.venueId) : null;
                    const transitInfo =
                      nextVenue && venue ? getTransit(venue.id, nextVenue.id) : null;
                    const tight =
                      Boolean(
                        transitInfo &&
                          nextItem &&
                          transitGaps.some((g) => g.fromId === item.id && g.toId === nextItem.id)
                      );

                    return (
                      <View key={item.id} style={{ marginBottom: 12 }}>
                        <View style={styles.routeItemRow}>
                          <View style={styles.routeNumberCircle}>
                            <Text style={styles.routeNumberText}>{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.routeItemTitle}>{item.title}</Text>
                            <Text style={styles.routeItemVenue}>{venue?.name}</Text>
                          </View>
                          <Text style={styles.routeItemTime}>{item.time}</Text>
                        </View>
                        {transitInfo && (
                          <View style={styles.transitRow}>
                            <Ionicons
                              name="car"
                              size={14}
                              color={tight ? '#38bdf8' : '#f59e0b'}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.transitText, tight && { color: '#7dd3fc' }]}>
                              Amalfi Coastal Drive: {transitInfo.duration} ({transitInfo.distance})
                              {tight ? ' · too tight' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
              )}
            </View>
          </ScrollView>
        )}

        {activeTab === 3 && (
          <ScrollView contentContainerStyle={[styles.scrollList, styles.tabContent]}>
            {/* Weather Section */}
            <Text style={styles.sectionTitle}>Amalfi Local Weather</Text>
            <View style={styles.weatherCard}>
              <View style={styles.weatherSearchRow}>
                <TextInput
                  style={styles.weatherSearchInput}
                  value={tempDestination}
                  onChangeText={setTempDestination}
                  placeholder="Enter location (e.g. Amalfi, Malibu)"
                  placeholderTextColor="#666"
                />
                <TouchableOpacity style={styles.weatherSearchBtn} onPress={() => fetchWeather(tempDestination)}>
                  <Ionicons name="search-outline" size={15} color="#000" />
                </TouchableOpacity>
              </View>

              {weatherLoading ? (
                <ActivityIndicator color="#c5a267" style={{ marginVertical: 20 }} />
              ) : weatherData ? (
                <View>
                  {weatherWarning ? (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ color: '#F59E0B', fontSize: 12, marginBottom: 8, fontWeight: '600' }}>
                        {weatherWarning}
                      </Text>
                      <TouchableOpacity
                        style={styles.retryChip}
                        onPress={() => fetchWeather(tempDestination || destination)}
                      >
                        <Text style={styles.retryChipText}>Retry live weather</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <View style={styles.weatherMain}>
                    <Ionicons
                      name={weatherIconName(weatherData.condition || '')}
                      size={32}
                      color="#c5a267"
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.weatherTemp}>{weatherData.currentTemp}°C</Text>
                      <Text style={styles.weatherLoc}>{weatherData.locationName}</Text>
                      {(weatherData.stationName || weatherStationCoords) ? (
                        <Text style={styles.weatherStationLine}>
                          {weatherData.stationName
                            ? `${weatherData.stationName}`
                            : 'Weather station'}
                          {weatherStationCoords ? `\n${weatherStationCoords}` : ''}
                        </Text>
                      ) : null}
                      <Text style={styles.weatherDetailText}>{weatherData.condition}</Text>
                    </View>
                  </View>
                  <View style={styles.weatherDetails}>
                    <Text style={styles.weatherDetailText}>Humidity: {weatherData.humidity}%</Text>
                    <Text style={styles.weatherDetailText}>Wind Speed: {weatherData.windSpeed}</Text>
                  </View>

                  {weatherRiskPills.length > 0 && (
                    <View style={styles.weatherRiskRow}>
                      {weatherRiskPills.map((pill) => (
                        <TouchableOpacity
                          key={pill.id}
                          onPress={() => Alert.alert(pill.chip, pill.detail)}
                          style={[
                            styles.weatherRiskPill,
                            pill.level === 'high'
                              ? styles.weatherRiskPillHigh
                              : styles.weatherRiskPillCaution,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={pill.detail}
                        >
                          <Text
                            style={[
                              styles.weatherRiskPillText,
                              pill.level === 'high'
                                ? styles.weatherRiskPillTextHigh
                                : styles.weatherRiskPillTextCaution,
                            ]}
                          >
                            {pill.chip}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.weatherForecastTitle}>3-Day Forecast</Text>
                  <View style={styles.forecastRow}>
                    {weatherData.forecast?.map((day: any, index: number) => (
                      <View key={index} style={styles.forecastDayCard}>
                        <Text style={styles.forecastDay}>{day.day}</Text>
                        <Text style={styles.forecastTemp}>{day.temp}°C</Text>
                        <Text style={styles.forecastCondition}>{day.condition}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyStateSubtext}>No weather data available.</Text>
              )}
            </View>

            {/* AI Mood board section */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>AI Mood-Board Generator</Text>
            <View style={styles.aiCard}>
              <Text style={styles.aiDesc}>Describe the dream aesthetic of your luxury event. Gemini will generate a custom image concept mood board.</Text>
              <TextInput
                style={styles.aiInput}
                multiline
                placeholder="E.g., Pastel floral arrangements along Amalfi Coast cliffs during a warm sunset..."
                placeholderTextColor="#666"
                value={aiPrompt}
                onChangeText={setAiPrompt}
              />
              <TouchableOpacity style={styles.aiButton} onPress={generateMoodBoard} disabled={aiLoading}>
                {aiLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Ionicons name="color-palette-outline" size={16} color="#000" />
                    <Text style={styles.aiButtonText}>Generate Visual Theme</Text>
                  </>
                )}
              </TouchableOpacity>

              {aiImageUrl ? (
                <View style={styles.aiImageContainer}>
                  <Image source={{ uri: aiImageUrl }} style={styles.aiImage} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}

        {activeTab === 4 && (
          <ScrollView contentContainerStyle={[styles.scrollList, styles.tabContent]}>
            <Text style={styles.sectionTitle}>Occasion Recap</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="document-text-outline" size={20} color="#c5a267" />
                <Text style={styles.summaryCardTitle}>{plannerName} Summary</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Events Scheduled</Text>
                <Text style={styles.summaryValue}>{totals.eventCount}</Text>
              </View>
              {totals.experienceCount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Experiences</Text>
                  <Text style={styles.summaryValue}>{totals.experienceCount}</Text>
                </View>
              )}
              {totals.stayCount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Stays ({totals.roomNights} room-nights)</Text>
                  <Text style={styles.summaryValue}>{totals.stayCount}</Text>
                </View>
              )}
              {totals.transferCount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Transfers</Text>
                  <Text style={styles.summaryValue}>{totals.transferCount}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Peak Guest Count</Text>
                <Text style={styles.summaryValue}>{peakGuests} guests</Text>
              </View>

              {/* Package cost breakdown */}
              {totals.eventsTotal > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Events</Text>
                  <Text style={styles.summaryValue}>${totals.eventsTotal.toLocaleString()}</Text>
                </View>
              )}
              {totals.experiencesTotal > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Experiences</Text>
                  <Text style={styles.summaryValue}>${totals.experiencesTotal.toLocaleString()}</Text>
                </View>
              )}
              {totals.staysTotal > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Accommodation</Text>
                  <Text style={styles.summaryValue}>${totals.staysTotal.toLocaleString()}</Text>
                </View>
              )}
              {totals.transfersTotal > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Transfers</Text>
                  <Text style={styles.summaryValue}>${totals.transfersTotal.toLocaleString()}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Estimated Cost</Text>
                <Text style={[styles.summaryValue, { color: '#c5a267', fontSize: 18 }]}>${totalCost.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Deposit to reserve ({Math.round(totals.depositPct * 100)}%)
                </Text>
                <Text style={[styles.summaryValue, { color: '#4ade80' }]}>
                  ${totals.deposit.toLocaleString()}
                </Text>
              </View>
              {targetBudget > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Target Budget</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: budgetDelta !== null && budgetDelta < 0 ? '#ef4444' : '#4ade80' },
                    ]}
                  >
                    ${targetBudget.toLocaleString()}
                    {budgetDelta !== null
                      ? budgetDelta >= 0
                        ? ` · ${budgetDelta.toLocaleString()} under`
                        : ` · ${Math.abs(budgetDelta).toLocaleString()} over`
                      : ''}
                  </Text>
                </View>
              )}
              {conflicts.length > 0 && (
                <View style={[styles.summaryRow, { alignItems: 'flex-start' }]}>
                  <Text style={styles.summaryLabel}>Schedule conflicts</Text>
                  <Text style={[styles.summaryValue, { color: '#f59e0b', flex: 1, textAlign: 'right' }]}>
                    {conflicts.length} overlap{conflicts.length === 1 ? '' : 's'}
                  </Text>
                </View>
              )}

              {/* Custom Segmented Budget Distribution Bar */}
              <Text style={styles.chartTitle}>Budget Allocation Breakdown</Text>
              {chartTotal > 0 ? (
                <View>
                  <View style={styles.progressBar}>
                    {wedPct > 0 && <View style={[styles.progressSegment, { width: `${wedPct}%` as `${number}%`, backgroundColor: '#c5a267' }]} />}
                    {dinPct > 0 && <View style={[styles.progressSegment, { width: `${dinPct}%` as `${number}%`, backgroundColor: '#f59e0b' }]} />}
                    {actPct > 0 && <View style={[styles.progressSegment, { width: `${actPct}%` as `${number}%`, backgroundColor: '#555555' }]} />}
                  </View>

                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#c5a267' }]} />
                      <Text style={styles.legendText}>Weddings (${weddingsCost.toLocaleString()} • {wedPct.toFixed(0)}%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#f59e0b' }]} />
                      <Text style={styles.legendText}>Dinners (${dinnersCost.toLocaleString()} • {dinPct.toFixed(0)}%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#555555' }]} />
                      <Text style={styles.legendText}>Activities (${activitiesCost.toLocaleString()} • {actPct.toFixed(0)}%)</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyStateSubtext}>Add events to see cost breakdown.</Text>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Custom Event Creation Modal */}
      <Modal visible={customModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bespoke Custom Event</Text>
              <TouchableOpacity
                onPress={() => setCustomModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Event Title</Text>
              <TextInput
                style={styles.modalInput}
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="E.g., Moonlight Violin Serenade"
                placeholderTextColor="#555"
              />

              <View style={styles.modalInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Location</Text>
                  <View style={styles.modalSelector}>
                    <TouchableOpacity
                      style={[styles.modalSelectorBtn, customLocation === 'Villa' && styles.modalSelectorBtnActive]}
                      onPress={() => setCustomLocation('Villa')}
                    >
                      <Text
                        style={[
                          styles.modalSelectorBtnText,
                          customLocation === 'Villa' && styles.modalSelectorBtnTextActive,
                        ]}
                      >
                        Villa
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSelectorBtn, customLocation === 'Hotel' && styles.modalSelectorBtnActive]}
                      onPress={() => setCustomLocation('Hotel')}
                    >
                      <Text
                        style={[
                          styles.modalSelectorBtnText,
                          customLocation === 'Hotel' && styles.modalSelectorBtnTextActive,
                        ]}
                      >
                        Hotel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Category</Text>
                  <View style={styles.modalSelector}>
                    <TouchableOpacity
                      style={[styles.modalSelectorBtn, customCategory === 'Weddings' && styles.modalSelectorBtnActive]}
                      onPress={() => setCustomCategory('Weddings')}
                    >
                      <Text
                        style={[
                          styles.modalSelectorBtnText,
                          customCategory === 'Weddings' && styles.modalSelectorBtnTextActive,
                        ]}
                      >
                        Wed
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSelectorBtn, customCategory === 'Dinners' && styles.modalSelectorBtnActive]}
                      onPress={() => setCustomCategory('Dinners')}
                    >
                      <Text
                        style={[
                          styles.modalSelectorBtnText,
                          customCategory === 'Dinners' && styles.modalSelectorBtnTextActive,
                        ]}
                      >
                        Dinner
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSelectorBtn, customCategory === 'Activities' && styles.modalSelectorBtnActive]}
                      onPress={() => setCustomCategory('Activities')}
                    >
                      <Text
                        style={[
                          styles.modalSelectorBtnText,
                          customCategory === 'Activities' && styles.modalSelectorBtnTextActive,
                        ]}
                      >
                        Act
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.modalLabel}>Specific Venue</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                style={{ flexDirection: 'row', marginBottom: 12 }}
              >
                {VENUES.filter((v) => v.type === customLocation).map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setCustomVenueId(v.id)}
                    style={[
                      styles.venuePillMobile,
                      customVenueId === v.id && styles.venuePillMobileActive,
                      { marginRight: 8 }
                    ]}
                  >
                    <Text
                      style={[
                        styles.venuePillMobileText,
                        customVenueId === v.id && styles.venuePillMobileTextActive,
                      ]}
                    >
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Base Price ($)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={customBasePrice}
                    onChangeText={setCustomBasePrice}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Per Guest ($)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={customPricePerGuest}
                    onChangeText={setCustomPricePerGuest}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Guests Count</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={customGuests}
                    onChangeText={setCustomGuests}
                  />
                </View>
              </View>

              <View style={styles.modalInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Date</Text>
                  <TouchableOpacity
                    style={styles.modalInput}
                    onPress={() => setPickerTarget({ scope: 'custom', field: 'date' })}
                  >
                    <Text style={styles.pickerValueText}>{customDate}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Time</Text>
                  <TouchableOpacity
                    style={styles.modalInput}
                    onPress={() => setPickerTarget({ scope: 'custom', field: 'time' })}
                  >
                    <Text style={styles.pickerValueText}>{customTime}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.modalLabel}>Special Notes / Requests</Text>
              <TextInput
                style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="Menu, styling rules, or floral layout requirements..."
                placeholderTextColor="#555"
                value={customNotes}
                onChangeText={setCustomNotes}
              />

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={addCustomActivity}>
                <Text style={styles.modalSubmitBtnText}>Add Custom Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename Planner Modal */}
      <Modal visible={renameModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, { height: 180 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Planner</Text>
              <TouchableOpacity
                onPress={() => setRenameModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <TextInput
                style={styles.modalInput}
                value={tempPlannerName}
                onChangeText={setTempPlannerName}
                placeholder="Occasion Name"
                placeholderTextColor="#555"
              />
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={savePlannerName}>
                <Text style={styles.modalSubmitBtnText}>Save Name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Stay Modal */}
      <Modal visible={stayModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Accommodation</Text>
              <TouchableOpacity
                onPress={() => setStayModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Property</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                style={{ flexDirection: 'row', marginBottom: 12 }}
              >
                {VENUES.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setStayVenueId(v.id)}
                    style={[
                      styles.venuePillMobile,
                      stayVenueId === v.id && styles.venuePillMobileActive,
                      { marginRight: 8 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.venuePillMobileText,
                        stayVenueId === v.id && styles.venuePillMobileTextActive,
                      ]}
                    >
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Room Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                style={{ flexDirection: 'row', marginBottom: 12 }}
              >
                {stayRoomTypesForVenue.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setStayRoomTypeId(r.id)}
                    style={[
                      styles.venuePillMobile,
                      stayRoomTypeId === r.id && styles.venuePillMobileActive,
                      { marginRight: 8 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.venuePillMobileText,
                        stayRoomTypeId === r.id && styles.venuePillMobileTextActive,
                      ]}
                    >
                      {r.name} · ${r.ratePerNight.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {stayRoomTypePreview?.description ? (
                <Text style={styles.modalHelperText}>{stayRoomTypePreview.description}</Text>
              ) : null}

              <Text style={styles.modalLabel}>Check-in Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                value={stayCheckIn}
                onChangeText={setStayCheckIn}
                placeholder="2026-07-20"
                placeholderTextColor="#555"
                autoCapitalize="none"
              />

              <View style={styles.modalInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Nights</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="number-pad"
                    value={stayNights}
                    onChangeText={setStayNights}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Rooms</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="number-pad"
                    value={stayRooms}
                    onChangeText={setStayRooms}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Guests</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="number-pad"
                    value={stayGuests}
                    onChangeText={setStayGuests}
                  />
                </View>
              </View>

              <Text style={styles.modalPreviewText}>
                {stayNightsNum} night{stayNightsNum === 1 ? '' : 's'} × {stayRoomsNum} room
                {stayRoomsNum === 1 ? '' : 's'} ={' '}
                <Text style={{ color: '#c5a267', fontWeight: '700' }}>
                  ${stayPreviewTotal.toLocaleString()}
                </Text>
              </Text>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={addStay}>
                <Text style={styles.modalSubmitBtnText}>Add Stay</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Transfer Modal */}
      <Modal visible={transferModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Transfer</Text>
              <TouchableOpacity
                onPress={() => setTransferModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>From</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                style={{ flexDirection: 'row', marginBottom: 12 }}
              >
                {VENUES.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setTransferFromId(v.id)}
                    style={[
                      styles.venuePillMobile,
                      transferFromId === v.id && styles.venuePillMobileActive,
                      { marginRight: 8 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.venuePillMobileText,
                        transferFromId === v.id && styles.venuePillMobileTextActive,
                      ]}
                    >
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>To</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                style={{ flexDirection: 'row', marginBottom: 12 }}
              >
                {VENUES.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setTransferToId(v.id)}
                    style={[
                      styles.venuePillMobile,
                      transferToId === v.id && styles.venuePillMobileActive,
                      { marginRight: 8 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.venuePillMobileText,
                        transferToId === v.id && styles.venuePillMobileTextActive,
                      ]}
                    >
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Vehicle</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                style={{ flexDirection: 'row', marginBottom: 12 }}
              >
                {TRANSFER_MODES.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setTransferMode(m.id)}
                    style={[
                      styles.venuePillMobile,
                      transferMode === m.id && styles.venuePillMobileActive,
                      { marginRight: 8 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.venuePillMobileText,
                        transferMode === m.id && styles.venuePillMobileTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.modalHelperText}>{getTransferMode(transferMode).note}</Text>

              <View style={styles.modalInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={transferDate}
                    onChangeText={setTransferDate}
                    placeholder="2026-07-20"
                    placeholderTextColor="#555"
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalLabel}>Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={transferTime}
                    onChangeText={setTransferTime}
                    placeholder="12:00"
                    placeholderTextColor="#555"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Pax</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="number-pad"
                    value={transferPax}
                    onChangeText={setTransferPax}
                  />
                </View>
              </View>

              <Text style={styles.modalPreviewText}>
                {transferSameVenue ? (
                  <Text style={{ color: '#ef4444' }}>Choose two different venues</Text>
                ) : (
                  <>
                    Estimated ={' '}
                    <Text style={{ color: '#c5a267', fontWeight: '700' }}>
                      ${transferPreviewPrice.toLocaleString()}
                    </Text>
                  </>
                )}
              </Text>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, transferSameVenue && { opacity: 0.5 }]}
                onPress={addTransfer}
                disabled={transferSameVenue}
              >
                <Text style={styles.modalSubmitBtnText}>Add Transfer</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tab Navigation Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab(0)} accessibilityLabel="Catalog">
          <Ionicons name={activeTab === 0 ? "compass" : "compass-outline"} size={20} color={activeTab === 0 ? "#c5a267" : "#888"} />
          <Text style={[styles.tabLabel, activeTab === 0 && styles.tabLabelActive]}>Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab(1)} accessibilityLabel="Itinerary">
          <View>
            <Ionicons name={activeTab === 1 ? "calendar" : "calendar-outline"} size={20} color={activeTab === 1 ? "#c5a267" : "#888"} />
            {itinerary.length > 0 && (
              <View style={styles.badgeCountContainer}>
                <Text style={styles.badgeCountText}>
                  {itinerary.length > 9 ? '9+' : itinerary.length}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.tabLabel, activeTab === 1 && styles.tabLabelActive]}>Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab(2)} accessibilityLabel="Map">
          <Ionicons name={activeTab === 2 ? "map" : "map-outline"} size={20} color={activeTab === 2 ? "#c5a267" : "#888"} />
          <Text style={[styles.tabLabel, activeTab === 2 && styles.tabLabelActive]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab(3)} accessibilityLabel="Theme and weather">
          <Ionicons name={activeTab === 3 ? "cloudy" : "cloudy-outline"} size={20} color={activeTab === 3 ? "#c5a267" : "#888"} />
          <Text style={[styles.tabLabel, activeTab === 3 && styles.tabLabelActive]}>Theme</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab(4)} accessibilityLabel="Summary">
          <Ionicons name={activeTab === 4 ? "stats-chart" : "stats-chart-outline"} size={20} color={activeTab === 4 ? "#c5a267" : "#888"} />
          <Text style={[styles.tabLabel, activeTab === 4 && styles.tabLabelActive]}>Summary</Text>
        </TouchableOpacity>
      </View>
      {/* Auth Gateway Modal */}
      <Modal visible={showLoginModal} animationType="slide">
        <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <TouchableOpacity
            onPress={() => { setShowLoginModal(false); setMobileErrors({}); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ position: 'absolute', top: Platform.OS === 'ios' ? 48 : 16, right: 16, zIndex: 10, padding: 12 }}
          >
            <Ionicons name="close" size={24} color="#888" />
          </TouchableOpacity>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Logo brand */}
            <View style={[styles.landingLogoCircle, { alignSelf: 'center', marginBottom: 12, marginTop: 24 }]}>
              <Text style={styles.landingLogoText}>V</Text>
            </View>
            <Text style={[styles.landingBrandTitle, { alignSelf: 'center', fontSize: 22, marginBottom: 2 }]}>VILLA & VALE</Text>
            <Text style={[styles.landingSlogan, { alignSelf: 'center', fontSize: 10, marginBottom: 8 }]}>Bespoke Itinerary Planner Gateway</Text>
            <Text style={{ alignSelf: 'center', fontSize: 10, color: '#888', marginBottom: 20, textAlign: 'center' }}>
              Demo sign-in: password is not verified — use a known email or Quick Login.
            </Text>

            {/* Segment Bar */}
            <View style={{ flexDirection: 'row', backgroundColor: '#111', borderColor: '#222', borderWidth: 1, borderRadius: 10, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: mobileAuthTab === 'signin' ? '#c5a267' : 'transparent' }}
                onPress={() => { setMobileAuthTab('signin'); setMobileErrors({}); }}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: mobileAuthTab === 'signin' ? '#000' : '#888', textTransform: 'uppercase' }}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: mobileAuthTab === 'register' ? '#c5a267' : 'transparent' }}
                onPress={() => { setMobileAuthTab('register'); setMobileErrors({}); }}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: mobileAuthTab === 'register' ? '#000' : '#888', textTransform: 'uppercase' }}>Register</Text>
              </TouchableOpacity>
            </View>

            {mobileAuthTab === 'signin' ? (
              <View>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Email Address</Text>
                <TextInput
                  style={{
                    backgroundColor: '#111',
                    borderColor: '#222',
                    borderWidth: 1,
                    padding: 10,
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                  value={mobileEmail}
                  onChangeText={setMobileEmail}
                  placeholder="sophia@amalfiwedding.com"
                  placeholderTextColor="#444"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {mobileErrors.email && (
                  <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold', marginTop: -8, marginBottom: 12 }}>{mobileErrors.email}</Text>
                )}

                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Password</Text>
                <TextInput
                  style={{
                    backgroundColor: '#111',
                    borderColor: '#222',
                    borderWidth: 1,
                    padding: 10,
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 12,
                    marginBottom: 16,
                  }}
                  value={mobilePassword}
                  onChangeText={setMobilePassword}
                  placeholder="••••••••"
                  placeholderTextColor="#444"
                  secureTextEntry
                />
                {mobileErrors.password && (
                  <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold', marginTop: -12, marginBottom: 16 }}>{mobileErrors.password}</Text>
                )}

                <TouchableOpacity
                  style={[styles.landingCta, { paddingVertical: 12, marginTop: 4 }]}
                  onPress={handleMobileSignIn}
                >
                  <Text style={styles.landingCtaText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Full Name / Event Title</Text>
                <TextInput
                  style={{
                    backgroundColor: '#111',
                    borderColor: '#222',
                    borderWidth: 1,
                    padding: 10,
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                  value={regName}
                  onChangeText={setRegName}
                  placeholder="e.g. Julian &amp; Clara"
                  placeholderTextColor="#444"
                />
                {mobileErrors.regName && (
                  <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold', marginTop: -8, marginBottom: 12 }}>{mobileErrors.regName}</Text>
                )}

                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Email Address</Text>
                <TextInput
                  style={{
                    backgroundColor: '#111',
                    borderColor: '#222',
                    borderWidth: 1,
                    padding: 10,
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                  value={regEmail}
                  onChangeText={setRegEmail}
                  placeholder="julian@example.com"
                  placeholderTextColor="#444"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {mobileErrors.regEmail && (
                  <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold', marginTop: -8, marginBottom: 12 }}>{mobileErrors.regEmail}</Text>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Role</Text>
                    <TextInput
                      style={{
                        backgroundColor: '#111',
                        borderColor: '#222',
                        borderWidth: 1,
                        padding: 10,
                        borderRadius: 10,
                        color: '#fff',
                        fontSize: 12,
                      }}
                      value={regRole}
                      onChangeText={setRegRole}
                      placeholder="Wedding Couple"
                      placeholderTextColor="#444"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Budget Cap ($)</Text>
                    <TextInput
                      style={{
                        backgroundColor: '#111',
                        borderColor: '#222',
                        borderWidth: 1,
                        padding: 10,
                        borderRadius: 10,
                        color: '#fff',
                        fontSize: 12,
                      }}
                      value={regBudget}
                      onChangeText={setRegBudget}
                      placeholder="100000"
                      placeholderTextColor="#444"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                {mobileErrors.regBudget && (
                  <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold', marginTop: -12, marginBottom: 16 }}>{mobileErrors.regBudget}</Text>
                )}

                <TouchableOpacity
                  style={[styles.landingCta, { paddingVertical: 12 }]}
                  onPress={handleMobileRegister}
                >
                  <Text style={styles.landingCtaText}>Create Account &amp; Plan</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
              <View style={{ flex: 1, height: 0.5, backgroundColor: '#222' }} />
              <Text style={{ marginHorizontal: 8, fontSize: 8, fontWeight: 'bold', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Quick Login Profiles</Text>
              <View style={{ flex: 1, height: 0.5, backgroundColor: '#222' }} />
            </View>

            {/* Quick Login Profiles list */}
            {MOCK_PROFILES.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#111',
                  borderColor: '#222',
                  borderWidth: 1,
                  padding: 10,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
                onPress={() => {
                  promptGuestMigration(p, () => {
                    setCurrentUser(p);
                    setShowLoginModal(false);
                    setMobileEmail('');
                    setMobilePassword('');
                  });
                }}
              >
                <Image source={{ uri: p.avatar }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{p.name}</Text>
                  <Text style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{p.role}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#c5a267" />
              </TouchableOpacity>
            ))}
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {pickerTarget && (
        Platform.OS === 'android' ? (
          <DateTimePicker
            value={
              pickerTarget.scope === 'custom'
                ? pickerTarget.field === 'date'
                  ? parseISODateToDate(customDate)
                  : parseTimeToDate(customTime)
                : (() => {
                    const item = itinerary.find((i) => i.id === pickerTarget.id);
                    if (!item) return new Date();
                    return pickerTarget.field === 'date'
                      ? parseISODateToDate(item.date)
                      : parseTimeToDate(item.time);
                  })()
            }
            mode={pickerTarget.field}
            display="default"
            onChange={(event, date) => {
              setPickerTarget(null);
              if (event.type === 'dismissed' || !date) return;
              if (pickerTarget.scope === 'custom') {
                if (pickerTarget.field === 'date') setCustomDate(dateToISODate(date));
                else setCustomTime(dateToTimeHM(date));
              } else if (pickerTarget.id) {
                if (pickerTarget.field === 'date') {
                  updateItineraryItem(pickerTarget.id, { date: dateToISODate(date) });
                } else {
                  updateItineraryItem(pickerTarget.id, { time: dateToTimeHM(date) });
                }
              }
            }}
          />
        ) : (
          <Modal visible transparent animationType="slide">
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModalSheet}>
                <View style={styles.pickerModalHeader}>
                  <TouchableOpacity onPress={() => setPickerTarget(null)}>
                    <Text style={styles.pickerModalAction}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerModalTitle}>
                    {pickerTarget.field === 'date' ? 'Select date' : 'Select time'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setPickerTarget(null)}
                  >
                    <Text style={[styles.pickerModalAction, { color: '#c5a267' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={
                    pickerTarget.scope === 'custom'
                      ? pickerTarget.field === 'date'
                        ? parseISODateToDate(customDate)
                        : parseTimeToDate(customTime)
                      : (() => {
                          const item = itinerary.find((i) => i.id === pickerTarget.id);
                          if (!item) return new Date();
                          return pickerTarget.field === 'date'
                            ? parseISODateToDate(item.date)
                            : parseTimeToDate(item.time);
                        })()
                  }
                  mode={pickerTarget.field}
                  display="spinner"
                  themeVariant="dark"
                  onChange={(_, date) => {
                    if (!date) return;
                    if (pickerTarget.scope === 'custom') {
                      if (pickerTarget.field === 'date') setCustomDate(dateToISODate(date));
                      else setCustomTime(dateToTimeHM(date));
                    } else if (pickerTarget.id) {
                      if (pickerTarget.field === 'date') {
                        updateItineraryItem(pickerTarget.id, { date: dateToISODate(date) });
                      } else {
                        updateItineraryItem(pickerTarget.id, { time: dateToTimeHM(date) });
                      }
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1917',
    backgroundColor: '#000000',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#ffffff',
    fontStyle: 'italic',
  },
  plannerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  plannerName: {
    fontSize: 11,
    color: '#c5a267',
    fontWeight: '600',
    maxWidth: 160,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerCostLabel: {
    fontSize: 9,
    color: '#666666',
  },
  headerCost: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c5a267',
  },
  tabContent: {
    flex: 1,
  },
  filterSection: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1917',
    backgroundColor: '#000000',
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#292524',
    marginRight: 6,
  },
  filterTagActive: {
    backgroundColor: '#c5a267',
    borderColor: '#c5a267',
  },
  filterTagText: {
    fontSize: 10,
    color: '#a0a0a0',
    fontWeight: '600',
  },
  filterTagTextActive: {
    color: '#000000',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
    padding: 0,
  },
  scrollList: {
    padding: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#a0a0a0',
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1c1917',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#1c1917',
  },
  cardBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
  },
  cardBadge: {
    fontSize: 8,
    color: '#000',
    backgroundColor: '#c5a267',
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardDesc: {
    fontSize: 11,
    color: '#a0a0a0',
    marginTop: 4,
    lineHeight: 15,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardPriceInfo: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#c5a267',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
  },
  addButtonActive: {
    backgroundColor: 'rgba(18, 62, 42, 0.4)',
    borderWidth: 1,
    borderColor: '#064e3b',
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 4,
  },
  addButtonTextActive: {
    color: '#4ade80',
  },
  itineraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  bespokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c5a267',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bespokeButtonText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 2,
  },
  catalogModeRow: {
    flexDirection: 'row',
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1c1917',
    borderRadius: 10,
    padding: 4,
    marginBottom: 10,
  },
  catalogModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
  },
  catalogModeBtnActive: {
    backgroundColor: '#c5a267',
  },
  catalogModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c5a267',
  },
  catalogModeTextActive: {
    color: '#000000',
  },
  packageActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  packageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2a2416',
    paddingVertical: 10,
    borderRadius: 10,
  },
  packageActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c5a267',
    marginLeft: 6,
  },
  packageSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#c5a267',
    marginTop: 8,
    marginBottom: 8,
  },
  modalHelperText: {
    fontSize: 11,
    color: '#8a8a8a',
    fontStyle: 'italic',
    marginBottom: 12,
    marginTop: -4,
  },
  modalPreviewText: {
    fontSize: 12,
    color: '#bbbbbb',
    marginBottom: 14,
  },
  itineraryCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1c1917',
    padding: 12,
    marginBottom: 12,
  },
  itineraryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itineraryCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  itineraryCardMeta: {
    fontSize: 10,
    color: '#666666',
    marginTop: 1,
  },
  itineraryInputsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 3,
  },
  inlineInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    fontSize: 11,
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  itineraryCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1c1917',
  },
  itineraryCostLabel: {
    fontSize: 10,
    color: '#666666',
  },
  itineraryCostVal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#c5a267',
  },
  weatherCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1c1917',
    padding: 12,
    marginTop: 10,
  },
  weatherSearchRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weatherSearchInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
  },
  weatherSearchBtn: {
    backgroundColor: '#c5a267',
    borderRadius: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherTemp: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  weatherLoc: {
    fontSize: 11,
    color: '#a0a0a0',
    marginTop: 1,
  },
  weatherStationLine: {
    marginTop: 4,
    fontSize: 10,
    color: '#888',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 14,
  },
  weatherDetails: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: '#0a0a0a',
    padding: 8,
    borderRadius: 8,
  },
  weatherDetailText: {
    fontSize: 10,
    color: '#666666',
    marginRight: 16,
  },
  weatherForecastTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 14,
    marginBottom: 6,
  },
  weatherRiskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  weatherRiskPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  weatherRiskPillCaution: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  weatherRiskPillHigh: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  weatherRiskPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  weatherRiskPillTextCaution: {
    color: '#f59e0b',
  },
  weatherRiskPillTextHigh: {
    color: '#fb7185',
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastDayCard: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#1c1917',
  },
  forecastDay: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '600',
  },
  forecastTemp: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 3,
  },
  forecastCondition: {
    fontSize: 8,
    color: '#a0a0a0',
  },
  aiCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1c1917',
    padding: 12,
    marginTop: 10,
  },
  aiDesc: {
    fontSize: 11,
    color: '#a0a0a0',
    lineHeight: 15,
  },
  aiInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#ffffff',
    padding: 8,
    fontSize: 11,
    height: 60,
    textAlignVertical: 'top',
    marginTop: 10,
  },
  aiButton: {
    flexDirection: 'row',
    backgroundColor: '#c5a267',
    borderRadius: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  aiButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 4,
  },
  aiImageContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  aiImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#0a0a0a',
  },
  summaryCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1c1917',
    padding: 14,
    marginTop: 10,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1917',
    paddingBottom: 8,
  },
  summaryCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#a0a0a0',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  progressBar: {
    height: 10,
    flexDirection: 'row',
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  progressSegment: {
    height: '100%',
  },
  legendContainer: {
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: '#888888',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#121212',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalForm: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
  },
  modalInputsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  modalSelector: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalSelectorBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  modalSelectorBtnActive: {
    backgroundColor: '#c5a267',
  },
  modalSelectorBtnText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalSelectorBtnTextActive: {
    color: '#000000',
  },
  modalSubmitBtn: {
    backgroundColor: '#c5a267',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 30,
  },
  modalSubmitBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  tabBar: {
    flexDirection: 'row',
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: '#1c1917',
    backgroundColor: '#000000',
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#c5a267',
    fontWeight: 'bold',
  },
  badgeCountContainer: {
    position: 'absolute',
    top: -4,
    right: -12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCountText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  landingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  landingLogoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#c5a267',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  landingLogoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  landingBrandTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#ffffff',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  landingSlogan: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#c5a267',
    letterSpacing: 2,
    marginTop: 4,
    fontWeight: '700',
  },
  landingGoldDivider: {
    width: 40,
    height: 2,
    backgroundColor: '#c5a267',
    marginVertical: 20,
  },
  landingDesc: {
    fontSize: 12,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 30,
  },
  landingGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  landingGridItem: {
    width: '48%',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1c1917',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  landingGridTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 4,
  },
  landingGridDesc: {
    fontSize: 9,
    color: '#666666',
    lineHeight: 12,
  },
  landingCta: {
    flexDirection: 'row',
    backgroundColor: '#c5a267',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#c5a267',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  landingCtaText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  venuePillMobile: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
  },
  venuePillMobileActive: {
    backgroundColor: '#c5a267',
    borderColor: '#c5a267',
  },
  venuePillMobileText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
  },
  venuePillMobileTextActive: {
    color: '#000',
  },
  mapCardMobile: {
    backgroundColor: '#0F0F10',
    borderColor: '#222',
    borderWidth: 1,
    borderRadius: 16,
    height: 260,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 16,
  },
  mapCoastlineLine: {
    position: 'absolute',
    left: '10%',
    top: '30%',
    width: '80%',
    height: 100,
    borderBottomWidth: 1.5,
    borderBottomColor: '#c5a267',
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  townLabelMobile: {
    position: 'absolute',
  },
  townLabelTextMobile: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#555',
    fontWeight: 'bold',
  },
  mapPinMobile: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinMobileSelected: {
    transform: [{ scale: 1.25 }],
  },
  mapPinPulse: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.25,
  },
  mapPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  venueDetailsCardMobile: {
    backgroundColor: '#111',
    borderColor: '#222',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  venueDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  venueTypeLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#c5a267',
    letterSpacing: 1,
  },
  venueNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  venueCapacityBadge: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  venueCapacityText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#aaa',
  },
  venueDescriptionText: {
    fontSize: 11,
    color: '#aaa',
    lineHeight: 16,
    fontWeight: '300',
  },
  bookingsLabel: {
    fontSize: 9,
    color: '#666',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  noBookingsText: {
    fontSize: 10,
    color: '#555',
    fontStyle: 'italic',
  },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderColor: '#222',
    borderWidth: 0.5,
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  bookingTitle: {
    fontSize: 10,
    color: '#ccc',
    fontWeight: '500',
  },
  bookingTime: {
    fontSize: 9,
    color: '#c5a267',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  routeContainerMobile: {
    backgroundColor: '#111',
    borderColor: '#222',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  routeSectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  routeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeNumberCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#c5a267',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeNumberText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  routeItemTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  routeItemVenue: {
    fontSize: 9,
    color: '#666',
  },
  routeItemTime: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#c5a267',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  transitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 28,
    marginTop: 4,
    marginBottom: 2,
  },
  transitText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f59e0b',
    textTransform: 'uppercase',
  },
  cardFeatureLine: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1a1408',
    borderWidth: 1,
    borderColor: '#f59e0b55',
  },
  conflictBannerText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  itineraryCardConflict: {
    borderColor: '#f59e0b88',
  },
  conflictChip: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
  },
  pickerValueText: {
    color: '#fff',
    fontSize: 12,
  },
  retryChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#c5a267',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryChipText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pickerModalSheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  pickerModalTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerModalAction: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 56,
  },
});
