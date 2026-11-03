"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, DownloadIcon, FileJsonIcon, FilmIcon, Trash2Icon, VideoIcon } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { primaryButtonClass } from "@/components/ui/styles";
import {
  deleteClip,
  getAllClips,
  getClip,
  getClipVideo,
  listClips,
  updateClip,
  type ClipMeta,
} from "@/lib/recording/clip-store";
import { RECORDING_LABELS, recordingFileName, type Recording } from "@/lib/recording/format";
import { bundleFileName, createBundle } from "@/lib/recording/replay";
import { videoExtension } from "@/components/workout/video-recorder";
import { ClipFields, clipSummary } from "./clip-fields";
import { ClipAppCount } from "./clip-app-count";
import { ClipPreview } from "./clip-preview";
import { shareOrDownload } from "./export";

const labelName = (id: string) => RECORDING_LABELS.find((l) => l.id === id)?.name ?? id;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatBytes(n: number) {
  return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
}

export function ClipLibrary() {
  const [clips, setClips] = useState<ClipMeta[] | null>(null);
  const [error, setError] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [open, setOpen] = useState<Recording | null>(null);
  const [openVideo, setOpenVideo] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setClips(await listClips());
      const est = await navigator.storage?.estimate?.();
      setUsage(est?.usage ?? null);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const map = new Map<string, ClipMeta[]>();
    for (const c of clips ?? []) map.set(c.label, [...(map.get(c.label) ?? []), c]);
    return RECORDING_LABELS.filter((l) => map.has(l.id)).map((l) => ({ ...l, clips: map.get(l.id)! }));
  }, [clips]);

  async function openClip(id: string) {
    setOpenId(id);
    const [rec, video] = await Promise.all([getClip(id), getClipVideo(id)]);
    setOpenVideo(video);
    setOpen(rec);
  }

  function closeClip() {
    setOpenId(null);
    setOpen(null);
    setOpenVideo(null);
  }

  function exportVideo() {
    if (!open || !openVideo) return;
    const name = recordingFileName(open).replace(/\.json$/, `.${videoExtension(openVideo.type)}`);
    void shareOrDownload(name, openVideo);
  }

  async function retag(patch: Partial<Pick<Recording, "label" | "view">>) {
    if (!openId || !open) return;
    setOpen({ ...open, ...patch });
    await updateClip(openId, patch);
    await refresh();
  }

  async function remove() {
    if (!openId || !window.confirm("Delete this clip? This can't be undone.")) return;
    await deleteClip(openId);
    closeClip();
    await refresh();
  }

  async function exportAll() {
    setBusy(true);
    try {
      const now = new Date();
      await shareOrDownload(bundleFileName(now), createBundle(await getAllClips(), now));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        icon={FilmIcon}
        title="Clips unavailable"
        text="This browser is blocking on-device storage (private mode?). Try a normal window."
      />
    );
  }
  if (!clips) return null;

  if (clips.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={FilmIcon}
          title="No clips yet"
          text="Record yourself on the workout screen with the red button. You'll get to watch each clip back before saving it."
        />
        <Link href="/record" className={primaryButtonClass}>
          Open camera
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <Card key={g.id} className="p-0">
            <p className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-[15px] font-bold">{g.name}</span>
              <span className="badge-text text-muted">
                {g.clips.length} clip{g.clips.length === 1 ? "" : "s"}
              </span>
            </p>
            <ul>
              {g.clips.map((c) => (
                <li key={c.id} className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => openClip(c.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-raised"
                  >
                    <span className="flex-1">
                      <span className="flex items-center gap-1.5 text-[14px] font-bold capitalize">
                        {c.video && <VideoIcon className="size-3.5 text-accent" aria-label="Has video" />}
                        {c.view} · {formatDate(c.createdAt)}
                      </span>
                      <span className="block text-[12px] font-medium text-muted">{clipSummary(c)}</span>
                    </span>
                    <ChevronRightIcon className="size-4 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}

        <SecondaryButton onClick={exportAll} disabled={busy} className="mt-2">
          <DownloadIcon className="size-4" />
          {busy ? "Preparing…" : clips.length === 1 ? "Export 1 clip" : `Export all ${clips.length} clips`}
        </SecondaryButton>
        <p className="text-center text-[12px] font-medium text-muted">
          One file with every clip&rsquo;s landmark data (no video), for training the model on a laptop.
          {usage !== null && ` Using ${formatBytes(usage)} on this device.`}
        </p>
      </div>

      <Sheet
        open={openId !== null}
        onClose={closeClip}
        title={open ? labelName(open.label) : "Clip"}
        footer={
          open && (
            <div className="flex gap-3">
              <SecondaryButton onClick={remove} className="text-danger">
                <Trash2Icon className="size-4" />
                Delete
              </SecondaryButton>
              {openVideo ? (
                <PrimaryButton onClick={exportVideo}>
                  <DownloadIcon className="size-4" />
                  Save video
                </PrimaryButton>
              ) : (
                <PrimaryButton onClick={() => shareOrDownload(recordingFileName(open), open)}>
                  <FileJsonIcon className="size-4" />
                  Export data
                </PrimaryButton>
              )}
            </div>
          )
        }
      >
        {open ? (
          <>
            <ClipPreview recording={open} video={openVideo} />
            <p className="mt-2 text-[12px] font-semibold text-muted">
              {formatDate(open.createdAt)} · {clipSummary(open)}
              {openVideo && ` · video ${formatBytes(openVideo.size)}`}
            </p>
            <ClipAppCount recording={open} />
            {openVideo && (
              <button
                type="button"
                onClick={() => shareOrDownload(recordingFileName(open), open)}
                className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-accent"
              >
                <FileJsonIcon className="size-4" />
                Export landmark data (JSON)
              </button>
            )}
            <div className="mt-5">
              <ClipFields
                label={open.label}
                view={open.view}
                onLabel={(label) => retag({ label })}
                onView={(view) => retag({ view })}
              />
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-[13px] font-semibold text-muted">Loading…</p>
        )}
      </Sheet>
    </>
  );
}
