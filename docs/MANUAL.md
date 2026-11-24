# ReMotion user manual

How to set up the device, run a session, record it on the laptop and look at it on the dashboard.
For checking the device against video (accuracy testing), see [`TESTING.md`](TESTING.md).

## What you need

- The button mat (Arduino, driver board, buzzer, five arcade buttons)
- The wrist box (wrist IMU + level shifter) and the chest box (chest IMU), with their cables
- The chest harness and the wrist strap
- A laptop with this repo, and a USB-C cable

## One-time laptop setup

From the repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate              # every new terminal: run this first
pip install -r requirements.txt

cd software/web
npm install
node server/set-owner.ts <your email>  # makes the dashboard login; prints a password once, save it
cd ../..
```

Upload the firmware once (Arduino IDE, or the command line):

```bash
arduino-cli upload -p /dev/ttyACM0 -b arduino:renesas_uno:minima firmware/reach_tracker
```

## 1. Connect and check the hardware

1. Plug the cables in this order: **mat → wrist box → chest box**. Then plug the Arduino into the laptop with USB-C.
2. **Close the Arduino IDE's Serial Monitor.** Only one program can use the USB port at a time, and the logger needs it.
3. If the buzzer gives **3 low beeps over and over**, an IMU isn't answering. Upload `firmware/tests/i2c_scanner`, open the Serial Monitor at 115200, and check it finds both `0x68` (chest) and `0x69` (wrist). Fix the wiring, then upload `reach_tracker` again.

## 2. Put the sensors on

- **Chest box:** on the GoPro chest harness, flat on the sternum, strap snug so it can't rock.
- **Wrist box:** clipped onto the outer wrap of the wrist strap, on the **reaching** arm.
- Run the cable along the forearm (Velcro) so it doesn't tug during reaches. Which way up the boxes face doesn't matter: the device learns "upright" every session.

## 3. Set up the mat

1. Seat the person upright, facing the table, the free hand in their lap.
2. Put **HOME** (white) at the table edge, in front of the reaching shoulder.
3. Measure their arm (shoulder to fingertip, seated, arm straight out). Place the mat so **RED is inside that reach**: they must be able to press it **without leaning**. GREEN (~40 %) and BLUE (~70 %) then sit between.
4. Write down the RED distance for this person.

## 4. Start recording on the laptop

In a terminal at the repo root:

```bash
source .venv/bin/activate
python -m software.tools.logger                    # full session (about 2 min)
python -m software.tools.logger --plan 0,0,5,0     # quick demo: 5 reps, buzzer on
python -m software.tools.logger --threshold 12     # optional: a 12° lean limit instead of 10°
```

Leave it running. It finds the Arduino by itself (or pass `--port /dev/ttyACM0`) and prints each rep as it happens.

## 5. Run the session

1. Press the yellow **START** button (or start the logger with `--start` to start it from the laptop).
2. **Calibration:** the person sits upright and still for 3 s while the HOME light blinks.
   - **2 low beeps and a fast-blinking HOME light** mean they moved. Press START to try again.
3. **2 short beeps:** a block begins. The person rests their hand on HOME.
4. After 1 s on HOME, one target lights up. They reach, press **that** button (wrong ones are ignored), and come back to HOME. One hand does everything.
5. The session runs by itself:

   | Block | Reps | Buzzer | Purpose |
   |---|---|---|---|
   | BASELINE | 3 | off | How much they lean on their own |
   | TRAINING | 10 | **on** | The buzzer sounds while they lean past the limit |
   | *rest 30 s* | | | HOME blinks slowly |
   | POST | 3 | off | Did the training stick? |

6. **3 beeps:** the session is done. Press **Ctrl+C** in the logger terminal.

Pressing START during a session ends it early (what was recorded is kept). If a reach takes over 15 s, that rep is skipped and HOME lights again.

The recording is saved in `data/raw/` as `reps_<time>.csv`, `samples_<time>.csv` and `raw_<time>.txt`.

## 6. See it on the dashboard

```bash
cd software/web
npm run dev
```

Open http://localhost:5173/dashboard and sign in with the login you made during setup.

After each new recording, refresh the data (in another terminal, at the repo root). The open dashboard picks it up within 5 seconds:

```bash
.venv/bin/python -m software.dashboard.export --data data --out data/state/accounts/owner/sessions.json
```

Laptop recordings appear under the patient **"recorded"**. What to look at:

- **BASELINE vs POST** percentage of leaned reps: the result. Lower in POST means the training helped.
- **Peak lean per target:** leaning usually grows with distance (RED).
- **Replay / rep detail:** the trunk angle during any single rep.

## Showing it off (short demos)

No need for a full session. Plug in the Arduino, close the Serial Monitor, and from the repo folder run:

```bash
./demo.sh
```

It starts the dashboard, opens it in the browser, and shows the demo menu. Quitting (`q`) stops the dashboard too.

| Key | Demo | What to show |
|---|---|---|
| 1 | Buzzer check: 5 reps, buzzer on | Lean forward on a reach: it beeps. Sit upright: silence |
| 2 | Before / after: 3 without the buzzer, 5 with, 3 without | Lean in the first 3, stay upright after. The dashboard shows the lean rate dropping |
| 3 | Full session | The real thing |

Press Enter when the person is sitting still: calibration starts right away (no START press). The laptop stops by itself when the session ends and refreshes the dashboard, then offers the menu again for the next visitor. Short demos skip the 30 s rests.

## Quick fixes

| Problem | Fix |
|---|---|
| Logger says "No Arduino found" | Plug in USB; close the IDE's Serial Monitor; or pass `--port` |
| 3 low beeps, repeating | An IMU isn't found: run `i2c_scanner` (step 1) |
| 2 low beeps after START | They moved during calibration: sit still, press START again |
| Buzzer goes off when they sit still | Strap loose, so redo the calibration; or raise the limit with `--threshold` |
| Nothing lights after calibration | Their hand must rest on HOME for 1 s |
| New session missing on the dashboard | Run the refresh command in step 6 |

## Phone instead of laptop

The Android app (`software/android/`) can run a session over USB-C and upload it to the dashboard. See [`software/android/README.md`](../software/android/README.md).
