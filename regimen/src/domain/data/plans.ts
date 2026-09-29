/* Default plans — ported from prototype/store.js. Always deep-clone before putting into state. */
import type { Plan } from '../types';

export const PLAN_UL4: Plan = {
  "id": "ul4",
  "name": "Upper / Lower · 4 day",
  "note": "Double progression. Hit the top of the range on every working set at the target RIR, then add the smallest increment.",
  "workouts": [
    {
      "id": "L1",
      "name": "Lower Body 1",
      "focus": "Quads · Hamstrings",
      "muscles": [
        "Quads",
        "Hamstrings",
        "Calves",
        "Core"
      ],
      "region": "lower",
      "items": [
        {
          "id": "ul4-L1-1",
          "exId": "squat",
          "sets": 3,
          "repMin": 6,
          "repMax": 8,
          "rir": 2,
          "rest": 150,
          "tempo": "3-0-1-0",
          "warmups": 2,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L1-2",
          "exId": "rdl",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 1,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L1-3",
          "exId": "legpress",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L1-4",
          "exId": "legcurl",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 1,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L1-5",
          "exId": "calf",
          "sets": 3,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "A",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L1-6",
          "exId": "crunch",
          "sets": 2,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "A",
          "notes": "",
          "replaced": []
        }
      ]
    },
    {
      "id": "U1",
      "name": "Upper Body 1",
      "focus": "Chest · Back",
      "muscles": [
        "Chest",
        "Upper back",
        "Lats",
        "Shoulders",
        "Triceps"
      ],
      "region": "upper",
      "items": [
        {
          "id": "ul4-U1-1",
          "exId": "incdb",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 1,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U1-2",
          "exId": "csrow",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U1-3",
          "exId": "pulldown",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 2,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U1-4",
          "exId": "dbsp",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U1-5",
          "exId": "lateral",
          "sets": 2,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "A",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U1-6",
          "exId": "pushdown",
          "sets": 2,
          "repMin": 10,
          "repMax": 12,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "A",
          "notes": "",
          "replaced": []
        }
      ]
    },
    {
      "id": "L2",
      "name": "Lower Body 2",
      "focus": "Glutes · Posterior",
      "muscles": [
        "Glutes",
        "Quads",
        "Hamstrings",
        "Core"
      ],
      "region": "lower",
      "items": [
        {
          "id": "ul4-L2-1",
          "exId": "hipthrust",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 2,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L2-2",
          "exId": "bss",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L2-3",
          "exId": "hack",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L2-4",
          "exId": "seatcurl",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 1,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L2-5",
          "exId": "abduct",
          "sets": 2,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-L2-6",
          "exId": "kneeraise",
          "sets": 2,
          "repMin": 10,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        }
      ]
    },
    {
      "id": "U2",
      "name": "Upper Body 2",
      "focus": "Press · Pull",
      "muscles": [
        "Chest",
        "Upper back",
        "Lats",
        "Rear delts",
        "Biceps"
      ],
      "region": "upper",
      "items": [
        {
          "id": "ul4-U2-1",
          "exId": "bench",
          "sets": 3,
          "repMin": 6,
          "repMax": 8,
          "rir": 2,
          "rest": 150,
          "tempo": "2-0-1-0",
          "warmups": 2,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U2-2",
          "exId": "dbrow",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U2-3",
          "exId": "ngpull",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U2-4",
          "exId": "fly",
          "sets": 2,
          "repMin": 10,
          "repMax": 12,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U2-5",
          "exId": "facepull",
          "sets": 2,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "B",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul4-U2-6",
          "exId": "ezcurl",
          "sets": 2,
          "repMin": 10,
          "repMax": 12,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "B",
          "notes": "",
          "replaced": []
        }
      ]
    }
  ],
  "rotation": [
    "L1",
    "U1",
    "L2",
    "U2"
  ],
  "allowConsecutive": false
};

