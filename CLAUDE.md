# CLAUDE.md — IMU Reach Tracker (ECE 198, UWaterloo, Group 19)

You are helping build the software for a hardware prototype. Read this whole file before writing anything.

## Ground rules for Claude

- **Ask before changing any hardware decision** in this file (parts, pins, wiring, addresses, I2C speed, drivers).
- **Do not change the serial protocol** (section 6) without updating the logger, fake-session generator, dashboard and `docs/PROTOCOL.md` together.
- Firmware: **no `printf("%f")`-style float formatting**. Use `Serial.print(value, 1)` or integer formatting.
- Firmware: sample with `micros()` timing, never `delay()` in the main loop.
- Never drive arcade-button LEDs or the buzzer straight from a GPIO pin (R4 Minima pins are ~8 mA max). Always go through a 2N3904 low-side switch.
- Code must be readable for 1st-year engineering students: clear constants at the top, comments explaining each state.
- If `arduino-cli` is available, compile every sketch for `arduino:renesas_uno:minima` and fix all errors.
- Reference material: `hardware/ECE 198 Parts List.pdf`.
- Circuit source of truth: KiCad project `hardware/kicad/` and its export `docs/imu-reach-tracker-schematic.pdf` ("IMU Reach Tracker", Group 19). Full specs, Digi-Key cart, wiring rules and bench test: `docs/parts-list.md`. Schematic review findings: `docs/issues.md`. Open checks: `docs/confirmations.md`. Research notes: `docs/research/`.
- Scope it like a hackathon: one exercise (seated reach), done reliably, is the finish line. Rule-based detection, not ML. Don't propose extra sensors unless they add something meaningful (build is about $150).

## 1. What we are building

A seated reaching-exercise device for stroke survivors and older adults that **detects trunk-lean compensation** during arm reaches and gives real-time feedback.

- **Client:** CCCARE (Centre for Community, Clinical & Applied Research Excellence, Waterloo). Course challenge: track and assess exercise quality, support at-home rehab.
- **Problem:** clinical assessments score whether a reach was completed, not how. A patient who leans their trunk forward to compensate for limited arm movement looks the same as a recovered patient. Therapists have no objective way to monitor this between appointments.
- **Device:** one IMU on the sternum measures trunk tilt; one IMU on the wrist measures arm movement; arcade buttons on a table mat time each reach. If the trunk tilts past a threshold during a reach, a buzzer sounds and the rep is flagged as compensated. All data streams to a laptop for logging and a therapist dashboard.

**Team:** Group 19, 4 people. The user is the project manager. Other roles: researcher, tester, designer.

### Deadlines
| Date | Milestone |
|---|---|
| Nov 4, 2026 | Brief written / project start |
| Week of Nov 9 | In-person update presentation: bring a working prototype (progress expected, not finished) |
| Nov 20 | Team target: fully working |
| Wed Nov 25 | Final symposium demo, Ideas Clinic |

Rough plan: (1) wiring + firmware streaming at 100 Hz, ship a sample CSV early so the dashboard/analysis isn't blocked on hardware; (2) rep logic and threshold on recorded data; (3) buzzer/LED feedback, dashboard; (4) filmed validation, threshold tuning, demo polish, report.

**Team split:** hardware/firmware · signal processing · dashboard/storage · mounting/testing.

### Demo plan
A judge straps on the chest and wrist sensors, the team measures their arm and places the mat, they press START, sit upright for 3 s, do ~5 reaches, hear the beep when leaning, then see the dashboard. Rehearse it, and keep a pre-recorded session as a fallback if the wiring fails.

## 2. Session procedure (how a patient uses it)

1. Patient wears a chest harness (trunk IMU on sternum) and a wrist brace (wrist IMU on the reaching arm). Free hand rests in the lap, not on the table.
2. Patient sits upright facing a flat button mat on the table. Mat layout (top view):
   - **HOME** (white): near the table edge in front of the reaching shoulder
   - **GREEN** target: ~40% of arm reach
   - **BLUE** target: ~70%
   - **RED** target: ~100% of comfortable seated reach (reachable WITHOUT leaning)
3. Operator presses **START** (yellow arcade button, beside the Arduino, not on the mat).
4. Calibration: patient sits upright and still for 3 s. HOME LED blinks during calibration; short beep when done.
5. Patient rests the reaching hand on HOME. After HOME is held for 1 s, a random target's LED lights up.
6. Patient lifts off HOME, reaches, presses the lit target, returns to HOME. ONE hand does everything.
7. During the reach, if trunk angle exceeds the threshold, the buzzer sounds. After the target press: green LED = clean rep, red LED = compensated rep.
8. Repeat (~10 reps). Operator presses START again to end the session.

Timing captured per rep:
- **Reaction time:** cue → leaving HOME
- **Reach time:** leaving HOME → pressing target

