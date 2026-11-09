import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildCoachContext } from "@/lib/ai/coach-context";
import { streamChat } from "@/lib/ai/gemini";
import { COACH_SYSTEM } from "@/lib/ai/prompts";
import { handleAiError, startAiRequest } from "@/lib/ai/route";
import { fetchDiet, fetchProfile, fetchSessions } from "@/lib/data/queries";
import { rowToAnswers, targetsFor } from "@/lib/nutrition/profile";

export const maxDuration = 45;

const Body = z.object({ message: z.string().trim().min(1).max(1000) });
const HISTORY_TURNS = 10;

/** One chat turn: the reply streams back as plain text, then both sides are saved. */
export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Type a question first." }, { status: 400 });

  const start = await startAiRequest("chat");
  if ("error" in start) return start.error;
  const { supabase, id } = start.user;

  const [profile, sessions, diet, history] = await Promise.all([
    fetchProfile(supabase, id),
    fetchSessions(supabase, id, 60),
    fetchDiet(supabase, id, 8 * 24),
    supabase.from("coach_messages").select("role, content").eq("user_id", id).order("created_at", { ascending: false }).limit(HISTORY_TURNS),
  ]);
  const answers = diet.nutrition ? rowToAnswers(diet.nutrition) : null;
  const context = buildCoachContext({
    now: new Date(),
    body: profile,
    sessions,
    nutrition: answers,
    targets: answers && profile ? targetsFor(answers, profile) : null,
    meals: diet.meals,
  });

  const turns = [...(history.data ?? [])].reverse().map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  turns.push({ role: "user", parts: [{ text: body.data.message }] });
  await supabase.from("coach_messages").insert({ user_id: id, role: "user", content: body.data.message });

  let chunks: AsyncGenerator<string>;
  try {
    chunks = streamChat(`${COACH_SYSTEM}\n\nUser data:\n${context}`, turns);
    // Pull the first chunk now, so a failed request becomes a proper error response.
    const first = await chunks.next();
    const encoder = new TextEncoder();
    let reply = first.done ? "" : first.value;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (reply) controller.enqueue(encoder.encode(reply));
      },
      async pull(controller) {
        try {
          const next = await chunks.next();
          if (!next.done) {
            reply += next.value;
            controller.enqueue(encoder.encode(next.value));
            return;
          }
        } catch {
          const note = "\n\n(The reply was cut off. Try asking again.)";
          reply += note;
          controller.enqueue(encoder.encode(note));
        }
        if (reply.trim()) await supabase.from("coach_messages").insert({ user_id: id, role: "assistant", content: reply.slice(0, 8000) });
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    return handleAiError(err);
  }
}
