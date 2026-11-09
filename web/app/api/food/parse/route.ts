import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { PARSE_TEXT_SYSTEM } from "@/lib/ai/prompts";
import { resolveFoods } from "@/lib/ai/resolve";
import { handleAiError, startAiRequest } from "@/lib/ai/route";
import { ParsedFoods } from "@/lib/ai/schemas";

export const maxDuration = 30;

const Body = z.object({ text: z.string().trim().min(2).max(500) });

/** "2 rotis and a bowl of dal" → foods with USDA numbers where we have them. */
export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Describe what you ate in a few words." }, { status: 400 });

  const start = await startAiRequest("text");
  if ("error" in start) return start.error;
  try {
    const reply = await generateJson(ParsedFoods, PARSE_TEXT_SYSTEM, [{ text: body.data.text }]);
    return NextResponse.json(resolveFoods(reply.foods));
  } catch (err) {
    return handleAiError(err);
  }
}
