"""
protocol.py  —  read and write the ReMotion serial protocol.

This is the ONE place that knows the line format in docs/PROTOCOL.md.
The logger, the fake-session generator, the dashboard and the analysis
code all import from here, so a protocol change only has to be made once.

Each line from the Arduino becomes one small Python object:

    "D,15230,REACHING,4.2,85.3,10.0"     -> Sample(...)
    "R,1,BLUE,412,1380,6.8,2,0,BASELINE" -> Rep(...)
    "S,10,3"                             -> SessionEnd(...)
    "E,chest IMU (0x68) not found"       -> DeviceError(...)
    "# calibration OK"                   -> Comment(...)

parse_line() returns None for lines it can't understand (blank, cut off,
garbled), so a bad line never crashes the logger.
"""

from dataclasses import dataclass, field

# Firmware states, in the order they appear in reach_tracker.ino
STATES = ("IDLE", "CALIBRATING", "CALIB_FAILED", "WAIT_HOME", "CUED", "REACHING", "RETURNING", "REST")
TARGETS = ("GREEN", "BLUE", "RED")

# Blocks of a session, in order (reach_tracker.ino runs them back to back after START).
# The buzzer only sounds in TRAINING; lean is measured the same way in every block.
PHASES = ("PRACTICE", "BASELINE", "TRAINING", "POST")
DEFAULT_PLAN = (3, 15, 30, 15)     # reps per phase, same as the firmware


@dataclass
class Sample:
    """One D line: a sensor reading, 100 times per second."""
    t_ms: int            # Arduino millis(); restarts at 0 when the board resets
    state: str           # one of STATES
    trunk_deg: float     # trunk lean from the calibrated upright position
    wrist_dps: float     # wrist rotation speed, deg/s
    threshold: float     # lean threshold in force, degrees
    extra: list = field(default_factory=list)  # any columns added later (e.g. raw IMU values)


@dataclass
class Rep:
    """One R line: the summary of a finished rep."""
    rep: int             # rep number, from 1 in each session
    target: str          # one of TARGETS
    react_ms: int        # target lit -> hand leaves HOME
    reach_ms: int        # hand leaves HOME -> target pressed
    peak_deg: float      # biggest trunk lean during the reach
    bursts: int          # wrist movement bursts during the reach (fewer = smoother)
    compensated: bool    # True if the lean stayed past the threshold for >= 200 ms
    phase: str = ""      # one of PHASES; "" in logs from before phases existed


@dataclass
class SessionEnd:
    """One S line: printed when START ends the session."""
    reps: int
    compensated_reps: int


@dataclass
class DeviceError:
    """One E line: an error reported by the Arduino."""
    message: str


@dataclass
class Comment:
    """One # line: a status message. Not data, but worth keeping in the log."""
    text: str


# Column names for the CSV files the logger writes (same order as the dataclasses)
SAMPLE_COLUMNS = ["t_ms", "state", "trunk_deg", "wrist_dps", "threshold"]
REP_COLUMNS = ["rep", "target", "react_ms", "reach_ms", "peak_deg", "bursts", "compensated", "phase"]


def parse_line(line):
    """Turn one line of serial text into a message object, or None if it isn't valid."""
    line = line.strip()
    if not line:
        return None

    if line.startswith("#"):
        return Comment(line[1:].strip())

    fields = line.split(",")
    kind = fields[0]

    # Any line can be cut off or garbled (for example the first line after
    # plugging in), so a conversion error just means "skip this line".
    try:
        if kind == "D" and len(fields) >= 6:
            return Sample(
                t_ms=int(fields[1]),
                state=fields[2],
                trunk_deg=float(fields[3]),
                wrist_dps=float(fields[4]),
                threshold=float(fields[5]),
                extra=fields[6:],           # tolerate extra columns at the end
            )
        if kind == "R" and len(fields) >= 8:
            return Rep(
                rep=int(fields[1]),
                target=fields[2],
                react_ms=int(fields[3]),
                reach_ms=int(fields[4]),
                peak_deg=float(fields[5]),
                bursts=int(fields[6]),
                compensated=fields[7] == "1",
                phase=fields[8] if len(fields) >= 9 else "",   # older firmware sent 8 fields
            )
        if kind == "S" and len(fields) >= 3:
            return SessionEnd(reps=int(fields[1]), compensated_reps=int(fields[2]))
        if kind == "E" and len(fields) >= 2:
            return DeviceError(",".join(fields[1:]))   # the message itself may contain commas
    except ValueError:
        return None

    return None   # unknown prefix or too few fields


# ---- Turning objects back into lines (used by the fake-session generator) ----

def format_sample(s):
    return f"D,{s.t_ms},{s.state},{s.trunk_deg:.1f},{s.wrist_dps:.1f},{s.threshold:.1f}"


def format_rep(r):
    line = (f"R,{r.rep},{r.target},{r.react_ms},{r.reach_ms},"
            f"{r.peak_deg:.1f},{r.bursts},{1 if r.compensated else 0}")
    return f"{line},{r.phase}" if r.phase else line


def format_session_end(s):
    return f"S,{s.reps},{s.compensated_reps}"


# ---- Commands the laptop can send to the Arduino ----

def threshold_command(degrees):
    """Command that sets the lean threshold, e.g. threshold_command(12) -> 'T12.0'."""
    if not 1 <= degrees <= 60:
        raise ValueError("threshold must be between 1 and 60 degrees")
    return f"T{degrees:.1f}"


def plan_command(plan):
    """Command that sets reps per phase, e.g. plan_command((3, 15, 30, 15)) -> 'P3,15,30,15'."""
    plan = tuple(int(n) for n in plan)
    if len(plan) != len(PHASES) or not all(0 <= n <= 60 for n in plan) or sum(plan) == 0:
        raise ValueError(f"plan needs {len(PHASES)} numbers from 0 to 60 ({', '.join(PHASES)}), not all 0")
    return "P" + ",".join(str(n) for n in plan)


STREAM_ON = "D1"
STREAM_OFF = "D0"