Wrong-target presses are ignored.

## 3. Hardware (final decisions)

We do NOT have the course sign-out parts (no OLED, no potentiometer, no kit pushbuttons, no Grove parts). Everything below is what we actually own.

| Part | Qty | Role |
|---|---|---|
| Arduino UNO R4 Minima (Renesas RA4M1, 5V logic, USB-C) | 2 | One main board, one spare |
| GY-521 (MPU-6050 accel + gyro, onboard 3.3V regulator) | 3 | Trunk (0x69), wrist (0x68), one spare |
| Adafruit 757 BSS138 4-ch I2C-safe bidirectional level shifter | 2 | 5V Arduino ↔ 3.3V IMUs |
| 30 mm arcade buttons with built-in 5V LED (white, green, blue, red, yellow) | 5 | HOME, 3 targets, START |
| CUI CMI-1295-0585T 5V magnetic buzzer, 12 mm | 2 | Lean alarm (driven via transistor) |
| 2N3904 NPN transistors | 10 | Buzzer driver + 4 button-LED drivers |
| 1N4148 diodes | 10 | Flyback diode across buzzer |
| Red / green 5 mm LEDs (Kingbright) | 10 each | Rep result |
| 1 kΩ, 10 kΩ resistors | 15 each | LED limit, transistor base |
| Adafruit 4-conductor 1 m flat cable, jumpers, headers, heat shrink | — | Wiring |
| Wrist brace, GoPro-style chest harness | — | Sensor mounts |

Sourcing: the team buys its own parts (no course kit). Laptop USB powers everything; no power bank needed. A phone films the side view for validation.

### Part notes
- **IMU clones:** clone chips may report a different WHO_AM_I (register 0x75, genuine = 0x68). If the Adafruit library rejects the chip ID, read the registers directly or use a library that doesn't check it. Run the I2C scanner first.
- **Chest AD0 goes to 3.3V, never 5V.** Wrist AD0 floats low via the GY-521's onboard pull-down.
- **Arcade button LEDs:** rated voltage and built-in resistor still unconfirmed. If they are bare LEDs, add a ~150–220 Ω series resistor each; if they are 12 V LEDs they will be dim at 5 V.
- **Buzzer** (CMI-1295-0585T) is rated 5 V, ~30 mA.
- **Arduino 3.3V pin** comes from the chip's USB regulator (~50 mA, unconfirmed officially); it only feeds chest AD0 and the shifter LV side.
- **Recommended addition (not in the schematic yet, ask before adding):** a 10 kΩ pull-down from each 2N3904 base to GND, so the buzzer doesn't chirp and LEDs don't flicker while the Arduino resets.

### Physical layout
- **Table unit:** Arduino, level shifter, buttons/mat, transistors, buzzer and result LEDs.
- **Chest box:** small box on the sternum strap holding the chest IMU; one 4-conductor cable (VCC, GND, SDA, SCL) from the table unit. The wrist IMU chains from the chest box on a second 4-conductor cable along the forearm. The person wears one cable; USB stays on the table.
- Keep SDA and SCL apart in each cable (e.g. order SDA, GND, SCL, VCC). If 100 kHz drops out at full length, try 50 kHz. Test at full cable length early.
- **Prototype:** full-size breadboard and jumpers; only soldering is IMU/shifter headers. **Final build:** Perma-Proto board in the table unit with female headers for the IMUs, soldered and heat-shrunk cables with zip-tie strain relief, Velcro along the forearm, 3D-printed chest box and table enclosure.

### Electrical constraints
- **R4 Minima GPIO can only safely source/sink about 8 mA per pin.** Never drive the arcade button LEDs or the buzzer directly from a pin. Use 2N3904 low-side switches.
- **I2C:** R4 Minima is 5V logic; MPU-6050 is 3.3V. IMUs sit behind the BSS138 shifter. Keep I2C at **100 kHz** (long leads: ~30 cm chest, ~45 cm wrist). ⚠ An older plan assumed ~1 m table→chest and ~70–80 cm chest→wrist (≈2 m total); confirm actual cable lengths with the user.
- MPU-6050 has only two addresses (0x68 / 0x69), so we use exactly two IMUs on one bus.

## 4. Pin map and wiring

### I2C / IMUs
| From | To |
|---|---|
| Arduino 5V | Shifter HV, chest VCC, wrist VCC |
| Arduino 3.3V | Shifter LV, chest AD0 |
| Arduino GND | Shifter GND, chest GND, wrist GND |
| Arduino SDA | Shifter B1 |
| Arduino SCL | Shifter B2 |
| Shifter A1 | Chest SDA + wrist SDA |
| Shifter A2 | Chest SCL + wrist SCL |
| Chest AD0 → 3.3V | Chest address = **0x69** |
| Wrist AD0 unconnected | Wrist address = **0x68** |
| INT, XDA, XCL (both) | Not connected (we poll every 10 ms) |

