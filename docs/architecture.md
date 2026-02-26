# RACEFUEL — Improved Architecture

## Design Philosophy

RACEFUEL should evolve from a single-page prototype into a **modular, offline-capable, data-driven nutrition planning platform**. The architecture must support:

1. **Multiple data sources** — GPX, FIT, TCX, Strava, Garmin, Wahoo, manual route drawing
2. **Real nutrition science** — evidence-based fueling strategies, not just "every 15km"
3. **Export everywhere** — GPX with waypoints, FIT course files, PDF race sheets, printable checklists
4. **Persistence & sharing** — plans survive refresh, can be shared, versioned, compared
5. **Progressive enhancement** — works offline, syncs when connected

---

## 1. Proposed Module Architecture

```
src/
├── app/
│   ├── App.tsx                        # Shell layout with responsive breakpoints
│   ├── Router.tsx                     # Client-side routing (plans, library, settings)
│   └── providers/
│       ├── AppProviders.tsx           # Composed provider tree
│       ├── ThemeProvider.tsx           # Dark/light mode + design tokens
│       └── ToastProvider.tsx           # Global notifications
│
├── features/                          # Feature-based modules (each self-contained)
│   ├── route/
│   │   ├── context/RouteContext.tsx    # Route state only
│   │   ├── hooks/useRouteLoader.ts    # GPX/FIT/TCX/Strava/Garmin loading
│   │   ├── hooks/useElevation.ts      # Elevation data processing
│   │   ├── hooks/useRouteMetrics.ts   # Distance, gain, difficulty scoring
│   │   ├── components/
│   │   │   ├── MapView.tsx            # Mapbox wrapper (rewritten)
│   │   │   ├── ElevationProfile.tsx   # SVG-based interactive elevation
│   │   │   ├── RouteInfoBar.tsx       # Stats overlay
│   │   │   ├── RouteDropZone.tsx      # File upload + import
│   │   │   └── RouteTimeline.tsx      # Time-based route visualization
│   │   ├── services/
│   │   │   ├── gpxParser.ts           # GPX → RouteData
│   │   │   ├── fitParser.ts           # FIT → RouteData (NEW)
│   │   │   ├── tcxParser.ts           # TCX → RouteData (NEW)
│   │   │   └── routeAnalyzer.ts       # Segment analysis, difficulty scoring
│   │   └── types.ts
│   │
│   ├── nutrition/
│   │   ├── context/NutritionContext.tsx  # Nutrition plan state
│   │   ├── hooks/useNutritionEngine.ts  # Core planning algorithm
│   │   ├── hooks/useNutritionMetrics.ts # Carbs/hr, sodium, hydration calcs
│   │   ├── components/
│   │   │   ├── NutritionPanel.tsx       # Product browser + plan summary
│   │   │   ├── ProductCard.tsx          # Draggable product card
│   │   │   ├── ProductDetail.tsx        # Full product modal
│   │   │   ├── ProductPicker.tsx        # Click-to-place picker
│   │   │   ├── NutritionMarker.tsx      # Map + elevation markers
│   │   │   ├── NutritionTimeline.tsx    # Time-based nutrition view (NEW)
│   │   │   ├── PlanComparison.tsx       # Side-by-side plan comparison (NEW)
│   │   │   └── CartView.tsx             # Shopping list / kit builder
│   │   ├── engine/
│   │   │   ├── carbCalculator.ts        # Evidence-based carb targets
│   │   │   ├── hydrationCalculator.ts   # Sweat rate + sodium loss model
│   │   │   ├── caffeineStrategy.ts      # Caffeine timing optimizer
│   │   │   ├── gutTrainingModel.ts      # Progressive carb tolerance
│   │   │   ├── planGenerator.ts         # Full auto-generation orchestrator
│   │   │   └── planValidator.ts         # Validate plan against constraints
│   │   ├── data/
│   │   │   ├── products.ts              # Product catalog
│   │   │   └── productSchema.ts         # Zod validation schema (NEW)
│   │   └── types.ts
│   │
│   ├── athlete/
│   │   ├── context/AthleteContext.tsx    # Profile + preferences
│   │   ├── hooks/useAthleteMetrics.ts   # Derived metrics (BMR, zones, etc.)
│   │   ├── components/
│   │   │   ├── ProfileEditor.tsx        # Full profile editor
│   │   │   ├── OnboardingWizard.tsx     # First-run setup
│   │   │   └── ProfileCard.tsx          # Sidebar summary
│   │   └── types.ts
│   │
│   ├── integrations/
│   │   ├── strava/
│   │   │   ├── context/StravaContext.tsx
│   │   │   ├── hooks/useStrava.ts
│   │   │   ├── components/
│   │   │   │   ├── StravaConnect.tsx
│   │   │   │   └── StravaActivityBrowser.tsx
│   │   │   ├── services/
│   │   │   │   ├── stravaAuth.ts        # (existing, improved)
│   │   │   │   ├── stravaApi.ts         # (existing, improved)
│   │   │   │   └── stravaTransforms.ts  # (existing stravaUtils, renamed)
│   │   │   └── types.ts
│   │   │
│   │   ├── garmin/                      # NEW — Garmin Connect IQ
│   │   │   ├── context/GarminContext.tsx
│   │   │   ├── hooks/useGarmin.ts
│   │   │   ├── components/
│   │   │   │   ├── GarminConnect.tsx
│   │   │   │   └── GarminDeviceSync.tsx
│   │   │   ├── services/
│   │   │   │   ├── garminAuth.ts        # OAuth 2.0 for Garmin
│   │   │   │   ├── garminApi.ts         # Activities, courses, wellness
│   │   │   │   └── garminTransforms.ts  # Garmin → RouteData
│   │   │   └── types.ts
│   │   │
│   │   └── wahoo/                       # Future — Wahoo SYSTM
│   │       └── ...
│   │
│   └── export/                          # NEW — Full export system
│       ├── hooks/useExport.ts
│       ├── components/
│       │   ├── ExportModal.tsx           # Export format picker
│       │   └── ExportPreview.tsx         # Preview before download
│       ├── services/
│       │   ├── gpxExporter.ts           # Route + nutrition waypoints → GPX
│       │   ├── fitExporter.ts           # Course file with course points → FIT
│       │   ├── pdfExporter.ts           # Race day sheet → PDF
│       │   ├── csvExporter.ts           # Nutrition data → CSV
│       │   ├── imageExporter.ts         # Map screenshot → PNG/TIFF
│       │   └── calendarExporter.ts      # Race day event → ICS
│       └── types.ts
│
├── shared/
│   ├── components/
│   │   ├── ui/                          # Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── Badge.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Panel.tsx
│   │   │   └── ResponsiveShell.tsx
│   │   └── data-display/
│   │       ├── StatRow.tsx
│   │       ├── ProgressBar.tsx
│   │       └── DataTable.tsx
│   │
│   ├── hooks/
│   │   ├── useLocalStorage.ts           # Type-safe localStorage
│   │   ├── useUndoRedo.ts              # Undo/redo state management
│   │   ├── useDragDrop.ts             # Unified drag-drop handling
│   │   ├── useDebounce.ts
│   │   └── useMediaQuery.ts            # Responsive breakpoints
│   │
│   ├── utils/
│   │   ├── geo.ts                       # Haversine, bearing, interpolation
│   │   ├── units.ts                     # km↔mi, kg↔lb, m↔ft conversions
│   │   ├── time.ts                      # Duration formatting
│   │   ├── id.ts                        # UUID/nanoid generation
│   │   └── color.ts                     # Product color utilities
│   │
│   └── types/
│       ├── route.ts                     # Shared route types
│       ├── nutrition.ts                 # Shared nutrition types
│       └── athlete.ts                   # Shared athlete types
│
├── persistence/                         # NEW — Data persistence layer
│   ├── db.ts                            # IndexedDB via Dexie.js
│   ├── schemas/
│   │   ├── planSchema.ts               # Nutrition plan schema
│   │   ├── routeSchema.ts             # Route cache schema
│   │   └── preferencesSchema.ts       # User preferences
│   ├── hooks/
│   │   ├── usePlan.ts                  # CRUD for nutrition plans
│   │   ├── useRouteLibrary.ts         # Saved routes
│   │   └── usePreferences.ts          # Persistent preferences
│   └── migrations/                     # DB version migrations
│       └── v1.ts
│
└── workers/                            # NEW — Web Workers for heavy lifting
    ├── fitParser.worker.ts             # FIT binary parsing off main thread
    ├── routeAnalyzer.worker.ts         # Segment analysis
    └── planOptimizer.worker.ts         # Nutrition optimization
```

