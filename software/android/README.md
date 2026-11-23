# ReMotion phone app (Android)

Runs a session from an Android phone plugged into the device's USB-C port (USB OTG), instead of a laptop, and sends everything to the dashboard over Wi-Fi.

## Signing in

The phone signs in as one patient with the code on that patient's **Profile & settings** page on the dashboard: **Scan the code** (Google's code scanner, no camera permission) or type its 6 letters. A scanned QR code carries the dashboard's address; a typed code goes to the address in Settings. Scanning the QR code with the phone's own camera opens the dashboard's `/pair` page, whose "Open the Re:Motion app" button (`remotion://pair?code=…`) signs the app in too. The server swaps the code (one use, 10 minutes) for this phone's token (`Account.kt`); every upload carries it, and the server files the sessions under that patient, whatever the phone says. The greeting uses the patient's first name: right after a sign-in the app says "Hello, Vincent" for about a second and a half (`Hello.kt`), then eases into the patient's screen. If the sign-in ends (a demo's hour, the patient deleted, Sign out of this phone in Settings), the app goes back to the sign-in screen and says why. A different patient signing in starts a fresh week on the phone.

## The patient's screen

Made for the patient (possibly elderly) with the phone propped up sideways on the table, read from arm's length. No login, nothing to tap during a session: the yellow START button on the mat starts it, as before. The screen is split like the dashboard's room: on the left, on the eucalyptus wall, a coach saying one thing at a time in very large type ("Sit up straight and stay still", "Put your hand on the white button", "Reach for the green button", "Rest for a moment") with a drawing of the mat showing the lit button; on the right, on plaster, the scoreboard (the block in plain words, "6 of 15 reaches", End session).

- **Feedback on leaning only in the training block:** the coach warms and says "Sit back against the chair", and the scoreboard shows the last reach as Upright or Leaned (icon and word). Baseline and post show only the count ("Your results come at the end"), so they still measure the patient without feedback.
- **Before each session:** "Get set up" (`Setup.kt`): a looping drawing builds the scene in order (the phone stands up against a book, the mat slides onto the table, the chest strap wraps on), each step lit beside it as it plays, then **I’m ready** moves on to "Press the yellow button". It shows as soon as a device is connected (the real one over USB, or the demo device from Settings), again after every session, and again after a disconnect. It comes before the yellow button because START begins the 3-second calibration at once. Animations off: the finished scene, still.
- **Between sessions:** "Good morning, Vincent", this week as a count and a track ("1 day practised", then Monday to Sunday on one line: a filled mark with a tick for a practised day, a ring for today), and, once there is a session, last time in plain words ("Last time you stayed upright in 3 of 4 reaches. Up from 0 of 3 the time before."). Kept on the phone in `history.json` (`History.kt`); the full record is on the dashboard.
- **After a session:** "Well done" with reaches upright and leaned, then Done back to the start.
- Opening (`Intro.kt`, about 3.5 s): Android's launch screen shows the app icon's figure at rest; the app picks it up at the same place, the arm reaches for the target with the back upright, the wordmark rises in, then a phone outline turns a quarter turn beside "Turn your phone sideways" (the app only works sideways). With the phone's animations off, the finished picture shows for a moment, without movement.
- Landscape only, and the screen stays on while the app is open. Fonts are the dashboard's (Literata, Atkinson Hyperlegible), bundled in `res/font` (SIL Open Font License).
- The coach names the lit target from the firmware's `# target GREEN` line (firmware from 2026-11-22 on); older firmware gets "Reach for the button that lights up".

## Settings for the care team

Behind **Settings** on the patient screen:

- **Connect device:** finds the Arduino on USB, asks for USB permission, opens it at 115200 baud and asks for its status (`?`).
- **Start session / End session:** send `G` / `X` (`docs/PROTOCOL.md`). Firmware from before these commands answers `unknown command`; the app then says the firmware needs updating, and the START button on the mat still works.
- **Live samples:** turns the `D` stream on or off (`D1` / `D0`). **Show samples** only changes what the log shows.
- **Session length:** full (3 · 15 · 30 · 15) or a short demo (5 reaches with the buzzer), sent as `P`.
- **Use the demo device:** a pretend device on the phone. Start a session, then **Add a reach** plays one in real time, clean or leaned at random (about 40%, decided like the firmware: past the limit for 200 ms). It answers the same commands as the firmware and follows the block plan, with 5 s rests where the firmware rests 30 s. Demo sessions are marked simulated on the dashboard. `DemoLinkTest` runs 300 demo reaches on a virtual clock.
- **Sending to the dashboard:** every line goes, about once a second, to `<dashboard>/api/phone/lines` with the phone's token (`software/web/server/phone.ts`); without a sign-in nothing is sent. The server keeps the raw lines, turns each finished rep into the usual session files with the logger (`data/phone/vincent/`, or `data/phone-demo/vincent/` for demo mode) and re-exports `sessions.json`; the dashboard picks it up within about 5 s. If the dashboard can't be reached, the app keeps the lines and sends them when it can.

`Protocol.kt` reads the lines the same way as `software/tools/protocol.py`; change both (and the firmware) together.

## Trying it on the Mac

Android Studio's emulator (Device Manager → ▶ Medium Phone) runs everything except the real device (it can't pass USB through): use the demo device. `adb -s emulator-5554 reverse tcp:5173 tcp:5173` sends its sessions to the dashboard.

