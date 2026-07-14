# Villa & Vale Event Planner

React + Vite web app (and Expo mobile companion) for planning villa and hotel events — weddings, dinners, and activities — with itinerary costing, day timeline + conflict detection, calendar export, and proposal inquiry handoff.

## Web

```bash
npm install
# Optional: GEMINI_API_KEY in .env for live weather + mood boards
npm run dev
```

Server listens on `http://localhost:3000` (Express + Vite in development).

### Client planner features
- Catalog browse / filter and bespoke custom events
- Day timeline with same-venue overlap warnings
- Review & Export: print/PDF + downloadable `.ics` calendar
- Request a Proposal: mailto inquiry + copy agenda package

## Mobile (Expo)

```bash
cd mobile
npm install
npx expo start
```

API base URL defaults to `http://localhost:3000` (iOS simulator) or `http://10.0.2.2:3000` (Android emulator). On a physical device set `EXPO_PUBLIC_API_URL` to your machine’s LAN address (e.g. `http://192.168.1.10:3000`).

## Stack

- Web: React 19, Vite 6, Tailwind CSS 4, Motion, Recharts
- Server: Express, Google Gemini (`@google/genai`)
- Mobile: Expo / React Native, AsyncStorage
