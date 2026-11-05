# Stroke Rehab IMU Device (ECE 198)

Wearable proof of concept for a 4-person ECE 198 team. Two IMUs (wrist + trunk) detect **trunk compensation** — leaning the torso to make up for limited arm reach — during a seated forward reach. Scope it like a hackathon: one exercise, done reliably, is the finish line.

## Settled decisions

- **One exercise:** seated reach from a home button to a lit target button. More exercises only after this one works.
- **Rule-based detection, not ML.** Calibrate an upright "zero" for trunk tilt; a rep is compensated when its peak tilt from zero exceeds a threshold (start ~10°, then tune from recorded data). The labeled test recordings double as ML training data if thresholds ever prove unreliable — ML is the fallback, not the plan.
- **Wrist IMU only segments reps** (onset/offset) and counts them. Smoothness and other wrist metrics are stretch goals.
- **Feedback:** a simple real-time cue (buzzer beep + red/green result LED on the table unit) when a rep crosses the threshold, plus post-session graphs in Streamlit + Plotly. No live-streaming dashboard — Streamlit reruns the whole script per update and handles 100 Hz plotting poorly.
- **Wired:** both IMUs cabled to one microcontroller, USB serial to a laptop. Wireless is a future extension.
- **Success:** run scripted reps — clean and deliberately leaned — filmed from the side as ground truth; the system must correctly label clean vs. bad reps.
- **Hardware is fixed** (see below, from the team's KiCad schematic `ECE 198 Kicad Design (3).pdf`, "IMU Reach Tracker", Group 19). The course gives no hardware constraints; the build is about $150. Don't propose extra sensors unless they add something meaningful.

## Scope

**Core (must work):** reach from the home button to one target button; trunk pitch + roll from a calibrated upright zero (sternum IMU, complementary filter); reps segmented and counted; a rep is compensated if its peak tilt exceeds the threshold; buzzer + red/green result LED per rep; Streamlit post-session graphs showing reps, threshold and flagged reps; validation against side-view video.

**Extension (once the core works, around week 3):** cycle through all four target buttons (Home, Green, Blue, Red), lighting the next one as the cue. The hardware for this is already in the schematic, so it is firmware-only. Same pipeline; roll does the work on side targets. If week 3 slips, demo the core with one target.

**Cut list (stretch goals at most):** yaw/rotation, smoothness metrics, wireless, ML, live dashboard, patient data.

**Success measure:** agreement between the system's clean/leaned label and the side-view video label. Target is a placeholder (about 90% over about 60 reps from 3+ team members); settle it together with the team after the first recordings.

**Timeline (4 weeks):** (1) wiring, firmware streaming timestamped CSV at 100 Hz, calibration button; a sample CSV goes to signal processing by day 2–3. (2) rep segmentation and threshold rule on recorded data. (3) buzzer/LED feedback, Streamlit report, then the multi-target extension. (4) filmed validation, threshold tuning, demo polish, report.

**Demo target (a few minutes, no hard limit):** a judge straps on the chest and wrist sensors, the team measures their arm and places the target board, they press calibrate, sit upright for 3 s, do about 5 reaches to the lit button, hear the beep when leaning, then see the graphs. Rehearse it, with a pre-recorded session as a fallback if the wiring fails.

## Fixed hardware

Source of truth for the circuit: the KiCad schematic in the repo root. Full specs, Digi-Key cart, wiring rules and bench test: `docs/parts-list.md`. Open checks: `docs/confirmations.md`.

- **Sourcing:** the team buys all its own parts and does not use the course kit. Already bought by a teammate: 2× MPU-6050, chest strap, wrist strap, buttons. The Digi-Key order covers the rest.
- **Microcontroller:** Arduino UNO R4 Minima (ABX00080). 5 V logic, 8 mA max per I/O pin (official datasheet), 3.3 V pin fed from the chip's USB regulator (~50 mA per third-party sources, unconfirmed officially; only feeds AD0, the shifter's LV side and logic levels).
- **IMUs:** 2× MPU-6050 on GY-521 breakouts, one I2C bus. **Chest (U1) = 0x69, AD0 to 3V3** (never 5 V). **Wrist (U2) = 0x68, AD0 left unconnected** (the GY-521 pulls it low). Clone chips may report a different WHO_AM_I (register 0x75, genuine = 0x68); check both with an I2C scanner first.
- **Level shifter:** Adafruit 757 (BSS138, 4-channel). HV to 5V, LV to 3V3. B1/B2 (HV side) to Arduino SDA/SCL (A4/A5); A1/A2 (LV side) to both IMUs' SDA/SCL. Channels 3–4 unused.
- **Buttons:** 5× 30 mm arcade buttons (SW1–SW5) to D2–D6, other side to GND, read with `INPUT_PULLUP`. SW1–SW4 are the targets Home, Green, Blue, Red, each with a built-in LED; SW5 has no LED and is the calibrate/start button. Confirm the exact button-to-pin order in KiCad before writing firmware.
- **Target button LEDs:** each switched low-side by a 2N3904 (Q1–Q4), Arduino pin → 1 kΩ (R1–R4) → base, collector → LED cathode, emitter → GND, LED anode to 5V. Pins: D7 Home, D8 Green, D9 Blue, D10 Red. **Unknown: the arcade LEDs' rated voltage and whether they have a built-in resistor**; if they are bare LEDs, add a ~150–220 Ω series resistor each; if they are 12 V LEDs, they will be dim at 5 V.
- **Buzzer:** Same Sky CMI-1295-0585T (active, internally driven magnetic, 5 V, 30 mA; no tone code). + to 5V, − to Q5 collector; D11 → 1 kΩ (R5) → base. 1N4148 (D1) across the buzzer, cathode to 5V.
- **Result LEDs:** 5 mm green on D12 (clean) and red on D13 (compensated), each through 1 kΩ (R6, R7) to GND, about 3 mA. D13 also drives the board's built-in LED, which is harmless.
- **Recommended addition (not in the schematic yet):** a 10 kΩ pull-down from each transistor base (Q1–Q5) to GND, so the buzzer doesn't chirp and target LEDs don't flicker while the Arduino resets.
- **Physical layout:** the Arduino, level shifter, buttons, transistors, buzzer and result LEDs live in a **table unit** under or beside the target board. One 4-conductor cable (power, GND, SDA, SCL; about 1 m) runs from the table unit to a small **chest box** holding the chest IMU on the sternum strap; the wrist IMU chains from the chest box on a second 4-conductor cable (about 70–80 cm) along the forearm. The person wears one cable; the USB cable stays on the table. Total I2C run is about 2 m: run 100 kHz, drop to 50 kHz if it drops out, keep SDA and SCL apart in each cable (e.g. SDA, GND, SCL, VCC), and test at full length early.
- **Prototyping (weeks 1–3):** everything on a full-size breadboard with jumpers; the only soldering is header pins on the IMUs and shifter. The IMUs connect with chained male-female jumpers until the real cables are made.
- **Final build (weeks 3–4):** circuit soldered onto a Perma-Proto board in the table unit, female headers so the IMUs and cables plug in, both cables soldered and heat-shrunk with zip-tie strain relief, Velcro ties along the forearm, a 3D-printed chest box and table enclosure.
- **Power:** the laptop's USB powers everything; total draw is well within USB limits. The power bank isn't needed.
- **Not on the list, assumed available:** a phone to film the side view, and a laptop.

