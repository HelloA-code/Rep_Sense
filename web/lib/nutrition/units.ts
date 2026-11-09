import type { Food } from "./foods";

// "2 rotis", "1 bowl dal", "150 g rice" → grams. Uses the food's own USDA serving
// sizes where they exist; otherwise standard kitchen measures, marked as assumed.

export type Unit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "cup"
  | "bowl"
  | "tbsp"
  | "tsp"
  | "piece"
  | "slice"
  | "small"
  | "medium"
  | "large"
  | "plate";

export const UNITS: readonly Unit[] = ["g", "kg", "ml", "l", "cup", "bowl", "tbsp", "tsp", "piece", "slice", "small", "medium", "large", "plate"];

export type Portion = { grams: number; basis: string; assumed: boolean };

const STANDARD: Partial<Record<Unit, { grams: number; basis: string }>> = {
  cup: { grams: 240, basis: "1 cup ≈ 240 g" },
  bowl: { grams: 240, basis: "1 bowl ≈ 1 cup ≈ 240 g" },
  tbsp: { grams: 15, basis: "1 tbsp ≈ 15 g" },
  tsp: { grams: 5, basis: "1 tsp ≈ 5 g" },
  plate: { grams: 350, basis: "1 plate ≈ 350 g" },
};

function serving(food: Food, pattern: RegExp) {
  return food.servings.find((s) => pattern.test(s.label));
}

/** The food's own "one of these" serving: medium/regular first, then any single item. */
function onePiece(food: Food, size: "small" | "medium" | "large" | null) {
  // US packaging sizes ("1 container", "1 can") mean nothing to most users: skip them.
  const notMeasure = (s: { label: string }) =>
    !/cup|tablespoon|teaspoon|fl oz|ounce|\boz\b|inch|slice|container|package|packet|bottle|\bcan\b|carton|box/i.test(s.label);
  if (size) {
    const sized = food.servings.find((s) => notMeasure(s) && new RegExp(`\\b${size}\\b`, "i").test(s.label));
    if (sized) return sized;
  }
  return (
    food.servings.find((s) => notMeasure(s) && /\b(medium|regular)\b/i.test(s.label)) ??
    food.servings.find((s) => notMeasure(s) && /^1 /.test(s.label))
  );
}

export function toGrams(food: Food, quantity: number, unit: Unit): Portion | null {
  if (!(quantity > 0)) return null;
  const times = (grams: number, basis: string, assumed: boolean): Portion => ({
    grams: Math.round(grams * quantity),
    basis,
    assumed,
  });

  switch (unit) {
    case "g":
      return times(1, "grams", false);
    case "kg":
      return times(1000, "kilograms", false);
    case "ml":
      return times(1, "1 ml ≈ 1 g", true);
    case "l":
      return times(1000, "1 l ≈ 1 kg", true);
    case "cup":
    case "bowl": {
      const own = serving(food, /^1 cup\b/i);
      if (own) return times(own.grams, `${unit === "bowl" ? "1 bowl ≈ " : ""}${own.label} (USDA)`, unit === "bowl");
      break;
    }
    case "tbsp": {
      const own = serving(food, /^1 tablespoon/i);
      if (own) return times(own.grams, `${own.label} (USDA)`, false);
      break;
    }
    case "tsp": {
      const own = serving(food, /^1 teaspoon/i);
      if (own) return times(own.grams, `${own.label} (USDA)`, false);
      break;
    }
    case "slice": {
      const own = serving(food, /slice/i);
      if (own) return times(own.grams, `${own.label} (USDA)`, false);
      return null;
    }
    case "piece":
    case "small":
    case "medium":
    case "large": {
      const own = onePiece(food, unit === "piece" ? null : unit);
      return own ? times(own.grams, `${own.label} (USDA)`, false) : null;
    }
  }
  const standard = STANDARD[unit];
  return standard ? times(standard.grams, standard.basis, true) : null;
}

/** Best guess when someone just types a count ("2 eggs"): one piece, else one cup. */
export function defaultPortion(food: Food, quantity: number): Portion | null {
  return toGrams(food, quantity, "piece") ?? toGrams(food, quantity, "cup") ?? toGrams(food, quantity * 100, "g");
}
