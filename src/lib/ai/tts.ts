const TTS_MODELS = [
  process.env.GEMINI_TTS_MODEL?.trim(),
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-flash-tts",
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

const MAX_TTS_CHARS = 4500;

function stripForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

type TtsResult = {
  audioBase64: string;
  mimeType: string;
};

async function callTtsModel(
  model: string,
  apiKey: string,
  text: string,
  voiceName: string,
): Promise<TtsResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Prefer the 2.5-preview shape first (prebuiltVoiceConfig + prompt style).
  // Newer 3.8 models accept speech_metadata + voiceConfig.voice.
  const bodies = [
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Speak as a friendly AI reading tutor. Recite the following exactly:\n\n${text}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    },
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text,
              speech_metadata: {
                style: "warm, clear tutoring voice for students",
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { voice: voiceName },
        },
      },
    },
  ];

  let lastError: Error | null = null;

  for (const body of bodies) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      lastError = new Error(
        `Gemini TTS error ${res.status} (${model}): ${errText.slice(0, 280)}`,
      );
      if (/404|NOT_FOUND|not found/i.test(errText)) break;
      continue;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data?: string; mimeType?: string };
            inline_data?: { data?: string; mimeType?: string };
          }>;
        };
      }>;
    };

    const part = data.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inlineData ?? part?.inline_data;
    const raw = inline?.data;
    if (!raw) {
      lastError = new Error(`Gemini TTS returned no audio (${model})`);
      continue;
    }

    const mime = inline?.mimeType ?? "audio/wav";
    if (mime.includes("pcm") || mime.includes("L16") || mime.includes("raw")) {
      const wav = pcmToWav(Buffer.from(raw, "base64"));
      return {
        audioBase64: wav.toString("base64"),
        mimeType: "audio/wav",
      };
    }

    return { audioBase64: raw, mimeType: mime.startsWith("audio/") ? mime : "audio/wav" };
  }

  throw lastError ?? new Error(`Gemini TTS failed (${model})`);
}

export async function synthesizeSpeech(text: string): Promise<TtsResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const spoken = stripForSpeech(text);
  if (!spoken) {
    throw new Error("Nothing to speak");
  }

  const voice = process.env.GEMINI_TTS_VOICE?.trim() || "Kore";
  let lastError: unknown;

  for (const model of TTS_MODELS) {
    try {
      return await callTtsModel(model, apiKey, spoken, voice);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/404|NOT_FOUND|not found|unsupported/i.test(message)) {
        throw error;
      }
      console.warn(`[BookFlow TTS] Model ${model} unavailable, trying fallback…`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini TTS models failed");
}
