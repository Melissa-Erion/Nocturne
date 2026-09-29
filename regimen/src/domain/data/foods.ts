/* Foods, per 100 g — approximate values from USDA FoodData Central unless noted (ported from prototype/store.js).
   Replace with a live integration (USDA FDC API + Open Food Facts) — see src/lib/foodApi.ts. */
import type { Food } from '../types';

export const tagMap: Record<string, string> = { df: 'Dairy-free', gf: 'Gluten-free', vg: 'Vegan', vt: 'Vegetarian', hp: 'High protein' };

export const FOODS: Record<string, Food> = {
  "chicken_c": {
    "id": "chicken_c",
    "name": "Chicken breast, skinless",
    "basis": "cooked",
    "kcal": 165,
    "p": 31,
    "c": 0,
    "f": 3.6,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "chicken_r",
    "yld": 0.75
  },
  "chicken_r": {
    "id": "chicken_r",
    "name": "Chicken breast, skinless",
    "basis": "raw",
    "kcal": 120,
    "p": 22.5,
    "c": 0,
    "f": 2.6,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "chicken_c",
    "yld": 0.75,
    "buy": {
      "unit": "pack",
      "g": 500
    }
  },
  "turkey": {
    "id": "turkey",
    "name": "Turkey breast, sliced",
    "basis": "prepared",
    "kcal": 104,
    "p": 17,
    "c": 3.5,
    "f": 2,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "pack",
      "g": 175
    }
  },
  "beef_c": {
    "id": "beef_c",
    "name": "Lean ground beef 95%",
    "basis": "cooked",
    "kcal": 170,
    "p": 26,
    "c": 0,
    "f": 7,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "beef_r",
    "yld": 0.72
  },
  "beef_r": {
    "id": "beef_r",
    "name": "Lean ground beef 95%",
    "basis": "raw",
    "kcal": 137,
    "p": 21.4,
    "c": 0,
    "f": 5,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "beef_c",
    "yld": 0.72,
    "buy": {
      "unit": "pack",
      "g": 450
    }
  },
  "salmon_r": {
    "id": "salmon_r",
    "name": "Atlantic salmon",
    "basis": "raw",
    "kcal": 208,
    "p": 20.4,
    "c": 0,
    "f": 13.4,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "salmon_c",
    "yld": 0.8,
    "buy": {
      "unit": "fillet",
      "g": 150
    }
  },
  "salmon_c": {
    "id": "salmon_c",
    "name": "Atlantic salmon",
    "basis": "cooked",
    "kcal": 206,
    "p": 22.1,
    "c": 0,
    "f": 12.4,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "salmon_r",
    "yld": 0.8
  },
  "cod_c": {
    "id": "cod_c",
    "name": "Cod",
    "basis": "cooked",
    "kcal": 105,
    "p": 22.8,
    "c": 0,
    "f": 0.9,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "cod_r",
    "yld": 0.78
  },
  "cod_r": {
    "id": "cod_r",
    "name": "Cod",
    "basis": "raw",
    "kcal": 82,
    "p": 17.8,
    "c": 0,
    "f": 0.7,
    "role": "protein",
    "cat": "Meat & fish",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "cod_c",
    "yld": 0.78,
    "buy": {
      "unit": "pack",
      "g": 400
    }
  },
  "tuna": {
    "id": "tuna",
    "name": "Tuna, canned in water",
    "basis": "drained",
    "kcal": 116,
    "p": 25.5,
    "c": 0,
    "f": 0.8,
    "role": "protein",
    "cat": "Pantry",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "can, drained",
      "g": 120
    },
    "buy": {
      "unit": "can",
      "g": 120
    }
  },
  "tofu": {
    "id": "tofu",
    "name": "Tofu, firm",
    "basis": "raw",
    "kcal": 144,
    "p": 17.3,
    "c": 2.8,
    "f": 8.7,
    "role": "protein",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "block",
      "g": 350
    }
  },
  "eggs": {
    "id": "eggs",
    "name": "Egg, whole",
    "basis": "raw",
    "kcal": 143,
    "p": 12.6,
    "c": 0.7,
    "f": 9.5,
    "role": "protein",
    "cat": "Dairy & eggs",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "large egg",
      "g": 50
    },
    "buy": {
      "unit": "dozen",
      "g": 600
    }
  },
  "eggw": {
    "id": "eggw",
    "name": "Egg whites, liquid",
    "basis": "raw",
    "kcal": 48,
    "p": 10,
    "c": 0.7,
    "f": 0.2,
    "role": "protein",
    "cat": "Dairy & eggs",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegetarian",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "carton",
      "g": 500
    }
  },
  "yog": {
    "id": "yog",
    "name": "Greek yogurt, 0% plain",
    "basis": "prepared",
    "kcal": 59,
    "p": 10.3,
    "c": 3.6,
    "f": 0.4,
    "role": "protein",
    "cat": "Dairy & eggs",
    "tags": [
      "Gluten-free",
      "Vegetarian",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "tub",
      "g": 750
    }
  },
  "soyog": {
    "id": "soyog",
    "name": "Soy yogurt, plain",
    "basis": "prepared",
    "kcal": 66,
    "p": 5.5,
    "c": 4,
    "f": 3,
    "role": "protein",
    "cat": "Dairy & eggs",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "tub",
      "g": 650
    }
  },
  "cottage": {
    "id": "cottage",
    "name": "Cottage cheese 2%",
    "basis": "prepared",
    "kcal": 84,
    "p": 11,
    "c": 4.3,
    "f": 2.3,
    "role": "protein",
    "cat": "Dairy & eggs",
    "tags": [
      "Gluten-free",
      "Vegetarian",
      "High protein"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "tub",
      "g": 500
    }
  },
  "whey": {
    "id": "whey",
    "name": "Whey protein isolate",
    "basis": "prepared",
    "kcal": 380,
    "p": 80,
    "c": 8,
    "f": 5,
    "role": "protein",
    "cat": "Pantry",
    "tags": [
      "Gluten-free",
      "Vegetarian",
      "High protein"
    ],
    "src": "Custom · product label",
    "est": false,
    "serving": {
      "label": "scoop",
      "g": 30
    },
    "buy": {
      "unit": "tub",
      "g": 900
    }
  },
  "rice_c": {
    "id": "rice_c",
    "name": "White rice, long-grain",
    "basis": "cooked",
    "kcal": 130,
    "p": 2.7,
    "c": 28.2,
    "f": 0.3,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "rice_r",
    "yld": 3
  },
  "rice_r": {
    "id": "rice_r",
    "name": "White rice, long-grain",
    "basis": "raw",
    "kcal": 365,
    "p": 7.1,
    "c": 80,
    "f": 0.7,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "rice_c",
    "yld": 3,
    "buy": {
      "unit": "bag",
      "g": 900
    }
  },
  "quinoa_c": {
    "id": "quinoa_c",
    "name": "Quinoa",
    "basis": "cooked",
    "kcal": 120,
    "p": 4.4,
    "c": 21.3,
    "f": 1.9,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "quinoa_r",
    "yld": 2.7
  },
  "quinoa_r": {
    "id": "quinoa_r",
    "name": "Quinoa",
    "basis": "raw",
    "kcal": 368,
    "p": 14.1,
    "c": 64.2,
    "f": 6.1,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "quinoa_c",
    "yld": 2.7,
    "buy": {
      "unit": "bag",
      "g": 500
    }
  },
  "pasta_c": {
    "id": "pasta_c",
    "name": "Pasta, enriched",
    "basis": "cooked",
    "kcal": 158,
    "p": 5.8,
    "c": 30.9,
    "f": 0.9,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "pasta_r",
    "yld": 2.25
  },
  "pasta_r": {
    "id": "pasta_r",
    "name": "Pasta, enriched",
    "basis": "raw",
    "kcal": 371,
    "p": 13,
    "c": 74.7,
    "f": 1.5,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "pasta_c",
    "yld": 2.25,
    "buy": {
      "unit": "box",
      "g": 450
    }
  },
  "potato_r": {
    "id": "potato_r",
    "name": "Potato, white, flesh & skin",
    "basis": "raw",
    "kcal": 77,
    "p": 2,
    "c": 17.5,
    "f": 0.1,
    "role": "carb",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "potato_c",
    "yld": 1,
    "buy": {
      "unit": "bag",
      "g": 2270
    }
  },
  "potato_c": {
    "id": "potato_c",
    "name": "Potato, boiled",
    "basis": "cooked",
    "kcal": 87,
    "p": 1.9,
    "c": 20.1,
    "f": 0.1,
    "role": "carb",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "potato_r",
    "yld": 1
  },
  "sweet_c": {
    "id": "sweet_c",
    "name": "Sweet potato, baked",
    "basis": "cooked",
    "kcal": 90,
    "p": 2,
    "c": 20.7,
    "f": 0.2,
    "role": "carb",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "sweet_r",
    "yld": 0.8
  },
  "sweet_r": {
    "id": "sweet_r",
    "name": "Sweet potato",
    "basis": "raw",
    "kcal": 86,
    "p": 1.6,
    "c": 20.1,
    "f": 0.1,
    "role": "carb",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "sweet_c",
    "yld": 0.8,
    "buy": {
      "unit": "each",
      "g": 200
    }
  },
  "oats": {
    "id": "oats",
    "name": "Rolled oats",
    "basis": "raw",
    "kcal": 379,
    "p": 13.2,
    "c": 67.7,
    "f": 6.5,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "bag",
      "g": 1000
    }
  },
  "bread": {
    "id": "bread",
    "name": "Whole-wheat bread",
    "basis": "prepared",
    "kcal": 247,
    "p": 13,
    "c": 41,
    "f": 3.4,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "slice",
      "g": 32
    },
    "buy": {
      "unit": "loaf",
      "g": 600
    }
  },
  "tortilla": {
    "id": "tortilla",
    "name": "Flour tortilla, large",
    "basis": "prepared",
    "kcal": 306,
    "p": 8.2,
    "c": 50,
    "f": 8,
    "role": "carb",
    "cat": "Grains & starches",
    "tags": [
      "Dairy-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "wrap",
      "g": 62
    },
    "buy": {
      "unit": "pack of 8",
      "g": 496
    }
  },
  "banana": {
    "id": "banana",
    "name": "Banana",
    "basis": "edible",
    "kcal": 89,
    "p": 1.1,
    "c": 22.8,
    "f": 0.3,
    "role": "carb",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "medium, peeled",
      "g": 118
    },
    "buy": {
      "unit": "each",
      "g": 118
    }
  },
  "blueb": {
    "id": "blueb",
    "name": "Blueberries",
    "basis": "raw",
    "kcal": 57,
    "p": 0.7,
    "c": 14.5,
    "f": 0.3,
    "role": "carb",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "pint",
      "g": 310
    }
  },
  "lentils": {
    "id": "lentils",
    "name": "Lentils, boiled",
    "basis": "cooked",
    "kcal": 116,
    "p": 9,
    "c": 20.1,
    "f": 0.4,
    "role": "carb",
    "cat": "Pantry",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "lentil_r",
    "yld": 2.4
  },
  "lentil_r": {
    "id": "lentil_r",
    "name": "Lentils, dry",
    "basis": "raw",
    "kcal": 352,
    "p": 24.6,
    "c": 63.4,
    "f": 1.1,
    "role": "carb",
    "cat": "Pantry",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "lentils",
    "yld": 2.4,
    "buy": {
      "unit": "bag",
      "g": 900
    }
  },
  "chick": {
    "id": "chick",
    "name": "Chickpeas, canned",
    "basis": "drained",
    "kcal": 139,
    "p": 7,
    "c": 22.5,
    "f": 2.1,
    "role": "carb",
    "cat": "Pantry",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "can, drained",
      "g": 250
    }
  },
  "avocado": {
    "id": "avocado",
    "name": "Avocado",
    "basis": "edible",
    "kcal": 160,
    "p": 2,
    "c": 8.5,
    "f": 14.7,
    "role": "fat",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "medium, edible",
      "g": 136
    },
    "buy": {
      "unit": "each",
      "g": 136
    }
  },
  "oil": {
    "id": "oil",
    "name": "Olive oil",
    "basis": "prepared",
    "kcal": 884,
    "p": 0,
    "c": 0,
    "f": 100,
    "role": "fat",
    "cat": "Pantry",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "tbsp",
      "g": 13.5
    },
    "buy": {
      "unit": "bottle",
      "g": 500
    }
  },
  "almonds": {
    "id": "almonds",
    "name": "Almonds",
    "basis": "raw",
    "kcal": 579,
    "p": 21.2,
    "c": 21.6,
    "f": 49.9,
    "role": "fat",
    "cat": "Pantry",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "bag",
      "g": 400
    }
  },
  "pb": {
    "id": "pb",
    "name": "Peanut butter, smooth",
    "basis": "prepared",
    "kcal": 588,
    "p": 25,
    "c": 20,
    "f": 50,
    "role": "fat",
    "cat": "Pantry",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "serving": {
      "label": "tbsp",
      "g": 16
    },
    "buy": {
      "unit": "jar",
      "g": 500
    }
  },
  "cheddar": {
    "id": "cheddar",
    "name": "Cheddar cheese",
    "basis": "prepared",
    "kcal": 403,
    "p": 24.9,
    "c": 1.3,
    "f": 33.1,
    "role": "fat",
    "cat": "Dairy & eggs",
    "tags": [
      "Gluten-free",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "block",
      "g": 400
    }
  },
  "feta": {
    "id": "feta",
    "name": "Feta cheese",
    "basis": "prepared",
    "kcal": 264,
    "p": 14.2,
    "c": 4.1,
    "f": 21.3,
    "role": "fat",
    "cat": "Dairy & eggs",
    "tags": [
      "Gluten-free",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "pack",
      "g": 200
    }
  },
  "hummus": {
    "id": "hummus",
    "name": "Hummus",
    "basis": "prepared",
    "kcal": 166,
    "p": 7.9,
    "c": 14.3,
    "f": 9.6,
    "role": "fat",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "tub",
      "g": 283
    }
  },
  "broccoli_c": {
    "id": "broccoli_c",
    "name": "Broccoli, steamed",
    "basis": "cooked",
    "kcal": 35,
    "p": 2.4,
    "c": 7.2,
    "f": 0.4,
    "role": "veg",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "rawId": "broccoli_r",
    "yld": 0.95
  },
  "broccoli_r": {
    "id": "broccoli_r",
    "name": "Broccoli",
    "basis": "raw",
    "kcal": 34,
    "p": 2.8,
    "c": 6.6,
    "f": 0.4,
    "role": "veg",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "cookedId": "broccoli_c",
    "yld": 0.95,
    "buy": {
      "unit": "head",
      "g": 500
    }
  },
  "spinach": {
    "id": "spinach",
    "name": "Spinach",
    "basis": "raw",
    "kcal": 23,
    "p": 2.9,
    "c": 3.6,
    "f": 0.4,
    "role": "veg",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "bag",
      "g": 300
    }
  },
  "greens": {
    "id": "greens",
    "name": "Mixed salad greens",
    "basis": "raw",
    "kcal": 20,
    "p": 1.5,
    "c": 3.5,
    "f": 0.2,
    "role": "veg",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "box",
      "g": 142
    }
  },
  "peppers": {
    "id": "peppers",
    "name": "Bell pepper",
    "basis": "raw",
    "kcal": 26,
    "p": 1,
    "c": 6,
    "f": 0.3,
    "role": "veg",
    "cat": "Produce",
    "tags": [
      "Dairy-free",
      "Gluten-free",
      "Vegan",
      "Vegetarian"
    ],
    "src": "USDA FoodData Central",
    "est": false,
    "buy": {
      "unit": "each",
      "g": 150
    }
  }
};
