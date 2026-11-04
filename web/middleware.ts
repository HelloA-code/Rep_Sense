import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets, the pose model and its WASM: they never need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|models/|mediapipe/|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
