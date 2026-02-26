# RACEFUEL — Project Details & Codebase Analysis

## Executive Summary

RACEFUEL is a browser-based nutrition planning application for endurance athletes. It allows users to import cycling/running/triathlon routes (via GPX file upload, Strava API, or demo data), visualize them on an interactive Mapbox map with elevation profiles, and plan nutrition intake by placing branded South African sports nutrition products at specific points along the route. The app calculates carbohydrate-per-hour targets, estimated costs, and provides drag-and-drop or click-to-place product placement on both the map and elevation chart.

**Tech Stack:** React 18 + TypeScript + Vite 5 + Tailwind CSS 3.4 + Mapbox GL JS 3.18  
**Target Market:** South African endurance athletes (cycling-first, with running/triathlon/hiking)  
**Deployment:** Docker → Nginx on GCP (Cloud Run ready)  
**Design Language:** Dark, futuristic HUD/motorsport aesthetic with neon accent colors

---

## 1. Architecture Overview

### 1.1 Application Structure

```
src/
├── App.tsx                          # Root layout: Sidebar | Map+ElevationPanel | NutritionPanel
├── index.tsx                        # React 18 createRoot entry
├── index.css                        # Tailwind directives + custom utilities
├── vite-env.d.ts                    # Env type declarations
│
├── context/
│   └── AppContext.tsx                # Monolithic context (ALL app state lives here)
│
├── components/
│   ├── Sidebar.tsx                   # Left panel: branding, sport selector, Strava, profile
│   ├── MapCanvas.tsx                 # Center: map container + elevation profile chart
│   ├── MapView.tsx                   # Mapbox GL JS initialization + route rendering
│   ├── NutritionPanel.tsx            # Right panel: product catalog + search + summary
│   ├── GpxDropZone.tsx               # File upload / Strava import / demo launcher
│   ├── ActionBar.tsx                 # Bottom bar: route stats summary
│   ├── AutoGenerateButton.tsx        # CTA for auto-generating nutrition plan
│   ├── NutritionCard.tsx             # Individual product card (draggable)
│   ├── NutritionMarker.tsx           # Pin/marker on elevation chart
│   ├── CartModal.tsx                 # Shopping cart / nutrition kit modal
│   ├── EditProfileModal.tsx          # Athlete profile editor
│   ├── OnboardingModal.tsx           # 4-step onboarding wizard
│   ├── ProductDetailModal.tsx        # Full product info modal
│   ├── ProductPickerModal.tsx        # Click-on-route product selector (portal)
│   └── strava/
│       └── StravaActivityList.tsx    # Strava activity browser + import
│
├── data/
│   └── products.ts                   # Static product catalog (27 products)
│
└── services/
    └── strava/
        ├── index.ts                  # Barrel export
        ├── stravaTypes.ts            # TypeScript interfaces
        ├── stravaAuth.ts             # OAuth 2.0 flow + token management
        ├── stravaApi.ts              # API client (athlete, activities, streams)
        └── stravaUtils.ts            # Polyline decoding, data transforms
```

### 1.2 Data Flow

```
User Input (GPX/Strava/Demo)
    ↓
AppContext.loadRoute() / importStravaActivity()
    ↓
RouteData { gpsPath[], distanceKm, elevationGain, nutritionPoints[] }
    ↓
┌──────────────────────────────────────────────────────┐
│  MapView.tsx         │  ElevationChart    │  ActionBar │
│  (Mapbox GL JS)      │  (CSS bars)        │  (Stats)   │
│  - Route polyline    │  - Height bars     │  - Distance │
│  - Start/end markers │  - Nutrition pins  │  - Points   │
│  - Nutrition markers │  - Drop zone       │  - Carbs    │
│  - Click to add      │                    │  - Cost     │
│  - Drag to add       │                    │             │
└──────────────────────────────────────────────────────┘
    ↓
NutritionPanel.tsx (product catalog, search, cart summary)
```

### 1.3 State Management

**Single monolithic React Context** (`AppContext.tsx` — ~380 lines) manages:

| State Slice | Type | Persistence |
|-------------|------|-------------|
| `onboardingComplete` | boolean | In-memory only |
| `userProfile` | `{weight, height, sweatRate, ftp}` | localStorage |
| `routeData` | Full route + nutrition points | In-memory only |
| `sportType` | `cycling\|running\|triathlon\|hiking` | In-memory only |
| `strava` | Auth state + athlete | localStorage (tokens) |
| `stravaActivities` | Activity list cache | In-memory only |

**Key observation:** Route data and nutrition plans are lost on page refresh. There is no persistence layer for plans.

---

## 2. Feature Inventory

### 2.1 Working Features

