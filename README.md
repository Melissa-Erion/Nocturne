# Handoff: Regimen — Fitness, Nutrition & Progress app

## Overview
Regimen is a standalone app for following a structured, user-built fitness plan. It auto-schedules workouts in rotation, logs sets live, recommends progressive-overload targets, plans meals to exact macro targets (with a portion solver, substitutions and meal prep), and tracks check-ins, private progress photos and trends.

**Principle:** the user chooses or builds the plan. The app organises, calculates, tracks, and recommends the next logical step. Every recommendation can be accepted, edited or ignored.

## About the design files
Everything in `prototype/` is a **design reference built in HTML**: a working prototype showing the intended look and behaviour. It is not production code to ship. Recreate it in a production stack.

**Recommended stack (no existing codebase):**
- **Expo (React Native + React Native Web)** with TypeScript, so one codebase ships to iOS, Android and web.
- **Supabase:** auth, Postgres, Row-Level Security, and private Storage for photos.
- **State:** Zustand or TanStack Query over Supabase.
- **Charts:** victory-native or react-native-svg polylines, matching the prototype.
- **Notifications:** expo-notifications (local and push).
- **Calendar:** expo-calendar, plus the `.ics` export that already exists.
- **Icons:** Phosphor (`phosphor-react-native`).
- **Font:** Inter.

`Regimen App (offline preview).html` is a single-file build of the prototype. Open it in any browser to click through everything. The data is sample data, and "today" is fixed at **2026-09-29**.

## Fidelity
**High-fidelity.** Colours, type, spacing, copy and interactions are final. Recreate them pixel-close using the tokens below.

---

## Architecture of the prototype (port this)
- `prototype/store.js` is the **single source of truth and calculation engine** (`window.RG`). Every page reads and writes through it, so all modules stay in sync. **Port its logic nearly 1:1 into a typed domain layer** (`/domain/*.ts`) and back it with Supabase tables.
- `Regimen.dc.html` is the app shell: a sidebar (desktop ≥980 px) or a top bar with a drawer (mobile), a route switch, an "active workout" resume banner and toasts.
- `Fit*.dc.html` is one file per page. Each file contains the markup (a template with `{{ }}` holes) and a `class Component` whose `renderVals()` holds the page logic.
- Metric is the internal standard everywhere. Unit conversion happens only at display and input (`RG.w`, `RG.bw`, `RG.len`, `RG.toKg`, `RG.toCm`).

### Data model (suggested Supabase tables)
| Table | Key fields |
|---|---|
| profiles | user_id, name, goal, goal_weight_kg, height_cm, age, sex, activity, experience, training_days int[] (Mon=0), rest_days, duration_min, workout_time, location, equipment text[], priorities text[], kcal, protein_g, carbs_g, fat_g, meals_per_day, diet_prefs[], allergies[], exclude[], check_in_day, check_in_freq, units, water_enabled, water_ml, increments jsonb {Barbell,Dumbbell,Cable,Machine}, progression ('double'/'linear'), shift_later bool, calendar_sync bool, quiet_start, quiet_end, quote_tone, onboarded |
| exercises | id, name, muscle, region (upper/lower/core/full), equipment, instructions, alt_ids[] (seed from `EX` in store.js) |
| plans | id, user_id, name, note, rotation text[], allow_consecutive |
| plan_workouts | id, plan_id, code (L1…), name, focus, region, position |
| plan_items | id, workout_id, exercise_id, position, sets, rep_min, rep_max, rir, rest_s, tempo, warmups, superset, notes, target_kg, media_url, replaced jsonb[] ({exercise_id, date}) |
| schedule_entries | id, user_id, date, plan_id, workout_code, status (planned/done/missed/skipped), origin (auto/manual/rescheduled), session_id, rescheduled_to, from_entry |
| pauses | id, user_id, from_date, to_date null, reason |
| sessions | id, user_id, date, workout_code, plan_id, entry_id, duration_min, notes |
| session_sets | id, session_id, exercise_id, kg, reps, rir, warm bool, note, feel, substituted_for |
| weights | user_id, date, kg |
| checkins | id, user_id, date, kg, waist, hips, chest, thighs, arms, custom jsonb, energy..recovery (1–5), cycle, strength, notes |
| photos | id, checkin_id, pose (front/side/back/custom), storage_path (**private bucket, signed URLs only**) |
| foods | id, name, basis (raw/cooked/drained/prepared/edible), kcal/p/c/f per 100 g, role, category, tags[], source, estimated, serving jsonb, raw_id/cooked_id, yield, buy jsonb; user_id null = global |
| day_plans / day_meals / meal_items | date, type (training/rest), water_ml; meal: slot, logged, prepped; item: food_id, grams, locked |
| meal_slots | user_id, day_type, index, label, time |
| distribution | user_id, mode (equal/custom/prepost/protein/manual), custom[], manual jsonb, pre_idx, post_idx, protein_idx[] |
| saved_meals, recipes (+ingredients), prep_plans, grocery_checks, grocery_manual, reminders, quotes_user (fav/hidden/custom) | as in `seed()` in store.js |

