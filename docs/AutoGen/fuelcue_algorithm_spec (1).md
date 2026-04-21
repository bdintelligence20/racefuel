# Fuelcue Algorithm — Evidence-Backed Spec

Pragmatic version. Formulas first, citations at the end of each section. Built to be spec'd into code.

---

## 0. The five outputs Fuelcue needs to produce

For any user + route + expected time + weather, the plan should output:

1. **Total carbohydrate per hour** (g/h)
2. **Carbohydrate type / ratio** (single-source vs glucose:fructose 2:1 or 1:0.8)
3. **Fluid per hour** (ml/h), with an upper safety bound
4. **Sodium per hour** (mg/h)
5. **Caffeine** (optional, event-dependent)

Everything else (total grams per session, products to use, pacing of intake) is derived from these five.

---

## 1. Input-to-output relationships — the structural view

The biggest algorithmic trap in endurance nutrition is scaling the wrong things by bodyweight. Here's the actual evidence-supported relationship for each input:

| Input | Drives carbs? | Drives fluid? | Drives sodium? | Notes |
|---|---|---|---|---|
| Weight | **No** | Weak | Weak | Carb recs are absolute g/h because absorption is the bottleneck, not muscle mass (Jeukendrup 2014). Weight affects sweat rate secondarily via heat production, but the primary driver is intensity + heat. |
| Height | No | No | No | Not a direct input. Only useful as part of body-surface-area heat models — and you don't need it. |
| Sex | No | Weak | Weak | Baker 2022 found sex is not a significant independent predictor of sweat [Na+] once other factors are controlled. Women have slightly lower sweat rates on average but huge overlap. |
| Age | No | Weak | No | Not a significant independent predictor in Baker 2022. Use only if the user is a youth athlete (separate track). |
| Sweat rate (self-reported or measured) | No | **Yes — primary** | **Yes — primary** | The single most important individual input after intensity. |
| Sweat [Na+] (self-reported or measured) | No | No | **Yes — primary** | Vastly individual. Moderate priors by sport/demographic if unknown. |
| Distance | Indirectly via duration | Indirectly via duration | Indirectly via duration | Only matters via `expected_duration = distance / pace`. |
| Elevation gain | Yes — via intensity | Yes — via sweat rate | Yes — via sweat rate | Scales average power output. |
| Expected time / pace | **Yes — primary** (determines duration tier) | Yes — via sweat rate | Yes — via sweat rate | Intensity is the master knob. |
| Air temperature | No | **Yes — strong** | **Yes — strong** | Primary environmental driver. |
| Humidity | Weak | Yes | Weak | Matters for cooling efficiency, not [Na+] itself (Baker 2022). |
| Heat acclimatisation | Small | Weak | **Yes — strong** | Acclimatised athletes have lower sweat [Na+]. |
| Training history / gut-trained? | **Yes — as a cap** | Yes — as a cap | Small | You shouldn't prescribe 90 g/h to someone whose gut hasn't seen it. |

**The key insight the current autogenerate probably gets wrong:** carb prescription should not scale with bodyweight. Intestinal absorption is the limit, and it's roughly independent of body mass (Jeukendrup 2014).

---

## 2. Carbohydrate engine

### 2.1 Tier by duration

| Duration | Carb (g/h) | Type | Evidence |
|---|---|---|---|
| < 30 min | 0 (or mouth rinse) | — | No metabolic benefit from ingestion this short. |
| 30–75 min, high intensity | Small amounts, or mouth rinse | Any | Central/neurological benefit only. Use ~20-30 g/h or mouth rinse. |
| 1–2 h | 30-60 | Any single source is fine | SGLT1 saturates around 60 g/h. |
| 2–3 h | 60-90 | **Multi-transportable (glucose:fructose 2:1)** | Above 60 g/h, second transporter (GLUT5) needed. |
| > 3 h (ultra) | 60-90+ | **Multi-transportable, glucose:fructose closer to 1:0.8** | Elite athletes now pushing 100-120 g/h; requires gut training. |

