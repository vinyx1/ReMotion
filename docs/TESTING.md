# Testing and labeling

How we check that the device's clean / compensated label matches what a person sees, and
how we pick the lean threshold from that. The plan is AGENTS.md section 9; this is the
runbook for doing it. Testers are team members (and maybe friends who agree to it); no
patients. If anyone outside the team takes part, check first whether the course needs
their consent.

**Success measure:** device and video agree on about 90% of reps, over about 60 reps from
3 or more testers. Write the result into `docs/STATUS.md` (Findings) when we have it.

## What to bring

- The device: mat with buttons and Arduino, chest harness, wrist brace, USB-C cable, the spare Arduino and IMU
- Laptop with the repo, `.venv` set up (`pip install -r requirements.txt`), and `arduino-cli` or the Arduino IDE
- A phone on a tripod (or propped on a stack of books) for the side-view video
- Tape measure, masking tape and a marker (to mark target spots and the tripod position)
- This page, and the tester table below, printed or open

## 0. Flash and bring-up (about 15 min, once)

Run the bring-up sketches in order and don't move on until each one passes.

```bash
arduino-cli compile --fqbn arduino:renesas_uno:minima firmware/tests/i2c_scanner
arduino-cli upload  --fqbn arduino:renesas_uno:minima -p <port> firmware/tests/i2c_scanner
arduino-cli monitor -p <port> -c baudrate=115200
```

`arduino-cli board list` shows the port (on a Mac, `/dev/cu.usbmodem…`). Close the monitor
(Ctrl+C) before the next upload.

| Sketch | Passes when |
|---|---|
| `firmware/tests/i2c_scanner` | It finds **0x68** (chest) and **0x69** (wrist), with the cables at full length |
| `firmware/tests/io_test` | Each button LED lights in turn, the buzzer beeps, every button press shows up |
| `firmware/tests/imu_test` | Trunk angle reads about 0° sitting upright and grows when leaning; wrist deg/s jumps when the arm moves |
| `firmware/reach_tracker` | Upload last. `?` in the monitor answers with an `I,IDLE,…` line |

## 1. Angle accuracy (about 10 min, one tester)

Does the trunk angle match the real lean? Use `imu_test` (it prints the live angle).

1. Phone on the tripod, side view, about 2 m away at chest height, the whole trunk in frame. Tape the tripod spot.
2. The tester sits upright with the chest harness on. Start the video.
3. Lean to about 0°, 10°, 20° and 30° (forward), holding each for 3 s. Someone reads the angle off the screen aloud at each hold.
4. Later, measure the trunk angle in each hold from the video with Kinovea (free) and fill the table:

| Hold | Video angle (°) | Device angle (°) | Difference |
|---|---|---|---|
| 0° | | | |
| 10° | | | |
| 20° | | | |
| 30° | | | |

Target: within about 3°. Upload `reach_tracker` again afterwards.

## 2. Set up each tester (2 min each)

1. Measure the arm: seated, arm straight out in front, shoulder to fingertip.
2. Place the mat (AGENTS.md section 2): HOME at the table edge in front of the reaching shoulder;
   GREEN at about 40%, BLUE at about 70% and RED at about 100% of the **comfortable** reach, so
   RED is reachable without leaning. Mark the spots with tape.
3. Fill in a row of the tester table:

| Tester | Arm length (cm) | RED distance (cm) | Script | Video files | Labeled by |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

## 3. Record a labeled run (about 5 min each)

Each tester does one run of 20 scored reps from a **script** (below), with the buzzer off so
nobody, including the camera, hears the device's verdict.

1. Phone on the tripod at the taped spot: side view, the trunk **and the HOME button** in frame.
2. On the laptop, from the repo root:

   ```bash
   .venv/bin/python -m software.tools.logger --plan 2,20,0,0 --out data/validation/<tester>
   ```

   `<tester>` is a short lowercase name (`alex`); it becomes the folder and the tester's name
   in the report. `--plan 2,20,0,0` means 2 warm-up reps (not scored), then 20 scored reps
   with the buzzer off.
