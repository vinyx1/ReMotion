# Handoff: testing and the next exercises (for Yousuf and his agent)

**Agents: read this whole file before doing anything else in this repo**, then `AGENTS.md` and
`docs/STATUS.md` as usual. It's the starting point for testing the device end to end and for
building the firmware side of the remaining exercises. Written 2026-11-23 by Vincent (vinyx1).

## 1. Where things stand

Works end to end today (tested on a Galaxy S22 and the real device):

- **Firmware** (`firmware/reach_tracker`): forward reach, the session blocks, your tilt filter and
  stricter calibration, and the phone commands `G` (start), `X` (stop), `?` (status, answered by an
  `I` line). It does not know which exercise is being done: every session is the reach logic.
- **Phone app** (`software/android`): the patient chooses one of four exercises before a session
  (Reach forward, Reach to the right, Hand to mouth, Turn your forearm), gets set up, presses the
  yellow button, and is coached through the session. Every line goes to the dashboard over Wi-Fi
  with the chosen exercise. **Settings → Demo mode** runs short demos (Buzzer check, No buzzer,
  Before and after, Full session) with a 5 s countdown before calibration.
- **Dashboard** (`software/web`): files each session under its exercise; every exercise has its own
  tab, trend and a 3D rep replay (forearm rotation's shows the forearm turning palm down to palm up).
- **Validation** (`docs/TESTING.md`, `software/analysis/validation.py`): the runbook and the
  label-sheet / agreement / threshold-sweep tool.

What doesn't work yet: **hand to mouth and forearm rotation on the real device.** The firmware
still waits for a target button press, which those exercises don't have. That is the main job
below (section 5). The phone's demo device already plays all four, so the app and dashboard side
can be shown without it.

## 2. Set up your laptop

From the repo root, once:

```bash
git pull
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt      # Python tools and tests
cd software/web && npm ci                                                 # dashboard (needs Node 24)
node server/set-owner.ts <your email>       # your dashboard login; prints a password once
```

Run the dashboard so a phone can reach it (`--host` makes it listen on the network, not only on
`localhost`):

```bash
cd software/web && npx vite --host --port 5173
```

### The Android app

1. Install **Android Studio**. In **Settings → Languages & Frameworks → Android SDK**: on the SDK
   Platforms tab tick **Android 17 (API 37.2)**, on the SDK Tools tab tick **Android SDK
   Build-Tools** and **Android SDK Platform-Tools**, then Apply. (The app compiles against API
   37.2 and runs on Android 8+.)
2. Point the build at the SDK and Android Studio's own Java (macOS paths; on Windows use the
   paths Android Studio shows under SDK Manager and Gradle JDK):
   ```bash
   export ANDROID_HOME=~/Library/Android/sdk
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   ```
3. On the phone: **Settings → About phone → Software information → tap Build number 7 times**,
   then **Settings → Developer options → USB debugging** on. Plug it into the laptop and tap
   **Allow** (tick "Always allow from this computer"). `adb devices` must say `device`, not
   `unauthorized`.
