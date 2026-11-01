# Stroke Rehab IMU Device (ECE 198)

Wearable proof of concept for a 4-person ECE 198 team. Two IMUs (wrist + trunk) detect **trunk compensation** — leaning the torso to make up for limited arm reach — during a seated forward reach. Scope it like a hackathon: one exercise, done reliably, is the finish line.

## Settled decisions

- **One exercise:** seated forward reach to a fixed target. More exercises only after this one works.
- **Rule-based detection, not ML.** Calibrate an upright "zero" for trunk tilt; a rep is compensated when its peak tilt from zero exceeds a threshold (start ~10°, then tune from recorded data). The labeled test recordings double as ML training data if thresholds ever prove unreliable — ML is the fallback, not the plan.
- **Wrist IMU only segments reps** (onset/offset) and counts them. Smoothness and other wrist metrics are stretch goals.
- **Feedback:** a simple real-time cue (buzzer beep + red/green LED, on the device) when a rep crosses the threshold, plus post-session graphs in Streamlit + Plotly. No live-streaming dashboard — Streamlit reruns the whole script per update and handles 100 Hz plotting poorly.
- **Wired:** both IMUs cabled to one microcontroller, USB serial to a laptop. Wireless is a future extension.
- **Success:** run scripted reps — clean and deliberately leaned — filmed from the side as ground truth; the system must correctly label clean vs. bad reps.
- **Hardware is fixed** (see below). The course gives no hardware constraints, but the team chose a ~$55–60 build; don't propose extra sensors unless they add something meaningful.

## Scope

**Core (must work):** the seated forward reach; trunk pitch + roll from a calibrated upright zero (sternum IMU, complementary filter); wrist IMU segments and counts reps; a rep is compensated if its peak tilt exceeds the threshold; on-device buzzer + red/green LED per rep; Streamlit post-session graphs showing reps, threshold and flagged reps; validation against side-view video.

**Extension (only once the core works, around week 3):** reach to forward / left / right targets on the printed template, cued in sequence. Same pipeline; roll does the work on the side targets. Not committed: if week 3 slips, demo the core. Decision pending with the user.

**Cut list (stretch goals at most):** yaw/rotation, smoothness metrics, wireless, ML, live dashboard, patient data.

**Success measure:** agreement between the system's clean/leaned label and the side-view video label. Target is a placeholder (about 90% over about 60 reps from 3+ team members); settle it together with the team after the first recordings.

**Timeline (4 weeks):** (1) wiring, firmware streaming timestamped CSV at 100 Hz, calibration button; a sample CSV goes to signal processing by day 2–3. (2) rep segmentation and threshold rule on recorded data. (3) buzzer/LED feedback, Streamlit report, then the multi-target extension. (4) filmed validation, threshold tuning, demo polish, report.

**Demo target (a few minutes, no hard limit):** a judge straps on the device, the team measures their arm and places the target, they press calibrate, sit upright for 3 s, do about 5 reaches, hear the beep when leaning, then see the graphs. Rehearse it, with a pre-recorded session as a fallback if the wiring fails.

## Fixed hardware