IMU box pinouts:
- **Chest:** VCC, GND, SDA, SCL, AD0
- **Wrist:** VCC, GND, SDA, SCL

### Buttons
Microswitch: one tab to pin, other tab to GND, `INPUT_PULLUP`, **LOW = pressed**.

| Pin | Button |
|---|---|
| D2 | HOME (white) |
| D3 | Target GREEN |
| D4 | Target BLUE |
| D5 | Target RED |
| D6 | START/STOP (yellow) |

### Outputs
| Pin | Circuit |
|---|---|
| D7 | 1k → 2N3904 base; E → GND; C → HOME button LED (−); LED (+) → 5V |
| D8 | Same driver → GREEN button LED |
| D9 | Same driver → BLUE button LED |
| D10 | Same driver → RED button LED |
| D11 | 1k → 2N3904 base; E → GND; C → buzzer (−); buzzer (+) → 5V; 1N4148 across buzzer, stripe to 5V. Drive with `tone(11, 2400)` / `noTone(11)` (works whether the buzzer is an indicator or transducer type) |
| D12 | 1k → green 5 mm LED → GND (clean rep) |
| D13 | 1k → red 5 mm LED → GND (compensated rep) |

The yellow START button's LED is optional; leave it unconnected unless the user asks.

## 5. Algorithms

### Trunk angle (axis-independent)
- **Calibration:** average the trunk accelerometer vector over 3 s while upright → normalize → `base`.
- Reject calibration and ask to redo if the samples vary too much (person moved). Pick a sensible variance threshold and make it a named constant.
- **Every sample:** `angle = acos( dot(a, base) / |a| )` in degrees. Clamp the cosine to [-1, 1]; skip the sample if |a| is tiny.
- **Smooth:** `trunkDeg += 0.15 * (angle - trunkDeg)` (exponential low-pass).
- Works regardless of how the GY-521 is mounted. Detects forward and sideways lean. Does **NOT** detect trunk twisting (rotation about vertical); document as a known limitation. Later upgrade: fuse the gyro (complementary filter).

### Lean decision
- **Threshold:** fixed constant, default **10°** (no potentiometer). Easy to change in code, and settable over serial (`T12` sets 12°).
- **Live:** buzzer ON while in REACHING state and `trunkDeg > threshold` has been true for **≥ 200 ms** (sustain filter to avoid jolts); OFF otherwise.
- **Per rep:** track peak `trunkDeg` from leaving HOME to target press. Rep is compensated if peak > threshold AND the sustain condition was met at least once.

### Wrist smoothness (simple)
- `wristDps = |gyro|` in deg/s.
- Count "bursts": enter burst when > 60 deg/s, exit when < 30 deg/s (hysteresis). Bursts per reach is a rough smoothness measure (fewer = smoother).
- Proper metrics (speed peaks, SPARC) are done later in Python from the logged data.

### State machine
```
IDLE -> CALIBRATING -> WAIT_HOME -> CUED -> REACHING -> RETURNING -> WAIT_HOME ...
```
- START in any active state ends the session (emit `S,` line) and returns to IDLE.
- Reach timeout (e.g. 15 s) aborts the rep and returns to WAIT_HOME.
- Debounce all buttons (arcade microswitches bounce).
- Sample at **100 Hz** using `micros()` timing, not `delay()`.

### Error handling without a screen
- **IMU not found at startup:** 3 low beeps, repeating, + message on Serial.
- **Calibration rejected:** 2 low beeps, HOME LED blinks fast, wait for START again.

## 6. Serial protocol

115200 baud, newline-terminated, comma-separated.

```
# comment lines start with '#'
D,t_ms,state,trunk_deg,wrist_dps,threshold      (every sample, 100 Hz; toggle with a constant)
R,rep,target,react_ms,reach_ms,peak_deg,bursts,compensated
S,reps,compensated_reps
E,message                                       (errors)
```

Commands accepted from the laptop:
- `T<deg>` — set threshold (e.g. `T12`)
- `D0` / `D1` — disable / enable sample (`D`) streaming

**Do not change this format without updating the logger and dashboard together.**

## 7. Software stack

| Layer | Tech |
|---|---|
| Firmware | C++, Arduino framework, board "Arduino UNO R4 Minima" (core: Arduino UNO R4 Boards) |
| Libraries | `Wire`, `Adafruit MPU6050` (+ Adafruit Unified Sensor, BusIO) |
| Build/flash | Arduino IDE or `arduino-cli` (FQBN `arduino:renesas_uno:minima`) |
| Logger | Python 3 + `pyserial` → `samples_<timestamp>.csv`, `reps_<timestamp>.csv` |
| Analysis / dashboard | `pandas`, `matplotlib` or `plotly`, `streamlit` |