---

## 2. State Management Redesign

### 2.1 Split the Monolith

The current `AppContext.tsx` (~380 lines, 25+ state values and methods) must be decomposed:

```
Current: AppContext (everything)
    ↓
Proposed:
├── RouteContext        # Route data, GPS path, loading state
├── NutritionContext    # Nutrition points, plan settings, engine config
├── AthleteContext      # Profile, preferences, onboarding
├── StravaContext       # Strava auth, activities, sync
├── GarminContext       # Garmin auth, activities, sync (NEW)
└── UIContext           # Modals, panels, sidebar state
```

### 2.2 State Machines for Complex Flows

Use state machines (XState or useReducer with discriminated unions) for:

```typescript
// Route loading state machine
type RouteState =
  | { status: 'empty' }
  | { status: 'loading'; source: 'gpx' | 'fit' | 'strava' | 'garmin' | 'demo' }
  | { status: 'loaded'; route: RouteData }
  | { status: 'error'; error: string; source: string }

// Strava auth state machine
type StravaAuthState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'authorizing'; redirectUrl: string }
  | { status: 'exchanging'; code: string }
  | { status: 'connected'; athlete: StravaAthlete; tokens: StravaTokens }
  | { status: 'error'; error: string; retryable: boolean }
```

### 2.3 Undo/Redo Architecture

