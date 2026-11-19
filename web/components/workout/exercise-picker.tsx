"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FilmIcon, InfoIcon, MinusIcon, PlusIcon, SearchIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { Sheet } from "@/components/ui/sheet";
import { inputClass, secondaryButtonClass } from "@/components/ui/styles";
import { TopBar } from "@/components/ui/top-bar";
import { EQUIPMENT, type EquipmentId } from "@/lib/equipment";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import { buildCustomExercise, type CustomExercise } from "@/lib/exercises/custom";
import { GROUP_EMOJI, TRACKING_EMOJI, exerciseEmoji } from "@/lib/exercises/emoji";
import type { AnyExerciseId } from "@/lib/exercises/ids";
import {
  ALL_EXERCISES,
  GROUP_ORDER,
  exerciseInfo,
  filterExercises,
  groupName,
  loadDetails,
  type ExerciseItem,
  type LibraryDetails,
  type LibraryGroup,
} from "@/lib/exercises/library";
import { exerciseName } from "@/lib/exercises/registry";
import { cn } from "@/lib/utils";

export const MIN_SETS = 1;
export const MAX_SETS = 5;

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
  /** About to open the teach screen: keep the picks so far. */
  onTeach: () => void;
  onClear: () => void;
};

const chip = "h-8 flex-none px-3 text-[12px]";
const MODE_TEXT = { reps: "reps", seconds: "time", minutes: "minutes" } as const;
const EQUIPMENT_NAMES = new Map<string, string>(EQUIPMENT.map((e) => [e.id, e.label]));

function trackingOf(item: ExerciseItem, taught: boolean) {
  if (item.tracking === "camera") return { key: "camera", text: "Camera" } as const;
  if (taught) return { key: "taught", text: "Taught" } as const;
  return item.tracking === "teach" ? ({ key: "teach", text: "Teach" } as const) : ({ key: "log", text: "Log" } as const);
}

function TrackingBadge({ item, taught }: { item: ExerciseItem; taught: boolean }) {
  const t = trackingOf(item, taught);
  return (
    <Badge tone={t.key === "camera" || t.key === "taught" ? "accent" : "neutral"} className="h-5 shrink-0 gap-1 px-2">
      <span aria-hidden>{TRACKING_EMOJI[t.key]}</span>
      {t.text}
    </Badge>
  );
}

function detailText(item: ExerciseItem, taught: boolean): string {
  if (item.tracking === "camera") {
    const cfg = EXERCISE_CONFIGS[item.id as keyof typeof EXERCISE_CONFIGS];
    return cfg.mode === "hold" ? `Timed hold · ${cfg.setupHint}` : cfg.setupHint;
  }
  if (taught) return "The camera counts it, the way you taught it";
  if (item.tracking === "teach") return "Show it 3 reps once, or log it by hand";
  return `You type the ${MODE_TEXT[item.mode]}`;
}

