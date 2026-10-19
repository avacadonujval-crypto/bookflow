"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  Radio,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { synthesizeTutorSpeech } from "@/lib/actions/reader-ai";
import type { ChatMessage } from "@/lib/ai/study-types";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function LiveTutorModal({
  open,
  onClose,
  bookId,
}: {
  open: boolean;
  onClose: () => void;
  bookId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"idle" | "thinking" | "speaking">(
    "idle",
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speakRef = useRef(speakReplies);
  speakRef.current = speakReplies;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      audioRef.current?.pause();
      setListening(false);
      setStreaming(false);
      setLiveStatus("idle");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      audioRef.current?.pause();
    };
  }, []);

  const speakText = async (messageId: string, text: string) => {
    if (!speakRef.current || !text.trim()) return;
    setLiveStatus("speaking");
    try {
      const res = await synthesizeTutorSpeech({ bookId, text });
      if (res.ok && res.audioBase64) {
        const url = `data:${res.mimeType ?? "audio/wav"};base64,${res.audioBase64}`;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, audioUrl: url } : m)),
        );
        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setLiveStatus("idle");
        await audio.play().catch(() => setLiveStatus("idle"));
        return;
      }
    } catch {
      /* fall through to browser TTS */
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.slice(0, 3500));
      utter.onend = () => setLiveStatus("idle");
      window.speechSynthesis.speak(utter);
      return;
    }
    setLiveStatus("idle");
  };

  const askLive = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || streaming) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: prompt,
    };
    const assistantId = `a-${Date.now() + 1}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);
    setLiveStatus("thinking");

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/tutor-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, message: prompt, history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Live tutor unavailable",
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          let event = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine) as {
            text?: string;
            content?: string;
            message?: string;
            state?: string;
          };

          if (event === "delta" && payload.text) {
            full += payload.text;
            setLiveStatus("speaking");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: full } : m,
              ),
            );
          }
          if (event === "error") {
            throw new Error(payload.message || "Live tutor error");
          }
          if (event === "done" && payload.content && !full) {
            full = payload.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: full } : m,
              ),
            );
          }
        }
      }

      if (full) await speakText(assistantId, full);
      else setLiveStatus("idle");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Live tutor failed");
      setLiveStatus("idle");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: "Sorry — I couldn’t answer just now. Try again." }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const toggleListen = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError("Voice needs Chrome or Edge with microphone access.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        parts.push(event.results[i][0].transcript);
      }
      const transcript = parts.join(" ").trim();
      setInput(transcript);
      const last = event.results[event.results.length - 1];
      if (last?.isFinal && transcript) {
        void askLive(transcript);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        setError("Allow microphone access for live voice tutoring.");
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Live Tutor"
      subtitle="Ask out loud or type — answers stream in live"
      size="xl"
      className="h-[min(88vh,820px)]"
    >
      <div className="flex h-full min-h-[480px] flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
              liveStatus === "idle" && "bg-neutral-100 text-muted-foreground",
              liveStatus === "thinking" && "bg-neutral-200 text-foreground",
              liveStatus === "speaking" && "bg-black text-white",
            )}
          >
            <Radio className="h-3 w-3" />
            {liveStatus === "idle"
              ? "Ready"
              : liveStatus === "thinking"
                ? "Listening…"
                : "Answering live"}
          </span>
          <Button
            type="button"
            size="sm"
            variant={speakReplies ? "default" : "outline"}
            onClick={() => {
              const next = !speakReplies;
              setSpeakReplies(next);
              if (!next) {
                audioRef.current?.pause();
                window.speechSynthesis?.cancel();
              }
            }}
          >
            {speakReplies ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            {speakReplies ? "Speak answers" : "Text only"}
          </Button>
          {streaming ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => abortRef.current?.abort()}
            >
              Stop
            </Button>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
              <Radio className="mx-auto h-5 w-5" />
              <p className="mt-2 text-sm text-muted-foreground">
                Live session ready. Ask anything about this PDF — answers appear
                as the tutor thinks, and you can replay spoken replies anytime.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {[
                  "What is this book mainly about?",
                  "Explain the hardest idea simply",
                  "Quiz me with one question",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs hover:border-black"
                    onClick={() => void askLive(s)}
                    disabled={streaming}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-black text-white"
                  : "mr-auto border border-neutral-200 bg-white",
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">
                {m.content || (streaming ? "…" : "")}
              </pre>
              {m.role === "assistant" && m.audioUrl ? (
                <div className="mt-2">
                  <audio controls src={m.audioUrl} className="w-full max-w-sm" />
                </div>
              ) : null}
            </div>
          ))}

          {streaming && liveStatus === "thinking" ? (
            <div className="mr-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Tutor is thinking…
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-foreground" role="alert">
              {error}
            </p>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-neutral-100 px-5 py-3">
          {listening ? (
            <p className="mb-2 text-xs text-muted-foreground">
              Mic live — speak your question, then pause.
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              size="icon"
              variant={listening ? "default" : "outline"}
              aria-label={listening ? "Stop mic" : "Start live voice"}
              onClick={toggleListen}
              disabled={streaming}
            >
              {listening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask live…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void askLive(input);
                }
              }}
            />
            <Button
              type="button"
              disabled={streaming || !input.trim()}
              onClick={() => void askLive(input)}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