### 2.2 Intensity modifier

Carb demand scales with intensity because substrate oxidation shifts toward CHO at higher %VO2max. Lower absolute intensity → lower absolute carb need.

Rule of thumb (map to your pace/elevation intensity model):

- **Easy / Z2 (< 65% VO2max)**: use lower end of tier (e.g., 30-45 g/h for 2 h event)
- **Moderate / Tempo (65-80%)**: middle of tier
- **Hard / threshold+ (> 80%)**: upper end of tier

### 2.3 Gut-tolerance cap

This is the guardrail the current autogenerate probably lacks. Don't prescribe above what the athlete has trained:

```
effective_carb_target = MIN(tier_recommendation × intensity_modifier, user.gut_training_ceiling)
```

Where `user.gut_training_ceiling` is either self-reported ("max I've tolerated is X g/h") or conservatively defaulted to 60 g/h for new users, with a flag to gradually increase via gut training.

### 2.4 Starting formula — pseudocode

```
function calculate_carbs(duration_h, intensity, gut_ceiling):
    if duration_h < 0.5: return 0
    if duration_h < 1.25: return 25  # or recommend mouth rinse
    if duration_h < 2:    base = map_intensity(30, 60, intensity)
    elif duration_h < 3:  base = map_intensity(60, 90, intensity)
    else:                 base = map_intensity(70, 100, intensity)
    return min(base, gut_ceiling)
```

**Citations:** Jeukendrup 2014 (tiers); Burke, Hawley, Wong & Jeukendrup 2011 (IOC); Stellingwerff & Cox 2014 (systematic review); Thomas, Erdman & Burke 2016 (ACSM position).

---

## 3. Fluid engine

### 3.1 Principle

The goal is to **limit body-mass loss to < 2%** over the session. That's the canonical target from ACSM 2007.

### 3.2 Formula

```
target_fluid_per_hour = estimated_sweat_rate  ×  replacement_fraction
```

Where:

- `estimated_sweat_rate` = either user-calibrated (best) or derived from sport-specific defaults × intensity × heat modifiers
- `replacement_fraction` = 0.6 to 1.0, depending on duration and conditions

**Key numbers to anchor the model:**

| Sport / condition | Default sweat rate (L/h) |
|---|---|
| Running, moderate, 20°C | 0.8–1.2 |
| Running, hard, 30°C+ | 1.5–2.5 |
| Cycling, moderate, 20°C | 0.6–1.0 |
| Cycling, hard, 30°C+ | 1.2–2.0 |

These are population averages from the Baker / Barnes normative data. Use them as priors; let users override after calibration.

### 3.3 Upper safety bound (hyponatremia guardrail)

Never recommend more than ~800 ml/h sustained for events > 4 h without matching sodium. This is the hyponatremia guardrail — the 3rd International EAH Consensus (Hew-Butler 2015) is clear that overdrinking kills athletes in ultra events.

```
fluid_per_hour = MIN(estimated_sweat_rate × replacement_fraction, 800 ml/h for events > 4h)
```

### 3.4 Sweat rate calibration (user onboarding feature)

The single most valuable feature you could add: a one-screen sweat-rate test. Standard protocol:

```
sweat_rate_L/h = (pre_weight_kg - post_weight_kg + fluid_intake_L - urine_loss_L) / duration_h
```

Ask users to do this once in typical conditions. Huge leap in plan accuracy.

**Citations:** Sawka et al. 2007 (ACSM); McDermott et al. 2017 (NATA); Casa et al. 2000 (sweat rate formula); Hew-Butler 2015 (EAH consensus).

---

## 4. Sodium engine — the deep dive

This is where Fuelcue can actually differentiate. Most apps get sodium spectacularly wrong because they either ignore individual variability (one-size-fits-all 500 mg/L) or over-scale by sweat rate alone without factoring [Na+] variability.

### 4.1 The core formula

