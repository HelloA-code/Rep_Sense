import { beforeEach, describe, expect, it, vi } from "vitest";

// The real routes, with the signed-in user and Gemini replaced by fakes.

const state = vi.hoisted(() => ({
  user: null as null | { id: string; supabase: { rpc: ReturnType<typeof vi.fn> } },
  configured: true,
  reply: null as unknown,
  fail: null as null | string,
}));

vi.mock("@/lib/supabase/server", () => ({ currentUser: async () => state.user }));
vi.mock("@/lib/ai/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/gemini")>("@/lib/ai/gemini");
  return {
    ...actual,
    geminiConfigured: () => state.configured,
    generateJson: async () => {
      if (state.fail) throw new actual.AiError(state.fail as "busy");
      return state.reply;
    },
  };
});

const { POST: parse } = await import("@/app/api/food/parse/route");
const { POST: photo } = await import("@/app/api/food/photo/route");

type Handler = (request: Parameters<typeof parse>[0]) => Promise<Response | undefined>;
const request = (body: unknown) =>
  new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }) as unknown as Parameters<typeof parse>[0];
/** Calls a route; every path in these handlers returns a response. */
async function call(handler: Handler, body: unknown): Promise<Response> {
  const res = await handler(request(body));
  if (!res) throw new Error("route returned nothing");
  return res;
}

const signIn = (allowed = true) => {
  state.user = { id: "u1", supabase: { rpc: vi.fn(async () => ({ data: allowed, error: null })) } };
};

beforeEach(() => {
  state.user = null;
  state.configured = true;
  state.fail = null;
  state.reply = {
    foods: [{ name: "roti", quantity: 2, unit: "piece", grams: 80, kcal_per_100g: 297, protein_per_100g: 11, carbs_per_100g: 46, fat_per_100g: 7 }],
  };
});

describe("POST /api/food/parse", () => {
  it("needs a sign-in", async () => {
    expect((await call(parse, ({ text: "2 rotis" }))).status).toBe(401);
  });

  it("rejects empty or huge input before calling the AI", async () => {
    signIn();
    expect((await call(parse, ({ text: "" }))).status).toBe(400);
    expect((await call(parse, ({ text: "x".repeat(501) }))).status).toBe(400);
    expect(state.user!.supabase.rpc).not.toHaveBeenCalled();
  });

  it("says when AI isn't set up", async () => {
    signIn();
    state.configured = false;
    expect((await call(parse, ({ text: "2 rotis" }))).status).toBe(503);
  });

  it("stops at the daily quota", async () => {
    signIn(false);
    const res = await call(parse, ({ text: "2 rotis" }));
    expect(res.status).toBe(429);
    expect(state.user!.supabase.rpc).toHaveBeenCalledWith("consume_ai_quota", { request_kind: "text" });
  });

  it("returns foods with USDA numbers", async () => {
    signIn();
    const res = await call(parse, ({ text: "2 rotis" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ foodId: "roti", dataSource: "usda" });
    expect(body.items[0].per100g.kcal).not.toBe(297);
  });

  it("turns AI errors into friendly messages", async () => {
    signIn();
    state.fail = "busy";
    const res = await call(parse, ({ text: "2 rotis" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/busy/);
  });
});

describe("POST /api/food/photo", () => {
  it("rejects anything that isn't base64", async () => {
    signIn();
    expect((await call(photo, ({ image: "<script>" }))).status).toBe(400);
  });

  it("uses the photo quota", async () => {
    signIn();
    const res = await call(photo, ({ image: "aGVsbG8=" }));
    expect(res.status).toBe(200);
    expect(state.user!.supabase.rpc).toHaveBeenCalledWith("consume_ai_quota", { request_kind: "photo" });
  });
});