export const PLAN_UL5: Plan = {
  "id": "ul5",
  "name": "Upper / Lower · 5 day",
  "note": "Adds a third lower day for glute and posterior-chain priority.",
  "workouts": [
    {
      "id": "L1",
      "name": "Lower Body 1",
      "focus": "Quads",
      "muscles": [
        "Quads",
        "Hamstrings"
      ],
      "region": "lower",
      "items": [
        {
          "id": "ul5-L1-1",
          "exId": "squat",
          "sets": 3,
          "repMin": 6,
          "repMax": 8,
          "rir": 2,
          "rest": 150,
          "tempo": "2-0-1-0",
          "warmups": 2,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-L1-2",
          "exId": "legpress",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-L1-3",
          "exId": "legext",
          "sets": 2,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        }
      ]
    },
    {
      "id": "U1",
      "name": "Upper Body 1",
      "focus": "Chest · Back",
      "muscles": [
        "Chest",
        "Upper back"
      ],
      "region": "upper",
      "items": [
        {
          "id": "ul5-U1-1",
          "exId": "incdb",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-U1-2",
          "exId": "csrow",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-U1-3",
          "exId": "lateral",
          "sets": 3,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        }
      ]
    },
    {
      "id": "L2",
      "name": "Lower Body 2",
      "focus": "Glutes",
      "muscles": [
        "Glutes",
        "Hamstrings"
      ],
      "region": "lower",
      "items": [
        {
          "id": "ul5-L2-1",
          "exId": "hipthrust",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-L2-2",
          "exId": "rdl",
          "sets": 3,
          "repMin": 8,
          "repMax": 10,
          "rir": 2,
          "rest": 120,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-L2-3",
          "exId": "abduct",
          "sets": 2,
          "repMin": 12,
          "repMax": 15,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        }
      ]
    },
    {
      "id": "U2",
      "name": "Upper Body 2",
      "focus": "Press · Pull",
      "muscles": [
        "Chest",
        "Lats"
      ],
      "region": "upper",
      "items": [
        {
          "id": "ul5-U2-1",
          "exId": "bench",
          "sets": 3,
          "repMin": 6,
          "repMax": 8,
          "rir": 2,
          "rest": 150,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-U2-2",
          "exId": "pulldown",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 2,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-U2-3",
          "exId": "ezcurl",
          "sets": 2,
          "repMin": 10,
          "repMax": 12,
          "rir": 1,
          "rest": 60,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        }
      ]
    },
    {
      "id": "L3",
      "name": "Lower Body 3",
      "focus": "Posterior chain",
      "muscles": [
        "Posterior chain",
        "Glutes"
      ],
      "region": "lower",
      "items": [
        {
          "id": "ul5-L3-1",
          "exId": "deadlift",
          "sets": 3,
          "repMin": 4,
          "repMax": 6,
          "rir": 2,
          "rest": 180,
          "tempo": "2-0-1-0",
          "warmups": 3,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-L3-2",
          "exId": "lunge",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 2,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        },
        {
          "id": "ul5-L3-3",
          "exId": "seatcurl",
          "sets": 3,
          "repMin": 10,
          "repMax": 12,
          "rir": 1,
          "rest": 90,
          "tempo": "2-0-1-0",
          "warmups": 0,
          "superset": "",
          "notes": "",
          "replaced": []
        }
      ]
    }
  ],
  "rotation": [
    "L1",
    "U1",
    "L2",
    "U2",
    "L3"
  ],
  "allowConsecutive": false
};

/** Starting working weights used only by the sample-data seed. */
export const START_KG: Record<string, number> = {
  "squat": 57.5,
  "rdl": 57.5,
  "legpress": 110,
  "legcurl": 32.5,
  "calf": 45,
  "crunch": 27.5,
  "incdb": 20,
  "csrow": 32,
  "pulldown": 50,
  "dbsp": 14,
  "lateral": 5,
  "pushdown": 20,
  "hipthrust": 75,
  "bss": 12,
  "hack": 65,
  "seatcurl": 32.5,
  "abduct": 45,
  "kneeraise": 0,
  "bench": 47.5,
  "dbrow": 22,
  "ngpull": 45,
  "fly": 37.5,
  "facepull": 17.5,
  "ezcurl": 20
};
