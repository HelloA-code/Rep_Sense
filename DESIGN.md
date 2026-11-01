# DESIGN.md: RepSense UI spec

Reference screenshots are in `docs/design-reference/`. Match their **feel, spacing, shapes and colour use**, but use our own copy, icons and branding. Don't copy text, logos or the 3D body model.

## 1. Overall direction
- **Mobile-first web app that feels native** (like an iOS fitness app), built as a responsive Next.js app and installable as a PWA. On desktop, the app renders in a centred phone-width column (max ~440px) over a dark background; the marketing landing page uses the full width.
- Dark, premium, calm. Black background, one warm **amber-yellow accent**, soft glass cards, big bold numbers.
- Every screen has **one obvious primary action** (full-width yellow button at the bottom).

## 2. Design tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#000000` | App background |
| `--glow-warm` | radial `rgba(255,190,40,0.18)` → transparent, top-left/top-centre | Ambient glow behind headers |
| `--glow-cool` | radial `rgba(60,90,160,0.12)` → transparent, bottom-left | Subtle depth |
| `--surface` | `rgba(255,255,255,0.04)` on black (≈ `#121212`) | Cards, tiles, keypad keys |
| `--surface-raised` | `rgba(255,255,255,0.07)` | Pressed / sheet background |
| `--border` | `rgba(255,255,255,0.08)` 1px | All card outlines |
| `--accent` | `#FFC53D` | Primary buttons, selected states, skeleton, progress |
| `--accent-tint` | `rgba(255,197,61,0.12)` bg + `rgba(255,197,61,0.55)` border | Selected tile/chip |
| `--accent-fg` | `#111111` | Text on yellow |
| `--text` | `#FFFFFF` | Headings, numbers |
| `--text-muted` | `#9A9A9A` | Subtitles, inactive labels |
| `--danger` | `#FF4D4D` | Pain/form-error, REC dot, bad joint ring |
| Radius | cards `20px`, tiles `16px`, chips `14px`, primary button `999px` (pill), icon buttons circle | |
| Spacing | 4px grid; screen padding `20–24px`; grid gap `10–12px` | |
| Shadows | none; depth comes from borders, glows and slight backdrop blur | |

**Typography:** a heavy geometric sans such as **Inter** or **Geist** (weights 500/600/800). Screen title 28px/800. Section label 15px/700. Body 14px/500 muted. **Hero numbers** (load, reps, timer) 64–96px/800 with a small unit suffix (`2` + `kg` at 24px). Small pill badges (`BETA`, `FRONT`) 11px/700 uppercase, letter-spacing 0.12em.

**Motion (Framer Motion):** 150–250ms ease-out; tiles scale 0.97 on press; sheets slide up with spring; selected check badge pops in; rep counter number does a vertical roll. Respect `prefers-reduced-motion`.

**Icons:** thin-stroke line icons (lucide-react), drawn in accent when selected and grey when not.

## 3. Components (build these once in `components/ui/` and reuse)
- `AppShell`: black bg + glows, safe-area padding, optional top bar, bottom tab bar.
- `TopBar`: circular back button (40px, surface + border), title, optional right action (badge or icon button). Optional **progress bar** variant (thin track, yellow fill, `7 / 10` counter) for onboarding.
- `BottomTabBar`: floating rounded bar inset from the edges with tabs **Today · Week · Coach · History · Profile**; active tab has a raised pill background + yellow icon/label.
- `PrimaryButton` (yellow pill, black bold text, 52px tall, full width) and `SecondaryButton` (surface + border, white text).
- `SelectTile`: icon + label, square-ish; selected → accent tint, accent border, accent icon/text, yellow check badge top-right.
- `SegmentChip` / preset chips (Minimal · Home gym · Park · Gym): selected uses accent tint.
- `OptionCard`: title + muted description; recommended option is **solid yellow** with dark text and a "Recommended ·" prefix.
- `Sheet`: bottom sheet with grabber, title left, "Cancel" right.
- `Keypad`: 3×4 grid of surface keys (1–9, decimal, 0, backspace), large digits.
- `ChatInput`: rounded input with a yellow circular send button.
- `Slider`/`ScaleBar`: dark track with tick marks, red-to-transparent fill, a handle line (used for the 0–10 pain/RPE scale).

## 4. Screens (and which day they're built)

### Onboarding (Day 1) — references: equipment grid
Steps with progress bar: goal → level → **equipment** → bodyweight/height → camera permission tip.
Equipment screen: title "What do you have?", subtitle, preset chips (Minimal / Home gym / Park / Gym) that pre-select tiles, then a 3-column `SelectTile` grid (pull-up bar, rings, parallettes, dip station, resistance bands, weight vest, backpack, bench, dumbbells…). **Equipment filters which exercises are offered** (no bar → no pull-ups).

### Today tab (Day 5)
Greeting + today's suggested session card (exercises, sets), streak, quick "Start workout" primary button, a mini weekly chart.

### Pre-workout check-in (Day 5) — reference: check-in modal
Quick questions (sleep, energy, soreness 0–10). Rule-based result in an `OptionCard` list: "Move day instead / Trim about a third / Cut about half (Recommended) / Keep the full session". This counts as "adaptive training" and is cheap to build because the rules are simple.

### Live camera workout (Days 2–4) — reference: pull-up camera screen
- Full-bleed camera, **skeleton in accent yellow**: 2–3px lines, joints as small circles with a dark stroke.
- Top: close (×) button left, camera-flip right, centre pill `● REC 5S · 0 REPS` (red dot).
- Form error: **red ring** around the offending joint + small cue label nearby; voice cue plays.
- Big rep count + phase indicator at the bottom on a translucent surface.

### Set logging (Day 4) — reference: weighted dips keypad
Header: session name + elapsed timer, page dots for exercises, `‹ Weighted Dips ›` with "Set 2 of 2". Huge value ("2 kg"), `Keypad`, yellow **Done**. Used for added load and for correcting the auto-counted reps.

### History tab (Day 5)
Session list → session detail (per-set reps, form score, issues), charts in accent yellow on dark (Recharts, no gridline clutter).

### Coach tab (Day 7 if time, otherwise "BETA" placeholder) — reference: coach chat
Empty-state chat with `BETA` badge and `ChatInput`. If time allows, answer from the user's own stats with an LLM API (numbers only). Otherwise show a friendly "coming soon" with 3 suggested questions.

### Profile tab (Day 5)
Body stats, equipment (reopens the equipment grid), units, voice-cue toggle, sign out.

### Pain map (future work) — reference: 3D body sheet
Build a simplified **2D front/back body SVG** with tappable regions + the 0–10 scale bar + "which movements trigger it?" chips only if Day 7 has spare time; otherwise list it as future work.

### Landing page (Day 1, keep it short)
Same tokens. Hero ("Your AI calisthenics coach") with a phone mockup showing the live skeleton screen, 3 feature blocks, privacy note, CTA "Open the app". This is for the shareable link and README, so don't overbuild it.