3. Start the video. Say the tester's name and the script letter aloud.
4. Press START with the HOME button in frame (its LED blinks during calibration: that's the
   sync point). Sit upright and still for 3 s.
5. Do the 2 warm-up reps normally. Then the 20 scored reps, **saying each rep number aloud**
   as you reach, following the script:
   - **C** clean: back against the chair, only the arm moves.
   - **L** leaned: lean the trunk forward clearly, as if the target were a bit too far.
   - **S** slight: a small lean, just noticeable. These are the ones that test the threshold.

   | Script | Reps 1 to 20 |
   |---|---|
   | A | 1C 2L 3C 4C 5L 6L 7C 8C 9S 10L 11L 12C 13L 14L 15C 16C 17S 18S 19S 20L |
   | B | 1L 2L 3L 4L 5L 6S 7C 8S 9C 10C 11C 12S 13C 14L 15C 16L 17S 18C 19C 20L |
   | C | 1L 2S 3C 4L 5L 6C 7C 8C 9C 10L 11L 12S 13L 14L 15C 16L 17C 18S 19C 20S |

   Give each tester a different script, and don't show it to whoever labels their video.
6. After 3 beeps (or the `S,` line on the laptop), press Ctrl+C. Stop the video. Write the
   video file name in the tester table. If a rep goes wrong (wrong button, a sneeze), say so
   aloud and keep going; note it.

**Optional, if there's time:** move RED about 20 cm past the tester's reach and do 5 reps to it
(`--plan 0,5,0,0`). Reaching that far forces a lean, so these should all come out leaned.

## 4. Repeatability (about 10 min, one or two testers)

Three short runs of 10 clean reps, **taking the harness off and putting it back on** between
runs (`--plan 0,10,0,0`, same `--out` folder). Peak lean and reach time should be similar
across the three; the report's Repeatability table shows them. Film and label these too.

## 5. Label (about 5 min per run)

For each run, make the blank sheet:

```bash
.venv/bin/python -m software.analysis.validation sheet data/validation/alex/reps_20261123_141500.csv --video IMG_0412.MOV
```

It writes `labels_20261123_141500.csv` next to the run, one row per scored rep, without the
device's answer. Then the labeler:

- is someone who did **not** do that run, and has not seen its dashboard, reps file or script;
- watches the video (half speed helps), matching reps by the spoken numbers;
- fills the `label` column with **clean**, **leaned** or **unsure**: leaned means the trunk
  visibly moves forward during the reach, judged by eye, not measured. Unsure is fine; those
  reps are left out of the score. Use `notes` for anything odd.

Open the CSV in Excel, Numbers or Google Sheets, and save it as CSV again.

## 6. Report and pick the threshold

```bash
.venv/bin/python -m software.analysis.validation report data/validation --out docs/validation-results.md
```

It prints, and saves to `docs/validation-results.md`:

- **Agreement** with the video and Cohen's kappa (agreement beyond chance), plus the table of
  missed leans and false alarms;
- agreement and median peak lean (clean vs leaned) **per tester**;
- the **repeatability** table (one row per run);
- a **threshold sweep**: every rep re-judged from the recorded trunk angle, the way the
  firmware does it (past the threshold for at least 200 ms during the reach), from 4° to 20°.
  It names the thresholds that best match the video and suggests the middle of that range.

Then: set the threshold (`--threshold <deg>` on the logger, or change `DEFAULT_THRESHOLD_DEG` in
the firmware with Yousuf), and add a line to the Decisions section of `docs/STATUS.md` with
the number and how many reps it came from. If clean and leaned reps overlap a lot in peak
lean, AGENTS.md section 9 says what to try next (wrist features before anything else).

## Where the files go

`data/validation/<tester>/`: the logger's `samples_`, `reps_` and `raw_` files and the
`labels_` sheets. The CSVs are small and can be committed so everyone can rerun the report.
Videos stay out of git (they're ignored); keep them in the team drive.

Keep one good clean run as the symposium fallback, in case the wiring fails on the day.
