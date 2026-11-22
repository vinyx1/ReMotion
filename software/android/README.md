# ReMotion phone app (Android)

Runs a session from an Android phone plugged into the device's USB-C port (USB OTG), instead of a laptop. Step 1 of the app: connect, see every line the device sends, and send it commands. Saving sessions and sending them to the dashboard come next.

- **Connect device:** finds the Arduino on USB, asks for USB permission, opens it at 115200 baud and asks for its status (`?`).
- **Start session / End session:** send `G` / `X` (`docs/PROTOCOL.md`). Firmware from before these commands answers `unknown command`; the app then says the firmware needs updating, and the START button on the mat still works.
- **Live samples:** turns the `D` stream on or off (`D1` / `D0`). **Show samples** only changes what the log shows.
- **Demo mode:** plays `data/sample/fake_session.txt` in real time as if the device were plugged in, and answers the same commands. Good for working on the app without the hardware, and a fallback for the demo.

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

## Phone setup

- Settings → About phone → Software information → tap Build number 7 times, then turn on USB debugging in Developer options.
- With the device plugged in, Android asks whether ReMotion may use it. Tick "Always open ReMotion" to skip the question next time.
- If a USB-C to USB-C cable doesn't power the Arduino, use the USB-A cable with a USB-C OTG adapter.
