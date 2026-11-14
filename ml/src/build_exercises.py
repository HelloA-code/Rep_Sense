"""Builds the exercise library for the web app from free-exercise-db (Unlicense, public domain).

Usage: python -m src.build_exercises [path/to/exercises.json]

Without a path it downloads the dataset from a pinned commit, so the output is reproducible.
Writes:
- web/lib/exercises/library-data.ts: the list the picker needs (small, typed).
- web/lib/exercises/library-details.json: instructions and muscles, loaded only when an
  exercise's detail sheet opens.

Instructions and muscles come only from the dataset. Exercises the dataset doesn't have
are kept with `source = None` and no instructions; nothing is written by hand.
"""

import json
import sys
import urllib.request
from pathlib import Path

DATASET_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5"
DATASET_URL = f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/{DATASET_COMMIT}/dist/exercises.json"
WEB = Path(__file__).resolve().parents[2] / "web" / "lib" / "exercises"
OUT_DATA = WEB / "library-data.ts"
OUT_DETAILS = WEB / "library-details.json"

# ---- Camera-tracked: these ids must exist in web/lib/exercises/catalog.ts ----
# (id, source exercise name or None). Name, family and equipment live in the catalog.
CAMERA: list[tuple[str, str | None]] = [
    ("squat", "Bodyweight Squat"),
    ("goblet-squat", "Goblet Squat"),
    ("sumo-squat", None),
    ("jump-squat", "Freehand Jump Squat"),
    ("box-squat", None),
    ("assisted-pistol", None),
    ("barbell-squat", "Barbell Squat"),
    ("front-squat", "Front Squat (Clean Grip)"),
    ("hack-squat", "Hack Squat"),
    ("smith-squat", "Smith Machine Squat"),
    ("romanian-deadlift", "Romanian Deadlift"),
    ("deadlift", "Barbell Deadlift"),
    ("sumo-deadlift", "Sumo Deadlift"),
    ("good-morning", "Good Morning"),
    ("glute-bridge", "Butt Lift (Bridge)"),
    ("hip-thrust", "Barbell Hip Thrust"),
    ("kettlebell-swing", "One-Arm Kettlebell Swings"),
    ("lunge", "Dumbbell Lunges"),
    ("reverse-lunge", "Dumbbell Rear Lunge"),
    ("walking-lunge", "Bodyweight Walking Lunge"),
    ("bulgarian-split-squat", None),
    ("step-up", "Dumbbell Step Ups"),
    ("lateral-lunge", None),
    ("shrimp-squat", None),
    ("cossack-squat", None),
    ("pushup", "Pushups"),
    ("dip", "Dips - Triceps Version"),
    ("knee-pushup", None),
    ("incline-pushup", "Incline Push-Up"),
    ("decline-pushup", "Decline Push-Up"),
    ("diamond-pushup", None),
    ("bench-dip", "Bench Dips"),
    ("archer-pushup", None),
    ("pseudo-planche-pushup", None),
    ("ring-pushup", None),
    ("ring-dip", "Ring Dips"),
    ("straight-bar-dip", None),
    ("chest-press-machine", "Leverage Chest Press"),
    ("assisted-dip", "Dip Machine"),
    ("pike-pushup", None),
    ("overhead-press", "Dumbbell Shoulder Press"),
    ("arnold-press", "Arnold Dumbbell Press"),
    ("military-press", "Standing Military Press"),
    ("shoulder-press-machine", "Machine Shoulder (Military) Press"),
    ("handstand-pushup", "Handstand Push-Ups"),
    ("inverted-row", "Inverted Row"),
    ("dumbbell-row", "One-Arm Dumbbell Row"),
    ("band-row", None),
    ("barbell-row", "Bent Over Barbell Row"),
    ("seated-cable-row", "Seated Cable Rows"),
    ("t-bar-row", "T-Bar Row with Handle"),
    ("pullup", "Pullups"),
    ("chin-up", "Chin-Up"),
    ("negative-pullup", None),
    ("wide-pullup", None),
    ("lat-pulldown", "Wide-Grip Lat Pulldown"),
    ("assisted-pullup", "Band Assisted Pull-Up"),
    ("bicep-curl", "Dumbbell Bicep Curl"),
    ("hammer-curl", "Hammer Curls"),
    ("concentration-curl", "Concentration Curls"),
    ("cable-curl", "Standing Biceps Cable Curl"),
    ("preacher-curl", "Preacher Curl"),
    ("lateral-raise", "Side Lateral Raise"),
    ("front-raise", "Front Dumbbell Raise"),
    ("tricep-extension", "Standing Dumbbell Triceps Extension"),
    ("triceps-pushdown", "Triceps Pushdown"),
    ("calf-raise", "Standing Calf Raises"),
    ("sit-up", "Sit-Up"),
    ("lying-leg-raise", "Flat Bench Lying Leg Raise"),
    ("captains-chair-knee-raise", "Knee/Hip Raise On Parallel Bars"),
    ("hanging-leg-raise", "Hanging Leg Raise"),
    ("v-up", "Jackknife Sit-Up"),
    ("plank", "Plank"),
    ("side-plank", "Side Bridge"),
    ("hollow-hold", None),
    ("l-sit", None),
    ("dead-hang", None),
    ("wall-sit", None),
]

