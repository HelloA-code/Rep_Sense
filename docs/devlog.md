# Devlog

**Day 1: foundations.** Design tokens, core components, app shell with tabs, onboarding, landing page. Deployed to Vercel.

**Day 2: camera and pose.** MediaPipe PoseLandmarker in the browser with a self-hosted model, skeleton overlay, FPS panel, body-in-frame warning, landmark recorder. Learned the frame loop and image vs world coordinates.

**Day 3: counting.** Joint angles, One-Euro smoothing, a state machine with hysteresis, all 6 exercises. Added clips kept in the app, with real video stored on-device only.

**Day 4: form and flow.** Moved the per-frame logic into a pure set engine, added view-aware form rules, red rings, voice cues, per-rep scores, and the guided workout from picker to summary. Broke: synthetic test poses first, not the engine.

**Day 5: accounts and data.** Supabase auth, schema with Row Level Security, local outbox for saving, check-in, real Today, Week, History and Profile tabs. Broke: an infinite loop from `onDone?.(queue.shift())`, because optional calls skip evaluating their arguments. Tests caught it.

**Day 6: machine learning.** Time-based 15 Hz windows, person-wise evaluation, Random Forest and 1D-CNN. A test caught windows bridging tracking gaps. No real clips on the dev machine yet, so a labelled synthetic dataset proves the pipeline. Scrambling the labels drops accuracy to chance, so nothing leaks.

**Day 7: ML in the browser.** ONNX export checked against PyTorch, TypeScript features golden-tested against Python, ONNX Runtime Web self-hosted, Auto chip with confidence bar. Cut: coach chat and pain map.

**Day 8: polish.** Replay regression tests for all 6 exercises, CI, install manifest and icons, Open Graph image, README and report. Lighthouse performance went from 72–76 to 94–96 by lazy-loading Supabase and charts and stopping landing-page prefetches.
