"""
demo.py  —  show ReMotion off without running the full 7-minute session.

    python -m software.tools.demo
    python -m software.tools.demo --port /dev/ttyACM0

Pick a demo with one key. The laptop starts the session itself (no START press),
records it like the logger (data/raw/), stops when the session ends, and refreshes
the dashboard so the result shows up within 5 seconds.
"""

import argparse
import subprocess
import sys
from pathlib import Path

from software.tools.logger import DEFAULT_OUT_DIR, SessionWriter, find_arduino_port, serial_lines
from software.tools.protocol import SessionEnd, parse_line

REPO_ROOT = Path(__file__).resolve().parents[2]
OWNER_SESSIONS = REPO_ROOT / "data" / "state" / "accounts" / "owner" / "sessions.json"

# key -> (name, plan PRACTICE,BASELINE,TRAINING,POST, what to tell the audience)
DEMOS = {
    "1": ("Buzzer check", [0, 0, 5, 0],
          "5 reps with the buzzer on. Lean forward on one: it beeps."),
    "2": ("Before / after", [0, 3, 5, 3],
          "3 reps without the buzzer, 5 with it, 3 without again. "
          "Lean in the first 3, stay upright after: the dashboard shows the drop."),
    "3": ("Full session", [0, 3, 10, 3],
          "The real thing: 3 without the buzzer, 10 with it, 3 without. About 2 minutes."),
}


def record_one_session(lines, writer):
    """Save lines until the session ends (S line). Returns True if it ended normally."""
    for line in lines:
        writer.handle(line)
        if isinstance(parse_line(line), SessionEnd):
            return True
    return False


def refresh_dashboard():
    """Re-export the owner's sessions so the open dashboard shows the new one."""
    if not OWNER_SESSIONS.parent.exists():
        print("(no dashboard login yet: run `node server/set-owner.ts <email>` in software/web)")
        return
    subprocess.run([sys.executable, "-m", "software.dashboard.export",
                    "--data", str(REPO_ROOT / "data"), "--out", str(OWNER_SESSIONS)],
                   cwd=REPO_ROOT, check=False)


def port_free(port):
    """True if the port can be opened; otherwise say why (usually the Arduino IDE's Serial Monitor)."""
    import serial
    try:
        serial.Serial(port).close()
        return True
    except serial.SerialException as e:
        print(f"\nCan't open {port}: {e}\n"
              "Close the Arduino IDE's Serial Monitor (or the IDE), check the USB cable, then try again.")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run a short ReMotion demo session.")
    parser.add_argument("--port", help="serial port (default: find the Arduino automatically)")
    args = parser.parse_args()
    port = args.port or find_arduino_port()

    while True:
        print("\nReMotion demo")
        for key, (name, plan, about) in DEMOS.items():
            print(f"  {key}  {name:15s} {about}")
        choice = input("Pick 1-3 (q to quit): ").strip().lower()
        if choice == "q":
            return
        if choice not in DEMOS:
            continue

        name, plan, _ = DEMOS[choice]
        input(f"\n{name}: sit up straight and still, then press Enter "
              f"(3 s calibration starts straight away)... ")
        if not port_free(port):
            continue
        writer = SessionWriter(REPO_ROOT / DEFAULT_OUT_DIR)
        lines = serial_lines(port, plan=plan, start=True)
        try:
            done = record_one_session(lines, writer)
        except KeyboardInterrupt:
            done = False
            print("\nstopped (press START on the mat if the device is still running)")
        finally:
            lines.close()                      # frees the USB port
            writer.close()
        if done:
            refresh_dashboard()
            print("Dashboard updated: http://localhost:5173/dashboard (patient \"recorded\").")


if __name__ == "__main__":
    main()
