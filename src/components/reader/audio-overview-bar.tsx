"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadAudioOverview,
  overviewToObjectUrl,
  type StoredAudioOverview,
} from "@/lib/reader/audio-overview-store";

/** Compact sticky player — NotebookLM-style “play anytime” bar. */
export function AudioOverviewBar({ bookId }: { bookId: string }) {
  const [overview, setOverview] = useState<StoredAudioOverview | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const stored = await loadAudioOverview(bookId);
      if (cancelled) return;
      setOverview(stored);
      if (stored) {
        const next = overviewToObjectUrl(stored);
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return next;
        });
      } else {
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    };
    void refresh();
    const onFocus = () => void refresh();
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent<{ bookId?: string }>).detail;
      if (!detail?.bookId || detail.bookId === bookId) void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("bookflow:audio-overview", onSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("bookflow:audio-overview", onSaved);
    };
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.src = url;
    audio.load();
  }, [url]);

  if (!overview || !url) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-3 z-[70] flex justify-center px-3"
      data-testid="audio-overview-bar"
    >
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-full border border-neutral-200/90 bg-white/95 px-2.5 py-2 pl-3.5 shadow-[0_16px_50px_rgba(0,0,0,0.12)] backdrop-blur-md">
        <audio
          ref={audioRef}
          onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
        <Radio className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium tracking-tight">
            Audio Overview
          </p>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(current, duration || 0)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = v;
              setCurrent(v);
            }}
            className="mt-1 h-1 w-full cursor-pointer accent-black"
            aria-label="Seek audio overview"
          />
        </div>
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label={playing ? "Pause overview" : "Play overview"}
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (playing) audio.pause();
            else void audio.play();
          }}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