- **Sourcing:** the team buys all its own parts and does not use the course kit. Already bought: 2× MPU-6050, chest strap, wrist strap, push buttons. Everything else below is still to buy.
- **Microcontroller:** Arduino UNO R4 Minima (not yet bought; chosen over the Pico 2 W because it is easier to find in stores). 5 V logic, per the official datasheet 8 mA max per I/O pin, and a 3.3 V pin fed from the chip's USB regulator (third-party sources say about 50 mA; not confirmed in the official datasheet). Because the MPU-6050 is a 3.3 V chip, SDA and SCL go through a 4-channel BSS138 bidirectional level shifter (5 V side to the Arduino, 3.3 V side to the IMUs).
- **IMUs:** 2× MPU-6050 (6-axis, no magnetometer) on one I2C bus, addresses 0x68 (AD0 to ground) and 0x69 (AD0 to 3.3 V, never 5 V). Cheap boards may carry clone chips with a different WHO_AM_I ID (register 0x75, genuine = 0x68); check both with an I2C scanner before writing firmware. Run I2C at 100 kHz with short, twisted wires, since the wrist cable runs to the chest box.
- **Wiring:** breadboard and jumper wires (including male-female); about 1 m of 4-conductor stranded wire for the wrist cable; perfboard, header pins and heat shrink for the final build; a ~2 m USB-C data cable to the laptop. Keep SDA and SCL apart in the wrist cable (e.g. SDA, GND, SCL, VCC). No STEMMA QT/Qwiic cables: the MPU-6050 breakouts use header pins.
- **Cues and input:** push buttons (bought; they start calibration/reps, wired with `INPUT_PULLUP`), red/green LEDs with 1 kΩ resistors (about 3 mA each), and an **active** 5 V piezo buzzer (beeps on power, so no tone code) powered from the Arduino's 5 V pin and switched through an NPN transistor (2N3904/2N2222, 1 kΩ base resistor). The 8 mA pin limit means nothing heavier than an LED goes straight on a pin. Shopping list: `docs/parts-list.md`.
- **Mounting:** chest strap/harness for the trunk IMU in a 3D-printed box with the chest electronics; velcro wrist/forearm strap for the wrist IMU.
- **Target layout:** printed template (poster paper/form board) showing where to reach. The parts list says LEDs cue which target to reach for, but the exercise stays a single forward reach until multiple targets are confirmed.
- **Layout:** the Arduino, level shifter, perfboard, trunk IMU, buzzer and red/green LED sit in the chest box. The wrist IMU connects over a 4-wire cable (power, ground, SDA, SCL) of about 60–80 cm along the forearm to the chest box; keep it short for I2C reliability. One USB cable runs from the Arduino to the laptop. Use strain relief and heat shrink at every connector. Target LEDs on the template would each need a wire back to the Arduino; decide that in week 3 if multi-target goes ahead.
- **Power:** the laptop USB link powers the board and carries the data; the power bank (personally owned) isn't needed while wired.
- **Not on the list, assumed available:** a phone to film the side view, and a laptop.

## Proposed, not yet confirmed

Treat these as defaults; confirm with the user before building on them.

- **Pitch + roll only** (forward and sideways lean). Trunk rotation (yaw) drifts on a 6-axis IMU without a magnetometer; it is a stretch goal. The MPU-6050 is accurate enough for this with a complementary filter.
- **Firmware** via Arduino IDE with an MPU-6050 library (e.g. Adafruit MPU6050), the official Arduino UNO R4 board package (keep it updated). If the library rejects a clone chip's ID, read the registers directly or use a library that doesn't check it. PlatformIO only if the team prefers it.
- **Python backend:** PySerial, NumPy, SciPy; a complementary filter for trunk tilt; CSV for session storage.
- **Sampling** at 100 Hz, each sample timestamped on the microcontroller.
- **Trunk sensor on the sternum** with a snug chest strap.
- **Arm's-length rule (setup procedure, not sensed):** before each tester's session, measure their arm length with a tape measure (shoulder to fingertip, seated, arm extended) and place the target inside it, so a clean reach needs essentially no trunk motion. Research (Foreman & Engsberg 2020, n=5, see `docs/research/stroke-compensations.md`) found healthy trunk flexion of about 0.4° at arm's length versus about 18.7° at +20 cm. Record the target distance per tester with the session data. The IMUs cannot measure distance, so they can't enforce this.
- **Per-person baseline threshold:** instead of a fixed ~10°, take the mean peak tilt of a few clean calibration reps and flag a rep that exceeds it by a margin; tune the margin from recorded data. The fixed 10° stays as the fallback default. The literature has no validated degree cutoff, so 10° is a tuning default only.
- **If clean and leaned reps overlap** in peak tilt, add wrist-IMU features already available (reach duration, peak speed) before considering anything else. No new hardware.
- **Testers are team members, possibly some friends,** simulating compensation; no patients (ethics). State this plainly in the report. Check whether the course requires consent or approval for testers outside the team.
- **Client:** Waterloo CCARE. Ask them what real stroke compensation looks like (and ideally for example videos), so scripted leaned reps resemble the real thing.
- **Video-to-data sync:** at the start of each recording, press the calibration button with the device's LED in camera frame; the firmware logs a marker at the same moment. Testers also follow a fixed rep script (e.g. 5 clean, then 5 leaned) and say each rep number aloud, as a cross-check if a rep is missed or double-counted.
- **Labeling protocol:** the team labels the side-view video themselves. The labeler is a teammate who did not perform that session where possible, labels from the video (not the script, since a "clean" rep can lean by accident), and does not see the system's output while labeling. Label by clearly visible lean, not a measured angle.
- **Team split:** hardware/firmware · signal processing · dashboard/storage · mounting/testing. Firmware ships a recorded CSV early so signal processing isn't blocked on hardware.

## Known limits

IMUs don't give absolute position; integrating acceleration for displacement drifts — measure angles, not distances. Two IMUs cannot reconstruct full arm or shoulder posture.