# ---- Not camera-tracked: taught once (teach) or logged by hand (log) ----
# (id, display name, source name or None, group, tracking, mode, requiresAny)
# group: a movement family id, or "cardio", "skills", "mobility".
# mode: "reps", "seconds" (holds, stretches) or "minutes" (cardio machines).
OTHER: list[tuple[str, str, str | None, str, str, str, list[str]]] = [
    # Machines and cables: the camera can count these once taught
    ("leg-extension", "Leg extension", "Leg Extensions", "single-joint", "teach", "reps", ["machines"]),
    ("seated-leg-curl", "Seated leg curl", "Seated Leg Curl", "single-joint", "teach", "reps", ["machines"]),
    ("pec-deck", "Pec deck", "Butterfly", "push", "teach", "reps", ["machines"]),
    ("cable-crossover", "Cable crossover", "Cable Crossover", "push", "teach", "reps", ["cable-machine"]),
    ("face-pull", "Face pull", "Face Pull", "row", "teach", "reps", ["cable-machine", "bands"]),
    ("straight-arm-pulldown", "Straight-arm pulldown", "Straight-Arm Pulldown", "vertical-pull", "teach", "reps", ["cable-machine"]),
    ("cable-lateral-raise", "Cable lateral raise", "Cable Seated Lateral Raise", "single-joint", "teach", "reps", ["cable-machine"]),
    ("glute-kickback", "Glute kickback", "Glute Kickback", "hinge", "teach", "reps", ["machines", "cable-machine", "bands", "mat"]),
    ("hip-abductor", "Hip abductor machine", "Thigh Abductor", "single-joint", "teach", "reps", ["machines"]),
    ("hip-adductor", "Hip adductor machine", "Thigh Adductor", "single-joint", "teach", "reps", ["machines"]),
    ("machine-curl", "Machine bicep curl", "Machine Bicep Curl", "single-joint", "teach", "reps", ["machines"]),
    # Lying down or hidden by the machine: logged by hand
    ("leg-press", "Leg press", "Leg Press", "squat", "log", "reps", ["machines"]),
    ("lying-leg-curl", "Lying leg curl", "Lying Leg Curls", "single-joint", "log", "reps", ["machines"]),
    ("seated-calf-raise", "Seated calf raise", "Seated Calf Raise", "single-joint", "log", "reps", ["machines"]),
    ("calf-press", "Calf press (leg press)", "Calf Press On The Leg Press Machine", "single-joint", "log", "reps", ["machines"]),
    ("barbell-bench-press", "Barbell bench press", "Barbell Bench Press - Medium Grip", "push", "log", "reps", ["barbell"]),
    ("incline-bench-press", "Incline bench press", "Barbell Incline Bench Press - Medium Grip", "push", "log", "reps", ["barbell"]),
    ("decline-bench-press", "Decline bench press", "Decline Barbell Bench Press", "push", "log", "reps", ["barbell"]),
    ("close-grip-bench-press", "Close-grip bench press", "Close-Grip Barbell Bench Press", "push", "log", "reps", ["barbell"]),
    ("dumbbell-bench-press", "Dumbbell bench press", "Dumbbell Bench Press", "push", "log", "reps", ["dumbbells"]),
    ("incline-dumbbell-press", "Incline dumbbell press", "Incline Dumbbell Press", "push", "log", "reps", ["dumbbells"]),
    ("smith-bench-press", "Smith machine bench press", "Smith Machine Bench Press", "push", "log", "reps", ["machines"]),
    ("dumbbell-fly", "Dumbbell fly", "Dumbbell Flyes", "push", "log", "reps", ["dumbbells"]),
    ("incline-dumbbell-fly", "Incline dumbbell fly", "Incline Dumbbell Flyes", "push", "log", "reps", ["dumbbells"]),
    ("skull-crusher", "Skull crusher", "EZ-Bar Skullcrusher", "single-joint", "log", "reps", ["ez-bar", "barbell"]),
    ("dumbbell-pullover", "Dumbbell pullover", "Bent-Arm Dumbbell Pullover", "push", "log", "reps", ["dumbbells"]),
    ("ab-crunch-machine", "Ab crunch machine", "Ab Crunch Machine", "core", "log", "reps", ["machines"]),
    # Free weights
    ("shrug", "Dumbbell shrug", "Dumbbell Shrug", "single-joint", "log", "reps", ["dumbbells", "barbell"]),
    ("reverse-fly", "Reverse fly", "Reverse Flyes", "row", "teach", "reps", ["dumbbells"]),
    ("upright-row", "Upright row", "Upright Barbell Row", "overhead", "teach", "reps", ["barbell", "dumbbells", "ez-bar"]),
    ("push-press", "Push press", "Push Press", "overhead", "teach", "reps", ["barbell"]),
    ("kettlebell-thruster", "Kettlebell thruster", "Kettlebell Thruster", "squat", "teach", "reps", ["kettlebell"]),
    ("kettlebell-clean", "Kettlebell clean", "One-Arm Kettlebell Clean", "hinge", "log", "reps", ["kettlebell"]),
    ("kettlebell-snatch", "Kettlebell snatch", "One-Arm Kettlebell Snatch", "hinge", "log", "reps", ["kettlebell"]),
    ("turkish-get-up", "Turkish get-up", "Kettlebell Turkish Get-Up (Squat style)", "skills", "log", "reps", ["kettlebell"]),
    ("clean-and-press", "Clean and press", "Clean and Press", "skills", "log", "reps", ["barbell"]),
    ("renegade-row", "Renegade row", "Alternating Renegade Row", "row", "log", "reps", ["dumbbells", "kettlebell"]),
    ("farmers-walk", "Farmer's walk", "Farmer's Walk", "skills", "log", "seconds", ["dumbbells", "kettlebell"]),
    # Core
    ("crunch", "Crunch", "Crunches", "core", "teach", "reps", []),
    ("bicycle-crunch", "Bicycle crunch", "Air Bike", "core", "teach", "reps", []),
    ("cable-crunch", "Cable crunch", "Cable Crunch", "core", "teach", "reps", ["cable-machine"]),
    ("russian-twist", "Russian twist", "Russian Twist", "core", "log", "reps", []),
    ("mountain-climber", "Mountain climber", "Mountain Climbers", "core", "teach", "reps", []),
    ("flutter-kicks", "Flutter kicks", "Flutter Kicks", "core", "teach", "reps", []),
    ("ab-rollout", "Ab wheel rollout", "Ab Roller", "core", "teach", "reps", []),
    ("dead-bug", "Dead bug", "Dead Bug", "core", "teach", "reps", []),
    ("superman-hold", "Superman hold", "Superman", "core", "log", "seconds", []),
    ("bird-dog", "Bird dog", None, "core", "log", "reps", []),
    # Cardio and jumps
    ("burpee", "Burpee", None, "cardio", "teach", "reps", []),
    ("jumping-jack", "Jumping jack", None, "cardio", "teach", "reps", []),
    ("high-knees", "High knees", None, "cardio", "teach", "reps", []),
    ("skater-jump", "Skater jump", None, "cardio", "teach", "reps", []),
    ("box-jump", "Box jump", "Front Box Jump", "cardio", "teach", "reps", ["box"]),
    ("tuck-jump", "Tuck jump", "Knee Tuck Jump", "cardio", "teach", "reps", []),
    ("jump-rope", "Jump rope", "Rope Jumping", "cardio", "log", "minutes", []),
    ("treadmill-run", "Treadmill run", "Running, Treadmill", "cardio", "log", "minutes", ["machines"]),
    ("stationary-bike", "Stationary bike", "Bicycling, Stationary", "cardio", "log", "minutes", ["machines"]),
    ("rowing-machine", "Rowing machine", "Rowing, Stationary", "cardio", "log", "minutes", ["machines"]),
    ("elliptical", "Elliptical", "Elliptical Trainer", "cardio", "log", "minutes", ["machines"]),
    ("stair-climber", "Stair climber", "Stairmaster", "cardio", "log", "minutes", ["machines"]),
    # Calisthenics skills
    ("muscle-up", "Muscle-up", "Muscle Up", "skills", "log", "reps", ["pullup-bar", "rings"]),
    ("toes-to-bar", "Toes-to-bar", None, "skills", "teach", "reps", ["pullup-bar"]),
    ("nordic-curl", "Nordic curl", None, "skills", "teach", "reps", []),
    ("dragon-flag", "Dragon flag", None, "skills", "log", "reps", ["bench"]),
    ("skin-the-cat", "Skin the cat", None, "skills", "log", "reps", ["pullup-bar", "rings"]),
    ("handstand-hold", "Handstand hold (wall)", None, "skills", "log", "seconds", []),
    ("crow-pose", "Crow pose", None, "skills", "log", "seconds", []),
    ("frog-stand", "Frog stand", None, "skills", "log", "seconds", []),
    ("tuck-front-lever", "Tuck front lever", None, "skills", "log", "seconds", ["pullup-bar", "rings"]),
    ("front-lever", "Front lever", None, "skills", "log", "seconds", ["pullup-bar", "rings"]),
    ("back-lever", "Back lever", None, "skills", "log", "seconds", ["pullup-bar", "rings"]),
    ("planche-lean", "Planche lean", None, "skills", "log", "seconds", []),
    # Mobility
    ("arm-circles", "Arm circles", "Arm Circles", "mobility", "log", "seconds", []),
    ("worlds-greatest-stretch", "World's greatest stretch", "World's Greatest Stretch", "mobility", "log", "seconds", []),
    ("cat-stretch", "Cat stretch", "Cat Stretch", "mobility", "log", "seconds", ["mat"]),
    ("childs-pose", "Child's pose", "Child's Pose", "mobility", "log", "seconds", ["mat"]),
    ("hip-flexor-stretch", "Kneeling hip flexor stretch", "Kneeling Hip Flexor", "mobility", "log", "seconds", []),
    ("hamstring-stretch", "Hamstring stretch", "Hamstring Stretch", "mobility", "log", "seconds", []),
    ("quad-stretch", "Quad stretch", "Quad Stretch", "mobility", "log", "seconds", []),
    ("calf-stretch", "Calf stretch", "Calf Stretch Hands Against Wall", "mobility", "log", "seconds", []),
    ("chest-stretch", "Chest stretch", "Dynamic Chest Stretch", "mobility", "log", "seconds", []),
    ("leg-swings", "Leg swings", None, "mobility", "log", "seconds", []),
]