## Build and install

Needs Android Studio (for the SDK, including SDK Platform 37.2 and the Command-line Tools) and these in `~/.zshrc`:

```
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

From `software/android/`, with the phone connected (`adb devices` lists it):

```
./gradlew installRelease        # build and install the optimised app on the phone (use this one)
./gradlew installDebug          # the debug build, for Android Studio's debugger; Compose runs much slower in it
./gradlew testDebugUnitTest     # parser and demo-device tests
```

The release build is shrunk and optimised by R8 (2 MB instead of 14 MB) and signed with the debug key, so it installs over a debug build and keeps the phone's history; a Play Store release would need a real signing key. `proguard-rules.pro` keeps the USB drivers and ML Kit's scanner parts, which both libraries build by reflection (without it, Scan the code crashed the release build).

**Motion** (`Motion.kt`): Material's fade-through between screens (home, session, done, settings), a crossfade when the coach says something new or a count changes, a 150 ms fade for the lit button and the warm wall. Nothing slides, so text never moves under an older reader's eyes. All of it follows the phone's Remove animations setting.

**Speed:** the 100 samples a second only change the screen state when the device's state or the leaning changes, so the screen redraws on events, not on every reading; the warm wall and the lit buttons are read while drawing. On the emulator, janky frames during a session went from 9% to under 4% (99th percentile 36 ms to 22 ms) with this and the release build; cold start is about 0.2 to 0.5 s.

Or open `software/android/` in Android Studio and press Run.

**The phone has one USB-C port.** Install over the cable first, then unplug it and plug in the device; the app runs on its own. To install while the device is plugged in, use Wireless debugging (Developer options), with the phone and Mac on a Wi-Fi that lets devices see each other (campus Wi-Fi usually doesn't: use home Wi-Fi or a teammate's hotspot).

## Getting the lines to the dashboard

Start the dashboard on the laptop (`npm run dev` in `software/web/`), then pick one:

- **Over the cable (testing):** `adb reverse tcp:5173 tcp:5173`, and leave the app's dashboard address as `http://localhost:5173`.
- **Over Wi-Fi:** start the dashboard with `npm run dev -- --host`, which prints a Network address such as `http://192.168.1.20:5173`. Type that into the app's **Dashboard address** before connecting. The phone and laptop must be on a Wi-Fi that lets devices reach each other: home Wi-Fi or a teammate's hotspot, not campus Wi-Fi (it keeps devices apart). With `--host` anyone on that network can reach the dashboard and its endpoints, so only use it on a network you trust.

## Phone setup

- Settings → About phone → Software information → tap Build number 7 times, then turn on USB debugging in Developer options.
- With the device plugged in, Android asks whether ReMotion may use it. Tick "Always open ReMotion" to skip the question next time.
- If a USB-C to USB-C cable doesn't power the Arduino, use the USB-A cable with a USB-C OTG adapter.
