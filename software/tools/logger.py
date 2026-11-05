"""
logger.py  —  record a session from the Arduino (or replay a saved one) into CSV files.

    python -m software.tools.logger                          # find the Arduino automatically
    python -m software.tools.logger --port /dev/cu.usbmodem1101
    python -m software.tools.logger --threshold 12           # send T12 before recording
    python -m software.tools.logger --replay data/sample/fake_session.txt

Press Ctrl+C to stop recording.

Each run writes three files to data/raw/ (or --out), named by start time:
    samples_<time>.csv   every D line          (for trunk-angle traces)
    reps_<time>.csv      every R line          (for the dashboard)
    raw_<time>.txt       every line, unchanged (nothing is ever lost)

Both CSVs get a `session` column: it starts at 1 and goes up after each S line,
so several sessions recorded in one run can be told apart.
"""

import argparse
import csv
import sys
import time
from datetime import datetime
from pathlib import Path

from software.tools.protocol import (
    Comment, DeviceError, Rep, Sample, SessionEnd,
    REP_COLUMNS, SAMPLE_COLUMNS, parse_line, threshold_command,
)

BAUD = 115200
DEFAULT_OUT_DIR = Path("data/raw")


# ---------------------------------------------------------------------------
#  Where lines come from: the Arduino, or a saved text file
# ---------------------------------------------------------------------------

def find_arduino_port():
    """Return the serial port of the Arduino, or stop with a helpful message."""
    from serial.tools import list_ports   # imported here so --replay works without pyserial

    ports = [p for p in list_ports.comports() if "usb" in p.device.lower() or p.vid]
    if len(ports) == 1:
        return ports[0].device
    if not ports:
        sys.exit("No Arduino found. Is it plugged in? You can also pass --port.")
    names = "\n  ".join(f"{p.device}  ({p.description})" for p in ports)
    sys.exit(f"Several serial ports found; pick one with --port:\n  {names}")


def serial_lines(port, threshold=None):
    """Yield lines from the Arduino forever (until Ctrl+C)."""
    import serial

    with serial.Serial(port, BAUD, timeout=1) as conn:
        time.sleep(2)                          # opening the port may reset the board
        conn.reset_input_buffer()              # drop a half-received first line
        if threshold is not None:
            conn.write((threshold_command(threshold) + "\n").encode())
        while True:
            raw = conn.readline()
            if raw:
                yield raw.decode("utf-8", errors="replace").rstrip("\r\n")


def file_lines(path):
    """Yield lines from a saved session file (for --replay)."""
    with open(path) as f:
        for line in f:
            yield line.rstrip("\r\n")


# ---------------------------------------------------------------------------
#  Writing the CSV files
# ---------------------------------------------------------------------------

class SessionWriter:
    """Writes samples, reps and the raw log for one logger run."""

    def __init__(self, out_dir):
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.samples_path = out_dir / f"samples_{stamp}.csv"
        self.reps_path = out_dir / f"reps_{stamp}.csv"
        self.raw_path = out_dir / f"raw_{stamp}.txt"

        self._samples_file = open(self.samples_path, "w", newline="")
        self._reps_file = open(self.reps_path, "w", newline="")
        self._raw_file = open(self.raw_path, "w")
        self.samples = csv.writer(self._samples_file)
        self.reps = csv.writer(self._reps_file)
        self.samples.writerow(["session"] + SAMPLE_COLUMNS)
        self.reps.writerow(["session"] + REP_COLUMNS)

        self.session = 1
        self.sample_count = 0
        self.rep_count = 0
        self.bad_lines = 0

    def handle(self, line):
        """Save one line and print anything a person should see."""
        self._raw_file.write(line + "\n")
        msg = parse_line(line)

        if isinstance(msg, Sample):
            self.samples.writerow([self.session, msg.t_ms, msg.state,
                                   msg.trunk_deg, msg.wrist_dps, msg.threshold])
            self.sample_count += 1
        elif isinstance(msg, Rep):
            self.reps.writerow([self.session, msg.rep, msg.target, msg.react_ms,
                                msg.reach_ms, msg.peak_deg, msg.bursts, int(msg.compensated)])
            self._reps_file.flush()            # reps are precious: save them right away
            self.rep_count += 1
            result = "COMPENSATED" if msg.compensated else "clean"
            print(f"rep {msg.rep:2d}  {msg.target:5s}  peak {msg.peak_deg:4.1f} deg  "
                  f"reach {msg.reach_ms} ms  -> {result}")
        elif isinstance(msg, SessionEnd):
            print(f"session {self.session} ended: {msg.reps} reps, "
                  f"{msg.compensated_reps} compensated")
            self.session += 1
        elif isinstance(msg, DeviceError):
            print(f"ARDUINO ERROR: {msg.message}")
        elif isinstance(msg, Comment):
            print(f"# {msg.text}")
        elif line.strip():
            self.bad_lines += 1                # garbled or unknown: kept in raw log only

    def close(self):
        for f in (self._samples_file, self._reps_file, self._raw_file):
            f.close()
        print(f"\nsaved {self.sample_count} samples and {self.rep_count} reps "
              f"({self.bad_lines} unreadable lines skipped):")
        for path in (self.samples_path, self.reps_path, self.raw_path):
            print(f"  {path}")


def main():
    parser = argparse.ArgumentParser(description="Record IMU Reach Tracker sessions to CSV.")
    parser.add_argument("--port", help="serial port (default: find the Arduino automatically)")
    parser.add_argument("--threshold", type=float, help="lean threshold to send, in degrees")
    parser.add_argument("--replay", help="read lines from this saved file instead of the Arduino")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR,
                        help="folder for the output files (default data/raw)")
    args = parser.parse_args()

    if args.replay:
        lines = file_lines(args.replay)
    else:
        lines = serial_lines(args.port or find_arduino_port(), args.threshold)

    writer = SessionWriter(args.out)
    try:
        for line in lines:
            writer.handle(line)
    except KeyboardInterrupt:
        pass                                   # Ctrl+C is the normal way to stop
    finally:
        writer.close()


if __name__ == "__main__":
    main()
