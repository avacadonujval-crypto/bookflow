"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Download,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  runReaderAI,
  synthesizeTutorSpeech,
} from "@/lib/actions/reader-ai";
import type { AIFeature } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/study-types";

const SUGGESTIONS = [
  "Give me an overview of this PDF",
  "Explain the hardest idea simply",
  "What should I remember for a quiz?",
];

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

function resolveFeature(prompt: string): AIFeature {
  const lower = prompt.toLowerCase();
  if (lower.includes("summar") || lower.includes("overview")) {
    return "chapter_summary";
  }
  if (lower.includes("teach") || lower.includes("lesson")) {
    return "teach_book";
  }
  if (lower.includes("study guide") || lower.includes("revision")) {
    return "study_guide";
  }
  if (lower.includes("explain") || lower.includes("simply")) {
    return "explain";
  }
  return "ask_book";
}

function speakWithBrowser(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 4000));
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

export function TutorChatModal({
  open,
  onClose,
  bookId,
  initialPrompt,
  onOpenFlashcards,
  onOpenQuiz,
}: {
  open: boolean;
  onClose: () => void;
  bookId: string;
  initialPrompt?: string | null;
  onOpenFlashcards: (topic?: string) => void;
  onOpenQuiz: (topic?: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRepliesRef = useRef(voiceReplies);
  voiceRepliesRef.current = voiceReplies;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      audioRef.current?.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const attachSpeech = async (messageId: string, text: string) => {
    setRecordingId(messageId);
    try {
      const res = await synthesizeTutorSpeech({ bookId, text });
      if (!res.ok || !res.audioBase64) {
        if (voiceRepliesRef.current) speakWithBrowser(text);
        if (res.message) setError(res.message);
        return null;
      }
      const url = `data:${res.mimeType ?? "audio/wav"};base64,${res.audioBase64}`;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, audioUrl: url } : m)),
      );
      return url;
    } finally {
      setRecordingId(null);
    }
  };

  const playAudio = (messageId: string, url: string) => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    setSpeakingId(messageId);
    audio.onended = () => setSpeakingId(null);
    audio.onerror = () => setSpeakingId(null);
    void audio.play().catch(() => setSpeakingId(null));
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeakingId(null);
  };

  const narrateMessage = async (message: ChatMessage) => {
    if (speakingId === message.id) {
      stopAudio();
      return;
    }
    if (message.audioUrl) {
      playAudio(message.id, message.audioUrl);
      return;
    }
    const url = await attachSpeech(message.id, message.content);
    if (url) playAudio(message.id, url);
  };

  const ask = (text: string) => {
    const prompt = text.trim();
    if (!prompt || pending) return;
    setError(null);

    const lower = prompt.toLowerCase();
    if (lower.includes("flashcard") || lower.includes("flash card")) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: prompt },
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          content: "Opening a flashcard deck for that topic in the center studio…",
        },
      ]);
      onOpenFlashcards(prompt);
      return;
    }
    if (lower.includes("quiz") || lower.includes("practice question")) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: prompt },
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          content: "Opening a practice quiz in the center studio…",
        },
      ]);
      onOpenQuiz(prompt);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: prompt },
    ]);
    setInput("");

    const feature = resolveFeature(prompt);
    startTransition(async () => {
      const res = await runReaderAI({
        feature,
        bookId,
        question: prompt,
      });

      if (!res.ok) {
        setError(res.message ?? "AI request failed");
        return;
      }

      const id = `a-${Date.now()}`;
      const content = res.content ?? "No response.";
      setMessages((prev) => [
        ...prev,
        { id, role: "assistant", content },
      ]);

      if (voiceRepliesRef.current) {
        const url = await attachSpeech(id, content);
        if (url) playAudio(id, url);
      }
    });
  };

  const createAudioLesson = () => {
    const prompt =
      "Create a short spoken audio lesson overview of this PDF for a student. Keep it clear and under two minutes of speech.";
    setVoiceReplies(true);
    ask(prompt);
  };

  const toggleListen = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError("Voice chat needs a browser with speech recognition (Chrome or Edge).");
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
        ask(transcript);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        setError("Microphone permission is required for voice chat.");
      } else if (event.error !== "aborted") {
        setError("Voice recognition stopped. Try again.");
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    recognition.start();
  };

  useEffect(() => {
    if (!open) {
      startedRef.current = null;
      stopAudio();
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const prompt = initialPrompt?.trim();
    if (!prompt || startedRef.current === prompt) return;
    startedRef.current = prompt;
    setMessages([]);
    setInput("");
    ask(prompt);
    // Intentionally only when the modal opens with a new seed prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Study chat"
      subtitle="Ask anytime — create audio and replay whenever you want"
      size="xl"
      className="h-[min(88vh,820px)]"
    >
      <div className="flex h-full min-h-[480px] flex-col">
        <div className="flex flex-wrap gap-2 border-b border-neutral-100 px-5 py-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenFlashcards(input || "Key ideas from this PDF")}
          >
            Open flashcards
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenQuiz(input || "Quiz me on this PDF")}
          >
            Open practice quiz
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={createAudioLesson}
          >
            <Volume2 className="h-3.5 w-3.5" />
            Audio lesson
          </Button>
          <Button
            type="button"
            size="sm"
            variant={voiceReplies ? "default" : "outline"}
            onClick={() => {
              const next = !voiceReplies;
              setVoiceReplies(next);
              if (!next) stopAudio();
            }}
          >
            {voiceReplies ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            {voiceReplies ? "Voice on" : "Voice off"}
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !pending ? (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Ask by typing or tap the mic. The tutor can reply with playable
                audio recordings.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700 hover:border-black"
                    onClick={() => ask(s)}
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
                  : "mr-auto border border-neutral-200 bg-white text-foreground",
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              {m.role === "assistant" ? (
                <div className="mt-2 space-y-2">
                  {m.audioUrl ? (
                    <audio
                      controls
                      src={m.audioUrl}
                      className="w-full max-w-sm"
                      data-testid="tutor-message-audio"
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={recordingId === m.id}
                      onClick={() => void narrateMessage(m)}
                    >
                      {recordingId === m.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Recording…
                        </>
                      ) : speakingId === m.id ? (
                        <>
                          <VolumeX className="h-3.5 w-3.5" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" />
                          {m.audioUrl ? "Play again" : "Create audio"}
                        </>
                      )}
                    </Button>
                    {m.audioUrl ? (
                      <a
                        href={m.audioUrl}
                        download={`bookflow-tutor-${m.id}.wav`}
                        className="inline-flex h-9 items-center gap-2 rounded-[1rem] border border-neutral-300 bg-white px-4 text-xs font-medium text-black hover:border-black hover:bg-neutral-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {pending ? (
            <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
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
              Listening… speak your question, then pause.
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              size="icon"
              variant={listening ? "default" : "outline"}
              aria-label={listening ? "Stop listening" : "Start voice chat"}
              onClick={toggleListen}
              className="shrink-0"
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
              placeholder="Ask a question or use the mic…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            <Button
              type="button"
              disabled={pending || !input.trim()}
              onClick={() => ask(input)}
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