| Feature | Status | Quality |
|---------|--------|---------|
| GPX file upload + parsing | ✅ Working | Good — haversine distance, elevation gain |
| Demo route loading | ✅ Working | Cape Town mock data |
| Mapbox dark map rendering | ✅ Working | Requires token in .env |
| Route polyline with gradient | ✅ Working | Cyan → white → orange |
| Elevation profile (bar chart) | ✅ Working | Real data when available |
| Drag products onto elevation chart | ✅ Working | Calculates distance from X position |
| Click-on-map product placement | ✅ Working | Nearest-point snapping |
| Product catalog with search | ✅ Working | 27 SA products with real images |
| Category filtering (gels/drinks/bars/chews) | ✅ Working | Tab-based |
| Nutrition summary (carbs/hr, cost) | ✅ Working | Based on route time estimate |
| Cart/kit modal | ✅ Working | Grouping, quantity, remove |
| Product detail modal | ✅ Working | Full nutrition + efficiency metrics |
| Onboarding wizard (4 steps) | ✅ Working | Strava → metrics → sweat → ready |
| Profile editing with persistence | ✅ Working | localStorage |
| Sport type selector | ✅ Working | Filters Strava activities |
| Strava OAuth 2.0 flow | ✅ Working | Client-side (security concern) |
| Strava activity import | ✅ Working | With stream data fallback |
| Strava profile sync (weight/FTP) | ✅ Working | One-way sync |
| Auto-generate nutrition plan | ✅ Working | Very basic algorithm |
| Reset route / Reset all | ✅ Working | Clears state + localStorage |

### 2.2 Broken / Stub Features

| Feature | Status | Issue |
|---------|--------|-------|
| **Export Plan** button | ❌ Stub | Button exists, no handler — no GPX/FIT/TIFF export |
| **Checkout** button | ❌ Stub | `alert('Checkout coming soon!')` |
| Drag-on-map product placement | ⚠️ Partial | Works but UX is rough — no visual feedback during drag |
| Responsive layout | ❌ Missing | Fixed widths (w-72, w-80) — unusable on mobile |
| Garmin Connect integration | ❌ Missing | Not implemented at all |
| FIT file parsing | ❌ Missing | Only GPX supported |
| Route persistence | ❌ Missing | Plans lost on refresh |
| User accounts | ❌ Missing | Single-user, client-side only |
| Real nutrition science engine | ❌ Missing | Auto-gen is just "every 15km" |
| Undo/redo | ❌ Missing | No action history |

### 2.3 Product Catalog Analysis

27 products across 4 categories, all South African market with ZAR pricing:

| Category | Count | Brands |
|----------|-------|--------|
| Gels | 12 | GU Energy, Maurten, SIS, 32Gi, USN, Biogen |
| Drinks | 8 | Maurten, SIS, 32Gi, Nuun |
| Bars | 3 | Maurten, USN, 32Gi |
| Chews | 2 | GU Energy, SIS |

**Issues:**
- Product images are external URLs (CDN links) — fragile, may break
- No product versioning or update mechanism
- Missing products: Clif, Hammer, Tailwind, Spring, PowerBar
- No "custom product" entry for homemade nutrition
- Nuun Sport priced at R180 (tube of tabs) but treated as single-serving in calculations

---

## 3. Technical Deep Dive

### 3.1 Mapbox Integration (`MapView.tsx`)

**Strengths:**
- Proper lifecycle management (init → add route → add markers → cleanup)
- Invisible wide hover area for easy route interaction
- Line-progress gradient for visual appeal
- Start/end markers with distinct colors

**Weaknesses:**
- Markers created via raw DOM (`document.createElement`) — not React-managed
- Marker cleanup uses array slicing (`markersRef.current.slice(2)`) — fragile
- No marker clustering for dense nutrition points
- No terrain/3D elevation view
- Closest-point algorithm is O(n) brute force on every mouse move
- Map token exposed in client bundle

### 3.2 Strava Integration (`services/strava/`)

**Well-structured** into 4 files (types, auth, api, utils) with clear separation.

**Critical security issue:** Client secret is in the browser bundle (`VITE_STRAVA_CLIENT_SECRET`). This is acknowledged in comments but must be fixed for production.

**OAuth flow:**
1. `initiateOAuth()` → redirect to Strava
2. On return, `hasOAuthCallback()` detects `?code=` param
3. `exchangeCodeForTokens()` POSTs to Strava token endpoint (client-side!)
4. Tokens stored in localStorage with auto-refresh

**Activity import pipeline:**
1. Fetch activity list → filter by sport type
2. On import: fetch streams (latlng, altitude, distance)
3. Transform to RouteData via `transformActivityToRoute()`
4. Falls back to summary polyline decoding if streams fail

**Polyline decoder** is a correct implementation of Google's encoding algorithm.

### 3.3 GPX Parser (`AppContext.tsx` → `loadRoute()`)

