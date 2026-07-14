import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Sparkles,
  Heart,
  Calendar,
  Utensils,
  Compass,
  Palmtree,
  Home,
  Printer,
  Search,
  CheckCircle,
  CalendarRange,
  CalendarPlus,
  Users,
  Clock,
  Sun,
  Moon,
  Monitor,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Image as ImageIcon,
  Loader2,
  Download,
  LogOut,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import { EventActivity, ItineraryItem, EventCategory, UserProfile } from './types';
import { CATALOG_ACTIVITIES } from './data/catalog';
import EventCard from './components/EventCard';
import ItineraryItemView from './components/ItineraryItemView';
import CustomEventForm from './components/CustomEventForm';
import DayTimeline from './components/DayTimeline';
import InquiryForm from './components/InquiryForm';
import LandingPage from './components/LandingPage';
import LoginScreen from './components/LoginScreen';
import {
  defaultDurationMinutes,
  findConflicts,
  findTransitGaps,
  groupByDate,
  itemHasConflict,
  itemHasTransitGap,
  sortItineraryChronologically,
} from './lib/schedule';
import { downloadIcs } from './lib/export';
import {
  evaluateOutdoorWeatherRisks,
  formatStationCoordinates,
} from './lib/weatherRisk';
import VenueMap from './components/VenueMap';
import { VENUES } from './data/venues';

function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
    typeof row.time === 'string' &&
    (row.location === 'Villa' || row.location === 'Hotel') &&
    (row.category === 'Weddings' ||
      row.category === 'Dinners' ||
      row.category === 'Activities')
  );
}

function normalizeItineraryItem(item: ItineraryItem): ItineraryItem {
  return {
    ...item,
    guests: Math.max(1, item.guests),
    notes: typeof item.notes === 'string' ? item.notes : '',
  };
}

function repriceItem(item: ItineraryItem): ItineraryItem {
  const associated = item.activityId
    ? CATALOG_ACTIVITIES.find((a) => a.id === item.activityId)
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
    calculatedPrice = associated.basePrice + guests * associated.pricePerGuest;
    durationMinutes = associated.durationMinutes;
  } else {
    const base = item.basePrice ?? item.calculatedPrice;
    const ppg = item.pricePerGuest ?? 0;
    calculatedPrice = base + ppg * guests;
  }
  return { ...item, guests, calculatedPrice, durationMinutes };
}

