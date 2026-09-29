/* Regimen — shared data + calculation engine. All pages read/write through window.RG so everything stays in sync. Metric is the internal standard. */
(function () {
  if (window.RG) return;
  const TODAY = '2026-09-29';
  const KEY = 'regimen.v2', PKEY = 'regimen.photos.v1';
  const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const iso = dt => dt.toISOString().slice(0, 10);
  const add = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const dow = s => (D(s).getUTCDay() + 6) % 7;
  const diff = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DFULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtD = s => `${DN[dow(s)]} ${D(s).getUTCDate()} ${MN[D(s).getUTCMonth()]}`;
  const fmtShort = s => `${D(s).getUTCDate()} ${MN[D(s).getUTCMonth()]}`;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const rnd = (seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(20260929);
  const r1 = n => Math.round(n * 10) / 10;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ── Exercise library ── */
  const EX = {};
  const ex = (id, name, muscle, region, equip, instr, alts) => EX[id] = { id, name, muscle, region, equip, instr, alts: alts || [] };
  ex('squat', 'Back squat', 'Quads', 'lower', 'Barbell', 'Bar on upper back, brace, sit down between the hips to depth you control, drive up through mid-foot.', ['hack', 'legpress', 'goblet']);
  ex('rdl', 'Romanian deadlift', 'Hamstrings', 'lower', 'Barbell', 'Soft knees, push hips back keeping the bar close, stop when hamstrings limit range, stand tall.', ['dbrdl', 'legcurl']);
  ex('legpress', 'Leg press', 'Quads', 'lower', 'Machine', 'Feet mid-platform, lower until hips start to tuck, press without locking knees hard.', ['hack', 'squat']);
  ex('legcurl', 'Lying leg curl', 'Hamstrings', 'lower', 'Machine', 'Hips pinned, curl to full flexion, 2 s lowering.', ['seatcurl', 'rdl']);
  ex('calf', 'Standing calf raise', 'Calves', 'lower', 'Machine', 'Full stretch at the bottom, pause, rise onto big toe.', []);
  ex('crunch', 'Cable crunch', 'Core', 'core', 'Cable', 'Kneel, rope by ears, flex the spine toward the floor, hips still.', ['kneeraise']);
  ex('incdb', 'Incline DB press', 'Chest', 'upper', 'Dumbbell', 'Bench at 30°, shoulder blades set, lower to chest level, press slightly inward.', ['incbar', 'bench', 'fly']);
  ex('csrow', 'Chest-supported row', 'Upper back', 'upper', 'Dumbbell', 'Chest on incline pad, row elbows toward hips, pause at the top.', ['dbrow', 'cablerow']);
  ex('pulldown', 'Lat pulldown', 'Lats', 'upper', 'Cable', 'Slight lean back, drive elbows down to ribs, control the return to a full stretch.', ['ngpull', 'pullup']);
  ex('dbsp', 'Seated DB shoulder press', 'Shoulders', 'upper', 'Dumbbell', 'Back supported, press up and slightly in, lower to ear height.', ['machsp']);
  ex('lateral', 'Cable lateral raise', 'Shoulders', 'upper', 'Cable', 'Lead with the elbow, raise to shoulder height, slow lowering.', ['dblateral']);
  ex('pushdown', 'Rope pushdown', 'Triceps', 'upper', 'Cable', 'Elbows fixed at sides, extend and split the rope at the bottom.', ['ohext']);
  ex('hipthrust', 'Barbell hip thrust', 'Glutes', 'lower', 'Barbell', 'Upper back on bench, chin tucked, drive through heels to full hip extension, pause 1 s.', ['glutebridge', 'machthrust']);
  ex('bss', 'Bulgarian split squat', 'Glutes', 'lower', 'Dumbbell', 'Rear foot on bench, torso slightly forward, lower under control. Weight is per dumbbell.', ['lunge', 'legpress']);
  ex('hack', 'Hack squat', 'Quads', 'lower', 'Machine', 'Feet shoulder width, lower to depth, press through the whole foot.', ['legpress', 'squat']);
  ex('seatcurl', 'Seated leg curl', 'Hamstrings', 'lower', 'Machine', 'Lean forward slightly for more stretch, curl fully, control up.', ['legcurl']);
  ex('abduct', 'Hip abduction', 'Glutes', 'lower', 'Machine', 'Slight forward lean, push knees out, pause at the end.', []);
  ex('kneeraise', 'Hanging knee raise', 'Core', 'core', 'Bodyweight', 'Posterior pelvic tilt, raise knees to chest, no swing.', ['crunch']);
  ex('bench', 'Bench press', 'Chest', 'upper', 'Barbell', 'Feet planted, slight arch, touch low chest, press back over shoulders.', ['incdb', 'machpress']);
  ex('dbrow', 'One-arm DB row', 'Upper back', 'upper', 'Dumbbell', 'Hand and knee on bench, row toward hip, full stretch at the bottom.', ['csrow', 'cablerow']);
  ex('ngpull', 'Neutral-grip pulldown', 'Lats', 'upper', 'Cable', 'Neutral handle, chest up, elbows to ribs.', ['pulldown']);
  ex('fly', 'Machine chest fly', 'Chest', 'upper', 'Machine', 'Soft elbows, hug the arc, squeeze, slow return.', []);
  ex('facepull', 'Face pull', 'Rear delts', 'upper', 'Cable', 'Rope at face height, pull to forehead, rotate thumbs back.', []);
  ex('ezcurl', 'EZ-bar curl', 'Biceps', 'upper', 'Barbell', 'Elbows still, curl up, 2 s down.', ['dbcurl']);
  ex('goblet', 'Goblet squat', 'Quads', 'lower', 'Dumbbell', 'Hold DB at chest, sit between hips, elbows inside knees.', ['squat']);
  ex('dbrdl', 'DB Romanian deadlift', 'Hamstrings', 'lower', 'Dumbbell', 'As the barbell RDL, dumbbells along the thighs.', ['rdl']);
  ex('incbar', 'Incline barbell press', 'Chest', 'upper', 'Barbell', '30° bench, bar to upper chest.', ['incdb']);
  ex('machpress', 'Machine chest press', 'Chest', 'upper', 'Machine', 'Handles at mid-chest, press without shrugging.', ['bench']);
  ex('cablerow', 'Seated cable row', 'Upper back', 'upper', 'Cable', 'Tall chest, row to lower ribs, stretch forward.', ['csrow']);
  ex('pullup', 'Assisted pull-up', 'Lats', 'upper', 'Machine', 'Weight shown is assistance — lower is harder.', ['pulldown']);
  ex('machsp', 'Machine shoulder press', 'Shoulders', 'upper', 'Machine', 'Seat so handles start at shoulder height.', ['dbsp']);
  ex('dblateral', 'DB lateral raise', 'Shoulders', 'upper', 'Dumbbell', 'Slight lean forward, raise to shoulder height.', ['lateral']);
  ex('ohext', 'Overhead cable extension', 'Triceps', 'upper', 'Cable', 'Face away, elbows forward, extend fully.', ['pushdown']);
  ex('glutebridge', 'DB glute bridge', 'Glutes', 'lower', 'Dumbbell', 'Floor bridge with DB on hips.', ['hipthrust']);
  ex('machthrust', 'Hip thrust machine', 'Glutes', 'lower', 'Machine', 'Pad across hips, drive to lockout.', ['hipthrust']);
  ex('lunge', 'Walking lunge', 'Glutes', 'lower', 'Dumbbell', 'Long step, back knee toward floor. Weight per dumbbell.', ['bss']);
  ex('dbcurl', 'Incline DB curl', 'Biceps', 'upper', 'Dumbbell', 'Arms hang behind torso, curl without swinging.', ['ezcurl']);
  ex('deadlift', 'Conventional deadlift', 'Posterior chain', 'lower', 'Barbell', 'Bar over mid-foot, wedge in, push the floor away.', ['rdl']);
  ex('legext', 'Leg extension', 'Quads', 'lower', 'Machine', 'Pause at the top, 3 s lowering.', []);

  /* ── Foods (per 100 g) — source: USDA FoodData Central unless noted ── */
  const FOODS = {};
  const tagMap = { df: 'Dairy-free', gf: 'Gluten-free', vg: 'Vegan', vt: 'Vegetarian', hp: 'High protein' };
  const food = (id, name, basis, kcal, p, c, f, role, cat, tags, extra) => FOODS[id] = Object.assign({ id, name, basis, kcal, p, c, f, role, cat, tags: tags.split(' ').filter(Boolean).map(t => tagMap[t]), src: 'USDA FoodData Central', est: false }, extra || {});
  food('chicken_c', 'Chicken breast, skinless', 'cooked', 165, 31, 0, 3.6, 'protein', 'Meat & fish', 'df gf hp', { rawId: 'chicken_r', yld: 0.75 });
  food('chicken_r', 'Chicken breast, skinless', 'raw', 120, 22.5, 0, 2.6, 'protein', 'Meat & fish', 'df gf hp', { cookedId: 'chicken_c', yld: 0.75, buy: { unit: 'pack', g: 500 } });
  food('turkey', 'Turkey breast, sliced', 'prepared', 104, 17, 3.5, 2, 'protein', 'Meat & fish', 'df gf hp', { buy: { unit: 'pack', g: 175 } });
  food('beef_c', 'Lean ground beef 95%', 'cooked', 170, 26, 0, 7, 'protein', 'Meat & fish', 'df gf hp', { rawId: 'beef_r', yld: 0.72 });
  food('beef_r', 'Lean ground beef 95%', 'raw', 137, 21.4, 0, 5, 'protein', 'Meat & fish', 'df gf hp', { cookedId: 'beef_c', yld: 0.72, buy: { unit: 'pack', g: 450 } });
  food('salmon_r', 'Atlantic salmon', 'raw', 208, 20.4, 0, 13.4, 'protein', 'Meat & fish', 'df gf hp', { cookedId: 'salmon_c', yld: 0.8, buy: { unit: 'fillet', g: 150 } });
  food('salmon_c', 'Atlantic salmon', 'cooked', 206, 22.1, 0, 12.4, 'protein', 'Meat & fish', 'df gf hp', { rawId: 'salmon_r', yld: 0.8 });
  food('cod_c', 'Cod', 'cooked', 105, 22.8, 0, 0.9, 'protein', 'Meat & fish', 'df gf hp', { rawId: 'cod_r', yld: 0.78 });
  food('cod_r', 'Cod', 'raw', 82, 17.8, 0, 0.7, 'protein', 'Meat & fish', 'df gf hp', { cookedId: 'cod_c', yld: 0.78, buy: { unit: 'pack', g: 400 } });
  food('tuna', 'Tuna, canned in water', 'drained', 116, 25.5, 0, 0.8, 'protein', 'Pantry', 'df gf hp', { serving: { label: 'can, drained', g: 120 }, buy: { unit: 'can', g: 120 } });
  food('tofu', 'Tofu, firm', 'raw', 144, 17.3, 2.8, 8.7, 'protein', 'Produce', 'df gf vg vt hp', { buy: { unit: 'block', g: 350 } });
  food('eggs', 'Egg, whole', 'raw', 143, 12.6, 0.7, 9.5, 'protein', 'Dairy & eggs', 'df gf vt', { serving: { label: 'large egg', g: 50 }, buy: { unit: 'dozen', g: 600 } });
  food('eggw', 'Egg whites, liquid', 'raw', 48, 10, 0.7, 0.2, 'protein', 'Dairy & eggs', 'df gf vt hp', { buy: { unit: 'carton', g: 500 } });
  food('yog', 'Greek yogurt, 0% plain', 'prepared', 59, 10.3, 3.6, 0.4, 'protein', 'Dairy & eggs', 'gf vt hp', { buy: { unit: 'tub', g: 750 } });
  food('soyog', 'Soy yogurt, plain', 'prepared', 66, 5.5, 4, 3, 'protein', 'Dairy & eggs', 'df gf vg vt', { buy: { unit: 'tub', g: 650 } });
  food('cottage', 'Cottage cheese 2%', 'prepared', 84, 11, 4.3, 2.3, 'protein', 'Dairy & eggs', 'gf vt hp', { buy: { unit: 'tub', g: 500 } });
  food('whey', 'Whey protein isolate', 'prepared', 380, 80, 8, 5, 'protein', 'Pantry', 'gf vt hp', { src: 'Custom · product label', serving: { label: 'scoop', g: 30 }, buy: { unit: 'tub', g: 900 } });
  food('rice_c', 'White rice, long-grain', 'cooked', 130, 2.7, 28.2, 0.3, 'carb', 'Grains & starches', 'df gf vg vt', { rawId: 'rice_r', yld: 3.0 });
  food('rice_r', 'White rice, long-grain', 'raw', 365, 7.1, 80, 0.7, 'carb', 'Grains & starches', 'df gf vg vt', { cookedId: 'rice_c', yld: 3.0, buy: { unit: 'bag', g: 900 } });
  food('quinoa_c', 'Quinoa', 'cooked', 120, 4.4, 21.3, 1.9, 'carb', 'Grains & starches', 'df gf vg vt', { rawId: 'quinoa_r', yld: 2.7 });
  food('quinoa_r', 'Quinoa', 'raw', 368, 14.1, 64.2, 6.1, 'carb', 'Grains & starches', 'df gf vg vt', { cookedId: 'quinoa_c', yld: 2.7, buy: { unit: 'bag', g: 500 } });
  food('pasta_c', 'Pasta, enriched', 'cooked', 158, 5.8, 30.9, 0.9, 'carb', 'Grains & starches', 'df vg vt', { rawId: 'pasta_r', yld: 2.25 });
  food('pasta_r', 'Pasta, enriched', 'raw', 371, 13, 74.7, 1.5, 'carb', 'Grains & starches', 'df vg vt', { cookedId: 'pasta_c', yld: 2.25, buy: { unit: 'box', g: 450 } });
  food('potato_r', 'Potato, white, flesh & skin', 'raw', 77, 2, 17.5, 0.1, 'carb', 'Produce', 'df gf vg vt', { cookedId: 'potato_c', yld: 1.0, buy: { unit: 'bag', g: 2270 } });
  food('potato_c', 'Potato, boiled', 'cooked', 87, 1.9, 20.1, 0.1, 'carb', 'Produce', 'df gf vg vt', { rawId: 'potato_r', yld: 1.0 });
  food('sweet_c', 'Sweet potato, baked', 'cooked', 90, 2, 20.7, 0.2, 'carb', 'Produce', 'df gf vg vt', { rawId: 'sweet_r', yld: 0.8 });
  food('sweet_r', 'Sweet potato', 'raw', 86, 1.6, 20.1, 0.1, 'carb', 'Produce', 'df gf vg vt', { cookedId: 'sweet_c', yld: 0.8, buy: { unit: 'each', g: 200 } });
  food('oats', 'Rolled oats', 'raw', 379, 13.2, 67.7, 6.5, 'carb', 'Grains & starches', 'df vg vt', { buy: { unit: 'bag', g: 1000 } });
  food('bread', 'Whole-wheat bread', 'prepared', 247, 13, 41, 3.4, 'carb', 'Grains & starches', 'df vg vt', { serving: { label: 'slice', g: 32 }, buy: { unit: 'loaf', g: 600 } });
  food('tortilla', 'Flour tortilla, large', 'prepared', 306, 8.2, 50, 8, 'carb', 'Grains & starches', 'df vg vt', { serving: { label: 'wrap', g: 62 }, buy: { unit: 'pack of 8', g: 496 } });
  food('banana', 'Banana', 'edible', 89, 1.1, 22.8, 0.3, 'carb', 'Produce', 'df gf vg vt', { serving: { label: 'medium, peeled', g: 118 }, buy: { unit: 'each', g: 118 } });
  food('blueb', 'Blueberries', 'raw', 57, 0.7, 14.5, 0.3, 'carb', 'Produce', 'df gf vg vt', { buy: { unit: 'pint', g: 310 } });
  food('lentils', 'Lentils, boiled', 'cooked', 116, 9, 20.1, 0.4, 'carb', 'Pantry', 'df gf vg vt', { rawId: 'lentil_r', yld: 2.4 });
  food('lentil_r', 'Lentils, dry', 'raw', 352, 24.6, 63.4, 1.1, 'carb', 'Pantry', 'df gf vg vt', { cookedId: 'lentils', yld: 2.4, buy: { unit: 'bag', g: 900 } });
  food('chick', 'Chickpeas, canned', 'drained', 139, 7, 22.5, 2.1, 'carb', 'Pantry', 'df gf vg vt', { buy: { unit: 'can, drained', g: 250 } });
  food('avocado', 'Avocado', 'edible', 160, 2, 8.5, 14.7, 'fat', 'Produce', 'df gf vg vt', { serving: { label: 'medium, edible', g: 136 }, buy: { unit: 'each', g: 136 } });
  food('oil', 'Olive oil', 'prepared', 884, 0, 0, 100, 'fat', 'Pantry', 'df gf vg vt', { serving: { label: 'tbsp', g: 13.5 }, buy: { unit: 'bottle', g: 500 } });
  food('almonds', 'Almonds', 'raw', 579, 21.2, 21.6, 49.9, 'fat', 'Pantry', 'df gf vg vt', { buy: { unit: 'bag', g: 400 } });
  food('pb', 'Peanut butter, smooth', 'prepared', 588, 25, 20, 50, 'fat', 'Pantry', 'df gf vg vt', { serving: { label: 'tbsp', g: 16 }, buy: { unit: 'jar', g: 500 } });
  food('cheddar', 'Cheddar cheese', 'prepared', 403, 24.9, 1.3, 33.1, 'fat', 'Dairy & eggs', 'gf vt', { buy: { unit: 'block', g: 400 } });
  food('feta', 'Feta cheese', 'prepared', 264, 14.2, 4.1, 21.3, 'fat', 'Dairy & eggs', 'gf vt', { buy: { unit: 'pack', g: 200 } });
  food('hummus', 'Hummus', 'prepared', 166, 7.9, 14.3, 9.6, 'fat', 'Produce', 'df gf vg vt', { buy: { unit: 'tub', g: 283 } });
  food('broccoli_c', 'Broccoli, steamed', 'cooked', 35, 2.4, 7.2, 0.4, 'veg', 'Produce', 'df gf vg vt', { rawId: 'broccoli_r', yld: 0.95 });
  food('broccoli_r', 'Broccoli', 'raw', 34, 2.8, 6.6, 0.4, 'veg', 'Produce', 'df gf vg vt', { cookedId: 'broccoli_c', yld: 0.95, buy: { unit: 'head', g: 500 } });
  food('spinach', 'Spinach', 'raw', 23, 2.9, 3.6, 0.4, 'veg', 'Produce', 'df gf vg vt', { buy: { unit: 'bag', g: 300 } });
  food('greens', 'Mixed salad greens', 'raw', 20, 1.5, 3.5, 0.2, 'veg', 'Produce', 'df gf vg vt', { buy: { unit: 'box', g: 142 } });
  food('peppers', 'Bell pepper', 'raw', 26, 1, 6, 0.3, 'veg', 'Produce', 'df gf vg vt', { buy: { unit: 'each', g: 150 } });

  const QUOTES = [
    ['Keep the appointment. The results follow the calendar, not the mood.', 'Disciplined'],
    ['Do the next set well. Then do the one after it.', 'Disciplined'],
    ['The plan works once you stop renegotiating it every morning.', 'Disciplined'],
    ['Repeated and unremarkable beats perfect and occasional.', 'Disciplined'],
    ['Decide once, on the quiet day, so the busy day has nothing to argue with.', 'Disciplined'],
    ['A missed session is information, not a verdict. Reschedule it and carry on.', 'Supportive'],
    ['You are allowed to go slower than your plan. You are not required to stop.', 'Supportive'],
    ['Rest days are part of the program, not a break from it.', 'Calm'],
    ['Breathe out on the hard part. Keep the rest simple.', 'Calm'],
    ['Log it honestly. Good data makes the next decision easy.', 'Direct'],
    ['Hit the minimum rep. Then decide about the maximum.', 'Direct'],
    ['Add a little, often. That is the whole trick.', 'Performance'],
    ['Quality reps at the right effort move the number. Ego reps move nothing.', 'Performance']
  ];

  /* ── Default plan ── */
  const it = (exId, sets, repMin, repMax, rir, rest, extra) => Object.assign({ id: uid(), exId, sets, repMin, repMax, rir, rest, tempo: '2-0-1-0', warmups: 0, superset: '', notes: '', replaced: [] }, extra || {});
  const PLAN = {
    id: 'ul4', name: 'Upper / Lower · 4 day', note: 'Double progression. Hit the top of the range on every working set at the target RIR, then add the smallest increment.',
    workouts: [
      { id: 'L1', name: 'Lower Body 1', focus: 'Quads · Hamstrings', muscles: ['Quads', 'Hamstrings', 'Calves', 'Core'], region: 'lower', items: [it('squat', 3, 6, 8, 2, 150, { warmups: 2, tempo: '3-0-1-0' }), it('rdl', 3, 8, 10, 2, 120, { warmups: 1 }), it('legpress', 3, 10, 12, 2, 120), it('legcurl', 3, 10, 12, 1, 90), it('calf', 3, 12, 15, 1, 60, { superset: 'A' }), it('crunch', 2, 12, 15, 1, 60, { superset: 'A' })] },
      { id: 'U1', name: 'Upper Body 1', focus: 'Chest · Back', muscles: ['Chest', 'Upper back', 'Lats', 'Shoulders', 'Triceps'], region: 'upper', items: [it('incdb', 3, 8, 10, 2, 120, { warmups: 1 }), it('csrow', 3, 8, 10, 2, 120), it('pulldown', 3, 10, 12, 2, 90), it('dbsp', 3, 8, 10, 2, 90), it('lateral', 2, 12, 15, 1, 60, { superset: 'A' }), it('pushdown', 2, 10, 12, 1, 60, { superset: 'A' })] },
      { id: 'L2', name: 'Lower Body 2', focus: 'Glutes · Posterior', muscles: ['Glutes', 'Quads', 'Hamstrings', 'Core'], region: 'lower', items: [it('hipthrust', 3, 8, 10, 2, 120, { warmups: 2 }), it('bss', 3, 8, 10, 2, 90), it('hack', 3, 8, 10, 2, 120), it('seatcurl', 3, 10, 12, 1, 90), it('abduct', 2, 12, 15, 1, 60), it('kneeraise', 2, 10, 15, 1, 60)] },
      { id: 'U2', name: 'Upper Body 2', focus: 'Press · Pull', muscles: ['Chest', 'Upper back', 'Lats', 'Rear delts', 'Biceps'], region: 'upper', items: [it('bench', 3, 6, 8, 2, 150, { warmups: 2 }), it('dbrow', 3, 8, 10, 2, 90), it('ngpull', 3, 8, 10, 2, 90), it('fly', 2, 10, 12, 1, 60), it('facepull', 2, 12, 15, 1, 60, { superset: 'B' }), it('ezcurl', 2, 10, 12, 1, 60, { superset: 'B' })] }
    ],
    rotation: ['L1', 'U1', 'L2', 'U2'], allowConsecutive: false
  };
  const PLAN5 = {
    id: 'ul5', name: 'Upper / Lower · 5 day', note: 'Adds a third lower day for glute and posterior-chain priority.',
    workouts: [
      { id: 'L1', name: 'Lower Body 1', focus: 'Quads', muscles: ['Quads', 'Hamstrings'], region: 'lower', items: [it('squat', 3, 6, 8, 2, 150, { warmups: 2 }), it('legpress', 3, 10, 12, 2, 120), it('legext', 2, 12, 15, 1, 60)] },
      { id: 'U1', name: 'Upper Body 1', focus: 'Chest · Back', muscles: ['Chest', 'Upper back'], region: 'upper', items: [it('incdb', 3, 8, 10, 2, 120), it('csrow', 3, 8, 10, 2, 120), it('lateral', 3, 12, 15, 1, 60)] },
      { id: 'L2', name: 'Lower Body 2', focus: 'Glutes', muscles: ['Glutes', 'Hamstrings'], region: 'lower', items: [it('hipthrust', 3, 8, 10, 2, 120), it('rdl', 3, 8, 10, 2, 120), it('abduct', 2, 12, 15, 1, 60)] },
      { id: 'U2', name: 'Upper Body 2', focus: 'Press · Pull', muscles: ['Chest', 'Lats'], region: 'upper', items: [it('bench', 3, 6, 8, 2, 150), it('pulldown', 3, 10, 12, 2, 90), it('ezcurl', 2, 10, 12, 1, 60)] },
      { id: 'L3', name: 'Lower Body 3', focus: 'Posterior chain', muscles: ['Posterior chain', 'Glutes'], region: 'lower', items: [it('deadlift', 3, 4, 6, 2, 180, { warmups: 3 }), it('lunge', 3, 10, 12, 2, 90), it('seatcurl', 3, 10, 12, 1, 90)] }
    ],
    rotation: ['L1', 'U1', 'L2', 'U2', 'L3'], allowConsecutive: false
  };

  const START_KG = { squat: 57.5, rdl: 57.5, legpress: 110, legcurl: 32.5, calf: 45, crunch: 27.5, incdb: 20, csrow: 32, pulldown: 50, dbsp: 14, lateral: 5, pushdown: 20, hipthrust: 75, bss: 12, hack: 65, seatcurl: 32.5, abduct: 45, kneeraise: 0, bench: 47.5, dbrow: 22, ngpull: 45, fly: 37.5, facepull: 17.5, ezcurl: 20 };

  function seed() {
    const s = {
      v: 1, route: 'dashboard', routeParam: null,
      profile: {
        name: 'Alex', goal: 'Fat loss', weightKg: 78.6, goalWeightKg: 72, heightCm: 170, age: 34, sex: 'Female', activity: 'Moderately active', experience: 'Intermediate',
        trainingDays: [0, 1, 3, 4], restDays: [2, 5, 6], duration: 60, location: 'Gym', equipment: ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'], priorities: ['Glutes', 'Upper back'],
        kcal: 1800, protein: 140, carbs: 190, fat: 55, mealsPerDay: 4, dietPrefs: [], allergies: [], exclude: ['Pork'],
        checkInDay: 6, checkInFreq: 'Weekly', units: 'metric', water: true, waterMl: 2500, supplements: false,
        increments: { Barbell: 2.5, Dumbbell: 2, Cable: 2.5, Machine: 5, Bodyweight: 0 },
        progression: 'double', quietStart: '22:00', quietEnd: '07:00', calendarSync: true, shiftLater: true, workoutTime: '17:30',
        quoteTone: 'Disciplined', onboarded: true, startDate: '2026-08-17'
      },
      plans: [PLAN, PLAN5], activePlanId: 'ul4', sessions: [], schedule: [], pauses: [],
      weights: [], checkins: [], nutritionLog: {}, days: {},
      distribution: { mode: 'prepost', custom: [25, 25, 25, 25], manual: null, preIdx: 2, postIdx: 3, proteinIdx: [1, 3] },
      mealSlots: {
        training: [{ name: 'Meal 1', label: 'Breakfast', time: '07:30' }, { name: 'Meal 2', label: 'Lunch', time: '12:30' }, { name: 'Meal 3', label: 'Pre-workout', time: '16:00' }, { name: 'Meal 4', label: 'Post-workout dinner', time: '19:30' }],
        rest: [{ name: 'Meal 1', label: 'Breakfast', time: '08:30' }, { name: 'Meal 2', label: 'Lunch', time: '12:30' }, { name: 'Meal 3', label: 'Snack', time: '15:30' }, { name: 'Meal 4', label: 'Dinner', time: '19:00' }]
      },
      savedMeals: [], recipes: [], customFoods: {}, prep: [], grocery: { checked: {}, manual: [] },
      reminders: [], quotes: { fav: {}, hidden: {}, custom: [] }, active: null, prCache: null
    };
    // weights: 44 days
    const n0 = diff('2026-08-17', TODAY);
    const noise = () => (rnd() - 0.5) * 0.9;
    for (let i = 0; i <= n0; i++) s.weights.push({ date: add('2026-08-17', i), kg: r1(81.6 - 0.068 * i + noise() + (dow(add('2026-08-17', i)) === 0 ? 0.25 : 0)) });
    // training history
    const wmap = {}; PLAN.workouts.forEach(w => wmap[w.id] = w);
    const prog = {};
    const slots = [];
    for (let w = 0; w < 6; w++) {
      const mon = add('2026-08-17', w * 7);
      [['L1', 0], ['U1', 1], ['L2', 3], ['U2', 4]].forEach(([wid, o]) => slots.push({ date: add(mon, o), wid }));
    }
    slots.push({ date: '2026-09-28', wid: 'L1' });
    slots.forEach(sl => {
      const miss = sl.date === '2026-09-11';
      const entry = { id: uid(), date: sl.date, workoutId: sl.wid, planId: 'ul4', status: miss ? 'missed' : 'done', origin: 'auto', sessionId: null };
      s.schedule.push(entry);
      const doDate = miss ? '2026-09-12' : sl.date;
      if (miss) { const re = { id: uid(), date: doDate, workoutId: sl.wid, planId: 'ul4', status: 'done', origin: 'rescheduled', from: entry.id }; entry.rescheduledTo = re.id; s.schedule.push(re); entry2session(re); } else entry2session(entry);
      function entry2session(en) {
        const w = wmap[sl.wid]; const sets = [];
        w.items.forEach(item => {
          const p = prog[item.exId] || (prog[item.exId] = { kg: START_KG[item.exId], reps: Array.from({ length: item.sets }, (_, j) => item.repMin - (j === item.sets - 1 ? 1 : 0)) });
          for (let j = 0; j < item.warmups; j++) sets.push({ exId: item.exId, kg: r1(p.kg * (j === 0 ? 0.5 : 0.7)), reps: j === 0 ? 8 : 5, rir: 5, warm: true });
          p.reps.forEach((rp, j) => sets.push({ exId: item.exId, kg: p.kg, reps: Math.max(1, rp), rir: j === item.sets - 1 ? Math.max(0, item.rir - 1) : item.rir, warm: false }));
          if (p.reps.every(r => r >= item.repMax)) { p.kg = r1(p.kg + (s.profile.increments[EX[item.exId].equip] || 2.5)); p.reps = p.reps.map((_, j) => item.repMin - (j > 0 && rnd() < 0.5 ? 1 : 0)); }
          else p.reps = p.reps.map(r => Math.min(item.repMax, r + (rnd() < 0.62 ? 1 : 0)));
        });
        const ses = { id: uid(), date: doDate, workoutId: sl.wid, planId: 'ul4', entryId: en.id, sets, durationMin: 52 + Math.round(rnd() * 14), notes: '' };
        s.sessions.push(ses); en.sessionId = ses.id;
      }
    });
    // check-ins weekly Sundays
    const ciDates = []; for (let d = '2026-08-16'; d <= '2026-09-27'; d = add(d, 7)) ciDates.push(d);
    ciDates.forEach((d, i) => s.checkins.push({
      id: uid(), date: d, kg: avgWeight(s.weights, d), waist: r1(84.5 - i * 0.45 + (rnd() - 0.5) * 0.3), hips: r1(103 - i * 0.3), chest: r1(96 - i * 0.2), thighs: r1(60 - i * 0.2), arms: r1(30.5 - i * 0.05), custom: [],
      energy: 3 + Math.round(rnd()), sleep: 3 + Math.round(rnd()), hunger: 2 + Math.round(rnd() * 2), stress: 2 + Math.round(rnd()), recovery: 3 + Math.round(rnd()),
      cycle: i === 3 ? 'Luteal phase, some water retention' : '', strength: i > 3 ? 'Squat moved up; incline press stalled one week' : 'Steady', notes: i === 0 ? 'Baseline check-in.' : '', photos: { front: null, side: null, back: null, custom: [] }
    }));
    // nutrition log history
    for (let d = '2026-08-17'; d < TODAY; d = add(d, 1)) {
      const k = 1800 + Math.round((rnd() - 0.45) * 260); const p = 140 + Math.round((rnd() - 0.55) * 28);
      s.nutritionLog[d] = { kcal: k, p, c: Math.round((k - p * 4 - 55 * 9) / 4 + (rnd() - 0.5) * 10), f: 55 + Math.round((rnd() - 0.5) * 12), prepped: dow(d) === 6 ? rnd() > 0.15 : null, water: 2000 + Math.round(rnd() * 800) };
    }
    // saved meals / recipes
    s.savedMeals = [
      { id: 'sm1', name: 'Chicken, rice & broccoli', items: [{ foodId: 'chicken_c', g: 145 }, { foodId: 'rice_c', g: 180 }, { foodId: 'broccoli_c', g: 100 }], fav: true, uses: 18 },
      { id: 'sm2', name: 'Yogurt, oats & berries', items: [{ foodId: 'yog', g: 250 }, { foodId: 'oats', g: 45 }, { foodId: 'blueb', g: 80 }], fav: true, uses: 31 },
      { id: 'sm3', name: 'Turkey wrap & banana', items: [{ foodId: 'turkey', g: 110 }, { foodId: 'tortilla', g: 62 }, { foodId: 'banana', g: 118 }], fav: false, uses: 9 },
      { id: 'sm4', name: 'Salmon, potatoes & greens', items: [{ foodId: 'salmon_r', g: 130 }, { foodId: 'potato_r', g: 250 }, { foodId: 'greens', g: 60 }], fav: false, uses: 6 },
      { id: 'sm5', name: 'Restaurant: poke bowl (estimate)', items: [], estimate: { kcal: 640, p: 38, c: 78, f: 18 }, fav: false, uses: 2 }
    ];
    s.recipes = [
      { id: 'rc1', name: 'Turkey-lentil chili', ingredients: [{ foodId: 'beef_r', g: 900 }, { foodId: 'lentil_r', g: 250 }, { foodId: 'peppers', g: 300 }, { foodId: 'oil', g: 15 }], cookedWeight: 2650, servings: 6, byWeight: false, fav: true },
      { id: 'rc2', name: 'Overnight protein oats', ingredients: [{ foodId: 'oats', g: 200 }, { foodId: 'whey', g: 60 }, { foodId: 'yog', g: 400 }, { foodId: 'blueb', g: 200 }], cookedWeight: 1150, servings: 4, byWeight: false, fav: false }
    ];
    s.prep = [{ id: 'pp1', mealId: 'sm1', kind: 'meal', containers: 5, people: 1, days: 5, version: 'training', actual: {} }, { id: 'pp2', mealId: 'rc1', kind: 'recipe', containers: 6, people: 1, days: 6, version: 'rest', actual: {} }];
    s.reminders = [
      { id: 'r1', type: 'Upcoming workout', time: '15:30', freq: 'Training days', channel: 'Push', snooze: 15, enabled: true, reschedule: true, note: '2 h before session' },
      { id: 'r2', type: 'Start workout', time: '17:30', freq: 'Training days', channel: 'Push', snooze: 10, enabled: true, reschedule: false },
      { id: 'r3', type: 'Missed workout', time: '20:30', freq: 'When missed', channel: 'Push', snooze: 0, enabled: true, reschedule: true },
      { id: 'r4', type: 'Progress check-in', time: '08:00', freq: 'Weekly · Sun', channel: 'Push + email', snooze: 60, enabled: true, reschedule: true },
      { id: 'r5', type: 'Progress photos', time: '08:05', freq: 'Every 2 weeks · Sun', channel: 'Push', snooze: 60, enabled: true, reschedule: true },
      { id: 'r6', type: 'Weight log', time: '07:15', freq: 'Daily', channel: 'Push', snooze: 30, enabled: true, reschedule: false },
      { id: 'r7', type: 'Meal prep', time: '14:00', freq: 'Weekly · Sun', channel: 'Push', snooze: 60, enabled: true, reschedule: true },
      { id: 'r8', type: 'Grocery shopping', time: '10:00', freq: 'Weekly · Sat', channel: 'Push', snooze: 60, enabled: true, reschedule: true },
      { id: 'r9', type: 'Drink water', time: '10:00', freq: 'Every 2 h, 10:00–18:00', channel: 'Push', snooze: 30, enabled: true, reschedule: false },
      { id: 'r10', type: "Prepare tomorrow's meals", time: '21:00', freq: 'Daily', channel: 'Push', snooze: 30, enabled: true, reschedule: false },
      { id: 'r11', type: 'Supplements', time: '08:00', freq: 'Daily', channel: 'Push', snooze: 15, enabled: false, reschedule: false },
      { id: 'r12', type: 'Wind-down routine', time: '22:15', freq: 'Daily', channel: 'Push', snooze: 15, enabled: true, reschedule: false }
    ];
    return s;
  }
  function avgWeight(ws, d, n) { n = n || 7; const a = ws.filter(w => w.date <= d && w.date > add(d, -n)); return a.length ? r1(sum(a.map(w => w.kg)) / a.length) : null; }

  /* ── Store ── */
  let S; const L = new Set(); let photos = {};
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!S || S.v !== 1) S = seed();
  try { localStorage.removeItem('regimen.v1'); } catch (e) { }
  try { photos = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { }
  function save() { try { const c = Object.assign({}, S, { prCache: null }); localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { } }
  function emit() { S.prCache = null; save(); L.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  const RG = window.RG = {
    TODAY, EX, FOODS, QUOTES, DN, DFULL, MN, MFULL, add, dow, diff, fmtD, fmtShort, uid, r1, sum, tagMap,
    get s() { return S; },
    subscribe(f) { L.add(f); return () => L.delete(f); },
    update(fn) { fn(S); emit(); },
    toast(msg) { const id = uid(); S.toast = { msg, id }; emit(); setTimeout(() => { if (S.toast && S.toast.id === id) { S.toast = null; emit(); } }, 3400); },
    go(route, param) { S.route = route; S.routeParam = param == null ? null : param; emit(); try { window.scrollTo(0, 0); } catch (e) { } },
    reset() { S = seed(); photos = {}; try { localStorage.removeItem(PKEY); } catch (e) { } ensureFuture(); emit(); },
    photo(id) { return photos[id] || null; },
    setPhoto(id, dataUrl) { if (dataUrl) photos[id] = dataUrl; else delete photos[id]; try { localStorage.setItem(PKEY, JSON.stringify(photos)); } catch (e) { console.warn('Photo storage full — kept in memory for this session'); } emit(); }
  };
  RG.food = id => FOODS[id] || S.customFoods[id];
  RG.allFoods = () => Object.values(FOODS).concat(Object.values(S.customFoods));

  /* ── Units ── */
  RG.imp = () => S.profile.units === 'imperial';
  RG.wu = () => RG.imp() ? 'lb' : 'kg';
  RG.lu = () => RG.imp() ? 'in' : 'cm';
  RG.w = (kg, dp) => kg == null ? '—' : RG.imp() ? String(Math.round(kg * 2.20462 * (dp === 0 ? 1 : 2)) / (dp === 0 ? 1 : 2)) : String(r1(kg));
  RG.bw = kg => kg == null ? '—' : RG.imp() ? (kg * 2.20462).toFixed(1) : Number(kg).toFixed(1);
  RG.len = cm => cm == null ? '—' : RG.imp() ? String(r1(cm / 2.54)) : String(r1(cm));
  RG.toKg = v => RG.imp() ? v / 2.20462 : v;
  RG.toCm = v => RG.imp() ? v * 2.54 : v;
  RG.g = g => RG.imp() ? `${r1(g / 28.3495)} oz` : `${Math.round(g)} g`;
  RG.num = n => Math.round(n).toLocaleString('en-CA');

  /* ── Plan helpers ── */
  RG.plan = () => S.plans.find(p => p.id === S.activePlanId) || S.plans[0];
  RG.workout = (wid, planId) => { const p = planId ? S.plans.find(x => x.id === planId) : RG.plan(); return p && p.workouts.find(w => w.id === wid); };
  RG.ex = id => EX[id];

  /* ── Schedule ── */
  const inPause = d => S.pauses.some(p => d >= p.from && (!p.to || d <= p.to));
  RG.inPause = inPause;
  RG.activePause = () => S.pauses.find(p => TODAY >= p.from && (!p.to || TODAY <= p.to));
  function nextRotationIndex(fromDate) {
    const plan = RG.plan(); const done = S.schedule.filter(e => e.date < fromDate && e.status === 'done' && e.planId === plan.id).sort((a, b) => a.date < b.date ? -1 : 1);
    const last = done[done.length - 1]; if (!last) return 0; return (plan.rotation.indexOf(last.workoutId) + 1) % plan.rotation.length;
  }
  function recoveryClash(date, wid, ignoreId) {
    const plan = RG.plan(); if (plan.allowConsecutive) return null; const w = RG.workout(wid); if (!w) return null;
    for (const o of [-1, 1]) {
      const e = S.schedule.find(x => x.date === add(date, o) && x.id !== ignoreId && x.status !== 'skipped' && x.status !== 'missed');
      if (e) { const w2 = RG.workout(e.workoutId, e.planId); if (w2 && w2.region === w.region && w.region !== 'core') return { date: e.date, name: w2.name }; }
    }
    return null;
  }
  RG.recoveryClash = recoveryClash;
  function fill(fromDate, idx, untilDate) {
    const plan = RG.plan(); let d = fromDate; let guard = 0;
    while (d <= untilDate && guard++ < 400) {
      if (S.profile.trainingDays.includes(dow(d)) && !inPause(d) && !S.schedule.some(e => e.date === d && e.status !== 'skipped' && e.status !== 'missed')) {
        const wid = plan.rotation[idx % plan.rotation.length];
        if (!recoveryClash(d, wid)) { S.schedule.push({ id: uid(), date: d, workoutId: wid, planId: plan.id, status: 'planned', origin: 'auto' }); idx++; }
      }
      d = add(d, 1);
    }
  }
  function regenerate(fromDate) {
    const planned = S.schedule.filter(e => e.status === 'planned' && e.date >= fromDate).sort((a, b) => a.date < b.date ? -1 : 1);
    const plan = RG.plan();
    const idx = planned.length && planned[0].planId === plan.id ? plan.rotation.indexOf(planned[0].workoutId) : nextRotationIndex(fromDate);
    S.schedule = S.schedule.filter(e => !(e.status === 'planned' && e.date >= fromDate && e.origin === 'auto'));
    fill(fromDate, Math.max(0, idx), add(TODAY, 70));
  }
  function ensureFuture() { if (!S.schedule.some(e => e.date >= TODAY && e.status === 'planned')) fill(TODAY, nextRotationIndex(TODAY), add(TODAY, 70)); }
  ensureFuture();
  RG.regenerate = from => { regenerate(from || TODAY); emit(); };
  RG.entriesOn = d => S.schedule.filter(e => e.date === d).sort((a, b) => (a.status === 'missed') - (b.status === 'missed'));
  RG.entry = id => S.schedule.find(e => e.id === id);
  RG.todayEntry = () => S.schedule.find(e => e.date === TODAY && (e.status === 'planned' || e.status === 'done'));
  RG.nextEntry = (after) => S.schedule.filter(e => e.status === 'planned' && e.date > (after || TODAY)).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  RG.moveEntry = (id, newDate, shift) => {
    const e = RG.entry(id); if (!e || e.status === 'done') return { error: 'Completed workouts stay on the day they were logged.' };
    const oldDate = e.date; const shiftLater = shift == null ? S.profile.shiftLater : shift;
    const occupant = S.schedule.find(x => x.date === newDate && x.id !== id && x.status === 'planned');
    let note = '';
    if (occupant && !shiftLater) { occupant.date = oldDate; note = `Swapped with ${RG.workout(occupant.workoutId).name}.`; e.date = newDate; }
    else if (shiftLater && newDate > oldDate) {
      const later = S.schedule.filter(x => x.status === 'planned' && x.date > oldDate && x.id !== id).sort((a, b) => a.date < b.date ? -1 : 1);
      e.date = newDate; let cursor = newDate;
      later.forEach(x => { if (x.date <= cursor) { let d = add(cursor, 1); let g = 0; while ((!S.profile.trainingDays.includes(dow(d)) || inPause(d)) && g++ < 14) d = add(d, 1); x.date = d; cursor = d; } else cursor = x.date; });
      note = later.length ? 'Later sessions shifted to keep the rotation.' : '';
    } else { if (occupant) occupant.date = oldDate; e.date = newDate; }
    e.origin = 'manual';
    const clash = recoveryClash(newDate, e.workoutId, e.id);
    emit();
    return { note, warning: clash ? `${RG.workout(e.workoutId).name} is next to ${clash.name} (${fmtD(clash.date)}) — same muscle groups on consecutive days.` : '' };
  };
  RG.swapEntries = (a, b) => { const A = RG.entry(a), B = RG.entry(b); if (!A || !B) return; const t = A.date; A.date = B.date; B.date = t; A.origin = B.origin = 'manual'; emit(); };
  RG.skipEntry = id => { const e = RG.entry(id); if (e && e.status === 'planned') { e.status = 'skipped'; emit(); } };
  RG.missEntry = id => { const e = RG.entry(id); if (e && e.status === 'planned') { e.status = 'missed'; emit(); } };
  RG.restoreEntry = id => { const e = RG.entry(id); if (e && (e.status === 'skipped' || e.status === 'missed')) { e.status = 'planned'; emit(); } };
  RG.rescheduleMissed = (id, date) => { const e = RG.entry(id); if (!e) return; const n = { id: uid(), date, workoutId: e.workoutId, planId: e.planId, status: 'planned', origin: 'rescheduled', from: e.id }; e.rescheduledTo = n.id; S.schedule.push(n); emit(); };
  RG.pause = (from, to, reason) => { S.pauses.push({ id: uid(), from, to: to || null, reason }); const planned = S.schedule.filter(e => e.status === 'planned' && e.date >= from).sort((a, b) => a.date < b.date ? -1 : 1); const idx = planned.length ? RG.plan().rotation.indexOf(planned[0].workoutId) : nextRotationIndex(from); S.schedule = S.schedule.filter(e => !(e.status === 'planned' && e.date >= from)); fill(from, Math.max(0, idx), add(TODAY, 70)); emit(); };
  RG.resume = () => { const p = RG.activePause() || S.pauses.find(p => !p.to); if (!p) return; const planned = S.schedule.filter(e => e.status === 'planned' && e.date >= TODAY).sort((a, b) => a.date < b.date ? -1 : 1); const idx = planned.length ? RG.plan().rotation.indexOf(planned[0].workoutId) : nextRotationIndex(TODAY); p.to = add(TODAY, -1); if (p.to < p.from) S.pauses = S.pauses.filter(x => x !== p); S.schedule = S.schedule.filter(e => !(e.status === 'planned' && e.date >= TODAY)); fill(TODAY, Math.max(0, idx), add(TODAY, 70)); emit(); };
  RG.weekStats = (mon) => { const ents = S.schedule.filter(e => e.date >= mon && e.date <= add(mon, 6) && e.origin !== 'rescheduled' || (e.origin === 'rescheduled' && e.date >= mon && e.date <= add(mon, 6) && false)); const all = S.schedule.filter(e => e.date >= mon && e.date <= add(mon, 6)); const done = all.filter(e => e.status === 'done').length; const total = all.filter(e => e.status !== 'missed' || !e.rescheduledTo).filter(e => e.status !== 'skipped').length; return { done, total: Math.max(total, done), missed: all.filter(e => e.status === 'missed').length, skipped: all.filter(e => e.status === 'skipped').length, pct: total ? Math.round(done / total * 100) : 0, ents }; };
  RG.monday = d => add(d || TODAY, -dow(d || TODAY));
  RG.streak = () => { const past = S.schedule.filter(e => e.date <= TODAY && e.status !== 'planned' && e.status !== 'skipped').sort((a, b) => a.date < b.date ? 1 : -1); let n = 0; for (const e of past) { if (e.status === 'done') n++; else if (e.status === 'missed' && !e.rescheduledTo) break; else if (e.status === 'missed') continue; } return n; };
  RG.icsExport = () => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Regimen//Fitness//EN'];
    S.schedule.filter(e => e.status === 'planned').forEach(e => { const w = RG.workout(e.workoutId, e.planId); const [h, m] = S.profile.workoutTime.split(':'); const dt = e.date.replace(/-/g, '') + 'T' + h + m + '00'; lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@regimen', 'DTSTART:' + dt, 'DURATION:PT' + S.profile.duration + 'M', 'SUMMARY:' + w.name, 'END:VEVENT'); });
    lines.push('END:VCALENDAR'); return lines.join('\r\n');
  };

  /* ── History / progression ── */
  RG.history = exId => S.sessions.filter(s => s.sets.some(x => x.exId === exId && !x.warm)).sort((a, b) => a.date < b.date ? -1 : 1).map(s => ({ date: s.date, sessionId: s.id, workoutId: s.workoutId, sets: s.sets.filter(x => x.exId === exId && !x.warm) }));
  RG.lastPerf = exId => { const h = RG.history(exId); return h[h.length - 1] || null; };
  RG.e1rm = (kg, reps) => kg * (1 + reps / 30);
  RG.prs = exId => {
    const h = RG.history(exId); if (!h.length) return null;
    let heavy = null, e1 = null, vol = null, best = null; const repsAt = {};
    h.forEach(s => { let v = 0; s.sets.forEach(x => { v += x.kg * x.reps; if (!heavy || x.kg > heavy.kg || (x.kg === heavy.kg && x.reps > heavy.reps)) heavy = { kg: x.kg, reps: x.reps, date: s.date }; const e = RG.e1rm(x.kg, x.reps); if (!e1 || e > e1.v) e1 = { v: e, kg: x.kg, reps: x.reps, date: s.date }; if (!repsAt[x.kg] || x.reps > repsAt[x.kg].reps) repsAt[x.kg] = { reps: x.reps, date: s.date }; }); if (!vol || v > vol.v) vol = { v, date: s.date }; const tot = sum(s.sets.map(x => x.reps)); const sc = s.sets[0].kg * tot; if (!best || sc > best.sc) best = { sc, kg: s.sets[0].kg, reps: s.sets.map(x => x.reps), date: s.date }; });
    return { heavy, e1, vol, best, repsAt };
  };
  RG.planItemFor = exId => { for (const w of RG.plan().workouts) for (const i of w.items) if (i.exId === exId) return { item: i, workout: w }; return null; };
  RG.recommend = (exId, item) => {
    item = item || (RG.planItemFor(exId) || {}).item; if (!item) return null;
    const h = RG.history(exId); const inc = S.profile.increments[EX[exId].equip] ?? 2.5;
    if (!h.length) {
      const rep = item.replaced && item.replaced.length ? RG.lastPerf(item.replaced[item.replaced.length - 1].exId) : null;
      return { type: 'baseline', kg: null, reps: Array(item.sets).fill(item.repMin), reason: rep ? `New exercise — replaces ${EX[item.replaced[item.replaced.length - 1].exId].name}. Pick a weight you can do for ${item.repMin}–${item.repMax} at RIR ${item.rir}; this session sets the baseline.` : `No history yet. Choose a weight for ${item.repMin}–${item.repMax} reps at RIR ${item.rir}.` };
    }
    const last = h[h.length - 1]; const prev = h[h.length - 2]; const kg = last.sets[0].kg; const reps = last.sets.map(x => x.reps);
    const rirOk = last.sets.every(x => x.rir == null || x.rir >= item.rir - 1);
    const allTop = reps.length >= item.sets && reps.every(r => r >= item.repMax);
    const anyBelow = reps.some(r => r < item.repMin);
    const prevBelow = prev && prev.sets[0].kg === kg && prev.sets.some(x => x.reps < item.repMin);
    const rule = S.profile.progression;
    if (rule === 'linear' && !anyBelow && rirOk) return { type: 'increase', kg: r1(kg + inc), reps: Array(item.sets).fill(item.repMin), reason: `Linear rule: all sets reached ${item.repMin}+. Add ${RG.w(inc)} ${RG.wu()}.` };
    if (allTop && rirOk) return { type: 'increase', kg: r1(kg + inc), reps: Array(item.sets).fill(item.repMin), reason: `All ${reps.length} sets hit ${item.repMax} at RIR ${item.rir}+. Add the smallest available increment (${RG.w(inc)} ${RG.wu()}) and restart at ${item.repMin}.` };
    if (allTop && !rirOk) return { type: 'hold', kg, reps: reps.map(() => item.repMax), reason: `Top of range reached, but effort was harder than RIR ${item.rir}. Repeat at the same weight before adding load.` };
    if (anyBelow && prevBelow) return { type: 'reduce', kg: r1(Math.max(0, kg - Math.max(inc, Math.round(kg * 0.05 / (inc || 1)) * (inc || 1)))), reps: Array(item.sets).fill(item.repMin + 1), reason: `Below ${item.repMin} reps two sessions running. Drop ~5% and rebuild through the range.` };
    if (anyBelow) return { type: 'hold', kg, reps: reps.map(r => Math.max(item.repMin, r)), reason: `${reps.filter(r => r < item.repMin).length} set(s) fell short of ${item.repMin}. Keep ${RG.w(kg)} ${RG.wu()} and aim to reach ${item.repMin} on every set.` };
    const tgt = reps.map((r, i) => Math.min(item.repMax, r + 1));
    return { type: 'hold', kg, reps: tgt, reason: `Within range. Keep ${RG.w(kg)} ${RG.wu()} and add a rep where you can (target ${tgt.join(', ')}).` };
  };

  /* ── Active workout ── */
  RG.startWorkout = entryId => {
    const e = RG.entry(entryId) || RG.todayEntry(); if (!e) return;
    if (S.active && S.active.entryId === e.id) { RG.go('workout'); return; }
    const w = RG.workout(e.workoutId, e.planId);
    S.active = {
      entryId: e.id, workoutId: w.id, planId: e.planId, date: e.date, startedAt: Date.now(), restEnd: null, restFor: null,
      ex: w.items.map(item => {
        const rec = RG.recommend(item.exId, item) || {}; const kg = rec.kg ?? (RG.lastPerf(item.exId) || { sets: [{ kg: START_KG[item.exId] || 10 }] }).sets[0].kg;
        const sets = [];
        for (let j = 0; j < item.warmups; j++) sets.push({ id: uid(), kg: r1(kg * (j === 0 ? 0.5 : 0.7)), reps: j === 0 ? 8 : 5, rir: null, warm: true, done: false, note: '', feel: '' });
        for (let j = 0; j < item.sets; j++) sets.push({ id: uid(), kg, reps: null, target: (rec.reps || [])[j] ?? item.repMin, rir: item.rir, warm: false, done: false, note: '', feel: '' });
        return { key: uid(), itemId: item.id, exId: item.exId, originalExId: item.exId, rec, recState: 'pending', sets, note: '', feel: '' };
      })
    };
    RG.go('workout');
  };
  RG.finishWorkout = () => {
    const a = S.active; if (!a) return;
    const sets = []; a.ex.forEach(x => x.sets.filter(st => st.done && st.reps).forEach(st => sets.push({ exId: x.exId, kg: Number(st.kg) || 0, reps: Number(st.reps), rir: st.rir === '' ? null : st.rir, warm: st.warm, note: st.note, feel: st.feel, sub: x.exId !== x.originalExId ? x.originalExId : undefined })));
    const ses = { id: uid(), date: a.date, workoutId: a.workoutId, planId: a.planId, entryId: a.entryId, sets, durationMin: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)), notes: a.ex.map(x => x.note).filter(Boolean).join(' · ') };
    const e = RG.entry(a.entryId);
    if (sets.length) { S.sessions.push(ses); if (e) { e.status = 'done'; e.sessionId = ses.id; } }
    S.active = null; emit(); return ses;
  };
  RG.discardWorkout = () => { S.active = null; emit(); };

  /* ── Plan editing ── */
  RG.replaceExercise = (planId, workoutId, itemId, newExId) => { const w = RG.workout(workoutId, planId); const i = w.items.find(x => x.id === itemId); i.replaced.push({ exId: i.exId, date: TODAY }); i.exId = newExId; emit(); };

  /* ── Nutrition ── */
  RG.macros = (foodId, g) => { const f = RG.food(foodId); if (!f) return { kcal: 0, p: 0, c: 0, f: 0 }; const k = g / 100; return { kcal: f.kcal * k, p: f.p * k, c: f.c * k, f: f.f * k }; };
  RG.sumM = items => items.reduce((a, i) => { const m = i.estimate ? i.estimate : RG.macros(i.foodId, i.g); return { kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }; }, { kcal: 0, p: 0, c: 0, f: 0 });
  function reconcile(total, weights) {
    const W = sum(weights) || 1; const raw = weights.map(w => total * w / W); const fl = raw.map(Math.floor); let rem = total - sum(fl);
    raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } }); return fl;
  }
  RG.reconcile = reconcile;
  RG.dayType = d => S.days[d] && S.days[d].type ? S.days[d].type : (S.schedule.some(e => e.date === d && (e.status === 'planned' || e.status === 'done')) ? 'training' : 'rest');
  RG.mealTargets = (type, mode) => {
    const P = S.profile, n = P.mealsPerDay, dist = S.distribution; mode = mode || dist.mode;
    const slots = (S.mealSlots[type] || S.mealSlots.training).slice(0, n);
    while (slots.length < n) slots.push({ name: 'Meal ' + (slots.length + 1), label: 'Meal', time: '' });
    let wp = Array(n).fill(1), wc = Array(n).fill(1), wf = Array(n).fill(1);
    if (mode === 'custom') { wp = wc = wf = dist.custom.slice(0, n).concat(Array(Math.max(0, n - dist.custom.length)).fill(0)); }
    if (mode === 'prepost' && type === 'training') { wc = wc.map((_, i) => i === dist.preIdx ? 1.3 : i === dist.postIdx ? 1.25 : 0.8); wf = wf.map((_, i) => i === dist.preIdx ? 0.6 : i === dist.postIdx ? 0.9 : 1.15); }
    if (mode === 'protein') wp = wp.map((_, i) => dist.proteinIdx.includes(i) ? 1.4 : 0.8);
    let p = reconcile(P.protein, wp), c = reconcile(P.carbs, wc), f = reconcile(P.fat, wf);
    if (mode === 'manual' && dist.manual && dist.manual.length === n) { p = dist.manual.map(m => m.p); c = dist.manual.map(m => m.c); f = dist.manual.map(m => m.f); }
    return slots.map((s, i) => ({ ...s, p: p[i], c: c[i], f: f[i], kcal: p[i] * 4 + c[i] * 4 + f[i] * 9 }));
  };
  RG.solve = (items, target) => {
    const free = items.filter(i => !i.locked && !i.estimate);
    const lk = RG.sumM(items.filter(i => i.locked));
    const t = [target.p - lk.p, target.c - lk.c, target.f - lk.f]; const w = [1.3, 1, 4];
    const A = free.map(i => { const f = RG.food(i.foodId); return [f.p / 100, f.c / 100, f.f / 100]; });
    let x = free.map(i => Math.max(10, i.g || 100));
    for (let it = 0; it < 600; it++) {
      for (let j = 0; j < x.length; j++) {
        const r = [0, 1, 2].map(k => sum(x.map((xi, q) => xi * A[q][k])) - t[k]);
        const g = sum([0, 1, 2].map(k => w[k] * A[j][k] * r[k])); const h = sum([0, 1, 2].map(k => w[k] * A[j][k] * A[j][k])) + 1e-6;
        x[j] = Math.min(700, Math.max(0, x[j] - g / h));
      }
    }
    const out = items.map(i => ({ ...i })); let j = 0;
    items.forEach((i, idx) => { if (i.locked || i.estimate) return; const f = RG.food(i.foodId); const step = f.f > 50 ? 1 : 5; out[idx].g = Math.round(x[j++] / step) * step; });
    return out;
  };
  RG.getDay = d => {
    if (!S.days[d]) {
      const type = RG.dayType(d); const tg = RG.mealTargets(type);
      const tpl = type === 'training' ? [['sm2'], ['chicken_c', 'rice_c', 'avocado'], ['turkey', 'tortilla', 'banana'], ['salmon_r', 'potato_r', 'broccoli_c']] : [['eggs', 'bread', 'blueb'], ['tuna', 'quinoa_c', 'avocado'], ['cottage', 'blueb', 'almonds'], ['chicken_c', 'sweet_c', 'broccoli_c']];
      const meals = tg.map((t, i) => {
        let items = (tpl[i] || ['chicken_c', 'rice_c', 'oil']).flatMap(x => x.startsWith('sm') ? S.savedMeals.find(m => m.id === x).items.map(q => ({ ...q })) : [{ foodId: x, g: 100 }]);
        items = items.map(q => ({ ...q, key: uid(), locked: false }));
        const veg = items.find(q => RG.food(q.foodId).role === 'veg'); if (veg) { veg.g = 100; veg.locked = true; }
        items = RG.solve(items, t); if (veg) veg.locked = false; items.forEach(q => { if (RG.food(q.foodId).role === 'veg') q.locked = false; });
        return { key: uid(), items, logged: false, prepped: false };
      });
      S.days[d] = { type, meals, water: 0 };
      if (d === TODAY) { meals[0].logged = true; meals[1].logged = true; meals[1].prepped = true; meals[2].prepped = true; S.days[d].water = 1250; }
    }
    const dd = S.days[d]; const nM = Math.min(6, Math.max(1, Number(S.profile.mealsPerDay) || 4));
    while (dd.meals.length < nM) dd.meals.push({ key: uid(), items: [], logged: false, prepped: false });
    while (dd.meals.length > nM && !dd.meals[dd.meals.length - 1].logged) dd.meals.pop();
    return dd;
  };
  RG.dayTotals = d => { const day = RG.getDay(d); const planned = RG.sumM(day.meals.flatMap(m => m.items)); const logged = RG.sumM(day.meals.filter(m => m.logged).flatMap(m => m.items)); return { planned, logged }; };
  RG.alternatives = (foodId, g, opts) => {
    opts = opts || {}; const src = RG.food(foodId); const m0 = RG.macros(foodId, g); const P = S.profile;
    const key = src.role === 'protein' ? 'p' : src.role === 'carb' ? 'c' : src.role === 'fat' ? 'f' : 'kcal';
    return RG.allFoods().filter(f => f.id !== foodId && f.name !== src.name && !(P.exclude || []).some(x => f.name.toLowerCase().includes(x.toLowerCase())) && !(P.allergies || []).some(a => f.name.toLowerCase().includes(a.toLowerCase())))
      .filter(f => !opts.tag || f.tags.includes(opts.tag))
      .map(f => {
        const per = key === 'kcal' ? f.kcal : f[key]; if (!per || per < (key === 'kcal' ? 5 : 1)) return null;
        let sg = m0[key] / per * 100; sg = Math.round(sg / 5) * 5 || 5; const m = RG.macros(f.id, sg);
        const d = { kcal: m.kcal - m0.kcal, p: m.p - m0.p, c: m.c - m0.c, f: m.f - m0.f };
        const dist = Math.abs(d.p) * 1.2 + Math.abs(d.c) + Math.abs(d.f) * 2.2; const role = f.role === src.role ? 0 : 25; const cal = Math.abs(d.kcal) / 12;
        const pref = (P.dietPrefs || []).filter(t => f.tags.includes(t)).length * -4; const silly = sg > 600 ? 40 : 0;
        return { food: f, g: sg, m, d, score: dist + role + cal + pref + silly };
      }).filter(Boolean)
      .filter(a => !opts.lower || a.d.kcal < -10).filter(a => !opts.higher || a.d.kcal > 10)
      .sort((a, b) => a.score - b.score);
  };

  /* ── Meal prep / grocery ── */
  RG.prepSource = p => p.kind === 'recipe' ? S.recipes.find(r => r.id === p.mealId) : S.savedMeals.find(m => m.id === p.mealId);
  RG.recipeNutrition = r => { const tot = RG.sumM(r.ingredients); const raw = sum(r.ingredients.map(i => i.g)); const cw = r.cookedWeight || raw; return { tot, raw, cooked: cw, perServing: { kcal: tot.kcal / r.servings, p: tot.p / r.servings, c: tot.c / r.servings, f: tot.f / r.servings }, servingG: cw / r.servings, per100: { kcal: tot.kcal / cw * 100, p: tot.p / cw * 100, c: tot.c / cw * 100, f: tot.f / cw * 100 } }; };
  RG.prepCalc = p => {
    const src = RG.prepSource(p); if (!src) return null; const n = p.containers * (p.people || 1);
    if (p.kind === 'recipe') {
      const rn = RG.recipeNutrition(src); const scale = n / src.servings;
      const actual = p.actual.total; const cw = actual || rn.cooked * scale;
      return { name: src.name, n, lines: src.ingredients.map(i => { const f = RG.food(i.foodId); return { foodId: i.foodId, name: f.name, basis: f.basis, buyG: i.g * scale, perG: null, est: false }; }), perContainer: { kcal: rn.tot.kcal * scale / n, p: rn.tot.p * scale / n, c: rn.tot.c * scale / n, f: rn.tot.f * scale / n }, batchG: cw, perContainerG: cw / n, estimated: !actual };
    }
    const lines = src.items.map(i => {
      const f = RG.food(i.foodId); const totalAsListed = i.g * n; let rawF = f, buyG = totalAsListed, est = false, expected = null;
      if (f.basis === 'cooked' && f.rawId) { rawF = RG.food(f.rawId); buyG = totalAsListed / f.yld; est = true; expected = totalAsListed; }
      else if (f.basis === 'raw' && f.cookedId) { expected = totalAsListed * f.yld; est = true; }
      const act = p.actual[i.foodId]; const perG = f.basis === 'cooked' ? (act ? act / n : i.g) : (f.cookedId ? (act ? act / n : i.g * f.yld) : i.g);
      return { foodId: i.foodId, name: f.name, basis: f.basis, rawId: rawF.id, rawBasis: rawF.basis, buyG, expected, actual: act || null, perG, perBasis: f.cookedId || f.basis === 'cooked' ? 'cooked' : f.basis, est: est && !act, yld: f.yld };
    });
    const per = RG.sumM(src.items); return { name: src.name, n, lines, perContainer: per, estimated: lines.some(l => l.est) };
  };
  RG.groceryList = () => {
    const agg = {};
    S.prep.forEach(p => { const c = RG.prepCalc(p); if (!c) return; c.lines.forEach(l => { const id = l.rawId || l.foodId; const f = RG.food(id); const k = id; if (!agg[k]) agg[k] = { id: k, name: f.name, basis: f.basis, cat: f.cat, g: 0, est: false, from: [] }; agg[k].g += l.buyG; agg[k].est = agg[k].est || l.est || (RG.food(l.foodId).basis === 'cooked'); agg[k].from.push(c.name); }); });
    return Object.values(agg).map(a => { const f = RG.food(a.id); const b = f.buy; let buy; if (b) { const q = Math.max(1, Math.ceil(a.g / b.g - 0.05)); buy = `${q} × ${b.unit}${b.g ? ` (${RG.g(b.g)})` : ''}`; } else buy = RG.g(Math.ceil(a.g / 50) * 50); return { ...a, buy, from: [...new Set(a.from)] }; }).sort((a, b) => a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : a.name < b.name ? -1 : 1);
  };

  /* ── Quotes ── */
  RG.quoteList = () => QUOTES.map((q, i) => ({ id: 'q' + i, text: q[0], tone: q[1], custom: false })).concat(S.quotes.custom.map(c => ({ ...c, custom: true })));
  RG.todayQuote = (offset) => { const tone = S.profile.quoteTone; let l = RG.quoteList().filter(q => !S.quotes.hidden[q.id] && (tone === 'All' || q.tone === tone || q.custom)); if (!l.length) l = RG.quoteList(); return l[(272 + (offset || 0)) % l.length]; };

  /* ── Charts ── */
  RG.pts = (vals, w, h, lo, hi) => { const mn = lo ?? Math.min(...vals.filter(v => v != null)), mx = hi ?? Math.max(...vals.filter(v => v != null)); const n = vals.length - 1 || 1; return vals.map((v, i) => v == null ? null : `${(i / n * w).toFixed(1)},${(h - (v - mn) / ((mx - mn) || 1) * h).toFixed(1)}`).filter(Boolean).join(' '); };
  RG.rolling = (vals, n) => vals.map((_, i) => { const a = vals.slice(Math.max(0, i - n + 1), i + 1).filter(v => v != null); return a.length ? sum(a) / a.length : null; });
  RG.avgWeight = (d, n) => avgWeight(S.weights, d || TODAY, n);
  RG.logWeight = (kg, date) => { date = date || TODAY; const e = S.weights.find(w => w.date === date); if (e) e.kg = r1(kg); else S.weights.push({ date, kg: r1(kg) }); S.weights.sort((a, b) => a.date < b.date ? -1 : 1); S.profile.weightKg = RG.avgWeight(TODAY); emit(); };
  RG.nextCheckIn = () => { const last = S.checkins.map(c => c.date).sort().pop() || TODAY; const step = S.profile.checkInFreq === 'Monthly' ? 28 : S.profile.checkInFreq === 'Biweekly' ? 14 : 7; let d = add(last, step); let g = 0; while (d < TODAY && g++ < 400) d = add(d, step); const cd = Number(S.profile.checkInDay) || 0; g = 0; while (dow(d) !== cd && g++ < 7) d = add(d, 1); return d; };
})();