## 8. Deliverables / repo structure

```
stroke-device/                        # repo root (GitHub: stroke-device)
  firmware/
    reach_tracker/reach_tracker.ino   # main sketch (sections 4-6)
    i2c_scanner/i2c_scanner.ino       # should report 0x68 and 0x69
    io_test/io_test.ino               # cycles each button LED, beeps, prints button states
    imu_test/imu_test.ino             # prints live trunk angle + wrist dps for bench testing
  hardware/
    kicad/                            # KiCad project + ECE198 symbol library (make_lib.py)
    ECE 198 Parts List.pdf
  tools/
    logger.py                         # serial -> CSV, prints rep summaries live, Ctrl+C to stop
    fake_session.py                   # generates realistic fake D/R/S data so the dashboard can be built without hardware
  dashboard/
    app.py                            # streamlit (see below)
  analysis/                           # offline Python / notebooks (SPARC, validation, tuning)
  data/
    raw/                              # real logs, git-ignored
    sample/                           # small committed examples for the dashboard
  docs/
    WIRING.md                         # pin map + both IMU box pinouts
    PROTOCOL.md                       # serial format
    TESTING.md                        # validation plan (section 9)
  README.md                           # setup, library install, flash, run logger, run dashboard
  requirements.txt                    # (to add with the Python tools)

Python code goes in `tools/`, `dashboard/` or `analysis/`, never in `firmware/`. `exam-guide/` is personal and git-ignored.
```

Dashboard (`dashboard/app.py`) must: load all `reps_*.csv`; show per-session % compensated, peak lean per target, reach time trend, and a trunk-angle trace for a chosen rep (from the samples CSV).

### Priorities (in order)
1. `i2c_scanner`, `imu_test`, `io_test` — needed first to bring up hardware.
2. `reach_tracker.ino` complete and compiling.
3. `logger.py` and `fake_session.py`.
4. Dashboard.
5. Docs.

## 9. Validation plan (for TESTING.md and the dashboard)

1. **Angle accuracy:** film the trunk from the side while leaning to ~0/10/20/30°; compare video angle (Kinovea) with logged `trunk_deg`. Target: within ~3°.
2. **Lean detection:** each team member does 10 upright reaches + 10 deliberate leans + reaches to a target beyond arm's length. Upright rarely flagged; leans flagged.
3. **Repeatability:** 3 sessions of 10 reps with the harness removed and replaced between sessions; peak lean and reach time should be similar.

**Success measure:** agreement between the device's clean/compensated label and the side-view video label. Placeholder target: ~90% over ~60 reps from 3+ team members; settle with the team after the first recordings.

Protocol details:
- **Arm's-length rule (setup, not sensed):** before each tester's session, measure arm length (shoulder to fingertip, seated, arm extended) and place the RED target inside it, so a clean reach needs essentially no trunk motion. Foreman & Engsberg 2020 (n=5, see `docs/research/stroke-compensations.md`): healthy trunk flexion ~0.4° at arm's length vs ~18.7° at +20 cm. Record target distance per tester. The literature has no validated degree cutoff, so 10° is a tuning default only.
- **Video sync:** at the start of each recording, press START with a result LED in camera frame. Testers follow a fixed rep script (e.g. 5 clean, then 5 leaned) and say each rep number aloud as a cross-check.
- **Labeling:** a teammate who did not perform that session labels from the video (not the script, since a "clean" rep can lean by accident), without seeing the device's output. Label by clearly visible lean, not a measured angle.
- **Testers** are team members and possibly friends simulating compensation; no patients (ethics). State this plainly in the report and check whether the course requires consent for testers outside the team.
- **Client input:** ask CCCARE what real stroke compensation looks like (ideally example videos) so scripted leaned reps resemble the real thing.
- **If clean and leaned reps overlap** in peak lean, add wrist features already logged (reach time, peak speed) before considering anything else. ML (using the labeled recordings as training data) is a fallback, not the plan. Possible later upgrade: a per-person threshold (mean peak of a few clean reps + margin), keeping fixed 10° as default.

## 10. Known limitations (document honestly)

- Does not detect trunk twisting (accelerometer only).
- Strap placement affects baseline; recalibrate each session.
- Donning the chest harness and wrist brace one-handed is hard for some patients; a real product needs easier straps.
- Thresholds need clinical tuning; ours is a configurable default.
- IMUs don't give absolute position; integrating acceleration for displacement drifts, so we measure angles, not distances. Two IMUs cannot reconstruct full arm or shoulder posture. They also can't enforce target distance (that's the arm's-length setup rule).
- Out of scope (stretch goals at most): yaw/trunk rotation, wireless, ML, live-streaming dashboard (Streamlit handles 100 Hz plotting poorly; dashboard is post-session), real patient data.
