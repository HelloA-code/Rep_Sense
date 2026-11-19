# How to train the RepSense model yourself

> **What this guide is:** step-by-step instructions to train the exercise model on your own clips, test it, and put it in the app. No experience needed: just copy each command, press Enter, and check the result looks like the example.
>
> **Time:** about 1 hour (most of it is waiting).

---

## First, what are we doing?

The app has a small "brain" (the **model**) that looks at your body movement and guesses the exercise: "this is a squat". Right now it learned from fake stick figures, so it's only a demo (that's why the app shows a **"Preview"** badge).

You will teach it with **real people's clips**. The steps are:

1. **Record** clips in the app.
2. **Copy** them to your laptop.
3. **Prepare** them: turn the clips into numbers.
4. **Train**: the model learns.
5. **Check** how good it is.
6. **Export**: save the model for the app.
7. **Test** the app.
8. **Put it live** on the website.

---

## Step 1: Record clips (on your phone)

Open the app → **Workout** → **Just start moving** (free camera) → use the **red record button**.

**Rules:**

- **At least 3 different people** (5 is better).
- Each person records these **6 exercises**: squat, push-up, pull-up, dip, lunge, plank.
- Each exercise **twice**: once from the **front**, once from the **side**.
- Each clip about **20–30 seconds** (about 8–12 reps).
- Each person also records **3 "Idle" clips**: just standing, walking around, resting.
- **Very important:** before recording, type the **person's name** in the recorder (Subject). Use **one name per person**, and keep it the same for all their clips.

> 💡 You can also use **Clips → Import a video** for old videos or reels. Type the person's name (for a reel, the creator's name).

> ⚠️ Only these 6 exercises + Idle are learned right now. Clips of other exercises are simply skipped.

---

## Step 2: Copy the clips to your laptop

1. In the app: **Profile → Recorded clips → Export all**.
2. You get one file named like `repsense_clips_20261120-153000.json`.
3. Send it to your laptop (email it to yourself, Google Drive, USB, anything).
4. Put the file in this folder of the project:

```
repsense/ml/data/
```

(Next to the folders `processed`, `raw` and `synthetic` that are already there.)

> 💡 You can put several export files there; all of them are used.

---

## Step 3: Open a terminal in the right folder

1. Open the project in **VS Code**.
2. Open a terminal: menu **Terminal → New Terminal**.
3. Go into the `ml` folder:

```powershell
cd ml
```

Every command below is typed in this terminal, inside `ml`.

**First time on a new laptop?** If the folder `ml/.venv` doesn't exist, set up Python once (it takes a few minutes):

```powershell
python -m venv .venv
```

```powershell
.venv\Scripts\python -m pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

---

## Step 4: Prepare the clips

```powershell
.venv\Scripts\python -m src.prepare
```

**What it does:** reads all your clips and cuts them into small 2-second pieces the model can learn from.

**What you should see** (your numbers will be different):

```
84 clips -> 2600 windows -> ...\ml\data\processed\real.npz
  dip     350
  idle    300
  lunge   380
  ...