```
sodium_per_hour_mg = sweat_rate_L/h  ×  sweat_Na_concentration_mg/L  ×  replacement_fraction
```

That's the whole thing. Everything else is about estimating the two concentration inputs and picking the right replacement fraction.

### 4.2 Estimating sweat [Na+]

**Best case:** user has done a sweat-sodium test (Levelen, Precision Hydration, hDrop, etc.). Take their number.

**Default case:** use priors by sport and acclimatisation status. From Barnes et al. 2019 normative data, broken into three buckets:

| Sweat [Na+] bucket | Range (mmol/L) | Range (mg/L) | Population prevalence |
|---|---|---|---|
| Low | < 30 | < 690 | ~25% |
| Medium | 30–50 | 690–1,150 | ~50% |
| High | > 50 | > 1,150 | ~25% |

**Default for unknown users:** Medium bucket, 40 mmol/L ≈ 920 mg/L. This is the safest central estimate.

**Adjust if:**

- User reports heavy salt-staining on clothing, muscle cramps, or salty-taste after workouts → bump to High (50+ mmol/L ≈ 1,150+ mg/L)
- User is heat-acclimatised (regularly training in 30°C+) → bump down one bucket
- User is in first 10-14 days of seasonal heat exposure → bump up one bucket

### 4.3 Intensity effect on [Na+]

Holmes 2016 showed [Na+] rises with intensity (L=30.6 → H=49.4 mmol/L in trained endurance athletes). Practical implementation:

```
intensity_na_multiplier = 1.0  (easy)
                       = 1.2  (moderate)
                       = 1.5  (hard)
```

Apply to the user's baseline [Na+] bucket.

### 4.4 Heat adjustment

Heat affects **sweat rate**, not [Na+] directly (Baker 2022). So in the model, heat flows through the sweat_rate term, not the [Na+] term:

```
sweat_rate = baseline_sweat_rate  ×  heat_multiplier
heat_multiplier =
    1.0  if temp < 18°C
    1.2  if 18–25°C
    1.5  if 25–30°C
    1.8  if 30–35°C
    2.0+ if > 35°C
```

Humidity further amplifies (roughly +20% when RH > 70%) because evaporative cooling is impaired so sweat output rises without proportional cooling.

### 4.5 Replacement fraction

Don't replace 100%. The literature (McCubbin & Costa) supports:

| Event duration | Target replacement |
|---|---|
| < 2 h | 0% (not needed unless cramp-prone) — meals before/after cover it |
| 2–4 h | 50–70% |
| 4–6 h | 70–80% |
| > 6 h (ultra) | 80–100% |

### 4.6 Full worked example

**User:** 72 kg male cyclist, non-acclimatised, no known salt-staining. Event: 4 h ride, moderate intensity, 28°C, 60% humidity.

```
baseline_sweat_rate (cycling, moderate, 20°C) = 0.9 L/h
heat_multiplier (28°C)                         = 1.5
humidity_adjustment                            = 1.0 (below 70%)
estimated_sweat_rate                           = 0.9 × 1.5 = 1.35 L/h

baseline_Na                                    = 40 mmol/L (medium default)
intensity_multiplier (moderate)                = 1.2
effective_Na                                   = 40 × 1.2 = 48 mmol/L ≈ 1,105 mg/L

sodium_loss_per_hour                           = 1.35 × 1,105 = 1,492 mg/h
replacement_fraction (4h event)                = 0.7
sodium_target                                  = 1,492 × 0.7 = 1,044 mg/h
```

So the plan recommends ~1,000 mg sodium per hour. For reference, a standard sports drink at 500 mg/L delivers only 500 mg/h at 1 L/h fluid intake — so this user needs salt capsules or a high-sodium drink mix on top of normal fluid.

### 4.7 Guardrails

- **Floor:** 300 mg/h for any event > 2 h, regardless of model output. Below this and you're underestimating.
- **Ceiling:** 2,000 mg/h without explicit user confirmation of a sweat test showing high losses. Anything higher needs a flag.
- **Hyponatremia check:** if `fluid_per_hour / sodium_per_hour × 1000 > 1.5 L per gram`, warn the user they're risking dilutional hyponatremia on long events.

