import "server-only";
import { ApiError, GoogleGenAI, type Content, type Part } from "@google/genai";
import type { z } from "zod";
import { toGeminiSchema } from "./schemas";

// Server-only: GEMINI_API_KEY must never reach the browser (it has no NEXT_PUBLIC_ prefix,
// and the "server-only" import breaks the build if a client file ever imports this).

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
/** Used when the main model is overloaded (503), which happens often on the free tier. */
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";

let client: GoogleGenAI | null = null;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new AiError("unavailable");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** What went wrong, in terms the app can show. */
export class AiError extends Error {
  constructor(public readonly reason: "unavailable" | "busy" | "daily-limit" | "bad-reply" | "failed") {
    super(reason);
  }
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  // Google's free tier caps requests per day for the whole project, not just per minute.
  if (err instanceof ApiError && err.status === 429 && /PerDay/i.test(err.message)) return new AiError("daily-limit");
  if (err instanceof ApiError && (err.status === 429 || err.status === 503)) return new AiError("busy");
  return new AiError("failed");
}

/**
 * Overloaded, briefly unavailable, or out of today's free quota for this model: worth one
 * try on the other model, which has its own quota.
 */
const isOverloaded = (err: unknown) => err instanceof ApiError && [429, 500, 503].includes(err.status);

/** Runs `call` on the main model, and once on the fallback model if the main one is overloaded. */
async function withFallback<T>(call: (model: string) => Promise<T>): Promise<T> {
  try {
    return await call(GEMINI_MODEL);
  } catch (err) {
    if (!isOverloaded(err) || GEMINI_FALLBACK_MODEL === GEMINI_MODEL) throw err;
    return call(GEMINI_FALLBACK_MODEL);
  }
}

/** One structured reply, validated against `schema`. */
export async function generateJson<T>(schema: z.ZodType<T>, system: string, parts: Part[]): Promise<T> {
  let text: string | undefined;
  try {
    const response = await withFallback((model) =>
      gemini().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiSchema(schema),
          temperature: 0.2,
        },
      }),
    );
    text = response.text;
  } catch (err) {
    throw toAiError(err);
  }
  try {
    return schema.parse(JSON.parse(text ?? ""));
  } catch {
    throw new AiError("bad-reply");
  }
}

async function* streamFrom(model: string, system: string, history: Content[]): AsyncGenerator<string> {
  const stream = await gemini().models.generateContentStream({
    model,
    contents: history,
    config: { systemInstruction: system, temperature: 0.6, maxOutputTokens: 900 },
  });
  for await (const chunk of stream) if (chunk.text) yield chunk.text;
}

/**
 * A streamed chat reply, as plain text chunks. An overloaded model can fail on the
 * first chunk rather than at the start, so the fallback also covers that, as long as
 * nothing has been sent to the user yet.
 */
export async function* streamChat(system: string, history: Content[]): AsyncGenerator<string> {
  let started = false;
  try {
    for await (const text of streamFrom(GEMINI_MODEL, system, history)) {
      started = true;
      yield text;
    }
    return;
  } catch (err) {
    if (started || !isOverloaded(err) || GEMINI_FALLBACK_MODEL === GEMINI_MODEL) throw toAiError(err);
  }
  try {
    yield* streamFrom(GEMINI_FALLBACK_MODEL, system, history);
  } catch (err) {
    throw toAiError(err);
  }
}