```typescript
interface UndoableAction {
  type: 'ADD_NUTRITION_POINT' | 'REMOVE_NUTRITION_POINT' | 'MOVE_NUTRITION_POINT' | 'AUTO_GENERATE';
  payload: any;
  inverse: () => void; // How to undo this action
}

// Hook usage:
const { state, dispatch, undo, redo, canUndo, canRedo } = useUndoRedo(nutritionReducer, initialState);
```

### 2.4 Persistence Layer

**IndexedDB** (via Dexie.js) for offline-first data:

```typescript
// Database schema
const db = new Dexie('racefuel');
db.version(1).stores({
  plans: '++id, name, routeId, createdAt, updatedAt',
  routes: '++id, name, source, distanceKm, createdAt',
  products: 'id, brand, category',
  preferences: 'key',
});
```

---

## 3. Integration Architecture

### 3.1 Backend Proxy (Required for Production)

**Critical:** OAuth client secrets must not be in the browser. Add a lightweight backend:

```
Client (React)  →  Proxy API  →  Strava API
                               →  Garmin API
                               →  Wahoo API
```

**Options (lightest to heaviest):**

| Option | Effort | Hosting |
|--------|--------|---------|
| Cloudflare Workers | Low | Edge (free tier) |
| Vercel Edge Functions | Low | Serverless |
| Flask microservice (you know Flask) | Medium | GCP Cloud Run |
| Supabase Edge Functions | Low | Managed |

