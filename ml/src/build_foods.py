"""Builds web/lib/nutrition/foods.json from USDA FoodData Central (public domain, CC0).

Usage: python -m src.build_foods <folder with the unzipped FDC CSV downloads>

Get the data from https://fdc.nal.usda.gov/download-datasets ("Survey (FNDDS)" and
"SR Legacy", CSV). Every number in the app's food list comes from these files; nothing
is typed in by hand. `note` marks entries that stand in for a food USDA doesn't list.
"""

import csv
import glob
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "web" / "lib" / "nutrition" / "foods.json"

ENERGY, PROTEIN, FAT, CARBS, FIBER = "1008", "1003", "1004", "1005", "1079"

# (id, display name, USDA description, dataset, aliases, category, note)
SELECTION: list[tuple[str, str, str, str, list[str], str, str | None]] = [
    # Grains and breads
    ("rice-white", "Rice, white (cooked)", "Rice, white, cooked, no added fat", "fndds", ["rice", "chawal", "steamed rice", "plain rice"], "grains", None),
    ("rice-brown", "Rice, brown (cooked)", "Rice, brown, cooked, no added fat", "fndds", ["brown rice"], "grains", None),
    ("roti", "Roti / chapati", "Tortilla, whole wheat", "fndds", ["roti", "chapati", "chapatti", "phulka", "fulka"], "grains",
     "USDA has no roti entry; values are its closest match, a whole-wheat flatbread"),
    ("naan", "Naan", "Bread, naan", "fndds", ["nan"], "grains", None),
    ("paratha", "Paratha", "Bread, paratha", "fndds", ["parantha", "parotta"], "grains", None),
    ("bread-white", "Bread, white", "Bread, white", "fndds", ["white bread", "bread slice"], "grains", None),
    ("bread-wheat", "Bread, whole wheat", "Bread, whole wheat", "fndds", ["brown bread", "wheat bread", "atta bread"], "grains", None),
    ("oats", "Oatmeal (cooked with water)", "Oatmeal, regular or quick, made with water, no added fat", "fndds", ["oats", "oatmeal", "porridge", "daliya"], "grains", None),
    ("oats-milk", "Oatmeal (cooked with milk)", "Oatmeal, regular or quick, made with milk, no added fat", "fndds", ["oats with milk"], "grains", None),
    ("pasta", "Pasta (cooked)", "Pasta, cooked", "fndds", ["spaghetti", "macaroni", "penne"], "grains", None),
    ("noodles", "Noodles (cooked)", "Noodles, cooked", "fndds", ["noodle"], "grains", None),
    ("quinoa", "Quinoa (cooked)", "Quinoa, no added fat", "fndds", [], "grains", None),
    ("idli", "Idli", "Idli", "fndds", ["idly"], "grains", None),
    ("dosa", "Dosa, plain", "Dosa, plain", "fndds", ["dosai", "plain dosa"], "grains", None),
    ("dosa-masala", "Dosa, with filling", "Dosa, with filling", "fndds", ["masala dosa"], "grains", None),
    ("upma", "Upma", "Upma", "fndds", ["uppit", "rava upma"], "grains", None),
    ("biryani-chicken", "Chicken biryani", "Biryani with chicken", "fndds", ["biryani", "chicken biriyani"], "dishes", None),
    ("biryani-veg", "Veg biryani", "Biryani with vegetables", "fndds", ["vegetable biryani", "pulao", "pulav"], "dishes", None),
    ("biryani-meat", "Mutton biryani", "Biryani with meat", "fndds", ["mutton biryani", "meat biryani"], "dishes", None),
    # Dal, legumes, soy
    ("dal", "Dal", "Dal", "fndds", ["daal", "dhal", "lentil dal", "toor dal", "moong dal", "masoor dal", "arhar dal"], "legumes", None),
    ("lentil-curry", "Lentil curry", "Lentil curry", "fndds", ["dal makhani", "dal tadka", "dal fry"], "legumes", None),
    ("lentils", "Lentils, boiled", "Lentils, from dried, no added fat", "fndds", ["boiled lentils", "masoor"], "legumes", None),
    ("chickpeas", "Chickpeas (cooked)", "Chickpeas, from dried, fat added", "fndds", ["chole", "chana", "chhole", "kabuli chana", "chana masala"], "legumes", None),
    ("rajma", "Rajma / kidney beans (cooked)", "Kidney beans, from dried, fat added", "fndds", ["rajma", "kidney beans", "rajmah"], "legumes", None),
    ("soybeans", "Soybeans (cooked)", "Soybeans, cooked", "fndds", ["soya", "soy chunks", "soya chunks"], "legumes", None),
    ("tofu", "Tofu, firm", "Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)", "sr", ["bean curd"], "legumes", None),
    ("hummus", "Hummus", "Hummus, plain", "fndds", ["houmous"], "legumes", None),
    ("soy-milk", "Soy milk, unsweetened", "Soy milk, unsweetened", "fndds", ["soya milk"], "dairy", None),
    # Dairy and eggs
    ("milk-whole", "Milk, whole", "Milk, whole", "fndds", ["milk", "full cream milk", "doodh"], "dairy", None),
    ("milk-2", "Milk, toned (2%)", "Milk, reduced fat (2%)", "fndds", ["toned milk", "2% milk"], "dairy", None),
    ("milk-skim", "Milk, skimmed", "Milk, fat free (skim)", "fndds", ["skim milk", "skimmed milk", "double toned milk"], "dairy", None),
    ("curd", "Curd / yogurt, plain", "Yogurt, whole milk, plain", "fndds", ["curd", "dahi", "yoghurt", "yogurt"], "dairy", None),
    ("greek-yogurt", "Greek yogurt, plain, nonfat", "Yogurt, Greek, nonfat milk, plain", "fndds", ["hung curd", "greek yoghurt"], "dairy", None),
    ("buttermilk", "Buttermilk", "Milk, buttermilk, fluid, cultured, reduced fat", "sr", ["chaas", "chhaas", "mattha"], "dairy", None),
    ("paneer", "Paneer", "Cheese, paneer", "fndds", ["cottage cheese indian", "panir"], "dairy",
     "USDA's paneer entry; homemade paneer usually has far fewer carbs"),
    ("palak-paneer", "Palak paneer", "Palak Paneer", "fndds", ["saag paneer"], "dishes", None),
    ("cheddar", "Cheese, cheddar", "Cheese, Cheddar", "fndds", ["cheese", "cheese slice"], "dairy", None),
    ("mozzarella", "Cheese, mozzarella", "Cheese, Mozzarella, part skim", "fndds", [], "dairy", None),
    ("egg-boiled", "Egg, boiled", "Egg, whole, boiled or poached", "fndds", ["egg", "eggs", "boiled egg", "anda"], "protein", None),
    ("egg-fried", "Egg, fried", "Egg, whole, fried with oil", "fndds", ["fried egg", "omelette", "omelet", "bhurji"], "protein", None),
    ("whey", "Whey protein powder", "Beverages, Protein powder whey based", "sr", ["whey", "protein powder", "protein shake"], "protein", None),
    # Meat and fish
    ("chicken-breast", "Chicken breast (cooked)", "Chicken breast, baked, broiled, or roasted, skin not eaten, from raw", "fndds", ["chicken", "grilled chicken", "chicken breast", "tandoori chicken"], "protein", None),
    ("chicken-curry", "Chicken curry", "Chicken curry", "fndds", ["butter chicken", "chicken gravy", "murgh curry"], "dishes", None),
    ("fish-curry", "Fish curry", "Fish curry", "fndds", ["machli curry", "fish gravy"], "dishes", None),
    ("salmon", "Salmon (cooked)", "Fish, salmon, baked or broiled", "fndds", ["fish"], "protein", None),
    ("tuna", "Tuna, canned", "Fish, tuna, canned", "fndds", ["tuna"], "protein", None),
    ("mutton-curry", "Mutton / lamb with gravy", "Lamb or mutton with gravy", "fndds", ["mutton", "mutton curry", "lamb curry", "goat curry"], "dishes", None),
    ("beef-curry", "Beef curry", "Beef curry", "fndds", [], "dishes", None),
    ("shrimp", "Prawns / shrimp (cooked)", "Shrimp, steamed or boiled", "fndds", ["prawns", "prawn", "jhinga"], "protein", None),
    # Fruit
    ("banana", "Banana", "Banana, raw", "fndds", ["kela"], "fruit", None),
    ("apple", "Apple", "Apple, raw", "fndds", ["seb"], "fruit", None),
    ("orange", "Orange", "Orange, raw", "fndds", ["santra"], "fruit", None),
    ("mango", "Mango", "Mango, raw", "fndds", ["aam"], "fruit", None),
    ("grapes", "Grapes", "Grapes, raw", "fndds", ["angoor"], "fruit", None),
    ("papaya", "Papaya", "Papaya, raw", "fndds", ["papita"], "fruit", None),
    ("guava", "Guava", "Guava, raw", "fndds", ["amrood"], "fruit", None),
    ("watermelon", "Watermelon", "Watermelon, raw", "fndds", ["tarbooz"], "fruit", None),
    ("pineapple", "Pineapple", "Pineapple, raw", "fndds", ["ananas"], "fruit", None),
    ("pomegranate", "Pomegranate", "Pomegranate, raw", "fndds", ["anar"], "fruit", None),
    # Vegetables
    ("potato", "Potato, boiled", "Potato, boiled, from fresh, peel not eaten, no added fat", "fndds", ["aloo", "potatoes"], "vegetables", None),
    ("sweet-potato", "Sweet potato, boiled", "Sweet potato, boiled, no added fat", "fndds", ["shakarkandi"], "vegetables", None),
    ("spinach", "Spinach, raw", "Spinach, raw", "fndds", ["palak"], "vegetables", None),
    ("broccoli", "Broccoli, raw", "Broccoli, raw", "fndds", [], "vegetables", None),
    ("cauliflower", "Cauliflower (cooked with oil)", "Cauliflower, fresh, cooked with oil", "fndds", ["gobi", "aloo gobi"], "vegetables", None),
    ("okra", "Okra / bhindi (cooked)", "Okra, fresh, cooked, fat added", "fndds", ["bhindi", "lady finger", "ladyfinger"], "vegetables", None),
    ("peas", "Green peas (cooked)", "Peas, green, frozen, cooked, boiled, drained, without salt", "sr", ["matar", "peas"], "vegetables", None),
    ("tomato", "Tomato", "Tomatoes, raw", "fndds", ["tamatar", "tomatoes"], "vegetables", None),
    ("cucumber", "Cucumber", "Cucumber, raw", "fndds", ["kheera", "kakdi"], "vegetables", None),
    ("carrot", "Carrot", "Carrots, raw", "fndds", ["gajar", "carrots"], "vegetables", None),
    ("onion", "Onion", "Onions, raw", "fndds", ["pyaz", "onions"], "vegetables", None),
    # Nuts, fats, sweets, drinks
    ("peanuts", "Peanuts, roasted", "Peanuts, roasted, salted", "fndds", ["moongphali", "groundnuts", "peanut"], "nuts", None),
    ("peanut-butter", "Peanut butter", "Peanut butter", "fndds", ["pb"], "nuts", None),
    ("almonds", "Almonds", "Almonds, unsalted", "fndds", ["badam", "almond"], "nuts", None),
    ("cashews", "Cashews", "Cashews, unsalted", "fndds", ["kaju", "cashew"], "nuts", None),
    ("ghee", "Ghee", "Ghee, clarified butter", "fndds", ["desi ghee"], "fats", None),
    ("butter", "Butter", "Butter, stick", "fndds", ["makhan"], "fats", None),
    ("oil", "Cooking oil", "Vegetable oil, NFS", "fndds", ["oil", "refined oil", "vegetable oil", "mustard oil", "sunflower oil"], "fats", None),
    ("olive-oil", "Olive oil", "Olive oil", "fndds", [], "fats", None),
    ("sugar", "Sugar", "Sugar, white, granulated or lump", "fndds", ["cheeni", "shakkar"], "sweets", None),
    ("honey", "Honey", "Honey", "fndds", ["shahad"], "sweets", None),
    ("chocolate", "Chocolate", "Chocolate candy", "fndds", ["chocolate bar", "dairy milk"], "sweets", None),
    ("ice-cream", "Ice cream, vanilla", "Ice cream, vanilla", "fndds", ["ice cream", "icecream"], "sweets", None),
    ("biscuit", "Biscuit", "Biscuit, NFS", "fndds", ["biscuits", "cookie"], "sweets", None),
    ("tea", "Tea, black (no milk)", "Tea, hot, leaf, black", "fndds", ["black tea"], "drinks", None),
    ("coffee", "Coffee, black", "Coffee, brewed", "fndds", ["black coffee"], "drinks", None),
    ("orange-juice", "Orange juice", "Orange juice, 100%,  freshly squeezed", "fndds", ["juice", "fresh juice"], "drinks", None),
    ("cola", "Cola", "Soft drink, cola", "fndds", ["coke", "pepsi", "soft drink"], "drinks", None),
    # Snacks and fast food
    ("samosa", "Samosa", "Samosa", "fndds", ["samosaa"], "snacks", None),
    ("pakora", "Pakora", "Pakora", "fndds", ["pakoda", "bhajji", "bhaji"], "snacks", None),
    ("vada", "Vada", "Vada", "fndds", ["medu vada", "wada"], "snacks", None),
    ("chips", "Potato chips", "Potato chips, plain", "fndds", ["chips", "crisps", "wafers"], "snacks", None),
    ("popcorn", "Popcorn", "Popcorn, popped in oil, no butter added", "fndds", [], "snacks", None),
    ("pizza", "Pizza, cheese", "Pizza, cheese, from restaurant or fast food, NS as to type of crust", "fndds", ["pizza slice"], "snacks", None),
    ("burger", "Cheeseburger", "Cheeseburger, NFS", "fndds", ["burger"], "snacks", None),
    ("fries", "French fries", "McDONALD'S, french fries", "sr", ["fries", "finger chips"], "snacks", None),
    ("pb-sandwich", "Peanut butter sandwich", "Peanut butter sandwich, with regular peanut butter, on wheat bread", "fndds", [], "snacks", None),
    ("lentil-soup", "Lentil soup", "Soup, lentil", "fndds", ["dal soup"], "dishes", None),
    ("chicken-soup", "Chicken soup", "Soup, chicken", "fndds", [], "dishes", None),
]

