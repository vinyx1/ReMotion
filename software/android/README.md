# ReMotion phone app (Android)

Runs a session from an Android phone plugged into the device's USB-C port (USB OTG), instead of a laptop, and sends everything to the dashboard over Wi-Fi. Sessions go to the patient **Vincent Jiang** (id `vincent`, set in `MainViewModel.kt`).

## The patient's screen

Made for the patient (possibly elderly) with the phone propped up sideways on the table, read from arm's length. No login, nothing to tap during a session: the yellow START button on the mat starts it, as before. The screen is split like the dashboard's room: on the left, on the eucalyptus wall, a coach saying one thing at a time in very large type ("Sit up straight and stay still", "Put your hand on the white button", "Reach for the green button", "Rest for a moment") with a drawing of the mat showing the lit button; on the right, on plaster, the scoreboard (the block in plain words, "6 of 15 reaches", End session).

- **Feedback on leaning only in the training block:** the coach warms and says "Sit back against the chair", and the scoreboard shows the last reach as Upright or Leaned (icon and word). Baseline and post show only the count ("Your results come at the end"), so they still measure the patient without feedback.
- **Between sessions:** "Good morning, Vincent", this week's practice days, and last time in plain words ("Last time you stayed upright in 3 of 4 reaches. Up from 0 of 3 the time before."). Kept on the phone in `history.json` (`History.kt`); the full record is on the dashboard.
- **After a session:** "Well done" with reaches upright and leaned, then Done back to the start.
- Landscape only, and the screen stays on while the app is open. Fonts are the dashboard's (Literata, Atkinson Hyperlegible), bundled in `res/font` (SIL Open Font License).
- The coach names the lit target from the firmware's `# target GREEN` line (firmware from 2026-11-22 on); older firmware gets "Reach for the button that lights up".

## Settings for the care team

Behind **Settings** on the patient screen:

- **Connect device:** finds the Arduino on USB, asks for USB permission, opens it at 115200 baud and asks for its status (`?`).
- **Start session / End session:** send `G` / `X` (`docs/PROTOCOL.md`). Firmware from before these commands answers `unknown command`; the app then says the firmware needs updating, and the START button on the mat still works.
- **Live samples:** turns the `D` stream on or off (`D1` / `D0`). **Show samples** only changes what the log shows.
- **Session length:** full (3 · 15 · 30 · 15) or a short demo (5 reaches with the buzzer), sent as `P`.
- **Use the demo device:** a pretend device on the phone. Start a session, then **Add a reach** plays one in real time, clean or leaned at random (about 40%, decided like the firmware: past the limit for 200 ms). It answers the same commands as the firmware and follows the block plan, with 5 s rests where the firmware rests 30 s. Demo sessions are marked simulated on the dashboard. `DemoLinkTest` runs 300 demo reaches on a virtual clock.
- **Sending to the dashboard:** every line goes, about once a second, to `<dashboard address>/api/phone/lines` (`software/web/server/phone.ts`). The server keeps the raw lines, turns each finished rep into the usual session files with the logger (`data/phone/vincent/`, or `data/phone-demo/vincent/` for demo mode) and re-exports `sessions.json`; the dashboard picks it up within about 5 s. If the dashboard can't be reached, the app keeps the lines and sends them when it can.

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
./gradlew installDebug          # build and install on the phone
./gradlew testDebugUnitTest     # parser tests
```

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