**Proxy responsibilities:**
- Store OAuth client secrets server-side
- Handle token exchange and refresh
- Rate limit API calls
- Cache Strava/Garmin responses (activities don't change often)

### 3.2 Garmin Connect Integration

Garmin's API ecosystem:

```
┌─────────────────────────────────────────────────┐
│                 Garmin Connect                    │
├─────────────────────────────────────────────────┤
│  Health API          │  Connect IQ API           │
│  - Activities        │  - Device apps            │
│  - Daily summaries   │  - Data fields            │
│  - Body composition  │  - Watch faces            │
│                      │                           │
│  Course API          │  Wellness API             │
│  - Upload courses    │  - Heart rate             │
│  - Course points     │  - Sleep                  │
│  - Nutrition alerts  │  - Stress                 │
└─────────────────────────────────────────────────┘
```

**Key Garmin features for RACEFUEL:**

1. **Activity Import** — Pull historical rides/runs with GPS + power data
2. **Course Upload** — Push routes TO Garmin devices with nutrition waypoints
3. **Course Points** — Garmin supports "food" and "water" course point types natively
4. **Body Composition** — Sync weight automatically
5. **Performance Metrics** — VO2 Max, training load for better calorie estimates

**OAuth flow:** Garmin uses OAuth 1.0a (not 2.0!) — requires server-side signing.

### 3.3 Unified Integration Interface

```typescript
interface PlatformIntegration {
  name: string;
  icon: React.ComponentType;
  status: 'connected' | 'disconnected' | 'error';

  connect(): Promise<void>;
  disconnect(): void;

  getActivities(options: ActivityQuery): Promise<Activity[]>;
  getActivity(id: string): Promise<ActivityDetail>;
  getStreams(activityId: string): Promise<StreamData>;

  // Platform-specific capabilities
  capabilities: {
    importRoutes: boolean;
    exportCourses: boolean;    // Garmin: yes, Strava: no
    syncProfile: boolean;
    coursePoints: boolean;      // Garmin: yes, Strava: no
    realTimeSync: boolean;     // Future: live ride data
  };
}
```

---

## 4. Nutrition Engine Architecture

### 4.1 Evidence-Based Calculation Model

```typescript
interface NutritionEngineInput {
  // Route data
  route: {
    distanceKm: number;
    elevationProfile: ElevationPoint[];
    segments: RouteSegment[];           // Climb/flat/descent classification
  };

  // Athlete data
  athlete: {
    weightKg: number;
    ftp: number;                        // Functional Threshold Power
    sweatRate: 'low' | 'medium' | 'high';
    gutTolerance: 'beginner' | 'trained' | 'elite';
    caffeineRegular: boolean;           // Regular caffeine consumer?
  };

  // Race parameters
  race: {
    targetIntensity: number;            // % of FTP (0.6-0.95)
    temperatureCelsius: number;
    humidity: number;                    // Affects sweat rate
    startTime: string;                  // For caffeine timing
    isCompetition: boolean;             // Higher carb targets for races
  };

  // Preferences
  preferences: {
    preferredProducts: string[];        // Product IDs
    excludedProducts: string[];         // Allergies, taste
    maxCaffeinePerHour: number;         // mg
    preferLiquids: boolean;             // Stomach sensitivity
    budget: number | null;              // ZAR limit
  };
}

interface NutritionEngineOutput {
  plan: NutritionPoint[];               // Placed products with timing
  metrics: {
    totalCarbs: number;
    carbsPerHour: number;
    totalSodium: number;
    sodiumPerHour: number;
    totalCaffeine: number;
    totalCalories: number;
    estimatedCost: number;
    hydrationLitersNeeded: number;
  };
  warnings: PlanWarning[];              // "Gap of 45min without fueling at km 52"
  recommendations: string[];            // "Consider adding caffeine after km 60"
  confidence: number;                   // 0-1 confidence in plan quality
}
```

### 4.2 Carbohydrate Target Model

Based on current sports nutrition research:

```typescript
function calculateCarbTarget(
  durationHours: number,
  intensity: number,       // % FTP
  gutTolerance: string,
  isCompetition: boolean
): { min: number; max: number; target: number } {

  // Base targets from Jeukendrup (2014) and Stellingwerff (2024)
  const baseCarbsPerHour =
    durationHours < 1   ? { min: 0,  max: 30, target: 20 } :
    durationHours < 2   ? { min: 30, max: 60, target: 45 } :
    durationHours < 2.5 ? { min: 60, max: 80, target: 70 } :
                          { min: 80, max: 120, target: 90 };

  // Adjust for intensity
  const intensityMultiplier = 0.5 + (intensity * 0.5); // 0.5x at Z1, 1.0x at FTP

  // Adjust for gut tolerance
  const gutMultiplier =
    gutTolerance === 'beginner' ? 0.7 :
    gutTolerance === 'trained'  ? 1.0 :
                                  1.2; // Elite can handle 120g+/hr

  // Competition bump
  const compMultiplier = isCompetition ? 1.1 : 1.0;

  return {
    min:    Math.round(baseCarbsPerHour.min * intensityMultiplier * gutMultiplier * compMultiplier),
    max:    Math.round(baseCarbsPerHour.max * intensityMultiplier * gutMultiplier * compMultiplier),
    target: Math.round(baseCarbsPerHour.target * intensityMultiplier * gutMultiplier * compMultiplier),
  };
}
```

### 4.3 Segment-Aware Placement

```typescript
interface RouteSegment {
  startKm: number;
  endKm: number;
  type: 'climb' | 'descent' | 'flat' | 'rolling';
  avgGradient: number;
  estimatedPower: number;      // Watts
  estimatedDuration: number;   // Minutes
  difficulty: number;          // 1-10
}

// Smart placement rules:
// 1. Front-load fueling: more fuel in first 60% of route
// 2. Fuel BEFORE climbs: place gel 5-10min before major climbs
// 3. Liquid on descents: easier to drink when not climbing
// 4. Caffeine late: save caffeine for final 30-40% of race
// 5. Solid food early: bars/chews in first half when intensity is lower
// 6. Don't cluster: minimum 15min between nutrition points
// 7. Respect aid stations: align with known aid station locations if applicable
```

---

## 5. Export System Architecture

### 5.1 GPX Export with Nutrition Waypoints

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RACEFUEL">
  <metadata>
    <name>Race Nutrition Plan - Cape Town Loop</name>
    <desc>Auto-generated nutrition plan: 85.4km, 8 nutrition points, 72g CHO/hr</desc>
  </metadata>

  <!-- Route track -->
  <trk>
    <name>Cape Town Loop</name>
    <trkseg>
      <trkpt lat="-33.9249" lon="18.4241"><ele>100</ele></trkpt>
      <!-- ... -->
    </trkseg>
  </trk>

  <!-- Nutrition waypoints -->
  <wpt lat="-33.8821" lon="18.4923">
    <ele>280</ele>
    <name>GEL @ 15.0km</name>
    <desc>GU Energy Gel (22g carbs, 100cal) - R36.99</desc>
    <sym>Food</sym>
    <type>nutrition</type>
    <extensions>
      <racefuel:nutrition>
        <racefuel:product>GU Energy Gel</racefuel:product>
        <racefuel:carbs>22</racefuel:carbs>
        <racefuel:distance>15.0</racefuel:distance>
      </racefuel:nutrition>
    </extensions>
  </wpt>
</gpx>
```

### 5.2 FIT Course File Export

FIT (Flexible and Interoperable Data Transfer) is the standard for Garmin/Wahoo devices:

```typescript
// Using fit-file-writer or custom FIT encoder
interface FitCourseExport {
  courseName: string;
  sport: 'cycling' | 'running';
  trackpoints: FitTrackPoint[];
  coursePoints: FitCoursePoint[];    // These appear as alerts on device!
}

interface FitCoursePoint {
  timestamp: number;
  positionLat: number;              // Semicircles
  positionLong: number;
  distance: number;                 // Meters from start
  type: 'food' | 'water' | 'danger' | 'left' | 'right' | 'generic';
  name: string;                     // "GEL 22g" — shows on device screen
}
```

### 5.3 PDF Race Day Sheet

Professional race-day reference document:

```
┌─────────────────────────────────────────────────┐
│  RACEFUEL — Race Day Nutrition Sheet             │
│  Cape Town Loop | 85.4km | Est. 3:15            │
├─────────────────────────────────────────────────┤
│                                                   │
│  [Elevation Profile with nutrition markers]       │
│                                                   │
├─────────────────────────────────────────────────┤
│  TIMELINE                                         │
│  ─────────────────────────────                   │
│  📍 15.0km (0:36) — GU Energy Gel               │
│     22g carbs | 100 cal | 20mg caffeine          │
│  📍 30.0km (1:12) — SIS Beta Fuel Drink         │
│     80g carbs | 320 cal | 500mg sodium           │
│  ...                                              │
├─────────────────────────────────────────────────┤
│  PACKING CHECKLIST                                │
│  □ 3x GU Energy Gel                     R110.97  │
│  □ 2x SIS Beta Fuel Drink               R130.00  │
│  □ 1x Maurten Gel 160                   R105.00  │
│  ──────────────────────────────                   │
│  Total: 6 items                         R345.97  │
├─────────────────────────────────────────────────┤
│  TARGETS                                          │
│  Carbs: 72g/hr | Sodium: 850mg/hr | Fluid: 750ml/hr │
│  Total: 234g carbs | 2,765mg sodium | 2.4L fluid │
└─────────────────────────────────────────────────┘
```

### 5.4 Map Image Export (PNG/TIFF)

Use Mapbox Static Images API or `map.getCanvas().toDataURL()` for:
- High-res route map with nutrition markers
- Elevation profile chart
- Combined composite image for social sharing

---

## 6. Performance Architecture

### 6.1 Web Workers

Offload heavy computation to avoid UI jank:

```typescript
// Route analysis worker
const routeWorker = new Worker(
  new URL('../workers/routeAnalyzer.worker.ts', import.meta.url),
  { type: 'module' }
);

// Usage
routeWorker.postMessage({ type: 'ANALYZE_ROUTE', gpsPath });
routeWorker.onmessage = (e) => {
  const { segments, difficulty, estimatedPower } = e.data;
  setRouteAnalysis({ segments, difficulty, estimatedPower });
};
```

### 6.2 Spatial Indexing

Replace O(n) nearest-point search with spatial index:

```typescript
// Use rbush or a simple grid-based spatial index
import RBush from 'rbush';

const tree = new RBush();
tree.load(gpsPath.map((p, i) => ({
  minX: p.lng, minY: p.lat,
  maxX: p.lng, maxY: p.lat,
  index: i,
})));

// O(log n) nearest-point query
const nearest = tree.search({
  minX: clickLng - 0.001, minY: clickLat - 0.001,
  maxX: clickLng + 0.001, maxY: clickLat + 0.001,
});
```

### 6.3 Lazy Loading & Code Splitting

```typescript
// Route-based code splitting
const StravaActivityBrowser = lazy(() => import('./features/integrations/strava/components/StravaActivityBrowser'));
const GarminConnect = lazy(() => import('./features/integrations/garmin/components/GarminConnect'));
const ExportModal = lazy(() => import('./features/export/components/ExportModal'));
const PlanComparison = lazy(() => import('./features/nutrition/components/PlanComparison'));
```

### 6.4 Elevation Profile (SVG Rewrite)

Replace CSS bar chart with interactive SVG:

```typescript
// D3-powered or custom SVG elevation profile
// Benefits: precise hover, gradient fills, smooth curves, click-to-place accuracy
<svg viewBox="0 0 1000 200">
  <defs>
    <linearGradient id="elevGradient">
      <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3" />
      <stop offset="100%" stopColor="#ff6b00" stopOpacity="0.3" />
    </linearGradient>
  </defs>
  <path d={elevationPath} fill="url(#elevGradient)" stroke="#fff" strokeWidth="1.5" />
  {nutritionPoints.map(point => (
    <NutritionMarkerSVG key={point.id} point={point} />
  ))}
</svg>
```

---

## 7. Responsive Design Strategy

```
Desktop (≥1280px):   [Sidebar 280px] [Map + Elevation] [NutritionPanel 320px]
Tablet  (768-1279):  [Collapsible Sidebar] [Map + Elevation] [Bottom Sheet Nutrition]
Mobile  (< 768px):   [Full Map] [Bottom Sheet: Elevation + Nutrition] [FAB Menu]
```

Key patterns:
- Sidebar collapses to icon rail on tablet
- Nutrition panel becomes a draggable bottom sheet on mobile
- Elevation profile becomes horizontally scrollable on mobile
- Touch-friendly product placement (tap instead of drag)

---

## 8. Testing Strategy

```
├── __tests__/
│   ├── unit/
│   │   ├── engine/carbCalculator.test.ts
│   │   ├── engine/hydrationCalculator.test.ts
│   │   ├── services/gpxParser.test.ts
│   │   ├── services/fitParser.test.ts
│   │   ├── utils/geo.test.ts
│   │   └── utils/units.test.ts
│   │
│   ├── integration/
│   │   ├── routeLoading.test.tsx
│   │   ├── nutritionPlacement.test.tsx
│   │   └── export.test.ts
│   │
│   └── e2e/
│       ├── onboarding.spec.ts
│       ├── gpxUpload.spec.ts
│       ├── autoGenerate.spec.ts
│       └── exportPlan.spec.ts
│
├── __fixtures__/
│   ├── routes/
│   │   ├── simple-loop.gpx
│   │   ├── mountain-stage.gpx
│   │   ├── flat-time-trial.fit
│   │   └── strava-response.json
│   └── plans/
│       ├── basic-plan.json
│       └── optimized-plan.json
```

**Testing tools:** Vitest (unit), React Testing Library (components), Playwright (E2E)
