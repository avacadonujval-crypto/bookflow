"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Pause, Play, Radio, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateAudioOverview } from "@/lib/actions/reader-ai";
import {
  loadAudioOverview,
  overviewToObjectUrl,
  saveAudioOverview,
  type StoredAudioOverview,
} from "@/lib/reader/audio-overview-store";

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioOverviewPlayer({
  bookId,
  bookTitle,
  className,
}: {
  bookId: string;
  bookTitle?: string;
  className?: string;
}) {
  const [overview, setOverview] = useState<StoredAudioOverview | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadAudioOverview(bookId);
        if (cancelled) return;
        if (stored) {
          setOverview(stored);
          const url = overviewToObjectUrl(stored);
          setObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !objectUrl) return;
    audio.src = objectUrl;
    audio.load();
  }, [objectUrl]);

  const generate = (force = false) => {
    if (pending) return;
    if (overview && !force) return;
    setError(null);
    startTransition(async () => {
      const res = await generateAudioOverview({ bookId });
      if (!res.ok || !res.audioBase64) {
        setError(res.message ?? "Could not create Audio Overview");
        return;
      }
      const stored: StoredAudioOverview = {
        bookId,
        title: res.title ?? `Audio Overview — ${bookTitle ?? "Book"}`,
        script: res.script ?? "",
        mimeType: res.mimeType ?? "audio/wav",
        audioBase64: res.audioBase64,
        createdAt: Date.now(),
      };
      await saveAudioOverview(stored);
      setOverview(stored);
      const url = overviewToObjectUrl(stored);
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setCurrent(0);
      setPlaying(false);
    });
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !objectUrl) {
      generate(false);
      return;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setError("Could not start playback. Try again.");
    }
  };

  const onSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  if (!ready) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border border-neutral-200/80 bg-gradient-to-b from-neutral-100 to-white p-4",
        className,
      )}
      data-testid="audio-overview-player"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-neutral-200/50 blur-2xl"
        aria-hidden
      />
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Listen
          </p>
          <h3 className="mt-0.5 text-[15px] font-semibold tracking-tight">
            Audio Overview
          </h3>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {overview
              ? overview.title
              : "A short briefing you can play anytime while reading."}
          </p>
        </div>
        {overview ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => generate(true)}
            aria-label="Regenerate audio overview"
            className="rounded-full p-2 text-neutral-500 transition hover:bg-white hover:text-foreground disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>

      {!overview ? (
        <Button
          type="button"
          className="relative mt-4 w-full"
          disabled={pending}
          onClick={() => generate(false)}
          data-testid="audio-overview-generate"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Radio className="h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      ) : (
        <div className="relative mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void togglePlay()}
            disabled={pending}
            aria-label={playing ? "Pause" : "Play"}
            data-testid="audio-overview-play"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-neutral-800 disabled:opacity-40"
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(current, duration || 0)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="h-1 w-full cursor-pointer accent-black"
              aria-label="Seek audio overview"
            />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-neutral-400">
              <span>{formatTime(current)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <p className="relative mt-2 text-[12px] text-foreground" role="alert">
          {error}
          <button
            type="button"
            className="ml-2 inline-flex align-middle"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <X className="h-3 w-3" />
          </button>
        </p>
      ) : null}
    </section>
  );
}