**RLS:** every table is scoped `user_id = auth.uid()`. Check-ins, measurements and photos are sensitive: photos go in a private bucket, served only through short-lived signed URLs, and are never public.

---

## Core algorithms (exact rules — see store.js)
**Scheduling** (`fill`, `regenerate`, `moveEntry`, `pause`, `resume`)
- Walk forward day by day. On training days that are not paused and have no active entry, place `rotation[idx]`, unless the adjacent day holds a workout in the same `region` and `allow_consecutive` is false.
- Moving to a later date with shift-later on: the moved entry lands on the target date, and later planned entries cascade forward to the next training days, keeping their order.
- Moving with shift-later off onto an occupied day swaps the two entries.
- Warn when a move creates back-to-back same-region days.
- Pause removes planned entries from its start date and refills after it, starting with the same next workout. Resume closes the pause yesterday and refills from today. The rotation is never lost.
- **Never set status "done" except by finishing a logged session.** Missed → reschedule creates a new entry and keeps the missed record.
- Streak = consecutive done entries, counting back; missed entries that were rescheduled don't break it.

**Progressive overload** (`recommend`), based on the last session's working sets:
- No history → **baseline** (note if it replaced an exercise).
- Linear rule → +increment when all sets ≥ rep_min and RIR is OK.
- All sets ≥ rep_max and RIR ≥ target−1 → **increase** by the equipment's smallest increment, restart at rep_min.
- Top of range but harder than target RIR → **hold** at the top.
- Any set < rep_min two sessions in a row at the same weight → **reduce** about 5% (rounded to the increment).
- Any set < rep_min → **hold**, aim for rep_min on all sets.
- Otherwise → **hold**, +1 rep per set up to rep_max.
- UI always distinguishes: Previous · Personal record · Recommended next. Accept / Edit / Ignore.

**PRs** (`prs`): heaviest set, most reps at each weight, e1RM (Epley: kg × (1 + reps/30)), best session volume, best working-set performance. Working sets only.

**Meal distribution** (`mealTargets` + `reconcile`)
- Integer largest-remainder rounding per macro, so per-meal grams sum **exactly** to the daily grams.
- Meal kcal = 4P + 4C + 9F. Show when the macro total differs from the calorie target (the sample is 1,815 vs 1,800).
- `prepost` on training days weights carbs [pre 1.3, post 1.25, others 0.8] and fat [pre 0.6, post 0.9, others 1.15].
- `protein` weights the chosen meals at 1.4 vs 0.8. `custom` uses percentages. `manual` uses entered grams and flags any mismatch.

