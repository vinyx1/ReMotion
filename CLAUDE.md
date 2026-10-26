# Stroke Rehab IMU Device (ECE 198)

Wearable proof of concept for a 4-person ECE 198 team. Two IMUs (wrist + trunk) detect **trunk compensation** — leaning the torso to make up for limited arm reach — during a seated forward reach. Scope it like a hackathon: one exercise, done reliably, is the finish line.

## Settled decisions

- **One exercise:** seated forward reach to a fixed target. More exercises only after this one works.
- **Rule-based detection, not ML.** Calibrate an upright "zero" for trunk tilt; a rep is compensated when its peak tilt from zero exceeds a threshold (start ~10°, then tune from recorded data). The labeled test recordings double as ML training data if thresholds ever prove unreliable — ML is the fallback, not the plan.
- **Wrist IMU only segments reps** (onset/offset) and counts them. Smoothness and other wrist metrics are stretch goals.
- **Feedback:** a simple real-time cue (beep / screen flash) when a rep crosses the threshold, plus post-session graphs in Streamlit + Plotly. No live-streaming dashboard — Streamlit reruns the whole script per update and handles 100 Hz plotting poorly.
- **Wired:** both IMUs cabled to one microcontroller, USB serial to a laptop. Wireless is a future extension.
- **Success:** run scripted reps — clean and deliberately leaned — filmed from the side as ground truth; the system must correctly label clean vs. bad reps.
- **No hardware or budget constraints** from the course.

## Proposed, not yet confirmed

Treat these as defaults; confirm with the user before building on them.

- **Pitch + roll only** (forward and sideways lean). Trunk rotation (yaw) drifts on a 6-axis IMU without a magnetometer; it is a stretch goal. This keeps the cheaper **2× LSM6DSOX** (one I2C bus, addresses 0x6A/0x6B) over the BNO085.
- **Raspberry Pi Pico 2**, programmed via Arduino IDE + the arduino-pico core (Adafruit LSM6DSOX library) rather than PlatformIO. Verify current PlatformIO Pico 2 support if anyone prefers it.
- **Python backend:** PySerial, NumPy, SciPy; a complementary filter for trunk tilt; CSV for session storage.
- **Sampling** at 100 Hz, each sample timestamped on the microcontroller.
- **Trunk sensor on the sternum** with a snug chest strap.
- **Testers are team members** simulating compensation; no patients (ethics). State this plainly in the report.
- **Team split:** hardware/firmware · signal processing · dashboard/storage · mounting/testing. Firmware ships a recorded CSV early so signal processing isn't blocked on hardware.

## Known limits

IMUs don't give absolute position; integrating acceleration for displacement drifts — measure angles, not distances. Two IMUs cannot reconstruct full arm or shoulder posture.
