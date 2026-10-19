import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userHasBookAccess } from "@/lib/services/license";
import { buildBookAIContext } from "@/lib/ai/context";
import { getAIService } from "@/lib/ai";

export const runtime = "nodejs";

const bodySchema = z.object({
  bookId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
});

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function streamGeminiLive(opts: {
  apiKey: string;
  model: string;
  system: string;
  userPrompt: string;
  onChunk: (text: string) => void;
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:streamGenerateContent?alt=sse&key=${opts.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`Gemini live stream ${res.status}: ${err.slice(0, 240)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const line of parts) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const json = JSON.parse(raw) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const piece =
          json.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || "")
            .join("") ?? "";
        if (piece) {
          full += piece;
          opts.onChunk(piece);
        }
      } catch {
        /* ignore partial JSON */
      }
    }
  }

  return full;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const access = await userHasBookAccess(user.id, parsed.bookId);
  if (!access.allowed) {
    return NextResponse.json({ error: "No book access" }, { status: 403 });
  }

  const ctx = await buildBookAIContext({
    bookId: parsed.bookId,
    question: parsed.message,
  });
  if (!ctx?.hasPdfText) {
    return NextResponse.json(
      { error: "Could not open this book’s PDF" },
      { status: 400 },
    );
  }

  const historyBlock = (parsed.history ?? [])
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n");

  const system = [
    "You are BookFlow Live Tutor — a real-time reading coach.",
    "Answer ONLY from the attached PDF / extracted text.",
    "Be concise, clear, and conversational — like a live tutor in the room.",
    "Use short paragraphs. Ask one follow-up question when helpful.",
    "Never invent facts outside the PDF.",
  ].join(" ");

  const userPrompt = [
    `Book: ${ctx.bookTitle}`,
    ctx.author ? `Author: ${ctx.author}` : "",
    historyBlock ? `Recent conversation:\n${historyBlock}` : "",
    `Student (live): ${parsed.message}`,
    "",
    "PDF / extracted text:",
    (ctx.pdfText || ctx.fullBookText || "").slice(0, 80000),
  ]
    .filter(Boolean)
    .join("\n");

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(encodeSse(event, data)));
      };

      try {
        send("status", { state: "thinking" });

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        const models = [
          process.env.GEMINI_MODEL?.trim(),
          "gemini-2.5-flash",
          "gemini-2.0-flash",
        ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

        let answer = "";

        if (apiKey) {
          let lastError: unknown;
          for (const model of models) {
            try {
              answer = await streamGeminiLive({
                apiKey,
                model,
                system,
                userPrompt,
                onChunk: (text) => send("delta", { text }),
              });
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              const msg = error instanceof Error ? error.message : String(error);
              if (!/404|NOT_FOUND|not found|429|quota/i.test(msg)) throw error;
            }
          }
          if (!answer && lastError) throw lastError;
        }

        if (!answer) {
          const ai = getAIService();
          const res = await ai.askBook({
            ...ctx,
            question: parsed.message,
          });
          answer = res.content;
          // Fake stream for mock/fallback so the UI still feels live.
          const words = answer.split(/(\s+)/);
          for (const w of words) {
            send("delta", { text: w });
            await new Promise((r) => setTimeout(r, 12));
          }
        }

        send("done", { content: answer });
        controller.close();
      } catch (error) {
        send("error", {
          message:
            error instanceof Error ? error.message : "Live tutor failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