function Row({
  emoji,
  name,
  detail,
  badge,
  order,
  onToggle,
  onInfo,
  onRemove,
}: {
  emoji: string;
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
        aria-label={on ? `${name}, number ${order} in your workout` : `Add ${name}`}
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-tile border px-3 py-3 text-left transition-colors",
          on ? "border-accent-border bg-accent-tint" : "border-border bg-surface hover:bg-surface-raised",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-[19px]",
            on ? "bg-accent text-[15px] font-extrabold text-accent-fg" : "border border-border bg-surface-raised",
          )}
        >
          {on ? order : emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[15px] font-bold", on && "text-accent")}>{name}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {badge}
            <span className="truncate text-[12px] font-medium text-muted">{detail}</span>
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border",
            on ? "border-accent bg-accent text-accent-fg" : "border-border-strong text-muted",
          )}
        >
          {on ? <XIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
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
  onTeach,
}: {
  item: ExerciseItem | null;
  taught: boolean;
  picked: boolean;
  onClose: () => void;
  onToggle: (id: AnyExerciseId) => void;
  onTeach: () => void;
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
        <Link
          href={`/teach?for=${item.id}`}
          onClick={onTeach}
          className={cn(secondaryButtonClass, "border-accent-border text-accent")}
        >
          <SparklesIcon className="size-4" />
          Teach it (3 reps)
        </Link>
        <PrimaryButton onClick={add}>{picked ? "Remove from workout" : "Add, log by hand"}</PrimaryButton>
      </div>
    ) : (
      <PrimaryButton onClick={add}>{picked ? "Remove from workout" : "Add to workout"}</PrimaryButton>
    );

  return (
    <Sheet open onClose={onClose} title={`${exerciseEmoji(item.id, item.group)} ${item.name}`} footer={footer}>
      <div className="flex flex-wrap items-center gap-2">
        <TrackingBadge item={item} taught={taught} />
        <Badge tone="neutral" className="h-5 px-2">
          {GROUP_EMOJI[item.group]} {groupName(item.group)}
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
            <dt className="font-semibold text-muted">💪 Works</dt>
            <dd className="font-semibold capitalize">
              {[...item.muscles, ...(info?.secondaryMuscles ?? [])].join(", ")}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-muted">🧰 Equipment</dt>
          <dd className="font-semibold">{equipment.length ? equipment.join(" or ") : "None (bodyweight)"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted">{TRACKING_EMOJI[trackingOf(item, taught).key]} Tracking</dt>
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
      <h3 className="mt-5 text-[13px] font-bold">📋 How to do it</h3>
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

/** Always on screen: what's picked (in order), sets per exercise, and Start. */
function WorkoutBar({
  picked,
  sets,
  onSets,
  onRemove,
  onClear,
  onStart,
}: {
  picked: { id: AnyExerciseId; name: string; emoji: string }[];
  sets: number;
  onSets: (n: number) => void;
  onRemove: (id: AnyExerciseId) => void;
  onClear: () => void;
  onStart: () => void;
}) {
  const total = picked.length * sets;
  const stepper =
    "grid size-9 place-items-center rounded-full border border-border-strong bg-surface text-text disabled:opacity-30";
  return (
    <div className="sticky bottom-0 z-20 -mx-5 mt-6 border-t border-border bg-bg/95 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur">
      {picked.length === 0 ? (
        <p className="pb-3 text-center text-[13px] font-semibold text-muted">
          👆 Tap exercises to add them, in the order you&rsquo;ll do them
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-muted">
              Your workout · {picked.length} {picked.length === 1 ? "exercise" : "exercises"}
            </p>
            <button type="button" onClick={onClear} className="text-[12px] font-semibold text-muted hover:text-text">
              Clear
            </button>
          </div>
          <ol className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" aria-label="Your workout">
            {picked.map((p, i) => (
              <li key={p.id} className="flex-none">
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`Remove ${p.name}`}
                  className="flex h-8 items-center gap-1.5 rounded-chip border border-accent-border bg-accent-tint pr-2 pl-1 text-[12px] font-bold text-accent"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-[11px] font-extrabold text-accent-fg">
                    {i + 1}
                  </span>
                  <span aria-hidden>{p.emoji}</span>
                  {p.name}
                  <XIcon className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center gap-2" role="group" aria-label="Sets per exercise">
          <button
            type="button"
            className={stepper}
            onClick={() => onSets(sets - 1)}
            disabled={sets <= MIN_SETS}
            aria-label="One set fewer"
          >
            <MinusIcon className="size-4" />
          </button>
          <p className="w-12 text-center leading-tight">
            <span className="block text-[17px] font-extrabold tabular-nums">{sets}</span>
            <span className="block text-[10px] font-semibold text-muted">{sets === 1 ? "set each" : "sets each"}</span>
          </p>
          <button
            type="button"
            className={stepper}
            onClick={() => onSets(sets + 1)}
            disabled={sets >= MAX_SETS}
            aria-label="One set more"
          >
            <PlusIcon className="size-4" />
          </button>
        </div>
        <PrimaryButton onClick={onStart} disabled={picked.length === 0} className="flex-1">
          {picked.length === 0 ? "Pick exercises" : `Start · ${total} ${total === 1 ? "set" : "sets"}`}
        </PrimaryButton>
      </div>
    </div>
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
  onTeach,
  onClear,
}: ExercisePickerProps) {
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
  const picked = selected.map((id) => {
    const item = exerciseInfo(id);
    return {
      id,
      name: exerciseName(id, taught),
      emoji: item ? exerciseEmoji(id, item.group) : GROUP_EMOJI.mine,
    };
  });

  function tap(item: ExerciseItem) {
    // Not taught yet: choose between teaching it and logging it by hand.
    if (item.tracking === "teach" && !taughtIds.has(item.id) && order(item.id) === 0) setInfo(item);
    else onToggle(item.id as AnyExerciseId);
  }

  function remove(c: CustomExercise) {
    if (window.confirm(`Remove "${c.name}"? Past workouts keep it.`)) onArchive(c.id);
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="New workout" backHref="/today" />
      <p className="-mt-1 text-[14px] font-medium text-muted">
        Tap exercises to add them. Only ones your equipment allows are shown.
      </p>

      <Link href="/teach" onClick={onTeach} className={cn(secondaryButtonClass, "mt-4 gap-2")}>
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
            {GROUP_EMOJI.mine} Mine
          </SegmentChip>
        )}
        {groups.map((g) => (
          <SegmentChip key={g} selected={filter === g} onClick={() => setFilter(g)} className={chip}>
            {GROUP_EMOJI[g]} {groupName(g)}
          </SegmentChip>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <SegmentChip selected={cameraOnly} onClick={() => setCameraOnly((v) => !v)} className={chip}>
          {TRACKING_EMOJI.camera} Camera only
        </SegmentChip>
        <SegmentChip selected={allGear} onClick={() => setAllGear((v) => !v)} className={chip}>
          🧰 All equipment
        </SegmentChip>
      </div>

      {mine.length > 0 && (filter === null || filter === "mine") && (
        <section className="mt-5">
          <h2 className="mb-2 text-[12px] font-semibold text-muted">
            {GROUP_EMOJI.mine} My exercises · {mine.length}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {mine.map((c) => (
              <Row
                key={c.id}
                emoji={GROUP_EMOJI.mine}
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
          .map((g) => {
            const inGroup = items.filter((e) => e.group === g);
            return (
              <section key={g} className="mt-5">
                <h2 className="mb-2 text-[12px] font-semibold text-muted">
                  {GROUP_EMOJI[g]} {groupName(g)} · {inGroup.length}
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {inGroup.map((e) => (
                    <Row
                      key={e.id}
                      emoji={exerciseEmoji(e.id, e.group)}
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
            );
          })}

      {items.length === 0 && mine.length === 0 && (
        <p className="mt-8 text-center text-[14px] font-medium text-muted">
          🤷 Nothing matches. Try another word{allGear ? "" : ", or turn on All equipment"}.
        </p>
      )}

      <Link
        href="/record"
        className="mt-6 flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-muted hover:text-text"
      >
        <FilmIcon className="size-4" />
        Just start moving (free camera &amp; recorder)
      </Link>

      <WorkoutBar
        picked={picked}
        sets={sets}
        onSets={(n) => onSets(Math.min(MAX_SETS, Math.max(MIN_SETS, n)))}
        onRemove={onToggle}
        onClear={onClear}
        onStart={onStart}
      />

      <DetailSheet
        item={info}
        taught={info ? taughtIds.has(info.id) : false}
        picked={info ? order(info.id) > 0 : false}
        onClose={() => setInfo(null)}
        onToggle={onToggle}
        onTeach={onTeach}
      />
    </div>
  );
}
