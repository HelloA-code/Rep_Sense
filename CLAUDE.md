# CLAUDE.md: RepSense (AI Calisthenics Tracking System)

## Project
Privacy-first AI calisthenics coach. The browser runs pose estimation (MediaPipe Tasks Vision), rep counting, form analysis and our own exercise classifier (ONNX Runtime Web). Supabase (Auth + PostgreSQL) stores workout stats only, never video. Python in `ml/` is used for dataset preparation and model training.

The roadmap is in `IMPLEMENTATION_PLAN.md`, an **8-day plan**. The UI spec is in `DESIGN.md`. Check which day we're on and don't build features from later days unless asked.

## How to work with me
- I'm a student on a tight deadline who also wants to learn. Optimise for **shipping fast with brief teaching**.
- Before a new concept, explain it in 3–5 lines max, then build. After non-trivial code, give 2–3 bullets on what to understand.
- When I say "I'll write this one", give me the signature, hints and tests only, then review my code.
- Build in sensible chunks (a full section or feature), then pause briefly so I can check it. Don't stop after every tiny change.
- Use plan mode for the start of each day.
- If something will take much longer than expected, tell me and suggest what to cut.

## Stack
- `web/`: Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Framer Motion, Recharts, @mediapipe/tasks-vision, onnxruntime-web, @supabase/supabase-js + @supabase/ssr. Tests: Vitest.
- `ml/`: Python 3.12, NumPy, Pandas, OpenCV, MediaPipe, scikit-learn, PyTorch, Jupyter.
- Deploy: Vercel. CI: GitHub Actions.

## Conventions
- TypeScript strict; avoid `any`.
- One file per exercise in `web/lib/exercises/` exporting `config`, state-machine config and form rules. Exercise logic is pure functions (no React) so it can be tested by replaying recorded landmark sequences.
- Geometry and filters live in `web/lib/pose/` with unit tests.
- Server components by default; `"use client"` only for camera, canvas, animation and interactive parts.
- Landmark recordings use one consistent JSON format shared by the web recorder and `ml/` scripts. Document it in `ml/README.md`.
- Supabase: every table has Row Level Security. Secrets in `.env.local` (gitignored); never hard-code keys.
- Never upload video; only numbers (landmarks, stats) leave the device. Video clips are opt-in, recorded by the user, and stored only on-device (IndexedDB).
- Conventional commits (`feat:`, `fix:`, `docs:`). Suggest a commit at the end of each day.

## Design system
- **`DESIGN.md` is the source of truth** for tokens, components and screens. Reference screenshots are in `docs/design-reference/`; look at the relevant one before building a screen.
- Summary: mobile-first native-feeling app; pure black background with soft amber/blue glows; glass cards (`rgba(255,255,255,0.04)` + 1px `rgba(255,255,255,0.08)` border, 16–20px radius); single accent `#FFC53D`; yellow pill primary buttons with black text; heavy sans (Inter/Geist 800) with huge hero numbers; bottom tab bar Today · Week · Coach · History · Profile.
- On desktop, the app renders in a centred phone-width column (max ~440px); the landing page uses full width.
- Reuse components from `components/ui/`. Don't restyle per screen.
- Match the screenshots' feel, spacing and shapes; **never copy their text, logos or the 3D body model**.

## Content rules
- No invented testimonials, user counts or results. Use clearly marked placeholders.
- Metrics in README/reports must come from real measurements in `ml/reports/`.

## Commands
- web: `cd web && npm run dev` · `npm run test` · `npm run lint`
- ml: `cd ml && python -m src.prepare` · `python -m src.train` · `python -m src.export`