people: ['aditya', 'priya', 'rahul']
```

**Check two things:**

- ✅ Every exercise has a number next to it (none missing).
- ✅ `people:` shows **3 or more names**. If someone's name is spelled two ways (`Rahul` and `rahul`), they count as two people, which makes the score look better than it really is. The app can't rename a saved clip, so delete those clips in the app (open the clip → Delete), record them again with the right name, export again, and replace the file.

---

## Step 5: Train the model

```powershell
.venv\Scripts\python -m src.train
```

**What it does:** the model practises on most people's clips and is then tested on people it has **never seen**. It does this a few times (each time hiding different people), then trains one final model on everything.

**How long:** a few minutes. Wait until the terminal is free again.

**The last line looks like this:**

```
{"rf_macro_f1": 0.912, "cnn_macro_f1": 0.948, "report": "...\\ml\\reports\\RESULTS.md"}
```

These are your **real scores**. (These example numbers are made up, so don't copy them!)

---

## Step 6: Check how good it is

Open this file in VS Code:

```
ml/reports/RESULTS.md
```

**How to read it, in simple words:**

| You see | It means |
|---|---|
| **Accuracy** | Out of all guesses, how many were right. 0.90 = 90% right. |
| **Macro-F1** | A fairer score from 0 to 1 that counts every exercise equally. **Closer to 1 = better.** This is the main number. |
| **F1 per class** | The score for each exercise. A low one means the model struggles with that exercise. |
| **Confusion matrix** | Which exercises get mixed up. Also see the pictures `confusion_cnn.png` and `confusion_rf.png` in the same folder. |
| **Random Forest vs 1D-CNN** | Two different models. The app uses the **1D-CNN**. |

**If one exercise has a low score:** record more clips of it (more people, both views), then run Step 4 and Step 5 again.

> ⚠️ **Be honest:** only ever write the numbers from *this* file in your README, report or resume. Never round them up or make them nicer.

---

## Step 7: Save the model for the app (export)

```powershell
.venv\Scripts\python -m src.export
```

**What it does:** turns the model into a small file the website can run, and double-checks the file gives the same answers.

**Good result**: you see lines like:

```
ONNX matches PyTorch on 64 windows (max difference 1.2e-07)
... KB -> ...\web\public\models\exercise_classifier.onnx (real)
```

The word **`(real)`** at the end means the app will now use your real model, and the **"Preview" badge disappears**.

---

## Step 8: Test the app

Go to the `web` folder and run the tests:

```powershell
cd ..\web
```

```powershell
npm run test
```

✅ It should end with **"passed"** and no "failed".

Now try the app on your laptop:

```powershell
npm run dev
```

Open **http://localhost:3000/record** in your browser → tap **Auto** → do a few exercises in front of the camera.

- The **"Preview" badge should be gone**.
- It should name the exercise you're doing.

Stop it with **Ctrl + C** in the terminal.

---

## Step 9: Put it live on the website

Go back to the project folder and save your work with git:

```powershell
cd ..
```

```powershell
git add web/public/models web/lib/ml/__fixtures__ ml/reports
```

```powershell
git commit -m "feat: classifier trained on real clips"
```

```powershell
git push
```

Vercel updates the live website by itself in about 1–2 minutes. Open the app on your phone, try **Auto**, and check the Preview badge is gone there too.

> 💡 Your clip files in `ml/data/` are **never** uploaded to GitHub (the project ignores that folder on purpose).

---

## Step 10: Write your real results

Copy the numbers from `ml/reports/RESULTS.md` into:

- **`README.md`**, in the **Results** table: replace the "Pending real clips" text with your 1D-CNN macro-F1 and the number of people.
- **`docs/report.md`**, in **section 5 (Results)**: fill in the `___` blanks.

Then save them with git:

```powershell
git add README.md docs/report.md
```

```powershell
git commit -m "docs: real classifier results"
```

```powershell
git push
```

---

## If something goes wrong

| Message | What it means | What to do |
|---|---|---|
| `No usable clips found` | No clip files were found in `ml/data/`, or they're too short. | Check the `.json` file is directly in `ml/data/` (not inside another folder). Clips must be at least 2 s long. |
| `WARNING: no clips for ['dip']` | That exercise has no clips. | Record it, export again, run Step 4 again. |
| `Need at least 2 clips to evaluate a model` | Too little data. | Record more clips. |
| `RESULTS.md` shows **"Warning: fewer than 3 people"** or **"split by clip"** | Fewer than 3 people. The score isn't trustworthy yet. | Get clips from at least 3 people. |
| `export rejected` | The saved model gave different answers. Very rare. | Run Step 5 and Step 7 again. If it repeats, ask for help. |
| `python` / `.venv\Scripts\python` **is not recognized** | You're in the wrong folder, or Python isn't set up. | Make sure you did `cd ml`. On a new laptop, do the "First time" setup in Step 3. |
| `npm run test` shows **failed** | Something doesn't match. | Copy the error message and ask for help before pushing. |

---

## Tiny dictionary

| Word | Simple meaning |
|---|---|
| **Model** | The "brain" that guesses the exercise from body movement. |
| **Training** | Showing the model many examples so it learns. |
| **Clip** | One recording: body points over time, plus the exercise name and the person's name. |
| **Window** | A 2-second piece of a clip. The model looks at one window at a time. |
| **Test on unseen people** | Checking the model on people it never practised on, the honest way to measure it. |
| **Accuracy** | How often it's right. |
| **Macro-F1** | A fair overall score from 0 to 1 that treats every exercise equally. |
| **Export / ONNX** | Saving the model as a small file the website can use. |
| **Preview badge** | The label in the app that says "this model is only a demo". It disappears after you train on real clips. |