4. Build and install (the release build, signed with the debug key, so it installs over any
   earlier version and keeps the phone's sign-in and history):
   ```bash
   cd software/android && ./gradlew installRelease
   ```
   Opening `software/android` in Android Studio and pressing Run works too. Unit tests:
   `./gradlew testDebugUnitTest`.

   **Without a cable:** after `./gradlew assembleRelease`, the dashboard serves the app.
   **Profile & settings → Connect a phone → Don't have the app?** swaps in a QR code: scan it with
   the phone's camera, open the file, allow installs from the browser once. (Open the dashboard
   at the laptop's network address, not `localhost`.)

### Connect the phone to your dashboard

The phone's only USB-C port goes to the Arduino, so the phone reaches the dashboard over Wi-Fi.
Campus Wi-Fi blocks devices from talking to each other: use the **phone's hotspot** and join it
from the laptop.

1. Find the laptop's address on the hotspot: `ipconfig getifaddr en0` (macOS) or `ipconfig`
   (Windows, "IPv4 Address").
2. Open `http://<that address>:5173/dashboard` (not `localhost`: the QR code carries the address
   the page was opened at), sign in, **Add patient** (or open one), **Profile & settings →
   Connect a phone**.
3. In the app: **Scan the code**. It says "Hello, <name>" and is signed in to your dashboard.
4. Unplug the phone from the laptop, plug it into the Arduino. The app connects by itself.

Without a phone, `./demo.sh` (laptop + Arduino over USB) runs the same short demos from the
terminal.

## 3. Test it

- **Demo mode** (Settings → Demo mode): all ticks on the left, then **Start** on a card. Sit upright
  and still through the countdown and the 3 s calibration. Buzzer check should beep on a leaned rep.
- **A real session**: Get set up → pick the exercise → I'm ready → yellow button. Reps appear on the
  dashboard within seconds.
- **Validation recordings** for the threshold: follow `docs/TESTING.md` exactly (laptop logger,
  scripted reps, blind labels, then `python -m software.analysis.validation report data/validation`).

## 4. Known problems (and what fixes them)

| What you see | Why | Fix |
|---|---|---|
| Upload fails with `dfu-util: Lost device after RESET?` | R4 Minima on macOS | Unplug and replug, or double-press RESET (LED pulses), upload again |
| `E,calibration rejected: moved too much (std …)` | Moving during the 3 s (limit 0.25 m/s²); tapping the phone counts | Sit still; Demo mode's countdown exists for this |
| `E,calibration rejected: chest IMU reads no gravity` | Chest sensor not answering (loose wrist→chest cable) | Reseat the cable, unplug/replug the device |
| Wrist speed stuck at one exact value (e.g. 685.7) | Wrist sensor stopped answering mid-run; the firmware repeats the last value | Reseat, press RESET. Firmware should detect this (open issue to file) |
| App screen cut off | Phone display size; the S22 is 360 dp tall sideways | Fixed for the S22; check new layouts at that size (`adb shell wm density 480` on an emulator) |

## 5. Your next job: hand to mouth and forearm rotation on the device

AGENTS.md section 1 has the exercises table. Today the phone knows the exercise; the firmware
doesn't. These two need it, because a rep is done by the **wrist's angle**, not a button press.

### Decide first (it's a contract change, AGENTS.md section 0)

A suggestion, to agree with Vincent before building:

- New command **`M<n>`**: the exercise mode. `M0` reach (forward and sideways: same logic, the mat
  is only turned), `M1` hand to mouth, `M2` forearm rotation. Refused mid-session, like `T` and
  `P`. The `I` line gains the mode as a last field.
- **Rep done:** hand to mouth when the wrist tips up past a "hand at mouth" angle (from the wrist
  accelerometer, against its own calibrated rest); forearm rotation when the wrist has turned past
  a target angle (integrate the wrist gyro about the forearm's axis). Back to rest = return.
- **The R line's `target`** for those two: a new value (e.g. `MOUTH`, `TURN`) or the lit LED's
  colour. `TARGETS` in `software/tools/protocol.py` is checked by the parser and the dashboard.
- **Lean limits per exercise**: from recorded clean and leaned reps (the validation tool's sweep),
  not guesses. 10° is the forward reach's default only.

### Then change every side together, in one branch

| Side | File | Change |
|---|---|---|
| Firmware | `firmware/reach_tracker/reach_tracker.ino` | `M` command, wrist-angle rep detection per mode, mode in the `I` line |
| Protocol doc | `docs/PROTOCOL.md`, `AGENTS.md` section 6 | the command, the new `I` field, the target values |
| Python parser | `software/tools/protocol.py` (+ `tests/`) | `Status` with the mode, `TARGETS` |
| Fake data | `software/tools/fake_session.py` | `M` and the new targets |
| Phone protocol | `software/android/.../Protocol.kt` (+ `ProtocolTest`) | same as `protocol.py` |
| Phone app | `software/android/.../MainViewModel.kt` | send `M<n>` for `exercise.value` on connect, in `chooseExercise`, and before `runDemo`'s `G` |
| Demo device | `software/android/.../DemoLink.kt` | answer `M` like the firmware |
| Dashboard | `software/dashboard/data.py`, `software/web/src/types.ts` | only if the targets or CSV columns change |

The app and dashboard are Vincent's area: tell him (an issue assigned to him, or the same PR with
him as reviewer) before changing them.

### Ground rules that still apply

Compile every sketch with `arduino-cli compile --fqbn arduino:renesas_uno:minima`, run
`python -m pytest` and `npm run lint && npm run build` in `software/web/`, keep CI green, and claim
the work with an issue first (`gh issue edit <n> --add-assignee @me`). Firmware stays readable for
first-years: named constants at the top, a comment on each state.
