import "server-only";
import { ApiError, GoogleGenAI, type Content, type Part } from "@google/genai";
import type { z } from "zod";
import { toJsonSchema } from "./schemas";

// Server-only: GEMINI_API_KEY must never reach the browser (it has no NEXT_PUBLIC_ prefix,
// and the "server-only" import breaks the build if a client file ever imports this).

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

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
  constructor(public readonly reason: "unavailable" | "busy" | "bad-reply" | "failed") {
    super(reason);
  }
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof ApiError && err.status === 429) return new AiError("busy");
  return new AiError("failed");
}

/** One structured reply, validated against `schema`. */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  system: string,
  parts: Part[],
): Promise<T> {
  let text: string | undefined;
  try {
    const response = await gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: toJsonSchema(schema),
        temperature: 0.2,
      },
    });
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

/** A streamed chat reply, as plain text chunks. */
export async function* streamChat(system: string, history: Content[]): AsyncGenerator<string> {
  let stream: AsyncGenerator<{ text?: string }>;
  try {
    stream = await gemini().models.generateContentStream({
      model: GEMINI_MODEL,
      contents: history,
      config: { systemInstruction: system, temperature: 0.6, maxOutputTokens: 900 },
    });
  } catch (err) {
    throw toAiError(err);
  }
  try {
    for await (const chunk of stream) if (chunk.text) yield chunk.text;
  } catch (err) {
    throw toAiError(err);
  }
}
