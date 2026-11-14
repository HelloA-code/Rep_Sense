"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckIcon, FilmIcon, InfoIcon, SearchIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { Sheet } from "@/components/ui/sheet";
import { inputClass, secondaryButtonClass } from "@/components/ui/styles";
import { TopBar } from "@/components/ui/top-bar";
import { EQUIPMENT, type EquipmentId } from "@/lib/equipment";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import { buildCustomExercise, type CustomExercise } from "@/lib/exercises/custom";
import type { AnyExerciseId } from "@/lib/exercises/ids";
import {
  ALL_EXERCISES,
  GROUP_ORDER,
  filterExercises,
  groupName,
  loadDetails,
  type ExerciseItem,
  type LibraryDetails,
  type LibraryGroup,
} from "@/lib/exercises/library";
import { cn } from "@/lib/utils";

export const SET_OPTIONS = [1, 2, 3, 4, 5] as const;

type Filter = LibraryGroup | "mine" | null;

type ExercisePickerProps = {
  equipment: readonly EquipmentId[];
  /** Exercises taught from scratch ("My exercises"). */
  custom: readonly CustomExercise[];
  /** Every taught exercise, to know which library exercises are taught already. */
  taught: readonly CustomExercise[];
  onArchive: (id: AnyExerciseId) => void;
  selected: readonly AnyExerciseId[];
  sets: number;
  onToggle: (id: AnyExerciseId) => void;
  onSets: (n: number) => void;
  onStart: () => void;
};

const chip = "h-8 flex-none px-3 text-[12px]";
const MODE_TEXT = { reps: "reps", seconds: "time", minutes: "minutes" } as const;
const EQUIPMENT_NAMES = new Map<string, string>(EQUIPMENT.map((e) => [e.id, e.label]));

function TrackingBadge({ item, taught }: { item: ExerciseItem; taught: boolean }) {
  const text = item.tracking === "camera" ? "Camera" : taught ? "Taught" : item.tracking === "teach" ? "Teach" : "Log";
  const tone = item.tracking === "camera" || taught ? "accent" : "neutral";
  return (
    <Badge tone={tone} className="h-5 shrink-0 px-2">
      {text}
    </Badge>
  );
}

function detailText(item: ExerciseItem, taught: boolean): string {
  if (item.tracking === "camera") {
    const cfg = EXERCISE_CONFIGS[item.id as keyof typeof EXERCISE_CONFIGS];
    return `${cfg.mode === "hold" ? "Timed hold" : "Reps"} · ${cfg.setupHint}`;
  }
  if (taught) return "Counted by camera (taught)";
  if (item.tracking === "teach") return "Tap to teach it, or log by hand";
  return `Log ${MODE_TEXT[item.mode]} by hand`;
}

function Row({
  name,
  detail,
  badge,
  order,
  onToggle,
  onInfo,
  onRemove,
}: {
  name: string;
  detail: string;
  badge?: React.ReactNode;
  /** Position in the workout (1-based), or 0 if not picked. */
  order: number;
  onToggle: () => void;
  onInfo?: () => void;
  onRemove?: () => void;
}) {
  const on = order > 0;
  return (
    <li className="flex items-stretch gap-2">
      <motion.button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-4 rounded-tile border px-4 py-3.5 text-left transition-colors",
          on ? "border-accent-border bg-accent-tint" : "border-border bg-surface hover:bg-surface-raised",
        )}
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border text-[13px] font-extrabold",
            on ? "border-accent bg-accent text-accent-fg" : "border-border-strong text-transparent",
          )}
        >
          {on ? order : <CheckIcon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-[15px] font-bold", on && "text-accent")}>{name}</span>
            {badge}
          </span>
          <span className="block text-[12px] font-medium text-muted">{detail}</span>
        </span>
      </motion.button>
      {(onInfo || onRemove) && (
        <button
          type="button"
          onClick={onInfo ?? onRemove}
          aria-label={onInfo ? `About ${name}` : `Remove ${name}`}
          className={cn(
            "grid w-11 shrink-0 place-items-center rounded-tile border border-border bg-surface text-muted",
            onInfo ? "hover:text-text" : "hover:text-danger",
          )}
        >
          {onInfo ? <InfoIcon className="size-4" /> : <Trash2Icon className="size-4" />}
        </button>
      )}
    </li>
  );
}