function guestItineraryCount(): number {
  try {
    const raw = localStorage.getItem('villa_hotel_itinerary_guest');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function userHasItinerary(userId: string): boolean {
  try {
    const raw = localStorage.getItem(`villa_hotel_itinerary_${userId}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function migrateGuestItineraryToUser(userId: string): void {
  const guestRaw = localStorage.getItem('villa_hotel_itinerary_guest');
  if (!guestRaw) return;
  try {
    const guestItems = JSON.parse(guestRaw);
    if (!Array.isArray(guestItems) || guestItems.length === 0) return;
    if (userHasItinerary(userId)) return;
    localStorage.setItem(`villa_hotel_itinerary_${userId}`, JSON.stringify(guestItems));
    localStorage.removeItem('villa_hotel_itinerary_guest');
    const guestName = localStorage.getItem('villa_hotel_planner_name_guest');
    if (guestName) {
      localStorage.setItem(`villa_hotel_planner_name_${userId}`, guestName);
      localStorage.removeItem('villa_hotel_planner_name_guest');
    }
  } catch (e) {
    console.error(e);
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [viewMode, setViewMode] = useState<'catalog' | 'map'>('catalog');
  const [mapSelectedDate, setMapSelectedDate] = useState(localTodayISO);
  // Filters & Search
  const [selectedLocation, setSelectedLocation] = useState<'All' | 'Villa' | 'Hotel'>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | EventCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Itinerary State
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);

  // Client name or wedding couple name
  const [plannerName, setPlannerName] = useState('Signature Occasion');
  const [isEditingName, setIsEditingName] = useState(false);

  // Modal / Share overlay
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isSavedAlert, setIsSavedAlert] = useState(false);
  const savedAlertTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [isHydrating, setIsHydrating] = useState(true);

  // Theme State: 'auto' | 'light' | 'dark'
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('villa-vale-theme') as 'auto' | 'light' | 'dark') || 'auto';
  });

  // Weather Widget State
  const [weatherLocation, setWeatherLocation] = useState('Amalfi Coast, Italy');
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherWarning, setWeatherWarning] = useState<string | null>(null);

  // Mood Board Generation State
  const [moodPrompt, setMoodPrompt] = useState(
    'An elegant cliffside ocean ceremony decorated with white orchids and soft linen drapes'
  );
  const [generatedMoodUrl, setGeneratedMoodUrl] = useState<string>(() => {
    return localStorage.getItem('villa_hotel_mood_board_img') || '';
  });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageGenError, setImageGenError] = useState<string | null>(null);

  // Apply Theme class to :root so Tailwind @custom-variant dark works
  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark-mode');
        root.classList.remove('light-mode');
      } else {
        root.classList.add('light-mode');
        root.classList.remove('dark-mode');
      }
    };

    localStorage.setItem('villa-vale-theme', theme);

    if (theme === 'light') {
      applyDark(false);
      return;
    }
    if (theme === 'dark') {
      applyDark(true);
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => applyDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Hydrate before paint so persist effects never write the prior user's itinerary into the new key
  useLayoutEffect(() => {
    const userId = currentUser ? currentUser.id : 'guest';
    setIsHydrating(true);
    setItinerary([]);

    const savedItinerary = localStorage.getItem(`villa_hotel_itinerary_${userId}`);
    if (savedItinerary) {
      try {
        const parsed = JSON.parse(savedItinerary);
        if (Array.isArray(parsed)) {
          setItinerary(
            parsed
              .filter(isValidItineraryItem)
              .map((item) => repriceItem(normalizeItineraryItem(item)))
          );
        } else {
          setItinerary([]);
        }
      } catch (e) {
        console.error(e);
        setItinerary([]);
      }
    } else {
      setItinerary([]);
    }

    const savedName = localStorage.getItem(`villa_hotel_planner_name_${userId}`);
    setPlannerName(
      savedName || (currentUser ? `${currentUser.name}'s Celebration` : 'Signature Occasion')
    );

    const savedTime = localStorage.getItem(`villa_hotel_last_saved_${userId}`);
    setLastSaved(savedTime || '');
    setIsHydrating(false);
  }, [currentUser]);

  // Sync itinerary after hydrate completes (layout hydrate avoids cross-user overwrite)
  useEffect(() => {
    if (isHydrating) return;
    const userId = currentUser ? currentUser.id : 'guest';
    localStorage.setItem(`villa_hotel_itinerary_${userId}`, JSON.stringify(itinerary));
  }, [itinerary, isHydrating, currentUser]);

  useEffect(() => {
    if (isHydrating) return;
    const userId = currentUser ? currentUser.id : 'guest';
    localStorage.setItem(`villa_hotel_planner_name_${userId}`, plannerName);
  }, [plannerName, isHydrating, currentUser]);

  useEffect(() => {
    if (isHydrating) return;
    const userId = currentUser ? currentUser.id : 'guest';
    const interval = setInterval(() => {
      localStorage.setItem(`villa_hotel_itinerary_${userId}`, JSON.stringify(itinerary));
      localStorage.setItem(`villa_hotel_planner_name_${userId}`, plannerName);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      localStorage.setItem(`villa_hotel_last_saved_${userId}`, timeStr);
      setLastSaved(timeStr);
    }, 30000);

    return () => clearInterval(interval);
  }, [itinerary, plannerName, currentUser, isHydrating]);

  // Fetch weather forecast with AbortController (ignore aborted / stale responses)
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchWeather = async () => {
      setIsWeatherLoading(true);
      setWeatherError(null);
      setWeatherWarning(null);
      setWeatherData(null);
      try {
        const response = await fetch(
          `/api/weather?location=${encodeURIComponent(weatherLocation)}`,
          { signal: controller.signal }
        );
        const resData = await response.json();
        if (cancelled || controller.signal.aborted) return;

        if (resData.data) {
          setWeatherData(resData.data);
          if (resData.fallback || !resData.success) {
            setWeatherWarning(
              resData.error ||
                'Showing cached or approximate conditions — live forecast unavailable.'
            );
          } else {
            setWeatherWarning(null);
          }
          setWeatherError(null);
        } else {
          setWeatherData(null);
          setWeatherError(resData.error || 'Failed to fetch weather forecast.');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || cancelled) return;
        console.error('Weather fetch error:', err);
        setWeatherData(null);
        setWeatherError('Network error while querying weather.');
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setIsWeatherLoading(false);
        }
      }
    };

    fetchWeather();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [weatherLocation, weatherRefreshKey]);

  // Handle Mood Board Generation
  const handleGenerateMoodBoard = async () => {
    if (!moodPrompt.trim()) return;
    setIsGeneratingImage(true);
    setImageGenError(null);
    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: moodPrompt }),
      });
      const resData = await response.json();
      if (resData.success && resData.imageUrl) {
        setGeneratedMoodUrl(resData.imageUrl);
        try {
          localStorage.setItem('villa_hotel_mood_board_img', resData.imageUrl);
        } catch (storageErr: any) {
          if (
            storageErr?.name === 'QuotaExceededError' ||
            storageErr?.code === 22 ||
            storageErr?.code === 1014
          ) {
            setImageGenError(
              'Image kept in memory only — browser storage quota exceeded. It will not persist after refresh.'
            );
          } else {
            setImageGenError('Could not persist mood board image to local storage.');
          }
        }
      } else {
        setImageGenError(resData.error || 'Failed to generate visual theme.');
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      setImageGenError('Network error while generating theme.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleClearMoodBoard = () => {
    if (!window.confirm('Clear the mood board image?')) return;
    setGeneratedMoodUrl('');
    localStorage.removeItem('villa_hotel_mood_board_img');
    setImageGenError(null);
  };

  // Body scroll lock while summary modal is open
  useEffect(() => {
    if (!showSummaryModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSummaryModal]);

  // Escape closes summary modal
  useEffect(() => {
    if (!showSummaryModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSummaryModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSummaryModal]);

  // Handle adding pre-defined activity to itinerary
  const handleAddActivity = (activity: EventActivity) => {
    if (isHydrating) return;
    setItinerary((prev) => {
      if (prev.some((item) => item.activityId === activity.id)) return prev;

      const guests = Math.min(10, activity.maxGuests);
      const targetLoc = activity.location === 'Both' ? 'Villa' : (activity.location as 'Villa' | 'Hotel');
      const defaultVenue = VENUES.find((v) => v.type === targetLoc);
      
      const newItem: ItineraryItem = {
        id: `itinerary-${activity.id}-${Date.now()}`,
        activityId: activity.id,
        title: activity.title,
        location: targetLoc,
        category: activity.category,
        date: localTodayISO(),
        time: '18:00',
        guests,
        notes: '',
        calculatedPrice: activity.basePrice + guests * activity.pricePerGuest,
        venueId: defaultVenue ? defaultVenue.id : undefined,
        durationMinutes: activity.durationMinutes,
      };

      return [...prev, newItem];
    });
  };

  // Handle adding custom-built activity
  const handleAddCustomItem = (customItem: Omit<ItineraryItem, 'id'>) => {
    if (isHydrating) return;
    setItinerary((prev) => [
      ...prev,
      {
        ...customItem,
        id: `itinerary-custom-${Date.now()}`,
      },
    ]);
  };

  // Merge patches against latest state to avoid lost concurrent field edits
  const handleUpdateItem = (id: string, patch: Partial<ItineraryItem>) => {
    if (isHydrating) return;
    setItinerary((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        let updated = { ...item, ...patch };
        if (patch.location && patch.location !== item.location) {
          const firstMatching = VENUES.find((v) => v.type === patch.location);
          updated.venueId = firstMatching ? firstMatching.id : undefined;
        }
        if (patch.venueId !== undefined) {
          const venue = patch.venueId
            ? VENUES.find((v) => v.id === patch.venueId)
            : undefined;
          if (venue && updated.guests > venue.capacity) {
            updated.guests = venue.capacity;
          }
        }
        return repriceItem(updated);
      })
    );
  };

  // Handle removing itinerary item
  const handleRemoveItem = (id: string) => {
    if (isHydrating) return;
    setItinerary((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear all itinerary items
  const handleClearAll = () => {
    if (isHydrating) return;
    if (window.confirm('Are you sure you want to clear your entire event itinerary?')) {
      setItinerary([]);
    }
  };

  // Trigger temporary success notification
  const handleSavePlanner = () => {
    if (isHydrating) return;
    const userId = currentUser ? currentUser.id : 'guest';
    localStorage.setItem(`villa_hotel_itinerary_${userId}`, JSON.stringify(itinerary));
    localStorage.setItem(`villa_hotel_planner_name_${userId}`, plannerName);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    localStorage.setItem(`villa_hotel_last_saved_${userId}`, timeStr);
    setLastSaved(timeStr);
    setIsSavedAlert(true);
    if (savedAlertTimer.current) clearTimeout(savedAlertTimer.current);
    savedAlertTimer.current = setTimeout(() => setIsSavedAlert(false), 3000);
  };

  useEffect(() => {
    return () => {
      if (savedAlertTimer.current) clearTimeout(savedAlertTimer.current);
    };
  }, []);

  const retryWeather = () => {
    setWeatherRefreshKey((k) => k + 1);
  };

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

  // Filtering catalog list based on search and selected categories
  const filteredActivities = CATALOG_ACTIVITIES.filter((activity) => {
    const matchesLocation =
      selectedLocation === 'All' ||
      activity.location === selectedLocation ||
      activity.location === 'Both';
    const matchesCategory = selectedCategory === 'All' || activity.category === selectedCategory;
    const matchesSearch =
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.features.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesLocation && matchesCategory && matchesSearch;
  });

  // Calculations for Pricing & Summaries
  const totalEstimatedCost = itinerary.reduce((sum, item) => sum + item.calculatedPrice, 0);
  const totalGuestsMax = itinerary.reduce((max, item) => Math.max(max, item.guests), 0);
  const weddingCount = itinerary.filter((item) => item.category === 'Weddings').length;
  const dinnerCount = itinerary.filter((item) => item.category === 'Dinners').length;
  const activityCount = itinerary.filter((item) => item.category === 'Activities').length;

  const weddingTotal = itinerary
    .filter((i) => i.category === 'Weddings')
    .reduce((sum, i) => sum + i.calculatedPrice, 0);
  const dinnerTotal = itinerary
    .filter((i) => i.category === 'Dinners')
    .reduce((sum, i) => sum + i.calculatedPrice, 0);
  const activityTotal = itinerary
    .filter((i) => i.category === 'Activities')
    .reduce((sum, i) => sum + i.calculatedPrice, 0);

  const pieData = [
    { name: 'Weddings', value: weddingTotal, color: '#F43F5E' },
    { name: 'Dinners', value: dinnerTotal, color: '#F97316' },
    { name: 'Activities', value: activityTotal, color: '#0EA5E9' },
  ].filter((item) => item.value > 0);

  const scheduleConflicts = findConflicts(itinerary);
  const transitGaps = findTransitGaps(itinerary);
  const dayGroups = groupByDate(itinerary);
  const chronologicalItinerary = sortItineraryChronologically(itinerary);

  const handleAuthenticated = (user: UserProfile) => {
    const guestCount = guestItineraryCount();
    if (guestCount > 0) {
      if (userHasItinerary(user.id)) {
        window.alert(
          'Guest itinerary kept separate — this account already has saved events. Continue as this account without overwriting.'
        );
      } else {
        const bring = window.confirm(
          `You have ${guestCount} guest event(s). Bring them onto this account?`
        );
        if (bring) migrateGuestItineraryToUser(user.id);
      }
    }
    setCurrentUser(user);
    setShowLogin(false);
  };

  if (!showPlanner) {
    return <LandingPage onEnter={() => setShowPlanner(true)} />;
  }

  if (showLogin) {
    return (
      <LoginScreen
        onLogin={handleAuthenticated}
        onClose={() => setShowLogin(false)}
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-dark-bg text-dark-text-primary font-sans flex flex-col selection:bg-gold-premium/30 selection:text-white"
      id="app-root-container"
    >
      {/* Sticky brand bar + phone jump controls */}
      <header
        className="sticky top-0 z-40 bg-dark-bg/95 [-webkit-backdrop-filter:blur(12px)] backdrop-blur-md border-b border-dark-border py-3 px-4 sm:px-6 shrink-0 shadow-none"
        id="brand-header"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 bg-gold-premium rounded-full flex items-center justify-center shrink-0">
              <span className="text-[#0A0A0A] font-bold text-lg font-serif">V</span>
            </div>
            <span className="font-serif font-semibold tracking-wide text-sm text-dark-text-primary italic truncate">
              VILLA &amp; VALE
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* User Session Info & Log Out */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-dark-input/60 border border-dark-border px-2 py-1.5 rounded-xl shrink-0">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-5 h-5 rounded-full object-cover border border-dark-border/40"
                />
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[10px] font-bold text-dark-text-primary leading-none">
                    {currentUser.name}
                  </span>
                  <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentUser(null)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg cursor-pointer transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-2.5 sm:px-3.5 py-1.5 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-colors"
                id="sign-in-gateway-btn"
              >
                <span className="sm:hidden">Sign In</span>
                <span className="hidden sm:inline">Sign In / Register</span>
              </button>
            )}
            {lastSaved && (
              <span
                className="hidden md:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-dark-text-secondary font-bold bg-dark-input/65 border border-dark-border/60 px-2 py-1 rounded"
                id="auto-save-indicator"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Auto-saved {lastSaved}
              </span>
            )}

            {/* Elegant Luxury Theme Controller */}
            <div
              className="flex items-center bg-dark-input border border-dark-border rounded p-0.5"
              id="theme-controller-container"
              role="group"
              aria-label="Color theme"
            >
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 sm:px-2 rounded transition-all cursor-pointer flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold ${
                  theme === 'light'
                    ? 'bg-gold-premium text-[#0A0A0A] shadow-xs'
                    : 'text-dark-text-secondary hover:text-dark-text-primary'
                }`}
                title="Light Mode"
                id="theme-btn-light"
                aria-pressed={theme === 'light'}
              >
                <Sun className="w-3 h-3" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                onClick={() => setTheme('auto')}
                className={`p-1.5 sm:px-2 rounded transition-all cursor-pointer flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold ${
                  theme === 'auto'
                    ? 'bg-gold-premium text-[#0A0A0A] shadow-xs'
                    : 'text-dark-text-secondary hover:text-dark-text-primary'
                }`}
                title="Auto / System Preference"
                id="theme-btn-auto"
                aria-pressed={theme === 'auto'}
              >
                <Monitor className="w-3 h-3" />
                <span className="hidden sm:inline">Auto</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 sm:px-2 rounded transition-all cursor-pointer flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold ${
                  theme === 'dark'
                    ? 'bg-gold-premium text-[#0A0A0A] shadow-xs'
                    : 'text-dark-text-secondary hover:text-dark-text-primary'
                }`}
                title="Dark Mode"
                id="theme-btn-dark"
                aria-pressed={theme === 'dark'}
              >
                <Moon className="w-3 h-3" />
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>

            <button
              onClick={handleSavePlanner}
              className="text-[10px] uppercase tracking-widest font-bold p-2 sm:px-4 sm:py-2 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              id="save-planner-top-btn"
              title="Save itinerary"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save Itinerary</span>
            </button>
          </div>
        </div>

        {/* Phone: jump between Catalog and Plan without endless scroll */}
        <nav
          className="lg:hidden max-w-7xl mx-auto mt-3 flex items-center gap-2"
          aria-label="Plan sections"
          id="mobile-section-jump"
        >
          <a
            href="#catalog-explorer-column"
            className="flex-1 text-center text-[11px] font-bold uppercase tracking-wider py-2.5 rounded-xl bg-dark-card border border-dark-border text-dark-text-secondary hover:text-gold-premium hover:border-gold-premium/40 transition-colors"
          >
            Catalog
          </a>
          <a
            href="#itinerary-column"
            className="flex-1 text-center text-[11px] font-bold uppercase tracking-wider py-2.5 rounded-xl bg-dark-card border border-dark-border text-dark-text-secondary hover:text-gold-premium hover:border-gold-premium/40 transition-colors"
          >
            Plan{itinerary.length > 0 ? ` (${itinerary.length})` : ''}
          </a>
          <div className="shrink-0 px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-right min-w-18">
            <span className="block text-[9px] uppercase tracking-wider text-dark-text-tertiary font-bold">
              Est.
            </span>
            <span className="font-mono text-xs font-extrabold text-gold-premium">
              ${totalEstimatedCost.toLocaleString()}
            </span>
          </div>
        </nav>
      </header>

      {/* Hero — brand, planner name, one supporting sentence */}
      <section
        className="relative overflow-hidden bg-dark-bg border-b border-dark-border py-6 sm:py-10 lg:py-12 px-4 sm:px-6 shrink-0"
        id="hero-banner-section"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-premium/5 rounded-full filter blur-3xl opacity-30 -z-10 translate-x-20 -translate-y-20 pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-gold-premium/5 rounded-full filter blur-3xl opacity-20 -z-10 -translate-x-10 translate-y-10 pointer-events-none" />

        <motion.div
          className="max-w-7xl mx-auto"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-dark-card border border-dark-border text-gold-premium text-[11px] uppercase tracking-widest font-bold px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" /> Villa &amp; Vale
            </div>

            <div className="group relative">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={plannerName}
                    onChange={(e) => setPlannerName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    className="font-serif text-3xl md:text-4xl font-light italic text-dark-text-primary border-b-2 border-gold-premium focus:outline-none bg-transparent py-1 w-full max-w-md"
                    autoFocus
                    id="planner-name-edit-input"
                  />
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="px-3 py-1.5 bg-gold-premium hover:bg-gold-hover text-dark-bg rounded text-xs font-bold uppercase tracking-wider cursor-pointer"
                    id="finish-edit-name-btn"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-light text-dark-text-primary tracking-tight leading-none flex flex-wrap items-center gap-2.5">
                  <span className="min-w-0 wrap-break-word">{plannerName}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-dark-text-secondary hover:text-gold-premium text-xs font-sans font-medium px-2 py-0.5 border border-dark-border rounded-md bg-dark-card transition-colors cursor-pointer"
                    title="Rename itinerary"
                    id="edit-name-btn"
                  >
                    Rename
                  </button>
                </h1>
              )}
            </div>

            <p className="hidden sm:block text-dark-text-secondary text-sm md:text-base leading-relaxed">
              Craft a refined itinerary across private villas and grand hotels — weddings, dinners,
              and curated experiences.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Secondary strip: full metrics + weather on desktop; compact weather on phone */}
      <section
        className="bg-dark-bg border-b border-dark-border px-4 sm:px-6 py-3 lg:py-5 shrink-0"
        id="hero-secondary-strip"
      >
        <div
          className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-stretch gap-4"
          id="hero-right-side-board"
        >
          <div className="hidden lg:flex flex-wrap gap-3 flex-1" id="quick-metrics-board">
            <div className="bg-dark-card border border-dark-border rounded-xl p-3 text-center min-w-[90px] flex-1">
              <span className="block text-[11px] uppercase tracking-widest font-bold text-dark-text-tertiary">
                Total Items
              </span>
              <span className="font-mono text-xl font-extrabold text-dark-text-primary">
                {itinerary.length}
              </span>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-3 text-center min-w-[90px] flex-1">
              <span className="flex text-[11px] uppercase tracking-widest font-bold text-gold-premium items-center justify-center gap-0.5">
                <Heart className="w-2.5 h-2.5 fill-gold-premium text-gold-premium" /> Weddings
              </span>
              <span className="font-mono text-xl font-extrabold text-dark-text-primary">
                {weddingCount}
              </span>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-3 text-center min-w-[90px] flex-1">
              <span className="flex text-[11px] uppercase tracking-widest font-bold text-gold-premium items-center justify-center gap-0.5">
                <Utensils className="w-2.5 h-2.5 text-gold-premium" /> Dinners
              </span>
              <span className="font-mono text-xl font-extrabold text-dark-text-primary">
                {dinnerCount}
              </span>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-3 text-center min-w-[90px] flex-1">
              <span className="flex text-[11px] uppercase tracking-widest font-bold text-gold-premium items-center justify-center gap-0.5">
                <Compass className="w-2.5 h-2.5 text-gold-premium" /> Activities
              </span>
              <span className="font-mono text-xl font-extrabold text-dark-text-primary">
                {activityCount}
              </span>
            </div>
          </div>

          {/* Weather Widget */}
          <div
            className="bg-dark-card/90 border border-dark-border rounded-xl p-4 w-full sm:max-w-[320px] shrink-0 flex flex-col gap-3"
            id="hero-weather-widget"
          >
            <div className="flex items-center justify-between gap-2 border-b border-dark-border/50 pb-2">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-dark-text-secondary">
                <Sun className="w-3.5 h-3.5 text-gold-premium" />
                <span>Local Weather</span>
              </div>
              <select
                value={weatherLocation}
                onChange={(e) => setWeatherLocation(e.target.value)}
                className="text-[11px] font-bold bg-dark-bg border border-dark-border rounded px-1.5 py-0.5 text-dark-text-primary focus:outline-none focus:border-gold-premium cursor-pointer max-w-44"
                id="weather-location-select"
                aria-label="Weather micro-climate location"
              >
                <option value="Amalfi Coast, Italy">Amalfi Coast, IT</option>
                {VENUES.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.type}: {v.name}
                  </option>
                ))}
                <option value="Santorini, Greece">Santorini, GR</option>
                <option value="Bali, Indonesia">Bali, ID</option>
                <option value="Cote d'Azur, France">Riviera, FR</option>
              </select>
            </div>

            {weatherWarning && weatherData && (
              <div
                className="text-[11px] text-amber-600 dark:text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 rounded flex items-start justify-between gap-2"
                role="status"
              >
                <span className="min-w-0">{weatherWarning}</span>
                <button
                  type="button"
                  onClick={retryWeather}
                  className="shrink-0 text-[10px] uppercase tracking-wider text-gold-premium underline hover:text-gold-hover cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {isWeatherLoading ? (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <Loader2 className="w-5 h-5 text-gold-premium animate-spin" />
                <span className="text-[11px] text-dark-text-tertiary uppercase tracking-widest font-bold animate-pulse">
                  Fetching forecast...
                </span>
              </div>
            ) : weatherError && !weatherData ? (
              <div className="text-center py-1">
                <p className="text-[11px] text-rose-400 font-bold">{weatherError}</p>
                <button
                  onClick={retryWeather}
                  className="mt-1 text-xs uppercase tracking-wider text-gold-premium underline hover:text-gold-hover cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : weatherData ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-gold-premium/10 border border-gold-premium/20 rounded-lg text-gold-premium shrink-0">
                      {weatherData.condition?.toLowerCase().includes('rain') ? (
                        <CloudRain className="w-5 h-5" />
                      ) : weatherData.condition?.toLowerCase().includes('cloud') ||
                        weatherData.condition?.toLowerCase().includes('overcast') ||
                        weatherData.condition?.toLowerCase().includes('part') ? (
                        <Cloud className="w-5 h-5" />
                      ) : weatherData.condition?.toLowerCase().includes('storm') ||
                        weatherData.condition?.toLowerCase().includes('lightning') ? (
                        <CloudLightning className="w-5 h-5" />
                      ) : weatherData.condition?.toLowerCase().includes('snow') ? (
                        <CloudSnow className="w-5 h-5" />
                      ) : (
                        <Sun className="w-5 h-5" />
                      )}
                    </div>
                    <div className="leading-tight min-w-0">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-lg font-bold text-dark-text-primary">
                          {weatherData.currentTemp}°C
                        </span>
                        <span className="text-[11px] text-dark-text-secondary font-medium line-clamp-1">
                          {weatherData.condition}
                        </span>
                      </div>
                      <span className="text-[11px] text-dark-text-tertiary font-bold uppercase tracking-wider line-clamp-1 block">
                        {weatherData.locationName}
                      </span>
                      {(weatherData.stationName || weatherStationCoords) && (
                        <span
                          className="mt-0.5 flex items-start gap-1 text-[10px] text-dark-text-tertiary font-mono leading-snug"
                          title="Nearest weather station for this villa/hotel micro-climate"
                        >
                          <MapPin className="w-2.5 h-2.5 shrink-0 mt-0.5 text-gold-premium/80" aria-hidden />
                          <span className="min-w-0">
                            {weatherData.stationName ? (
                              <span className="block truncate text-dark-text-secondary font-sans font-semibold normal-case tracking-normal">
                                {weatherData.stationName}
                              </span>
                            ) : null}
                            {weatherStationCoords ? (
                              <span className="block truncate">{weatherStationCoords}</span>
                            ) : null}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono text-dark-text-secondary space-y-0.5 shrink-0">
                    <p className="flex items-center justify-end gap-1">
                      <Droplets className="w-2.5 h-2.5 text-sky-400" /> Hum: {weatherData.humidity}%
                    </p>
                    <p className="flex items-center justify-end gap-1">
                      <Wind className="w-2.5 h-2.5 text-dark-text-secondary" /> {weatherData.windSpeed}
                    </p>
                  </div>
                </div>

                {weatherRiskPills.length > 0 && (
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Outdoor event weather risks"
                  >
                    {weatherRiskPills.map((pill) => (
                      <span
                        key={pill.id}
                        title={pill.detail}
                        aria-label={pill.detail}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide cursor-help border ${
                          pill.level === 'high'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {pill.id === 'humidity' ? (
                          <Droplets className="w-2.5 h-2.5" aria-hidden />
                        ) : (
                          <Wind className="w-2.5 h-2.5" aria-hidden />
                        )}
                        {pill.chip}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-dark-border/40 text-center">
                  {weatherData.forecast?.slice(0, 3).map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-dark-bg/40 border border-dark-border/50 rounded-lg p-1 flex flex-col items-center"
                    >
                      <span className="text-[11px] uppercase tracking-wider text-dark-text-tertiary font-bold">
                        {f.day}
                      </span>
                      <span className="text-xs font-bold text-dark-text-primary font-mono my-0.5">
                        {f.temp}°C
                      </span>
                      <span className="text-[11px] text-dark-text-secondary truncate w-full px-1">
                        {f.condition}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-dark-text-tertiary text-center py-1">
                Select a venue destination to see forecast.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Floating alert for Save status */}
      <AnimatePresence>
        {isSavedAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="fixed top-28 lg:top-16 left-1/2 -translate-x-1/2 z-50 max-w-[min(92vw,28rem)] bg-emerald-900 text-white font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-800"
            id="saved-itinerary-toast"
            role="status"
            aria-live="polite"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Itinerary plan saved successfully to persistent storage!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Workspace Grid Layout */}
      <main
        className="max-w-7xl w-full mx-auto p-4 md:p-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6"
        id="primary-grid-workspace"
      >
        {/* LEFT COLUMN: Catalog Showcase & Exploration (cols 7) */}
        <div className="lg:col-span-7 flex flex-col space-y-5 scroll-mt-28 lg:scroll-mt-4" id="catalog-explorer-column">
          {/* Dashboard Mode Selector: Catalog vs Map */}
          <div className="flex items-center gap-2 bg-dark-card border border-dark-border rounded-2xl p-1.5 shadow-md shrink-0">
            <button
              onClick={() => setViewMode('catalog')}
              aria-pressed={viewMode === 'catalog'}
              className={`flex-1 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                viewMode === 'catalog'
                  ? 'bg-gold-premium text-[#0A0A0A] shadow-xs'
                  : 'text-dark-text-secondary hover:text-dark-text-primary'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span className="sm:hidden">Catalog</span>
              <span className="hidden sm:inline">Curated Catalog</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
              className={`flex-1 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                viewMode === 'map'
                  ? 'bg-gold-premium text-[#0A0A0A] shadow-xs'
                  : 'text-dark-text-secondary hover:text-dark-text-primary'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span className="sm:hidden">Map</span>
              <span className="hidden sm:inline">Interactive Venue Map</span>
            </button>
          </div>

          {viewMode === 'catalog' ? (
            <>
              {/* Filters and Search toolbar */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-lg flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h2 className="font-serif font-light text-lg text-dark-text-primary flex items-center gap-2">
                <Compass className="w-4 h-4 text-gold-premium" /> Catalog Exploration
              </h2>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
                  id="search-catalog-input"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div
                className="flex items-center gap-1.5 flex-wrap"
                role="group"
                aria-label="Filter by location"
              >
                <span className="text-[11px] uppercase font-bold text-dark-text-secondary min-w-[65px] tracking-wider">
                  Location:
                </span>
                <button
                  onClick={() => setSelectedLocation('All')}
                  aria-pressed={selectedLocation === 'All'}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors border cursor-pointer uppercase tracking-wider ${
                    selectedLocation === 'All'
                      ? 'bg-gold-premium border-gold-premium text-[#0A0A0A]'
                      : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                  }`}
                  id="filter-loc-all"
                >
                  All Venues
                </button>
                <button
                  onClick={() => setSelectedLocation('Villa')}
                  aria-pressed={selectedLocation === 'Villa'}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors border cursor-pointer flex items-center gap-1 uppercase tracking-wider ${
                    selectedLocation === 'Villa'
                      ? 'bg-gold-premium border-gold-premium text-[#0A0A0A]'
                      : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                  }`}
                  id="filter-loc-villa"
                >
                  <Home className="w-3 h-3" /> Private Villas
                </button>
                <button
                  onClick={() => setSelectedLocation('Hotel')}
                  aria-pressed={selectedLocation === 'Hotel'}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors border cursor-pointer flex items-center gap-1 uppercase tracking-wider ${
                    selectedLocation === 'Hotel'
                      ? 'bg-gold-premium border-gold-premium text-[#0A0A0A]'
                      : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                  }`}
                  id="filter-loc-hotel"
                >
                  <Palmtree className="w-3 h-3" /> Luxury Hotels
                </button>
              </div>

              <div
                className="flex items-center gap-1.5 flex-wrap"
                role="group"
                aria-label="Filter by category"
              >
                <span className="text-[11px] uppercase font-bold text-dark-text-secondary min-w-[65px] tracking-wider">
                  Category:
                </span>
                <button
                  onClick={() => setSelectedCategory('All')}
                  aria-pressed={selectedCategory === 'All'}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors border cursor-pointer uppercase tracking-wider ${
                    selectedCategory === 'All'
                      ? 'bg-gold-premium border-gold-premium text-[#0A0A0A]'
                      : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                  }`}
                  id="filter-cat-all"
                >
                  All Events
                </button>
                <button
                  onClick={() => setSelectedCategory('Weddings')}
                  aria-pressed={selectedCategory === 'Weddings'}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors border cursor-pointer flex items-center gap-1 uppercase tracking-wider ${
                    selectedCategory === 'Weddings'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'
                      : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                  }`}
                  id="filter-cat-wedding"
                >
                  <Heart className="w-3 h-3" /> Weddings
                </button>
                <button
                  onClick={() => setSelectedCategory('Dinners')}
                  aria-pressed={selectedCategory === 'Dinners'}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors border cursor-pointer flex items-center gap-1 uppercase tracking-wider ${
                    selectedCategory === 'Dinners'
                      ? 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-300'
                      : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                  }`}
                  id="filter-cat-dinner"
                >
                  <Utensils className="w-3 h-3" /> Dinners
                </button>
                <button
                  onClick={() => setSelectedCategory('Activities')}
                  aria-pressed={selectedCategory === 'Activities'}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors border cursor-pointer flex items-center gap-1 uppercase tracking-wider ${
                    selectedCategory === 'Activities'
                      ? 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300'
                      : 'bg-dark-input border-dark-border text-dark-text-secondary hover:text-dark-text-primary'
                  }`}
                  id="filter-cat-activities"
                >
                  <Compass className="w-3 h-3" /> Activities
                </button>
              </div>
            </div>
          </div>

          {/* Activities Grid */}
          <div className="flex-1">
            {filteredActivities.length === 0 ? (
              <div
                className="bg-dark-card border border-dashed border-dark-border rounded-2xl p-12 text-center"
                id="catalog-empty-state"
              >
                <Compass className="w-12 h-12 text-dark-text-tertiary mx-auto mb-3" />
                <h3 className="font-serif font-light text-lg text-dark-text-primary">
                  No matching activities
                </h3>
                <p className="text-xs text-dark-text-secondary mt-1 max-w-xs mx-auto">
                  We couldn&apos;t find any pre-defined activities matching your query. Try resetting
                  your search filters or add a bespoke activity below.
                </p>
                <button
                  onClick={() => {
                    setSelectedLocation('All');
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 bg-dark-input border border-dark-border text-dark-text-secondary hover:text-dark-text-primary rounded text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                  id="reset-filters-btn"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="activities-cards-grid">
                <AnimatePresence mode="popLayout">
                  {filteredActivities.map((activity) => {
                    const isAdded = itinerary.some((item) => item.activityId === activity.id);
                    return (
                      <EventCard
                        key={activity.id}
                        activity={activity}
                        onAddToItinerary={handleAddActivity}
                        isAdded={isAdded}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          <CustomEventForm onAddCustomItem={handleAddCustomItem} />

          <InquiryForm
            plannerName={plannerName}
            items={itinerary}
            total={totalEstimatedCost}
          />

          {/* AI Mood Board & Theme Generator */}
          <div
            className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg flex flex-col gap-4 mt-5 shrink-0"
            id="ai-mood-board-generator-panel"
          >
            <div>
              <h2 className="font-serif font-light text-lg text-dark-text-primary flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gold-premium" /> AI Mood-board Generator
              </h2>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mt-0.5">
                Generate high-quality concept visualization for chosen themes
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1">
                  Visual Inspiration Prompt
                </label>
                <textarea
                  value={moodPrompt}
                  onChange={(e) => setMoodPrompt(e.target.value)}
                  placeholder="Describe your luxury vision: colors, lighting, florals, furniture, ambiance..."
                  className="w-full h-16 bg-dark-input border border-dark-border rounded-xl text-xs text-dark-text-primary p-3 placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium resize-none"
                  id="mood-prompt-textarea"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wider font-bold text-dark-text-tertiary">
                  Quick Themes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Sunset beach reception with white orchids and warm candlelight',
                    'Enchanted glasshouse wedding glowing with thousands of fairy lights',
                    'Grand imperial ballroom gala with gold chandeliers and red velvet',
                    'Minimalist garden cocktail party under ancient banyan trees',
                  ].map((themeOpt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      title={themeOpt}
                      aria-label={themeOpt}
                      onClick={() => setMoodPrompt(themeOpt)}
                      className="text-[11px] px-2 py-0.5 rounded bg-dark-input hover:bg-dark-border border border-dark-border text-dark-text-secondary hover:text-dark-text-primary transition-colors cursor-pointer"
                    >
                      {themeOpt.length > 32 ? `${themeOpt.slice(0, 32)}…` : themeOpt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateMoodBoard}
                disabled={isGeneratingImage || !moodPrompt.trim()}
                className={`w-full py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  isGeneratingImage || !moodPrompt.trim()
                    ? 'bg-dark-input text-dark-text-tertiary border border-dark-border cursor-not-allowed shadow-none'
                    : 'bg-gold-premium hover:bg-gold-hover text-dark-bg'
                }`}
                id="generate-moodboard-btn"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-dark-bg" />
                    <span>Sculpting Theme Concept...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-dark-bg" />
                    <span>Generate Mood Board Image</span>
                  </>
                )}
              </button>

              {imageGenError && (
                <p className="text-[11px] text-rose-400 font-bold bg-rose-950/20 border border-rose-900/40 p-2 rounded-xl">
                  {imageGenError}
                </p>
              )}

              {generatedMoodUrl ? (
                <div
                  className="relative overflow-hidden rounded-xl border border-dark-border bg-dark-bg mt-1"
                  id="generated-image-display"
                >
                  <img
                    src={generatedMoodUrl}
                    alt="AI Generated Mood Board"
                    className="w-full h-auto aspect-video object-cover transition-transform hover:scale-105 duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-300 font-semibold line-clamp-1 italic">
                      {moodPrompt}
                    </span>
                    <button
                      onClick={handleClearMoodBoard}
                      className="text-[11px] uppercase tracking-wider font-bold text-rose-400 hover:text-rose-300 underline shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-dark-border rounded-xl aspect-video flex flex-col items-center justify-center text-center p-4 bg-dark-input/20 mt-1">
                  <ImageIcon className="w-8 h-8 text-dark-text-tertiary mb-1" />
                  <p className="text-[11px] text-dark-text-secondary font-medium">
                    No custom mood-board generated yet
                  </p>
                  <p className="text-[11px] text-dark-text-tertiary max-w-xs mt-0.5 leading-normal">
                    Describe your luxury vision and trigger our AI generator to paint a
                    high-fidelity visual context.
                  </p>
                </div>
              )}
            </div>
          </div>
          </>
          ) : (
            <VenueMap
              itinerary={itinerary}
              selectedDate={mapSelectedDate}
              onSelectDate={setMapSelectedDate}
            />
          )}
        </div>

        {/* RIGHT COLUMN: Active Event Itinerary (cols 5) */}
        <div className="lg:col-span-5 flex flex-col space-y-5 scroll-mt-28 lg:scroll-mt-4" id="itinerary-column">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col h-full">
            <div className="flex items-center justify-between pb-4 border-b border-dark-border">
              <div>
                <h2 className="font-serif font-light text-lg text-dark-text-primary flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-gold-premium" /> Active Schedule
                </h2>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-dark-text-tertiary mt-0.5">
                  Customize event details &amp; times
                </p>
              </div>

              {itinerary.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                  id="clear-all-itinerary-btn"
                >
                  Clear All
                </button>
              )}
            </div>

            <div
              className="flex-1 overflow-visible max-h-none lg:overflow-y-auto lg:max-h-[640px] space-y-4 pt-4 pb-36 lg:pb-4"
              id="itinerary-items-list-container"
            >
              {itinerary.length === 0 ? (
                <div
                  className="py-12 px-6 text-center border border-dashed border-dark-border rounded-2xl"
                  id="itinerary-empty-state"
                >
                  <Calendar className="w-12 h-12 text-dark-text-tertiary mx-auto mb-3" />
                  <h3 className="font-serif font-light text-dark-text-primary text-base">
                    Your itinerary is empty
                  </h3>
                  <p className="text-xs text-dark-text-secondary mt-1 max-w-xs mx-auto">
                    Select activities from our luxury catalog on the left, or configure a customized
                    bespoke session to start your itinerary!
                  </p>

                  <div className="mt-4 flex flex-col gap-2 items-center">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-dark-text-tertiary">
                      Quick recommendations:
                    </span>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      <button
                        onClick={() =>
                          handleAddActivity(CATALOG_ACTIVITIES.find((a) => a.id === 'w1')!)
                        }
                        className="text-[11px] px-2.5 py-1 bg-gold-premium/10 hover:bg-gold-premium/20 border border-gold-premium/20 text-gold-premium font-semibold rounded transition-colors cursor-pointer"
                      >
                        + Sunset Wedding
                      </button>
                      <button
                        onClick={() =>
                          handleAddActivity(CATALOG_ACTIVITIES.find((a) => a.id === 'd1')!)
                        }
                        className="text-[11px] px-2.5 py-1 bg-gold-premium/10 hover:bg-gold-premium/20 border border-gold-premium/20 text-gold-premium font-semibold rounded transition-colors cursor-pointer"
                      >
                        + Beachside Dinner
                      </button>
                      <button
                        onClick={() =>
                          handleAddActivity(CATALOG_ACTIVITIES.find((a) => a.id === 'a5')!)
                        }
                        className="text-[11px] px-2.5 py-1 bg-gold-premium/10 hover:bg-gold-premium/20 border border-gold-premium/20 text-gold-premium font-semibold rounded transition-colors cursor-pointer"
                      >
                        + Floating Breakfast
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pr-1">
                  <DayTimeline
                    groups={dayGroups}
                    conflicts={scheduleConflicts}
                    transitGaps={transitGaps}
                  />
                  <AnimatePresence mode="popLayout">
                    {chronologicalItinerary.map((item) => {
                      const associated = CATALOG_ACTIVITIES.find((a) => a.id === item.activityId);
                      return (
                        <ItineraryItemView
                          key={item.id}
                          item={item}
                          associatedActivity={associated}
                          onUpdate={handleUpdateItem}
                          onRemove={handleRemoveItem}
                          allowLocationSwitch={associated?.location === 'Both'}
                          hasConflict={itemHasConflict(item.id, scheduleConflicts)}
                          hasTransitGap={itemHasTransitGap(item.id, transitGaps)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div
              className="pt-4 border-t border-dark-border mt-auto lg:static sticky bottom-0 z-10 px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-dark-card/95 [-webkit-backdrop-filter:blur(8px)] backdrop-blur-sm"
              id="cost-estimator-panel"
            >
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-text-secondary font-semibold">Total Capacity Required</span>
                  <span className="font-mono font-bold text-dark-text-primary">
                    {totalGuestsMax} guests peak
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-text-secondary font-semibold">Scheduled Events Count</span>
                  <span className="font-mono font-bold text-dark-text-primary">
                    {itinerary.length} items
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-dashed border-dark-border">
                  <span className="font-serif font-bold text-dark-text-primary text-sm">
                    Estimated Grand Total
                  </span>
                  <div className="text-right">
                    <span className="font-mono text-2xl font-extrabold text-gold-premium">
                      ${totalEstimatedCost.toLocaleString()}
                    </span>
                    <span className="block text-[11px] text-dark-text-tertiary font-semibold">
                      Includes setup &amp; guest multipliers
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={itinerary.length === 0}
                  onClick={() => setShowSummaryModal(true)}
                  className={`py-3 px-4 rounded font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    itinerary.length === 0
                      ? 'bg-dark-input text-dark-text-tertiary border border-dark-border cursor-not-allowed shadow-none'
                      : 'border border-gold-premium text-gold-premium hover:bg-gold-premium/10'
                  }`}
                  id="view-summary-btn"
                >
                  <Download className="w-4 h-4" /> Review &amp; Export
                </button>
                <button
                  onClick={handleSavePlanner}
                  className="py-3 px-4 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded text-xs font-bold uppercase tracking-widest transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                  id="save-planner-btn"
                >
                  <CheckCircle className="w-4 h-4" /> Save Plans
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="bg-dark-bg border-t border-dark-border py-8 px-6 text-center text-[11px] text-dark-text-tertiary font-bold tracking-widest uppercase shrink-0"
        id="main-footer"
      >
        <p>© 2026 VILLA &amp; VALE RESORTS. ELEGANT PRIVATE VENUES &amp; CELEBRATIONS.</p>
      </footer>

      {/* DETAILED SUMMARY & PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {showSummaryModal && (
          <motion.div
            key="summary-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            id="summary-modal-backdrop"
            onClick={() => setShowSummaryModal(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="summary-modal-title"
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="bg-dark-card rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-dark-border"
              id="summary-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                id="summary-modal-chrome-header"
                className="bg-dark-bg border-b border-dark-border text-dark-text-primary p-5 flex items-center justify-between shrink-0"
              >
                <div>
                  <h3 id="summary-modal-title" className="font-serif font-light text-lg">
                    Event Schedule Recap
                  </h3>
                  <p className="text-[11px] uppercase tracking-wider text-dark-text-tertiary font-bold mt-0.5">
                    Official presentation layout
                  </p>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="text-dark-text-secondary hover:text-gold-premium transition-colors p-1.5 rounded text-xs font-bold uppercase tracking-wider hover:bg-dark-input cursor-pointer"
                  id="close-summary-modal-btn"
                  aria-label="Close summary dialog"
                >
                  ✕ Close
                </button>
              </div>

              <div
                className="p-6 overflow-y-auto flex-1 space-y-6 text-left bg-dark-card"
                id="print-area"
              >
                <div className="border-b-2 border-dark-border pb-4 text-center sm:text-left flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-widest font-black text-gold-premium">
                      Villa &amp; Hotel Occasion Summary
                    </span>
                    <h2 className="font-serif text-2xl font-light text-dark-text-primary tracking-tight">
                      {plannerName}
                    </h2>
                    <p className="text-xs text-dark-text-tertiary mt-1">
                      Generated:{' '}
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-center sm:text-right font-mono">
                    <span className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-tertiary">
                      Estimated Total
                    </span>
                    <span className="text-2xl font-extrabold text-gold-premium">
                      ${totalEstimatedCost.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-serif font-light text-sm text-dark-text-secondary border-b border-dark-border pb-1 uppercase tracking-wide">
                    Chronological Events ({itinerary.length})
                  </h4>

                  {scheduleConflicts.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                      Note: {scheduleConflicts.length} same-venue schedule conflict
                      {scheduleConflicts.length === 1 ? '' : 's'} detected — review times before
                      confirming with Villa &amp; Vale.
                    </p>
                  )}
                  {transitGaps.length > 0 && (
                    <p className="text-xs text-sky-800 dark:text-sky-200 font-semibold bg-sky-500/10 border border-sky-500/30 rounded-xl px-3 py-2">
                      Note: {transitGaps.length} coastal drive
                      {transitGaps.length === 1 ? '' : 's'} too tight between venues — add buffer
                      or adjust start times.
                    </p>
                  )}

                  {itinerary.length === 0 ? (
                    <p className="text-xs text-dark-text-tertiary py-4 text-center italic">
                      No scheduled events in itinerary.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {itinerary
                        .slice()
                        .sort((a, b) => {
                          const dateCompare = a.date.localeCompare(b.date);
                          if (dateCompare !== 0) return dateCompare;
                          return a.time.localeCompare(b.time);
                        })
                        .map((item, idx) => (
                          <div
                            key={item.id}
                            className="bg-dark-bg p-4 rounded-xl border border-dark-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#0A0A0A] bg-gold-premium px-1.5 py-0.5 rounded-sm uppercase text-[11px]">
                                  {idx + 1}
                                </span>
                                <h5 className="font-serif font-light text-dark-text-primary text-sm">
                                  {item.title}
                                </h5>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-dark-text-secondary font-medium">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" /> {item.date}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> {item.time}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" /> At {item.location}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" /> {item.guests} guests
                                </span>
                              </div>

                              {item.notes && (
                                <p className="text-dark-text-primary bg-dark-input p-2.5 rounded border border-dark-border italic text-[11px] mt-2 leading-relaxed">
                                  &ldquo;{item.notes}&rdquo;
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0 min-w-[100px]">
                              <p className="font-mono font-bold text-gold-premium text-sm">
                                ${item.calculatedPrice.toLocaleString()}
                              </p>
                              <span className="text-[11px] text-dark-text-tertiary font-semibold uppercase tracking-wider">
                                {item.category}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="bg-dark-bg p-5 rounded-2xl border border-dark-border space-y-4">
                  <h4 className="font-serif font-light text-sm text-dark-text-secondary uppercase tracking-wide">
                    Budget Distribution
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 space-y-2.5 text-xs font-mono">
                      <div className="p-2.5 bg-dark-card/60 rounded-xl border border-dark-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span className="text-dark-text-secondary font-bold uppercase text-[11px]">
                            Weddings
                          </span>
                        </div>
                        <span className="text-dark-text-primary font-bold">
                          ${weddingTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 bg-dark-card/60 rounded-xl border border-dark-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          <span className="text-dark-text-secondary font-bold uppercase text-[11px]">
                            Dinners
                          </span>
                        </div>
                        <span className="text-dark-text-primary font-bold">
                          ${dinnerTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 bg-dark-card/60 rounded-xl border border-dark-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                          <span className="text-dark-text-secondary font-bold uppercase text-[11px]">
                            Activities
                          </span>
                        </div>
                        <span className="text-dark-text-primary font-bold">
                          ${activityTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div
                      className="md:col-span-7 h-40 w-full flex items-center justify-center bg-dark-card/40 rounded-xl border border-dark-border/40 p-2"
                      id="summary-piechart-container"
                    >
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={48}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']}
                              contentStyle={{
                                backgroundColor: 'var(--color-dark-card, #161616)',
                                borderColor: 'var(--color-dark-border, #2A2A2A)',
                                borderRadius: '8px',
                                color: 'var(--color-dark-text-primary, #FFF)',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                              }}
                            />
                            <Legend
                              verticalAlign="middle"
                              align="right"
                              layout="vertical"
                              iconSize={7}
                              iconType="circle"
                              wrapperStyle={{
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                color: 'var(--color-dark-text-secondary, #A0AEC0)',
                                paddingLeft: '8px',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <span className="text-xs text-dark-text-tertiary italic">
                          No budget distribution data available
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-dark-text-tertiary leading-normal space-y-1 pt-4 border-t border-dashed border-dark-border">
                  <p className="font-bold text-dark-text-secondary">Planning Policies &amp; Agreements:</p>
                  <p>
                    • Costs represented here are conceptual estimates. Actual billing is finalized
                    during catering lock-in contract negotiations.
                  </p>
                  <p>
                    • Cancellations or significant scale down of guests within 14 days of any
                    scheduled dinner/activity is subject to a 50% reservation penalty fee.
                  </p>
                  <p>
                    • Customized decor arrangements or technical installations require layout
                    approval from Villa and Hotel logistics teams.
                  </p>
                </div>
              </div>

              <div
                id="summary-modal-chrome-footer"
                className="p-4 bg-dark-bg border-t border-dark-border shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <p className="text-xs text-dark-text-secondary font-medium">
                  Download calendar (.ics) or print a PDF of this agenda.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadIcs(plannerName, itinerary)}
                    className="px-4 py-2 border border-gold-premium text-gold-premium hover:bg-gold-premium/10 rounded text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                    id="download-ics-action-btn"
                  >
                    <CalendarPlus className="w-4 h-4" /> Download .ics
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="px-4 py-2 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                    id="print-summary-action-btn"
                  >
                    <Printer className="w-4 h-4" /> Print / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSummaryModal(false)}
                    className="px-4 py-2 bg-dark-input border border-dark-border text-dark-text-secondary hover:bg-dark-bg hover:text-dark-text-primary rounded text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                    id="cancel-summary-modal-btn"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