## Proposed, not yet confirmed

Treat these as defaults; confirm with the user before building on them.

- **Pitch + roll only** (forward and sideways lean). Trunk rotation (yaw) drifts on a 6-axis IMU without a magnetometer; it is a stretch goal. The MPU-6050 is accurate enough for this with a complementary filter.
- **Buttons as rep segmentation:** releasing the home button marks rep onset and pressing the lit target marks the reach end, giving exact timing. The wrist IMU then becomes a cross-check and fallback rather than the only segmenter. This would amend the settled "wrist IMU only segments reps" decision.
- **Firmware** via Arduino IDE with an MPU-6050 library (e.g. Adafruit MPU6050), the official Arduino UNO R4 board package (keep it updated). If the library rejects a clone chip's ID, read the registers directly or use a library that doesn't check it. PlatformIO only if the team prefers it.
- **Python backend:** PySerial, NumPy, SciPy; a complementary filter for trunk tilt; CSV for session storage.
- **Sampling** at 100 Hz, each sample timestamped on the microcontroller.
- **Trunk sensor on the sternum** with a snug chest strap.
- **Arm's-length rule (setup procedure, not sensed):** before each tester's session, measure their arm length with a tape measure (shoulder to fingertip, seated, arm extended) and place the target board so the lit button sits inside it, so a clean reach needs essentially no trunk motion. Research (Foreman & Engsberg 2020, n=5, see `docs/research/stroke-compensations.md`) found healthy trunk flexion of about 0.4° at arm's length versus about 18.7° at +20 cm. Record the target distance per tester with the session data. The IMUs cannot measure distance, so they can't enforce this.
- **Per-person baseline threshold:** instead of a fixed ~10°, take the mean peak tilt of a few clean calibration reps and flag a rep that exceeds it by a margin; tune the margin from recorded data. The fixed 10° stays as the fallback default. The literature has no validated degree cutoff, so 10° is a tuning default only.
- **If clean and leaned reps overlap** in peak tilt, add wrist-IMU features already available (reach duration, peak speed) before considering anything else. No new hardware.
- **Testers are team members, possibly some friends,** simulating compensation; no patients (ethics). State this plainly in the report. Check whether the course requires consent or approval for testers outside the team.
- **Client:** Waterloo CCARE. Ask them what real stroke compensation looks like (and ideally for example videos), so scripted leaned reps resemble the real thing.
- **Video-to-data sync:** at the start of each recording, press the calibrate button (SW5) with a result LED in camera frame; the firmware logs a marker at the same moment. Testers also follow a fixed rep script (e.g. 5 clean, then 5 leaned) and say each rep number aloud, as a cross-check if a rep is missed or double-counted.
- **Labeling protocol:** the team labels the side-view video themselves. The labeler is a teammate who did not perform that session where possible, labels from the video (not the script, since a "clean" rep can lean by accident), and does not see the system's output while labeling. Label by clearly visible lean, not a measured angle.
- **Team split:** hardware/firmware · signal processing · dashboard/storage · mounting/testing. Firmware ships a recorded CSV early so signal processing isn't blocked on hardware.

## Known limits

IMUs don't give absolute position; integrating acceleration for displacement drifts — measure angles, not distances. Two IMUs cannot reconstruct full arm or shoulder posture.