SKIP_PORTIONS = ("quantity not specified", "guideline amount")


def load(folder: Path, dataset: str):
    base = str(Path(glob.glob(str(folder / dataset / "*" / "food.csv"))[0]).parent) + "/"
    foods = {r["description"]: r["fdc_id"] for r in csv.DictReader(open(f"{base}food.csv", encoding="utf-8"))}
    # SR Legacy uses FDC nutrient ids (1008…); FNDDS uses the older numbers (208…).
    legacy = {"208": ENERGY, "203": PROTEIN, "204": FAT, "205": CARBS, "291": FIBER}
    wanted = {ENERGY, PROTEIN, FAT, CARBS, FIBER}
    nutrients: dict[str, dict[str, float]] = {}
    for r in csv.DictReader(open(f"{base}food_nutrient.csv", encoding="utf-8")):
        nid = legacy.get(r["nutrient_id"], r["nutrient_id"])
        if nid in wanted and r["amount"]:
            nutrients.setdefault(r["fdc_id"], {})[nid] = float(r["amount"])
    portions: dict[str, list[tuple[str, float]]] = {}
    units = {r["id"]: r["name"] for r in csv.DictReader(open(f"{base}measure_unit.csv", encoding="utf-8"))}
    for r in csv.DictReader(open(f"{base}food_portion.csv", encoding="utf-8")):
        grams = float(r["gram_weight"] or 0)
        label = r["portion_description"].strip() or " ".join(
            x for x in (r["amount"], units.get(r["measure_unit_id"], "") if units.get(r["measure_unit_id"]) != "undetermined" else "", r["modifier"]) if x
        )
        if grams > 0 and label and not label.lower().startswith(SKIP_PORTIONS):
            portions.setdefault(r["fdc_id"], []).append((label, grams))
    return foods, nutrients, portions


