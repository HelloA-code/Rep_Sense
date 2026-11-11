import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { AiError, geminiConfigured } from "./gemini";

export type AiKind = "chat" | "photo" | "text" | "plan";

const MESSAGES: Record<AiError["reason"] | "signin" | "quota", { status: number; message: string }> = {
  signin: { status: 401, message: "Sign in to use the AI features." },
  quota: { status: 429, message: "You've used today's AI allowance for this. It resets tomorrow." },
  unavailable: { status: 503, message: "AI features aren't set up on this server yet." },
  busy: { status: 503, message: "The AI is busy right now. Try again in a minute." },
  "daily-limit": { status: 503, message: "The AI has reached today's limit for the app. It resets tomorrow." },
  "bad-reply": { status: 502, message: "The AI gave an answer we couldn't use. Try rephrasing." },
  failed: { status: 502, message: "Couldn't reach the AI. Try again." },
};

export function aiErrorResponse(reason: keyof typeof MESSAGES) {
  const { status, message } = MESSAGES[reason];
  return NextResponse.json({ error: message }, { status });
}

/**
 * Every AI route starts here: signed in, AI configured, and one request taken from
 * today's allowance (counted by a database function the user can't tamper with).
 */
export async function startAiRequest(kind: AiKind) {
  const user = await currentUser();
  if (!user) return { error: aiErrorResponse("signin") } as const;
  if (!geminiConfigured()) return { error: aiErrorResponse("unavailable") } as const;
  const { data: allowed, error } = await user.supabase.rpc("consume_ai_quota", { request_kind: kind });
  if (error) return { error: aiErrorResponse("failed") } as const;
  if (!allowed) return { error: aiErrorResponse("quota") } as const;
  return { user } as const;
}

export function handleAiError(err: unknown) {
  return aiErrorResponse(err instanceof AiError ? err.reason : "failed");
}
