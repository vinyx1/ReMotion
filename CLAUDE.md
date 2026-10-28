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

## Fixed hardware

- **Microcontroller:** ESP32 or Arduino, course-provided. Exact board not yet decided; ask before writing firmware.
- **IMUs:** 2× MPU-6050 (6-axis, no magnetometer) on one I2C bus, addresses 0x68 (AD0 low) and 0x69 (AD0 high). Run I2C at 100 kHz with short, twisted wires, since the wrist cable runs to the chest box.
- **Wiring:** full-size breadboard, jumper wires, male headers, perfboard, heat shrink and wire for the final build. No STEMMA QT/Qwiic cables: the MPU-6050 breakouts use header pins.
- **Cues and input:** LEDs and push buttons (course-provided; buttons start calibration/reps) plus a **piezo buzzer, still to buy** (~$1) for the audible cue.
- **Mounting:** chest strap/harness for the trunk IMU in a 3D-printed box with the chest electronics; velcro wrist/forearm strap for the wrist IMU.
- **Target layout:** printed template (poster paper/form board) showing where to reach. The parts list says LEDs cue which target to reach for, but the exercise stays a single forward reach until multiple targets are confirmed.
- **Power:** power bank (personally owned); the laptop USB serial link also powers the board.
- **Not on the list, assumed available:** a phone to film the side view, and a laptop.

## Proposed, not yet confirmed

Treat these as defaults; confirm with the user before building on them.

- **Pitch + roll only** (forward and sideways lean). Trunk rotation (yaw) drifts on a 6-axis IMU without a magnetometer; it is a stretch goal. The MPU-6050 is accurate enough for this with a complementary filter.
- **Firmware** via Arduino IDE with an MPU-6050 library (e.g. Adafruit MPU6050), board core matching whichever ESP32/Arduino is chosen. PlatformIO only if the team prefers it.
- **Python backend:** PySerial, NumPy, SciPy; a complementary filter for trunk tilt; CSV for session storage.
- **Sampling** at 100 Hz, each sample timestamped on the microcontroller.
- **Trunk sensor on the sternum** with a snug chest strap.
- **Testers are team members** simulating compensation; no patients (ethics). State this plainly in the report.
- **Team split:** hardware/firmware · signal processing · dashboard/storage · mounting/testing. Firmware ships a recorded CSV early so signal processing isn't blocked on hardware.

## Known limits

IMUs don't give absolute position; integrating acceleration for displacement drifts — measure angles, not distances. Two IMUs cannot reconstruct full arm or shoulder posture.