GROUPS = {
    "squat", "hinge", "lunge", "push", "overhead", "row", "vertical-pull", "single-joint", "core", "hold",
    "cardio", "skills", "mobility",
}
EQUIPMENT = {
    "pullup-bar", "rings", "parallettes", "dip-station", "bands", "weight-vest", "backpack", "bench", "box",
    "dumbbells", "kettlebell", "mat", "barbell", "ez-bar", "cable-machine", "machines", "assist-band",
}


def fix_text(s: str) -> str:
    """The dataset has a few UTF-8 strings that were decoded as Latin-1 ("Â¾"): undo that."""
    if "Â" in s or "â€" in s:
        try:
            return s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s.replace("Â", "")
    return s


def load_dataset(path: str | None) -> dict[str, dict]:
    if path:
        raw = Path(path).read_text(encoding="utf-8")
    else:
        with urllib.request.urlopen(DATASET_URL, timeout=60) as response:  # noqa: S310 (pinned GitHub URL)
            raw = response.read().decode("utf-8")
    return {x["name"]: x for x in json.loads(raw)}


def validate() -> None:
    ids = [i for i, _ in CAMERA] + [o[0] for o in OTHER]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise SystemExit(f"duplicate ids: {sorted(dupes)}")
    for id_, name, _src, group, tracking, mode, gear in OTHER:
        if group not in GROUPS:
            raise SystemExit(f"{id_}: unknown group {group}")
        if tracking not in ("teach", "log") or mode not in ("reps", "seconds", "minutes"):
            raise SystemExit(f"{id_}: bad tracking/mode")
        if any(g not in EQUIPMENT for g in gear):
            raise SystemExit(f"{id_}: unknown equipment in {gear}")
        if not name.strip():
            raise SystemExit(f"{id_}: no name")


