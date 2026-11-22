# ReMotion phone app (Android)

Runs a session from an Android phone plugged into the device's USB-C port (USB OTG), instead of a laptop, and sends everything to the dashboard over Wi-Fi. Sessions go to the patient **Vincent Jiang** (id `vincent`, set in `MainViewModel.kt`).

- **Connect device:** finds the Arduino on USB, asks for USB permission, opens it at 115200 baud and asks for its status (`?`).
- **Start session / End session:** send `G` / `X` (`docs/PROTOCOL.md`). Firmware from before these commands answers `unknown command`; the app then says the firmware needs updating, and the START button on the mat still works.
- **Live samples:** turns the `D` stream on or off (`D1` / `D0`). **Show samples** only changes what the log shows.
- **Demo mode:** a pretend device on the phone. Start a session, then **Add rep** plays one rep in real time, clean or leaned at random (decided like the firmware: past the limit for 200 ms). It answers the same commands as the firmware and follows the block plan, without the 30 s rests. Demo sessions are marked simulated on the dashboard.
- **Sending to the dashboard:** every line goes, about once a second, to `<dashboard address>/api/phone/lines` (`software/web/server/phone.ts`). The server keeps the raw lines, turns each finished rep into the usual session files with the logger (`data/phone/vincent/`, or `data/phone-demo/vincent/` for demo mode) and re-exports `sessions.json`; the dashboard picks it up within about 5 s. If the dashboard can't be reached, the app keeps the lines and sends them when it can.

`Protocol.kt` reads the lines the same way as `software/tools/protocol.py`; change both (and the firmware) together.

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
