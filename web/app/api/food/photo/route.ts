import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { PARSE_PHOTO_SYSTEM } from "@/lib/ai/prompts";
import { resolveFoods } from "@/lib/ai/resolve";
import { handleAiError, startAiRequest } from "@/lib/ai/route";
import { ParsedFoods } from "@/lib/ai/schemas";

export const maxDuration = 30;

/** The browser shrinks photos to ≤1024 px JPEG first, so this is generous. */
const MAX_BASE64 = 1_500_000;
const Body = z.object({
  image: z.string().max(MAX_BASE64).regex(/^[A-Za-z0-9+/=]+$/),
  note: z.string().trim().max(200).optional(),
});

/**
 * A meal photo → foods and portions. The photo is passed to Gemini once and never
 * stored by RepSense; only the numbers the user confirms are saved.
 */
export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "That photo couldn't be read. Try another." }, { status: 400 });

  const start = await startAiRequest("photo");
  if ("error" in start) return start.error;
  try {
    const parts = [
      { inlineData: { mimeType: "image/jpeg", data: body.data.image } },
      { text: body.data.note ? `Note from the user: ${body.data.note}` : "What is in this meal?" },
    ];
    const reply = await generateJson(ParsedFoods, PARSE_PHOTO_SYSTEM, parts);
    return NextResponse.json(resolveFoods(reply.foods));
  } catch (err) {
    return handleAiError(err);
  }
}
