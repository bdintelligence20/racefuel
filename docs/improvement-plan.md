# RACEFUEL — Full Improvement Plan

## Implementation Roadmap

This plan is organized into 6 phases, from critical fixes to ambitious features. Each phase builds on the previous one. Estimated timelines assume a solo developer working part-time.

---

## Phase 1: Foundation & Critical Fixes (Week 1-2)

**Goal:** Fix broken features, add persistence, secure the OAuth flow.

### 1.1 Backend Proxy for OAuth Secrets

**Priority: CRITICAL (security)**

The Strava client secret is currently exposed in the browser bundle. This is the #1 issue to fix.

**Implementation: Flask Proxy (leveraging your existing Flask expertise)**

```python
# /api/strava/token — Token exchange endpoint
# /api/strava/refresh — Token refresh endpoint
# /api/garmin/token — Future Garmin support
# /api/garmin/refresh — Future Garmin refresh
```

**Deliverables:**
- [ ] Flask microservice with 3 endpoints (token exchange, refresh, revoke)
- [ ] Deploy to GCP Cloud Run (you already have the Docker + GCP setup)
- [ ] Move `STRAVA_CLIENT_SECRET` to server-side environment variable
- [ ] Update `stravaAuth.ts` to call proxy instead of Strava directly
- [ ] Add CORS configuration for your domain(s)
- [ ] Add rate limiting (prevent abuse)

### 1.2 Fix Export Plan Button

**Priority: HIGH (currently broken/stub)**

The "Export Plan" button in ActionBar.tsx does nothing. Implement basic GPX export first.

**Deliverables:**
- [ ] Create `src/features/export/services/gpxExporter.ts`
- [ ] Generate GPX with `<wpt>` elements for each nutrition point
- [ ] Include route track data (`<trk>`) if from GPX source
- [ ] Download as `.gpx` file via Blob URL
- [ ] Wire up the Export Plan button to show format options
- [ ] Add success toast notification

**GPX export format:**
```xml
<wpt lat="..." lon="...">
  <name>GEL @ 15.0km — GU Energy Gel</name>
  <desc>22g carbs | 100 cal | R36.99</desc>
  <sym>Food</sym>
  <type>nutrition</type>
</wpt>
```

### 1.3 Plan Persistence (IndexedDB)

**Priority: HIGH (plans lost on refresh)**

**Deliverables:**
- [ ] Install and configure Dexie.js
- [ ] Create database schema for plans, routes, preferences
- [ ] Auto-save nutrition plan on every change (debounced 500ms)
- [ ] Auto-restore last plan on page load
- [ ] Add "Save Plan" and "Load Plan" functionality
- [ ] Add plan naming and management
- [ ] Show "unsaved changes" indicator

### 1.4 Fix `autoGeneratePlan()` Product References