**Portion solver** (`solve`)
- Non-negative weighted least squares (coordinate descent, 600 iterations) on P/C/F, with weights [1.3, 1, 4].
- Locked items are fixed and subtracted from the target first.
- Vegetables keep their amount (as when a day's meals are generated) unless they are the only adjustable foods, so a carb target is never met with hundreds of grams of vegetables.
- Every food the user added keeps at least 15 g (5 g for foods with more than 50% fat); it never drops to 0.
- Bounds 0–700 g. Rounded to 5 g (1 g for foods with more than 50% fat).
- **Always show the remaining difference.** Never claim an exact match.

**Alternatives** (`alternatives`)
- The substitute weight matches the source food's primary nutrient (protein, carbs, fat, or kcal for vegetables), rounded to 5 g.
- Score = |ΔP|·1.2 + |ΔC| + |ΔF|·2.2 + (different role ? 25 : 0) + |Δkcal|/12 − 4·(matching diet prefs) + (more than 600 g ? 40 : 0).
- Filter out excluded foods and allergens. Show every delta.
- "Use" swaps the food in and locks it; "Rebalance meal" re-solves the other foods.

**Meal prep and grocery** (`prepCalc`, `groceryList`)
- For cooked-basis foods, raw purchase = cooked ÷ yield. Flag these as **estimated yield**.
- If the user enters the actual cooked batch weight, per container = actual ÷ containers.
- Recipes spread nutrition over the actual final cooked weight.
- The grocery list combines raw ingredients across prep plans, converts them to purchase units (`buy`), groups by category, and supports check-off and manual items. It updates live.

**Safety**
- Warn and don't recommend when calories fall below max(estimated BMR, 1200 kcal female / 1500 kcal male).
- Show "Not medical advice" wherever calculations are presented.
- Deleting history requires confirmation: a checkbox, or typing DELETE for bulk deletes.

---

## Screens
All pages sit in a shell with a max content width of 1320 px and 22 px/28 px padding (12 px/14 px on mobile). Cards use `var(--color-surface)`, 8 px radius, `--shadow-sm`, 16–18 px padding. Row dividers are 1 px rules that fade over 48 px at each end.

1. **Fitness Dashboard**: header with date, greeting, 4 quick actions (log weight dialog, photos, move-workout dialog with a 12-day picker and shift toggle, prepare meals) and a kg/lb toggle. Paused banner. Today's workout card with Start/Resume (exercise, last session, next target, recommendation icon), or a Rest-day card. The week strip (7 cells) with done/today/planned/missed/skipped/paused states, done/total, streak and next check-in. Weight card (7-day average, change vs last week, 28-day chart: daily grey, average accent). Calories & macros (logged fill over planned track). Meals today (log toggle, prep status). Daily quote (favourite, hide, another). Upcoming reminders.
2. **My Schedule**: Day/Week/Month views, prev/today/next. Drag and drop onto any day. Clicking an entry opens an actions dialog (move by date, open, swap with…, skip, mark missed, reschedule, restore). Toggles for shift-later and show-in-main-calendar. Pause dialog (reason chips, from/until). Resume. `.ics` export. Rotation card. "Needs attention" list.
3. **Workout Plans**: plan selector, plan name and notes, the allow-consecutive toggle, and rotation reordering. Workout tabs. An editable table: exercise select, sets, rep range, target weight, rest, tempo, RIR, warm-ups, superset letter, notes, and reorder/remove. Replacing an exercise records it in `replaced[]`; history stays with the original exercise.
4. **Active Workout**: a sticky header (name, timer, progress, Finish) and a rest-timer bar (−15 / +15 / skip). For each exercise: previous / PR / recommended tiles with Accept / Edit / Ignore; instructions and a media field; a substitute panel (optionally permanent); repeat-last. Set rows are 48 px tall: set label (tap to toggle warm-up), weight, reps (placeholder = target), RIR, a done check, remove. A PB flag appears inline. Add set, feel chips (Good / Discomfort / Pain / Poor form), notes. Finish dialog with a summary; discard needs confirmation.
5. **Exercise History**: searchable exercise list, e1RM and working-weight chart, next-session recommendation, and a session table. A session detail panel with permanent delete (checkbox confirm).
6. **Personal Records**: records set in the last 14 days, plus a table of all exercises × the five PR types. Filter All / Upper / Lower.
7. **Progress Check-Ins**: frequency toggle. Form: date, weight, 5 measurements plus custom ones, five 1–5 ratings (energy, sleep, hunger, stress, recovery), cycle notes, strength, notes. "Since your first check-in" deltas. A list with edit and delete (confirm).
8. **Progress Photos**: privacy notice. Front/side/back selector. Compare two check-ins side by side, or with a slider (clip-path). Toggles for weight labels, measurement labels and an alignment grid. Upload / replace / download / delete (confirm). Same-pose guidance. Timeline grid.
9. **Nutrition Dashboard**: day switcher. Four cards (remaining, logged vs planned bars). Meals with prep status and a log toggle. Water tracker (10 cells, +250/+500/undo). Explainer: planned vs logged.
10. **Meal Planner**: day and training/rest type. A distribution-mode select, and a per-meal targets table showing the sum vs the daily target. Meal tabs. For the selected meal: food rows (name, basis badge, serving info, grams input, lock toggle, macros, Alternatives, remove), food search, a Calculate portions button, a totals-vs-target panel with the differences, a match note, save as favourite, and load a saved meal.
11. **Meal-Prep Calculator**: per-plan card with source (recipe or meal), meals, people, training/rest version. Table: buy/raw total, expected cooked yield (estimated flag), an actual cooked batch input, and the amount per container. For recipes, a total cooked batch input.
12. **Recipes & Saved Meals**: tabs. Recipe editor (ingredients by weight, total cooked weight, divide by servings or by serving weight, per serving / per 100 g / whole recipe, favourite, duplicate, delete). Saved meals (favourite, add to today's slot, duplicate, delete, restaurant estimate form). Custom food from a label (basis, serving, macros, label kcal check). Barcode button (uses `BarcodeDetector` where supported).
13. **Food Alternatives**: original food and grams, the role and the nutrient it's matched on. Filter chips (dairy-free, vegan, gluten-free, lower-cal, higher-cal). Ranked cards with weight, macros and deltas. When opened from a meal, "Use" appears, followed by a Rebalance-meal bar.
14. **Grocery List**: source summary, estimated-yield warning, grouped checkable rows (buy quantity plus "need X g"), manual items, uncheck all.
15. **Analytics**: 3/7/14-day rolling weight average with rate per week (flags if more than 1% of body weight per week). Measurements chart. Weekly completion bars. Weekly volume bars. e1RM per exercise. Calorie/protein/fat adherence (28-day deviation bars). Meal-prep consistency. Photo timeline.
16. **Fitness Settings**: tabs for Profile & goal, Training (days regenerate the schedule; increments, progression rule, shift-later, calendar sync), Nutrition (targets with the low-calorie warning, meals per day, water, diet, allergies, exclude, meal slot labels and times for training/rest), Reminders (on, time, frequency, channel, snooze, reschedule-if-missed, quiet hours), Motivation (tone filter, favourite/hide, custom statements), Data & privacy (export JSON, restore sample data, delete history by type with DELETE confirmation).
17. **Onboarding** (6 steps): goal; body and units; training week, equipment and priorities; targets with a Mifflin-St Jeor suggestion; check-ins and reminders; review. Saving regenerates future workouts and keeps all history.

Responsive: at ≥980 px, a sticky 236 px sidebar; below that, a sticky top bar with a drawer. Grids use `repeat(auto-fit, minmax(min(100%, N px), 1fr))`. Touch targets are ≥44 px (workout inputs 48 px).

## Design tokens (Nocturne — `prototype/_ds/.../styles.css`)
- **Colours:** bg `#161826` · surface `#232532` · text `#e9e9ed` · accent `#9184d9` · divider = text at 16% alpha.
  - Neutral ramp 100–900: `#f3f5fe #e4e7f5 #cfd3e5 #b2b6ca #9397ab #75798c #595d6c #3f424d #292b31`
  - Accent ramp 100–900: `#f5f4ff #e7e5fe #d2cefd #b5abfc #968ae0 #796cbf #5d5294 #423a6a #2b2741`
  - Section ground (hero or stat band only): `#262a60` / glow `#353b80`.
  - Sidebar gradient: `#1b1d2c` → bg.
- **Type:** Inter. Headings weight 500 (never bolder), letter-spacing −0.015em. h1 42 · h2 32 (pages use 28) · h3 25 · h4 20. Body 15/1.55. Kickers 10 px uppercase with 0.1em tracking, in the accent colour. Numbers use tabular-nums.
- **Spacing:** 2.8, 5.6, 8.4, 11.2, 16.8, 22.4 px (density 0.7).
- **Radius:** 4 / 8 / 14.
- **Shadows:**
  - sm `0 0 0 1px #3f424d`
  - md `0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,.55)`
  - lg `0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,.65)`
- **Buttons are outlined, never filled.** Primary = 1 px accent border and accent text; hover adds a 12% accent tint, pressed 22%. Focus: 2 px accent outline with 2 px offset.
- Accent text at body size uses accent-300 (`#d2cefd`) for contrast.

## Assets
- Icons: Phosphor, regular and fill weights.
- There are no image assets. Photo slots are striped placeholders until the user uploads.
- Nutrition values are approximate figures drawn from USDA FoodData Central. **Replace them with a live integration**: the USDA FDC API (free key), plus Open Food Facts for barcodes.

## Files
- `Regimen App (offline preview).html`: the whole prototype in one file.
- `prototype/Regimen.dc.html`: the shell and navigation.
- `prototype/Fit*.dc.html`: one file per page (names match the screen list above).
- `prototype/store.js`: **domain logic and seed data. Port this first.**
- `prototype/_ds/.../styles.css`: design tokens and base component classes.
- `prototype/support.js`: prototype runtime only. Ignore it.

## Suggested build order
1. Expo app, Supabase project, auth, and the token theme.
2. Port `store.js` into typed domain modules, with unit tests (scheduler, recommend, reconcile, solve, alternatives, prepCalc).
3. DB schema and RLS; seed exercises and foods.
4. Shell and navigation, then Dashboard, Schedule, Active Workout, Meal Planner (the core loop).
5. The remaining pages, then notifications, calendar sync and photo storage.
6. EAS builds and store submission.