**Citations:** Baker 2017 (variability review); Barnes et al. 2019 (normative data by sport); Baker 2022 (what actually drives [Na+] in the data); Holmes et al. 2016 (intensity effect); McCubbin & Costa 2018 (replacement modelling); Casa 2015 (NATA heat illness).

---

## 5. Where the current autogenerate is probably failing

Based on how most early-stage endurance nutrition algorithms get built, here are the high-probability failure modes to audit:

1. **Scaling carbs by bodyweight.** If your code does `carbs = user.weight × X g/kg/h`, that contradicts Jeukendrup 2014. Absorption is weight-independent.
2. **Ignoring gut tolerance.** If a new 70 kg user running their first marathon gets told to take 90 g/h carbs, they'll have GI failure. Cap by training history.
3. **Treating sodium as a fixed concentration.** If your sodium output assumes everyone has 500 mg/L sweat [Na+], you're wrong for the 25% of users in the High bucket by a factor of 2-3x.
4. **Not separating heat → sweat rate from heat → [Na+].** Baker 2022 is explicit that heat drives volume, not concentration. Keep the effects on separate variables.
5. **No hyponatremia guardrail.** For events > 4 h, unlimited fluid recommendation without sodium match is a safety risk.
6. **Same intensity model for running and cycling.** Elevation gain on the bike ≠ elevation gain on foot in metabolic cost. The intensity → sweat rate mapping should have sport-specific coefficients.

---

## 6. Recommended build order

If you're going to overhaul the autogenerate, I'd sequence it like this:

1. **Fix carbs first.** Lowest-risk, highest-user-impact. Swap any bodyweight scaling for the duration × intensity tier table. Add the gut-tolerance cap.
2. **Add the sweat-rate calibration onboarding screen.** Single biggest accuracy unlock. Two bottle weighings, before/after a typical session.
3. **Rebuild sodium using the 4.1 formula with priors.** Default users to Medium bucket until they test. Add the Low/High pick-from-symptoms flow.
4. **Add the guardrails.** Hyponatremia ceiling on fluid, floor/ceiling on sodium, gut-tolerance cap on carbs.
5. **Instrument the output.** Every plan should log inputs + outputs so you can later fit real user outcome data back into the model. This is your long-term moat.

---

## 7. Source library (quick reference)

- Thomas, Erdman & Burke 2016 — ACSM position, Med Sci Sports Exerc 48(3):543-568
- Jeukendrup 2014 — Sports Med 44(S1):S25-S33
- Burke et al. 2011 — J Sports Sci 29(S1):S17-S27
- Jeukendrup 2011 — J Sports Sci 29(S1):S91-S99
- Stellingwerff & Cox 2014 — Appl Physiol Nutr Metab 39(9):998-1011
- Sawka et al. 2007 — Med Sci Sports Exerc 39(2):377-390
- McDermott et al. 2017 — J Athl Train 52(9):877-895
- Casa et al. 2000 — J Athl Train 35(2):212-224
- Baker 2017 — Sports Med 47(S1):111-128
- Barnes et al. 2019 — J Sports Sci 37(20):2356-2366
- Baker et al. 2022 — J Appl Physiol
- Holmes et al. 2016 — Ann Sports Med Res
- McCubbin & Costa 2018 — Int J Sports Sci
- Casa et al. 2015 — J Athl Train 50(9):986-1000
- Hew-Butler et al. 2015 — Clin J Sport Med (3rd Int EAH Consensus)
- Jeukendrup 2017 — Sports Med 47(S1):101-110 (Training the Gut)
- Martinez et al. 2023 — Sports Med 53(6):1175-1200
- Costa et al. 2017 — Appl Physiol Nutr Metab 42(5):547-557
- Burke et al. 2019 — IJSNEM 29(2):73-84 (IAAF consensus)