/** Instructions, muscles and actions for one exercise. Instructions load when it opens. */
function DetailSheet({
  item,
  taught,
  picked,
  onClose,
  onToggle,
}: {
  item: ExerciseItem | null;
  taught: boolean;
  picked: boolean;
  onClose: () => void;
  onToggle: (id: AnyExerciseId) => void;
}) {
  const [details, setDetails] = useState<{ id: string; data: LibraryDetails | null } | null>(null);
  useEffect(() => {
    if (!item) return;
    let live = true;
    void loadDetails(item.id).then((data) => live && setDetails({ id: item.id, data }));
    return () => {
      live = false;
    };
  }, [item]);
  if (!item) return null;

  const info = details?.id === item.id ? details.data : undefined;
  const id = item.id as AnyExerciseId;
  const cfg = item.tracking === "camera" ? EXERCISE_CONFIGS[item.id as keyof typeof EXERCISE_CONFIGS] : null;
  const equipment = item.requiresAny.map((g) => EQUIPMENT_NAMES.get(g) ?? g);
  const add = () => {
    onToggle(id);
    onClose();
  };

  const footer =
    item.tracking === "teach" && !taught ? (
      <div className="flex flex-col gap-3">
        <Link href={`/teach?for=${item.id}`} className={cn(secondaryButtonClass, "border-accent-border text-accent")}>
          <SparklesIcon className="size-4" />
          Teach it (3 reps)
        </Link>
        <PrimaryButton onClick={add}>{picked ? "Remove from workout" : "Add, log by hand"}</PrimaryButton>
      </div>
    ) : (
      <PrimaryButton onClick={add}>{picked ? "Remove from workout" : "Add to workout"}</PrimaryButton>
    );

  return (
    <Sheet open onClose={onClose} title={item.name} footer={footer}>
      <div className="flex flex-wrap items-center gap-2">
        <TrackingBadge item={item} taught={taught} />
        <Badge tone="neutral" className="h-5 px-2">
          {groupName(item.group)}
        </Badge>
        {item.level && (
          <Badge tone="neutral" className="h-5 px-2">
            {item.level}
          </Badge>
        )}
      </div>
      <dl className="mt-4 flex flex-col gap-2 text-[13px]">
        {item.muscles.length > 0 && (
          <div>
            <dt className="font-semibold text-muted">Works</dt>
            <dd className="font-semibold capitalize">
              {[...item.muscles, ...(info?.secondaryMuscles ?? [])].join(", ")}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-muted">Equipment</dt>
          <dd className="font-semibold">{equipment.length ? equipment.join(" or ") : "None (bodyweight)"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted">Tracking</dt>
          <dd className="font-semibold">
            {cfg
              ? `Counted by camera. ${cfg.setupHint}.`
              : taught
                ? "Counted by camera, the way you taught it."
                : item.tracking === "teach"
                  ? "Teach it once (3 slow reps) and the camera counts it from then on. Or just log it by hand."
                  : `Logged by hand: you type the ${MODE_TEXT[item.mode]}. The camera can't see this one reliably.`}
          </dd>
        </div>
      </dl>
      <h3 className="mt-5 text-[13px] font-bold">How to do it</h3>
      {info === undefined ? (
        <p className="mt-1 text-[13px] text-muted">Loading…</p>
      ) : info && info.instructions.length > 0 ? (
        <>
          <ol className="mt-1 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-text/90">
            {info.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-muted">
            From free-exercise-db (public domain): &ldquo;{info.source}&rdquo;.
          </p>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-muted">No instructions in our library for this one yet.</p>
      )}
    </Sheet>
  );
}

/** Step 1 of a workout: search and pick exercises, in the order you'll do them, and how many sets. */
export function ExercisePicker({
  equipment,
  custom,
  taught,
  onArchive,
  selected,
  sets,
  onToggle,
  onSets,
  onStart,
}: ExercisePickerProps) {
  const total = selected.length * sets;
  const [filter, setFilter] = useState<Filter>(null);
  const [query, setQuery] = useState("");
  const [cameraOnly, setCameraOnly] = useState(false);
  const [allGear, setAllGear] = useState(false);
  const [info, setInfo] = useState<ExerciseItem | null>(null);
  const order = (id: string) => selected.indexOf(id as AnyExerciseId) + 1;

  const taughtIds = useMemo(
    () => new Set(taught.filter((c) => !c.archived && c.libraryId).map((c) => c.libraryId as string)),
    [taught],
  );
  const owned = allGear ? null : equipment;
  const items = useMemo(
    () => filterExercises(ALL_EXERCISES, { query, cameraOnly, taught: taughtIds, owned }),
    [query, cameraOnly, taughtIds, owned],
  );
  const groups = GROUP_ORDER.filter((g) => items.some((e) => e.group === g));
  const q = query.trim().toLowerCase();
  const mine = custom.filter((c) => !q || c.name.toLowerCase().includes(q));

  function tap(item: ExerciseItem) {
    // Not taught yet: choose between teaching it and logging it by hand.
    if (item.tracking === "teach" && !taughtIds.has(item.id) && order(item.id) === 0) setInfo(item);
    else onToggle(item.id as AnyExerciseId);
  }

  function remove(c: CustomExercise) {
    if (window.confirm(`Remove "${c.name}"? Past workouts keep it.`)) onArchive(c.id);
  }

  return (
    <div className="flex flex-1 flex-col pb-8">
      <TopBar title="New workout" backHref="/today" />
      <p className="-mt-1 text-[14px] font-medium text-muted">
        Pick exercises in the order you&rsquo;ll do them. Only ones your equipment allows are shown.
      </p>

      <Link href="/teach" className={cn(secondaryButtonClass, "mt-4 gap-2")}>
        <SparklesIcon className="size-4" />
        Teach a new exercise
      </Link>

      <label className="relative mt-4 block">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises or muscles"
          aria-label="Search exercises"
          className={cn(inputClass, "pl-11")}
        />
      </label>

      <div
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        role="group"
        aria-label="Filter by group"
      >
        <SegmentChip selected={filter === null} onClick={() => setFilter(null)} className={chip}>
          All
        </SegmentChip>
        {custom.length > 0 && (
          <SegmentChip selected={filter === "mine"} onClick={() => setFilter("mine")} className={chip}>
            Mine
          </SegmentChip>
        )}
        {groups.map((g) => (
          <SegmentChip key={g} selected={filter === g} onClick={() => setFilter(g)} className={chip}>
            {groupName(g)}
          </SegmentChip>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <SegmentChip selected={cameraOnly} onClick={() => setCameraOnly((v) => !v)} className={chip}>
          Camera only
        </SegmentChip>
        <SegmentChip selected={allGear} onClick={() => setAllGear((v) => !v)} className={chip}>
          All equipment
        </SegmentChip>
      </div>

      {mine.length > 0 && (filter === null || filter === "mine") && (
        <section className="mt-5">
          <h2 className="mb-2 text-[12px] font-semibold text-muted">My exercises</h2>
          <ul className="flex flex-col gap-2.5">
            {mine.map((c) => (
              <Row
                key={c.id}
                name={c.name}
                detail={`Taught · ${buildCustomExercise(c).setupHint}`}
                order={order(c.id)}
                onToggle={() => onToggle(c.id)}
                onRemove={() => remove(c)}
              />
            ))}
          </ul>
        </section>
      )}

      {filter !== "mine" &&
        groups
          .filter((g) => filter === null || filter === g)
          .map((g) => (
            <section key={g} className="mt-5">
              <h2 className="mb-2 text-[12px] font-semibold text-muted">{groupName(g)}</h2>
              <ul className="flex flex-col gap-2.5">
                {items
                  .filter((e) => e.group === g)
                  .map((e) => (
                    <Row
                      key={e.id}
                      name={e.name}
                      detail={detailText(e, taughtIds.has(e.id))}
                      badge={<TrackingBadge item={e} taught={taughtIds.has(e.id)} />}
                      order={order(e.id)}
                      onToggle={() => tap(e)}
                      onInfo={() => setInfo(e)}
                    />
                  ))}
              </ul>
            </section>
          ))}

      {items.length === 0 && mine.length === 0 && (
        <p className="mt-8 text-center text-[14px] font-medium text-muted">
          Nothing matches. Try another word{allGear ? "" : ", or turn on All equipment"}.
        </p>
      )}

      <p className="mt-6 text-[12px] font-semibold text-muted">Sets per exercise</p>
      <div className="mt-2 flex gap-2">
        {SET_OPTIONS.map((n) => (
          <SegmentChip key={n} selected={sets === n} onClick={() => onSets(n)}>
            {n}
          </SegmentChip>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <PrimaryButton onClick={onStart} disabled={selected.length === 0}>
          {selected.length === 0
            ? "Pick at least one exercise"
            : `Start workout · ${total} ${total === 1 ? "set" : "sets"}`}
        </PrimaryButton>
        <Link
          href="/record"
          className="mt-3 flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-muted hover:text-text"
        >
          <FilmIcon className="size-4" />
          Just start moving (free camera &amp; recorder)
        </Link>
      </div>

      <DetailSheet
        item={info}
        taught={info ? taughtIds.has(info.id) : false}
        picked={info ? order(info.id) > 0 : false}
        onClose={() => setInfo(null)}
        onToggle={onToggle}
      />
    </div>
  );
}