def main() -> None:
    folder = Path(sys.argv[1])
    data = {ds: load(folder, ds) for ds in ("fndds", "sr")}
    out, missing = [], []
    for food_id, name, description, dataset, aliases, category, note in SELECTION:
        foods, nutrients, portions = data[dataset]
        fdc_id = foods.get(description)
        n = nutrients.get(fdc_id or "", {})
        if not fdc_id or ENERGY not in n:
            missing.append(description)
            continue
        servings = []
        for label, grams in portions.get(fdc_id, []):
            if all(s["label"] != label for s in servings):
                servings.append({"label": label, "grams": round(grams, 1)})
        out.append(
            {
                "id": food_id,
                "name": name,
                "aliases": aliases,
                "category": category,
                "per100g": {
                    "kcal": round(n[ENERGY], 1),
                    "protein": round(n.get(PROTEIN, 0), 2),
                    "carbs": round(n.get(CARBS, 0), 2),
                    "fat": round(n.get(FAT, 0), 2),
                    "fiber": round(n.get(FIBER, 0), 2),
                },
                "servings": servings[:6],
                "source": {"dataset": "USDA FNDDS 2021-2023" if dataset == "fndds" else "USDA SR Legacy", "fdcId": int(fdc_id), "description": description},
                **({"note": note} if note else {}),
            }
        )
    if missing:
        raise SystemExit("Not found in USDA data:\n  " + "\n  ".join(missing))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": "USDA FoodData Central (public domain, CC0 1.0). fdc.nal.usda.gov", "foods": out}, indent=1))
    print(f"wrote {len(out)} foods -> {OUT}")


if __name__ == "__main__":
    main()