Inline in AppContext (should be extracted). Handles:
- `<trkpt>` (track points) and `<rtept>` (route points)
- Haversine distance calculation
- Cumulative elevation gain
- Falls back to demo route on parse failure

**Missing:** FIT file support, TCX support, drag-and-drop folder, multi-segment tracks, waypoint import.

### 3.4 Nutrition Engine (`autoGeneratePlan()`)

Currently trivial:
```
Every 15km → alternating gel/drink
```

No consideration of: athlete weight, FTP, estimated power output, elevation difficulty, temperature, race duration, gastric tolerance, caffeine timing, sodium needs, or progressive carb loading strategies.

### 3.5 Elevation Profile (`ElevationChart` in `MapCanvas.tsx`)

Pure CSS implementation — 40 bars with percentage heights. Not SVG or Canvas.

**Issues:**
- No interactive hover/tooltip on elevation bars
- Nutrition markers positioned absolutely with `left: %` — imprecise
- No zoom or selection range
- No gradient coloring by slope
- Bars don't correspond exactly to distance segments

### 3.6 Styling & Design System

Tailwind CSS 3.4 with custom theme:
- **Colors:** `background (#0a0a0a)`, `surface (#141414)`, neon orange/blue/green
- **Fonts:** JetBrains Mono (data), Inter (UI)
- **Custom utilities:** `clip-corner` (CSS clip-path), `pulse-glow` animation
- **Grid pattern:** Subtle background grid via CSS linear-gradient

The HUD/motorsport aesthetic is well-executed but entirely custom — no design system documentation exists.

---

## 4. Dependencies & Infrastructure

### 4.1 Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.3.1 | UI framework |
| react-dom | 18.3.1 | DOM rendering |
| mapbox-gl | 3.18.1 | Interactive maps |
| lucide-react | 0.522.0 | Icons |
| @types/mapbox-gl | 3.4.1 | TypeScript types (runtime dep — should be devDep) |

### 4.2 Dev Dependencies

Vite 5, TypeScript 5, Tailwind 3.4, ESLint 8, PostCSS, Autoprefixer.

### 4.3 Build & Deploy

- **Dev:** `npx vite` (HMR, no pre-bundling issues)
- **Build:** `npx vite build` → static files in `dist/`
- **Docker:** Multi-stage (Node build → Nginx serve on port 8080)
- **GCP:** `.gcloudignore` present, Cloud Run ready

### 4.4 Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_STRAVA_CLIENT_ID` | For Strava | OAuth app ID |
| `VITE_STRAVA_CLIENT_SECRET` | For Strava | ⚠️ Exposed in client |
| `VITE_STRAVA_REDIRECT_URI` | Optional | Defaults to origin |
| `VITE_MAPBOX_TOKEN` | For maps | Mapbox GL access token |

---

## 5. Code Quality Assessment

### 5.1 Strengths
- Clean TypeScript with proper interfaces
- Strava service well-modularized
- Product data well-structured with consistent schema
- Tailwind usage is consistent and the design is cohesive
- React hooks used correctly (useCallback, useMemo where needed)
- Error boundaries on image loads

### 5.2 Weaknesses
- **Monolithic context** — AppContext.tsx is 380+ lines managing everything
- **GPX parsing inline** in context — should be a service
- **No tests** — zero test files
- **No error boundaries** — React error boundaries missing
- **Memory leaks** — Mapbox event listeners in useEffect without proper cleanup
- **No loading states** for many async operations
- **Inconsistent ID generation** — `Math.random().toString(36).substr(2, 9)` is not collision-safe
- **autoGeneratePlan()** uses hardcoded mock products that don't match the product catalog
- **@types/mapbox-gl** is listed as a runtime dependency instead of devDependency
- **No accessibility** — no ARIA labels, keyboard navigation, screen reader support
- **No i18n** — hardcoded English/ZAR

### 5.3 Performance Concerns
- O(n) nearest-point search on every mouse move over map route
- All 27 products rendered in right panel (no virtualization)
- Elevation chart re-renders full bar set on any routeData change
- Mapbox markers are DOM elements, not WebGL — slow with many nutrition points
- No code splitting or lazy loading

---

## 6. User Experience Gaps

1. **No undo** — accidentally removing a nutrition point is permanent
2. **No drag reposition** — can't move placed nutrition points along the route
3. **No plan comparison** — can't A/B test different nutrition strategies
4. **No timeline view** — only distance-based, not time-based visualization
5. **No weather integration** — temperature significantly affects nutrition needs
6. **No race-day checklist** — what to actually pack
7. **No sharing** — can't share plans with coaches or teammates
8. **No print view** — can't print a race-day sheet
9. **Lost on refresh** — entire plan disappears
10. **No Garmin support** — largest GPS device ecosystem excluded
