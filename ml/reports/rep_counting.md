# Rep-counting accuracy

How well the app's rep counter matches a careful manual count. **Fill this in with real
measurements only.** Leave rows empty rather than guessing.

## Method

1. Record clips with the in-app recorder (`/record`, red button). Use 5 short clips per
   exercise (about 5–15 reps each), from the exercise's preferred camera view, and include
   some sloppy reps.
2. Count each clip by hand while watching the saved video in **Profile → Recorded clips**.
   Count only full reps (full depth, full lockout, chin over the bar for pull-ups).
3. Read the **App count** shown under the same clip. It replays the saved landmarks
   through the same set engine as the live camera (`web/lib/workout/replay.ts`).
4. Error = app − manual. Report the mean absolute error (MAE) and the % of clips counted
   exactly right, per exercise and overall.

Thresholds tested: see `counter` in each `web/lib/exercises/<exercise>.ts` (commit: ______).

## Results

| Clip (date / file) | Exercise | View | Manual | App | Error |
|---|---|---|---|---|---|
| | | | | | |

## Summary

| Exercise | Clips | Exact | MAE (reps) |
|---|---|---|---|
| Squat | | | |
| Push-up | | | |
| Pull-up | | | |
| Dip | | | |
| Lunge | | | |
| Plank (seconds, not reps) | | | |
| **Overall** | | | |

## Notes

- Failure cases you saw (e.g. half reps counted, the side flipping, people leaving the frame):
