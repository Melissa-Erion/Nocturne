/* Exercise library — ported from prototype/store.js (EX). Also seeded into the `exercises` table. */
import type { Exercise } from '../types';

export const EX: Record<string, Exercise> = {
  "squat": {
    "id": "squat",
    "name": "Back squat",
    "muscle": "Quads",
    "region": "lower",
    "equip": "Barbell",
    "instr": "Bar on upper back, brace, sit down between the hips to depth you control, drive up through mid-foot.",
    "alts": [
      "hack",
      "legpress",
      "goblet"
    ]
  },
  "rdl": {
    "id": "rdl",
    "name": "Romanian deadlift",
    "muscle": "Hamstrings",
    "region": "lower",
    "equip": "Barbell",
    "instr": "Soft knees, push hips back keeping the bar close, stop when hamstrings limit range, stand tall.",
    "alts": [
      "dbrdl",
      "legcurl"
    ]
  },
  "legpress": {
    "id": "legpress",
    "name": "Leg press",
    "muscle": "Quads",
    "region": "lower",
    "equip": "Machine",
    "instr": "Feet mid-platform, lower until hips start to tuck, press without locking knees hard.",
    "alts": [
      "hack",
      "squat"
    ]
  },
  "legcurl": {
    "id": "legcurl",
    "name": "Lying leg curl",
    "muscle": "Hamstrings",
    "region": "lower",
    "equip": "Machine",
    "instr": "Hips pinned, curl to full flexion, 2 s lowering.",
    "alts": [
      "seatcurl",
      "rdl"
    ]
  },
  "calf": {
    "id": "calf",
    "name": "Standing calf raise",
    "muscle": "Calves",
    "region": "lower",
    "equip": "Machine",
    "instr": "Full stretch at the bottom, pause, rise onto big toe.",
    "alts": []
  },
  "crunch": {
    "id": "crunch",
    "name": "Cable crunch",
    "muscle": "Core",
    "region": "core",
    "equip": "Cable",
    "instr": "Kneel, rope by ears, flex the spine toward the floor, hips still.",
    "alts": [
      "kneeraise"
    ]
  },
  "incdb": {
    "id": "incdb",
    "name": "Incline DB press",
    "muscle": "Chest",
    "region": "upper",
    "equip": "Dumbbell",
    "instr": "Bench at 30°, shoulder blades set, lower to chest level, press slightly inward.",
    "alts": [
      "incbar",
      "bench",
      "fly"
    ]
  },
  "csrow": {
    "id": "csrow",
    "name": "Chest-supported row",
    "muscle": "Upper back",
    "region": "upper",
    "equip": "Dumbbell",
    "instr": "Chest on incline pad, row elbows toward hips, pause at the top.",
    "alts": [
      "dbrow",
      "cablerow"
    ]
  },
  "pulldown": {
    "id": "pulldown",
    "name": "Lat pulldown",
    "muscle": "Lats",
    "region": "upper",
    "equip": "Cable",
    "instr": "Slight lean back, drive elbows down to ribs, control the return to a full stretch.",
    "alts": [
      "ngpull",
      "pullup"
    ]
  },
  "dbsp": {
    "id": "dbsp",
    "name": "Seated DB shoulder press",
    "muscle": "Shoulders",
    "region": "upper",
    "equip": "Dumbbell",
    "instr": "Back supported, press up and slightly in, lower to ear height.",
    "alts": [
      "machsp"
    ]
  },
  "lateral": {
    "id": "lateral",
    "name": "Cable lateral raise",
    "muscle": "Shoulders",
    "region": "upper",
    "equip": "Cable",
    "instr": "Lead with the elbow, raise to shoulder height, slow lowering.",
    "alts": [
      "dblateral"
    ]
  },
  "pushdown": {
    "id": "pushdown",
    "name": "Rope pushdown",
    "muscle": "Triceps",
    "region": "upper",
    "equip": "Cable",
    "instr": "Elbows fixed at sides, extend and split the rope at the bottom.",
    "alts": [
      "ohext"
    ]
  },
  "hipthrust": {
    "id": "hipthrust",
    "name": "Barbell hip thrust",
    "muscle": "Glutes",
    "region": "lower",
    "equip": "Barbell",
    "instr": "Upper back on bench, chin tucked, drive through heels to full hip extension, pause 1 s.",
    "alts": [
      "glutebridge",
      "machthrust"
    ]
  },
  "bss": {
    "id": "bss",
    "name": "Bulgarian split squat",
    "muscle": "Glutes",
    "region": "lower",
    "equip": "Dumbbell",
    "instr": "Rear foot on bench, torso slightly forward, lower under control. Weight is per dumbbell.",
    "alts": [
      "lunge",
      "legpress"
    ]
  },
  "hack": {
    "id": "hack",
    "name": "Hack squat",
    "muscle": "Quads",
    "region": "lower",
    "equip": "Machine",
    "instr": "Feet shoulder width, lower to depth, press through the whole foot.",
    "alts": [
      "legpress",
      "squat"
    ]
  },
  "seatcurl": {
    "id": "seatcurl",
    "name": "Seated leg curl",
    "muscle": "Hamstrings",
    "region": "lower",
    "equip": "Machine",
    "instr": "Lean forward slightly for more stretch, curl fully, control up.",
    "alts": [
      "legcurl"
    ]
  },
  "abduct": {
    "id": "abduct",
    "name": "Hip abduction",
    "muscle": "Glutes",
    "region": "lower",
    "equip": "Machine",
    "instr": "Slight forward lean, push knees out, pause at the end.",
    "alts": []
  },
  "kneeraise": {
    "id": "kneeraise",
    "name": "Hanging knee raise",
    "muscle": "Core",
    "region": "core",
    "equip": "Bodyweight",
    "instr": "Posterior pelvic tilt, raise knees to chest, no swing.",
    "alts": [
      "crunch"
    ]
  },
  "bench": {
    "id": "bench",
    "name": "Bench press",
    "muscle": "Chest",
    "region": "upper",
    "equip": "Barbell",
    "instr": "Feet planted, slight arch, touch low chest, press back over shoulders.",
    "alts": [
      "incdb",
      "machpress"
    ]
  },
  "dbrow": {
    "id": "dbrow",
    "name": "One-arm DB row",
    "muscle": "Upper back",
    "region": "upper",
    "equip": "Dumbbell",
    "instr": "Hand and knee on bench, row toward hip, full stretch at the bottom.",
    "alts": [
      "csrow",
      "cablerow"
    ]
  },
  "ngpull": {
    "id": "ngpull",
    "name": "Neutral-grip pulldown",
    "muscle": "Lats",
    "region": "upper",
    "equip": "Cable",
    "instr": "Neutral handle, chest up, elbows to ribs.",
    "alts": [
      "pulldown"
    ]
  },
  "fly": {
    "id": "fly",
    "name": "Machine chest fly",
    "muscle": "Chest",
    "region": "upper",
    "equip": "Machine",
    "instr": "Soft elbows, hug the arc, squeeze, slow return.",
    "alts": []
  },
  "facepull": {
    "id": "facepull",
    "name": "Face pull",
    "muscle": "Rear delts",
    "region": "upper",
    "equip": "Cable",
    "instr": "Rope at face height, pull to forehead, rotate thumbs back.",
    "alts": []
  },
  "ezcurl": {
    "id": "ezcurl",
    "name": "EZ-bar curl",
    "muscle": "Biceps",
    "region": "upper",
    "equip": "Barbell",
    "instr": "Elbows still, curl up, 2 s down.",
    "alts": [
      "dbcurl"
    ]
  },
  "goblet": {
    "id": "goblet",
    "name": "Goblet squat",
    "muscle": "Quads",
    "region": "lower",
    "equip": "Dumbbell",
    "instr": "Hold DB at chest, sit between hips, elbows inside knees.",
    "alts": [
      "squat"
    ]
  },
  "dbrdl": {
    "id": "dbrdl",
    "name": "DB Romanian deadlift",
    "muscle": "Hamstrings",
    "region": "lower",
    "equip": "Dumbbell",
    "instr": "As the barbell RDL, dumbbells along the thighs.",
    "alts": [
      "rdl"
    ]
  },
  "incbar": {
    "id": "incbar",
    "name": "Incline barbell press",
    "muscle": "Chest",
    "region": "upper",
    "equip": "Barbell",
    "instr": "30° bench, bar to upper chest.",
    "alts": [
      "incdb"
    ]
  },
  "machpress": {
    "id": "machpress",
    "name": "Machine chest press",
    "muscle": "Chest",
    "region": "upper",
    "equip": "Machine",
    "instr": "Handles at mid-chest, press without shrugging.",
    "alts": [
      "bench"
    ]
  },
  "cablerow": {
    "id": "cablerow",
    "name": "Seated cable row",
    "muscle": "Upper back",
    "region": "upper",
    "equip": "Cable",
    "instr": "Tall chest, row to lower ribs, stretch forward.",
    "alts": [
      "csrow"
    ]
  },
  "pullup": {
    "id": "pullup",
    "name": "Assisted pull-up",
    "muscle": "Lats",
    "region": "upper",
    "equip": "Machine",
    "instr": "Weight shown is assistance — lower is harder.",
    "alts": [
      "pulldown"
    ]
  },
  "machsp": {
    "id": "machsp",
    "name": "Machine shoulder press",
    "muscle": "Shoulders",
    "region": "upper",
    "equip": "Machine",
    "instr": "Seat so handles start at shoulder height.",
    "alts": [
      "dbsp"
    ]
  },
  "dblateral": {
    "id": "dblateral",
    "name": "DB lateral raise",
    "muscle": "Shoulders",
    "region": "upper",
    "equip": "Dumbbell",
    "instr": "Slight lean forward, raise to shoulder height.",
    "alts": [
      "lateral"
    ]
  },
  "ohext": {
    "id": "ohext",
    "name": "Overhead cable extension",
    "muscle": "Triceps",
    "region": "upper",
    "equip": "Cable",
    "instr": "Face away, elbows forward, extend fully.",
    "alts": [
      "pushdown"
    ]
  },
  "glutebridge": {
    "id": "glutebridge",
    "name": "DB glute bridge",
    "muscle": "Glutes",
    "region": "lower",
    "equip": "Dumbbell",
    "instr": "Floor bridge with DB on hips.",
    "alts": [
      "hipthrust"
    ]
  },
  "machthrust": {
    "id": "machthrust",
    "name": "Hip thrust machine",
    "muscle": "Glutes",
    "region": "lower",
    "equip": "Machine",
    "instr": "Pad across hips, drive to lockout.",
    "alts": [
      "hipthrust"
    ]
  },
  "lunge": {
    "id": "lunge",
    "name": "Walking lunge",
    "muscle": "Glutes",
    "region": "lower",
    "equip": "Dumbbell",
    "instr": "Long step, back knee toward floor. Weight per dumbbell.",
    "alts": [
      "bss"
    ]
  },
  "dbcurl": {
    "id": "dbcurl",
    "name": "Incline DB curl",
    "muscle": "Biceps",
    "region": "upper",
    "equip": "Dumbbell",
    "instr": "Arms hang behind torso, curl without swinging.",
    "alts": [
      "ezcurl"
    ]
  },
  "deadlift": {
    "id": "deadlift",
    "name": "Conventional deadlift",
    "muscle": "Posterior chain",
    "region": "lower",
    "equip": "Barbell",
    "instr": "Bar over mid-foot, wedge in, push the floor away.",
    "alts": [
      "rdl"
    ]
  },
  "legext": {
    "id": "legext",
    "name": "Leg extension",
    "muscle": "Quads",
    "region": "lower",
    "equip": "Machine",
    "instr": "Pause at the top, 3 s lowering.",
    "alts": []
  }
};