def ts(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def build(dataset: dict[str, dict]) -> tuple[list[str], dict]:
    missing = [s for s in [src for _, src in CAMERA] + [o[2] for o in OTHER] if s and s not in dataset]
    if missing:
        raise SystemExit(f"not in the dataset: {missing}")

    lines: list[str] = []
    details: dict[str, dict] = {}

    def meta(src: str | None) -> dict:
        x = dataset[src] if src else None
        if x:
            details_entry = {
                "source": x["name"],
                "instructions": [fix_text(s) for s in x["instructions"]],
                "secondaryMuscles": x["secondaryMuscles"],
            }
        else:
            details_entry = {"source": None, "instructions": [], "secondaryMuscles": []}
        return {
            "level": x["level"] if x else None,
            "muscles": x["primaryMuscles"] if x else [],
            "source": x["id"] if x else None,
            "_details": details_entry,
        }

    for id_, src in CAMERA:
        m = meta(src)
        details[id_] = m.pop("_details")
        lines.append(
            f'  {{ id: {ts(id_)}, tracking: "camera", level: {ts(m["level"])}, muscles: {ts(m["muscles"])}, source: {ts(m["source"])} }},'
        )
    for id_, name, src, group, tracking, mode, gear in OTHER:
        m = meta(src)
        details[id_] = m.pop("_details")
        lines.append(
            f"  {{ id: {ts(id_)}, name: {ts(name)}, group: {ts(group)}, tracking: {ts(tracking)}, mode: {ts(mode)}, "
            f'requiresAny: {ts(gear)}, level: {ts(m["level"])}, muscles: {ts(m["muscles"])}, source: {ts(m["source"])} }},'
        )
    return lines, details


def main() -> None:
    validate()
    dataset = load_dataset(sys.argv[1] if len(sys.argv) > 1 else None)
    lines, details = build(dataset)
    header = (
        "// Generated by ml/src/build_exercises.py from free-exercise-db (Unlicense, public domain),\n"
        f"// commit {DATASET_COMMIT}. Don't edit by hand: change the script and run it again.\n"
        "// Camera-tracked entries take their name, family and equipment from catalog.ts.\n\n"
        'import type { LibraryEntry } from "./library-types";\n\n'
        "export const LIBRARY = [\n"
    )
    OUT_DATA.write_text(header + "\n".join(lines) + "\n] as const satisfies readonly LibraryEntry[];\n", encoding="utf-8")
    OUT_DETAILS.write_text(json.dumps(details, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    sourced = sum(1 for d in details.values() if d["source"])
    print(f"wrote {len(details)} exercises ({sourced} with instructions) to {OUT_DATA.name} and {OUT_DETAILS.name}")


if __name__ == "__main__":
    main()
