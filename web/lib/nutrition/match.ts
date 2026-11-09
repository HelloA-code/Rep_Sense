import { FOODS, type Food } from "./foods";

// Finds foods by name or alias: "chapatis" → Roti, "dahi" → Curd.

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Crude singular: "rotis" → "roti", "eggs" → "egg", "tomatoes" → "tomato". */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

const key = (text: string) => normalize(text).split(" ").map(singular).join(" ");

function score(query: string, food: Food): number {
  const names = [food.name, ...food.aliases].map(key);
  let best = 0;
  for (const name of names) {
    if (name === query) return 100;
    if (name.startsWith(query) || query.startsWith(name)) best = Math.max(best, 80);
    const words = new Set(name.split(" "));
    const shared = query.split(" ").filter((w) => words.has(w)).length;
    if (shared) best = Math.max(best, 40 + (30 * shared) / Math.max(words.size, query.split(" ").length));
  }
  return best;
}

/** Foods ranked by how well they match, best first. */
export function searchFoods(text: string, limit = 8): Food[] {
  const query = key(text);
  if (!query) return [];
  return FOODS.map((food) => ({ food, s: score(query, food) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.food);
}

/** A confident single match, or null (then the AI estimate is used and labelled). */
export function bestMatch(text: string): Food | null {
  const query = key(text);
  if (!query) return null;
  let top: { food: Food; s: number } | null = null;
  for (const food of FOODS) {
    const s = score(query, food);
    if (!top || s > top.s) top = { food, s };
  }
  return top && top.s >= 70 ? top.food : null;
}