**Priority: MEDIUM (uses hardcoded products that don't match catalog)**

Currently `autoGeneratePlan()` creates inline product objects that lack `id`, `priceZAR`, `image`, and `category`. Fix to reference actual products from the catalog.

**Deliverables:**
- [ ] Import products from `data/products.ts` in the auto-generate function
- [ ] Select appropriate products from the actual catalog
- [ ] Vary product selection based on distance into route
- [ ] Ensure all generated nutrition points have complete product data

### 1.5 Move `@types/mapbox-gl` to devDependencies

**Priority: LOW (correctness)**

- [ ] Move from `dependencies` to `devDependencies` in `package.json`

### 1.6 Extract GPX Parser from AppContext

**Priority: MEDIUM (code quality)**

- [ ] Create `src/features/route/services/gpxParser.ts`
- [ ] Move GPX parsing logic out of AppContext
- [ ] Add proper error types and error messages
- [ ] Add support for multi-segment tracks (`<trkseg>`)
- [ ] Handle GPX files with metadata but no track points gracefully

---

## Phase 2: Garmin Connect Integration (Week 3-4)

**Goal:** Add Garmin as a data source and export target, matching and exceeding the Strava integration.

### 2.1 Garmin OAuth 1.0a Server-Side Auth

Garmin uses OAuth 1.0a (requires server-side request signing).

**Deliverables:**
- [ ] Add Garmin OAuth endpoints to Flask proxy
- [ ] Register RACEFUEL as a Garmin Connect app
- [ ] Implement 3-legged OAuth 1.0a flow
- [ ] Store Garmin tokens server-side (more secure than client-side)
- [ ] Create `src/features/integrations/garmin/` module structure

### 2.2 Garmin Activity Import

**Deliverables:**
- [ ] Fetch activity list from Garmin Connect API
- [ ] Filter by activity type (cycling, running, etc.)
- [ ] Fetch detailed activity data including GPS tracks
- [ ] Transform Garmin activity → RouteData (similar to Strava transform)
- [ ] Create `GarminActivityBrowser` component (mirror StravaActivityList)
- [ ] Handle Garmin's rate limits (Garmin is more restrictive than Strava)

### 2.3 Garmin Course Export (Unique Selling Point!)

**This is a killer feature** — export nutrition plans as Garmin course files with course points that trigger alerts on the device during a ride.

**Deliverables:**
- [ ] Research FIT SDK / `fit-file-writer` npm package
- [ ] Create `fitExporter.ts` service
- [ ] Convert route GPS data to FIT trackpoints (semicircle coordinates)
- [ ] Convert nutrition points to FIT course points with type `food` / `water`
- [ ] Course point names appear on device: "GEL 22g @ 15km"
- [ ] Test with Garmin Edge simulator
- [ ] Add FIT export option to Export modal

### 2.4 Unified Integration Hub

**Deliverables:**
- [ ] Create shared `PlatformIntegration` interface
- [ ] Refactor Strava to implement this interface
- [ ] Implement Garmin as second implementation
- [ ] Create unified "Connections" panel in Sidebar
- [ ] Show capabilities per platform (import routes, export courses, sync profile)
- [ ] Indicate which platforms support course point export

### 2.5 Garmin Profile Sync

**Deliverables:**
- [ ] Sync weight from Garmin body composition data
- [ ] Sync VO2 Max for better calorie estimates
- [ ] Sync training load for fatigue-adjusted recommendations
- [ ] Display synced data in athlete profile

---

## Phase 3: Smart Nutrition Engine (Week 5-7)

**Goal:** Replace the trivial "every 15km" algorithm with an evidence-based nutrition engine.

### 3.1 Route Segment Analysis

**Deliverables:**
- [ ] Create `routeAnalyzer.ts` service
- [ ] Classify route into segments: climb, descent, flat, rolling
- [ ] Calculate gradient for each segment
- [ ] Estimate power output per segment (using FTP + gradient + weight)
- [ ] Estimate time per segment (from power model or average speed)
- [ ] Calculate difficulty score per segment (1-10)
- [ ] Run analysis in Web Worker to avoid blocking UI
- [ ] Visualize segments on elevation profile (color coding)

### 3.2 Carbohydrate Target Calculator

Based on Jeukendrup (2014), Stellingwerff (2024), and Asker Jeukendrup's "Fuel for the Work" framework.

**Deliverables:**
- [ ] Create `carbCalculator.ts` with evidence-based targets
- [ ] Factor in: duration, intensity, gut tolerance, competition flag
- [ ] Output min/max/target carbs per hour
- [ ] Support progressive targets (start lower, ramp up)
- [ ] Display targets in NutritionPanel with traffic-light indicators
- [ ] Add "Nutrition Science" info popover explaining the targets

### 3.3 Hydration Calculator

**Deliverables:**
- [ ] Create `hydrationCalculator.ts`
- [ ] Model sweat rate from: body weight, temperature, humidity, intensity
- [ ] Calculate sodium loss per hour
- [ ] Recommend fluid intake per hour
- [ ] Factor in drink mix sodium content
- [ ] Warn when hydration plan is insufficient
- [ ] Add temperature/humidity input (manual or weather API integration)

### 3.4 Caffeine Timing Strategy

**Deliverables:**
- [ ] Create `caffeineStrategy.ts`
- [ ] Model caffeine absorption kinetics (peak at 45-60 min)
- [ ] Recommend caffeine timing for optimal late-race performance
- [ ] Cap daily caffeine based on body weight (3-6 mg/kg)
- [ ] Avoid caffeine in first 30-40% unless very long event
- [ ] Mark caffeinated products clearly in the timeline

### 3.5 Intelligent Plan Generator

**Deliverables:**
- [ ] Create `planGenerator.ts` orchestrator
- [ ] Input: route analysis + athlete profile + race parameters + preferences
- [ ] Algorithm:
  1. Calculate hourly targets (carbs, fluid, sodium)
  2. Score route segments for difficulty
  3. Place nutrition points with smart timing rules:
     - Fuel before climbs (5-10 min pre-climb)
     - Liquids on descents or flats
     - Solid food in first half only
     - Caffeine in final 30-40%
     - Minimum 12-15 min between points
     - Front-load fueling (more in first 60%)
  4. Select products matching targets from preferred catalog
  5. Respect budget constraint if set
  6. Validate plan and generate warnings
- [ ] Output plan with confidence score
- [ ] Generate comparison: "Your plan vs Recommended"

### 3.6 Plan Validation & Warnings

**Deliverables:**
- [ ] Create `planValidator.ts`
- [ ] Check for nutrition gaps (>30 min without fuel)
- [ ] Check for clustering (too many products in short window)
- [ ] Validate carbs/hr against targets (under/over)
- [ ] Check caffeine limits
- [ ] Validate sodium intake
- [ ] Check hydration adequacy
- [ ] Display warnings inline on elevation profile and in panel
- [ ] Color-code warnings: info (blue), warning (yellow), critical (red)

---

## Phase 4: Export System & Race Day Tools (Week 8-9)

**Goal:** Make plans actionable — export to every format athletes need.

### 4.1 Export Modal & Format Selection

**Deliverables:**
- [ ] Create `ExportModal.tsx` with format cards
- [ ] Supported formats:
  - GPX with waypoints (already started in Phase 1)
  - FIT course file (for Garmin devices)
  - PDF race day sheet
  - CSV nutrition data
  - PNG map image
  - ICS calendar event
- [ ] Show preview of each format before download
- [ ] Remember last-used format preference

### 4.2 PDF Race Day Sheet

**Deliverables:**
- [ ] Create `pdfExporter.ts` using jsPDF or pdf-lib
- [ ] Content sections:
  - Header: route name, distance, estimated time, date
  - Elevation profile with nutrition markers (render SVG to canvas)
  - Nutrition timeline (distance, time, product, macros)
  - Packing checklist with quantities and prices
  - Nutrition targets summary (carbs/hr, sodium/hr, fluid/hr)
  - Emergency info section (blank for athlete to fill in)
- [ ] Print-optimized layout (A4 or Letter)
- [ ] Option to include/exclude pricing
- [ ] Option to include/exclude detailed macros

### 4.3 FIT Course File Export (Enhanced)

**Deliverables:**
- [ ] Binary FIT encoding (using fit-file-writer or custom encoder)
- [ ] Include all route trackpoints with timestamps
- [ ] Course points with nutrition info in name field
- [ ] Support for food, water, and generic course point types
- [ ] Test on real Garmin devices (Edge 530/830/1040)
- [ ] Add Wahoo ELEMNT compatibility notes

### 4.4 Map Image Export

**Deliverables:**
- [ ] Use `map.getCanvas().toDataURL()` for Mapbox screenshot
- [ ] Overlay nutrition markers on captured image
- [ ] Add route stats text overlay
- [ ] Export as PNG (high-res) or TIFF
- [ ] Option for social media dimensions (1:1, 16:9, 9:16)

### 4.5 CSV Nutrition Data Export

**Deliverables:**
- [ ] Export nutrition plan as spreadsheet-friendly CSV
- [ ] Columns: distance, time, product, brand, carbs, sodium, caffeine, calories, price
- [ ] Include summary row with totals
- [ ] Useful for coaches and sports dietitians

### 4.6 Race Day Checklist Component

**Deliverables:**
- [ ] New component showing packing list
- [ ] Grouped by product with quantities
- [ ] Checkboxes (persisted in localStorage)
- [ ] Total weight estimate
- [ ] Where to place each product (jersey pocket, bento box, etc.)
- [ ] Print-friendly view

---

## Phase 5: UX & Polish (Week 10-12)

**Goal:** Transform from prototype to polished product.

### 5.1 Interactive SVG Elevation Profile

Replace CSS bar chart with full interactive SVG:

**Deliverables:**
- [ ] Rewrite elevation chart as SVG with smooth bezier curves
- [ ] Add crosshair on hover showing distance + elevation
- [ ] Click to place nutrition point at exact position
- [ ] Color segments by gradient (green=flat, yellow=moderate, red=steep)
- [ ] Show nutrition markers as proper positioned pins
- [ ] Drag markers to reposition along route
- [ ] Zoom into sections (click+drag selection)
- [ ] Show current carbs/hr between nutrition points
- [ ] Time axis option (toggle distance ↔ time)

### 5.2 Undo/Redo System

**Deliverables:**
- [ ] Implement `useUndoRedo` hook
- [ ] Track nutrition point add/remove/move actions
- [ ] Track auto-generate as single undoable action
- [ ] Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
- [ ] Visual indicator showing undo/redo availability
- [ ] Limit history to 50 actions

### 5.3 Drag-to-Reposition Nutrition Points

**Deliverables:**
- [ ] Make nutrition markers draggable on elevation profile
- [ ] Make nutrition markers draggable on map
- [ ] Snap to nearest point on route
- [ ] Show distance label during drag
- [ ] Animate marker movement
- [ ] Register as undoable action

### 5.4 Responsive Layout

**Deliverables:**
- [ ] Add media query breakpoints (mobile/tablet/desktop)
- [ ] Collapsible sidebar with icon-only mode
- [ ] Bottom sheet for nutrition panel on mobile
- [ ] Horizontally scrollable elevation profile on mobile
- [ ] Touch-friendly interaction (long-press to place, tap to view)
- [ ] Safe area handling for mobile notches

### 5.5 Strava Activity Browser Enhancement

**Deliverables:**
- [ ] Add infinite scroll / pagination
- [ ] Add date range filter
- [ ] Add distance/elevation filters
- [ ] Add activity search by name
- [ ] Show activity map preview (polyline thumbnail)
- [ ] Show activity stats in richer format
- [ ] Cache activity list in IndexedDB
- [ ] Add "starred/favorite" routes for quick access
- [ ] Sort by: date, distance, elevation, name

### 5.6 Product Catalog Improvements

**Deliverables:**
- [ ] Add "Custom Product" entry form
- [ ] Add product favorites/pinning
- [ ] Show recently used products first
- [ ] Add product comparison view
- [ ] Add product efficiency sorting (g carbs per ZAR)
- [ ] Add product availability/stock links (Takealot, Dis-Chem)
- [ ] Add missing brands: Clif, Hammer, Tailwind, Spring, PowerBar, Precision Fuel & Hydration
- [ ] Add Zod schema validation for product data
- [ ] Support product image fallbacks gracefully
- [ ] Add "homemade" category (Coke flat, gummy bears, rice cakes)

### 5.7 Design System & Component Library

**Deliverables:**
- [ ] Extract common components to `shared/components/ui/`
- [ ] Create consistent Button, Modal, Input, Select primitives
- [ ] Document design tokens (colors, spacing, typography)
- [ ] Add consistent animation patterns
- [ ] Add keyboard navigation support
- [ ] Add ARIA labels for accessibility
- [ ] Create component storybook or documentation page

### 5.8 Notifications & Toasts

**Deliverables:**
- [ ] Add toast notification system
- [ ] Success: "Plan saved", "Route imported", "Export complete"
- [ ] Warning: "Nutrition gap detected", "Budget exceeded"
- [ ] Error: "Failed to import route", "Strava connection lost"
- [ ] Auto-dismiss with progress bar

---

## Phase 6: Advanced Features & Growth (Week 13+)

**Goal:** Differentiate RACEFUEL from any competition.

### 6.1 Plan Comparison View

**Deliverables:**
- [ ] Side-by-side comparison of two nutrition plans
- [ ] Overlay nutrition timelines on same elevation profile
- [ ] Compare metrics: carbs/hr, cost, sodium, caffeine
- [ ] Highlight differences
- [ ] Use case: "My plan" vs "Auto-generated optimal plan"

### 6.2 Weather Integration

**Deliverables:**
- [ ] Integrate weather API (OpenWeather or WeatherAPI)
- [ ] Get forecast for route location + race date
- [ ] Auto-adjust hydration recommendations based on temperature
- [ ] Auto-adjust sodium recommendations based on humidity
- [ ] Show weather overlay on route map
- [ ] Display weather conditions in export documents

### 6.3 AI-Powered Plan Optimization

**Deliverables:**
- [ ] Use Claude API to analyze plan and suggest improvements
- [ ] Natural language plan explanation: "Your plan provides 68g/hr of carbs, which is below the recommended 80-90g/hr for a 3+ hour event at your intensity..."
- [ ] Answer athlete questions: "Should I add caffeine for this race?"
- [ ] Generate race-specific advice based on route and conditions

### 6.4 Route Drawing / Manual Route Creation

**Deliverables:**
- [ ] Draw routes on map with click-to-place points
- [ ] Snap to roads (Mapbox Directions API)
- [ ] Out-and-back route generator
- [ ] Loop route generator
- [ ] Elevation auto-population from Mapbox terrain data
- [ ] Save drawn routes to library

### 6.5 Multi-Day / Stage Race Support

**Deliverables:**
- [ ] Support multi-stage events (e.g., Cape Epic, Tour de France)
- [ ] Per-stage nutrition plans
- [ ] Recovery nutrition between stages
- [ ] Cumulative carb/calorie tracking across stages
- [ ] Stage overview dashboard

### 6.6 Social / Sharing Features

**Deliverables:**
- [ ] Generate shareable plan links (read-only)
- [ ] Share to coach/nutritionist for review
- [ ] Community plan templates for popular routes
- [ ] "Used by X athletes" social proof
- [ ] Export to social media (Instagram story template)

### 6.7 FIT File Import (Activity Analysis)

**Deliverables:**
- [ ] Parse FIT binary format (using fit-file-parser npm package)
- [ ] Extract GPS, altitude, power, heart rate, temperature data
- [ ] Support Garmin, Wahoo, Hammerhead device files
- [ ] Use power data for more accurate calorie estimates
- [ ] Show actual vs planned nutrition (post-race analysis)

### 6.8 TCX File Support

**Deliverables:**
- [ ] Parse TCX XML format
- [ ] Extract GPS, altitude, heart rate data
- [ ] Primarily for older Garmin files and some training platforms

### 6.9 PWA / Offline Support

**Deliverables:**
- [ ] Add service worker for offline caching
- [ ] Cache map tiles for viewed routes
- [ ] Full offline plan creation and editing
- [ ] Sync plans when back online
- [ ] Add to home screen prompt
- [ ] Background sync for Strava/Garmin data

### 6.10 Monetization Foundation (Micro-SaaS)

If pursuing as a business:

**Deliverables:**
- [ ] Free tier: 1 saved plan, basic auto-generate, GPX export
- [ ] Pro tier (R99/month): unlimited plans, all exports, Garmin course export, AI optimization, weather integration
- [ ] Stripe/PayFast payment integration
- [ ] Usage analytics (anonymous, privacy-first)
- [ ] Landing page with feature comparison
- [ ] Product demo video

---

## Technical Debt Backlog

These items should be addressed continuously throughout all phases:

| Item | Priority | Phase |
|------|----------|-------|
| Add Vitest for unit testing | High | 1 |
| Add React Error Boundaries | High | 1 |
| Fix Mapbox marker memory management | Medium | 1 |
| Replace Math.random IDs with nanoid | Low | 1 |
| Add ESLint strict rules + Prettier | Medium | 2 |
| Add Husky pre-commit hooks | Low | 2 |
| Set up CI/CD pipeline (GitHub Actions) | Medium | 3 |
| Add Sentry error tracking | Medium | 3 |
| Add bundle size monitoring | Low | 4 |
| Add Lighthouse CI checks | Low | 5 |
| Security audit of dependencies | Medium | 3 |
| Add Content Security Policy headers | Medium | 2 |
| Add rate limiting on proxy API | High | 1 |
| TypeScript strict mode (no `any`) | Medium | 2 |
| Add JSDoc documentation | Low | 5 |

---

## New Dependencies to Add

| Package | Purpose | Phase |
|---------|---------|-------|
| `dexie` | IndexedDB wrapper for persistence | 1 |
| `nanoid` | Collision-safe ID generation | 1 |
| `zod` | Runtime type validation for products/plans | 2 |
| `rbush` | Spatial indexing for route point queries | 3 |
| `jspdf` + `jspdf-autotable` | PDF export | 4 |
| `fit-file-writer` | FIT course file export | 2 |
| `fit-file-parser` | FIT activity import | 6 |
| `date-fns` | Date formatting/manipulation | 2 |
| `react-hot-toast` or `sonner` | Toast notifications | 5 |
| `immer` | Immutable state updates | 3 |
| `@tanstack/react-query` | Server state management | 2 |

---

## Success Metrics

### Phase 1 (Foundation)
- [ ] Plans survive page refresh
- [ ] Export produces valid GPX file
- [ ] OAuth secrets no longer in client bundle
- [ ] Auto-generate uses real products

### Phase 3 (Nutrition Engine)
- [ ] Auto-generated plans match registered dietitian recommendations within 15%
- [ ] Plan validator catches all common nutrition planning mistakes
- [ ] Carbs/hr targets align with published sports science guidelines

### Phase 4 (Export)
- [ ] FIT files load correctly on Garmin Edge devices
- [ ] PDF is print-ready and information-complete
- [ ] GPX waypoints appear in all major mapping apps

### Phase 5 (UX)
- [ ] Usable on mobile devices (320px+)
- [ ] Undo/redo works for all nutrition actions
- [ ] Elevation profile interaction is precise and satisfying
- [ ] First-time user can create a plan in under 3 minutes

### Business Metrics (if commercialized)
- [ ] 100 active users within 3 months of launch
- [ ] 10% free→paid conversion rate
- [ ] <5% monthly churn on paid tier
- [ ] NPS score >50

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Garmin API access denied | High | Apply early, have FIT file import as fallback |
| Strava API rate limits (100/15min, 1000/day) | Medium | Cache aggressively, queue requests |
| Mapbox pricing at scale | Medium | Cache tiles, consider MapLibre for self-hosting |
| Product image URLs breaking | Low | Download and self-host product images |
| FIT file format complexity | Medium | Use existing npm packages, test with real devices |
| Nutrition science liability | Medium | Add disclaimers, cite sources, never replace professional advice |
| Solo developer burnout | High | Prioritize ruthlessly, ship MVPs, get feedback early |
