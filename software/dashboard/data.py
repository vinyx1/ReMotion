"""
data.py  —  load the logger's CSV files for the dashboard.

No Streamlit in here, only pandas, so these functions can be tested with
pytest and reused by the analysis notebooks.

The logger writes two CSVs per run, named by start time:
    reps_<time>.csv      one row per finished rep
    samples_<time>.csv   one row per sensor sample (100 per second)
One run can hold several sessions (the `session` column counts them).
"""

from datetime import datetime
from pathlib import Path

import pandas as pd

from software.tools.protocol import REP_COLUMNS, SAMPLE_COLUMNS, TARGETS

SAMPLE_PERIOD_MS = 10          # firmware samples at 100 Hz
DEFAULT_THRESHOLD_DEG = 10.0   # firmware default, used only if a session has no samples


def session_label(stamp, session, sessions_in_file):
    """Readable name for a session, e.g. 'Nov 05, 13:43' or 'Nov 05, 13:43 (session 2)'."""
    try:
        label = datetime.strptime(stamp, "%Y%m%d_%H%M%S").strftime("%b %d, %H:%M")
    except ValueError:
        label = stamp                       # file was renamed by hand: show the name as-is
    if sessions_in_file > 1:
        label += f" (session {session})"
    return label


def load_reps(folders):
    """
    Load every reps_*.csv in the given folders into one table.

    Adds these columns to the ones in the CSV:
        folder         where the file came from
        stamp          the <time> part of the file name (also names the samples file)
        session_label  readable, unique name for the session
    Returns an empty table (with the right columns) if nothing is found.
    """
    tables = []
    for folder in folders:
        for path in sorted(Path(folder).glob("reps_*.csv")):
            reps = pd.read_csv(path)
            if reps.empty or not set(["session"] + REP_COLUMNS) <= set(reps.columns):
                continue                    # no reps recorded, or not one of our files
            stamp = path.stem[len("reps_"):]
            sessions_in_file = reps["session"].nunique()
            reps["folder"] = str(folder)
            reps["stamp"] = stamp
            reps["session_label"] = [session_label(stamp, s, sessions_in_file)
                                     for s in reps["session"]]
            tables.append(reps)

    if not tables:
        return pd.DataFrame(columns=["session"] + REP_COLUMNS + ["folder", "stamp", "session_label"])

    reps = pd.concat(tables, ignore_index=True)
    reps["compensated"] = reps["compensated"].astype(bool)
    reps["result"] = reps["compensated"].map({True: "Compensated", False: "Clean"})
    return reps


def load_samples(folder, stamp, session):
    """Load the samples of one session, or None if the samples file is missing."""
    path = Path(folder) / f"samples_{stamp}.csv"
    if not path.exists():
        return None
    samples = pd.read_csv(path)
    if not set(["session"] + SAMPLE_COLUMNS) <= set(samples.columns):
        return None
    return samples[samples["session"] == session].reset_index(drop=True)


def summarize_sessions(reps):
    """One row per session: rep count, compensated count and percent, typical reach time."""
    if reps.empty:
        return pd.DataFrame(columns=["session_label", "reps", "compensated",
                                     "pct_compensated", "median_reach_s", "max_peak_deg"])
    groups = reps.groupby(["stamp", "session", "session_label"], sort=True)
    summary = groups.agg(
        reps=("rep", "count"),
        compensated=("compensated", "sum"),
        median_reach_s=("reach_ms", lambda ms: ms.median() / 1000),
        max_peak_deg=("peak_deg", "max"),
    ).reset_index()
    summary["pct_compensated"] = 100 * summary["compensated"] / summary["reps"]
    return summary


def session_threshold(samples):
    """The lean threshold used in a session (the most common value in its samples)."""
    if samples is None or samples.empty:
        return DEFAULT_THRESHOLD_DEG
    return float(samples["threshold"].mode().iloc[0])


def find_reach_windows(samples):
    """
    Find where each finished rep is in a session's samples.

    The samples have no rep number, so we use the firmware's states: a finished
    rep is a run of REACHING samples followed by RETURNING. (An aborted reach
    goes back to WAIT_HOME or IDLE instead, and prints no R line.) The first
    such run is rep 1, the second is rep 2, and so on.

    Returns a list of (cue_row, reach_start_row, reach_end_row), one per rep.
    reach_end_row is the first row AFTER the reach (the target press).
    """
    state = samples["state"]
    run_id = (state != state.shift()).cumsum()          # goes up by 1 each time the state changes
    runs = samples.groupby(run_id).agg(state=("state", "first"),
                                       first_row=("state", lambda s: s.index[0]),
                                       last_row=("state", lambda s: s.index[-1]))
    runs = runs.reset_index(drop=True)

    windows = []
    for i in range(len(runs) - 1):
        if runs.loc[i, "state"] == "REACHING" and runs.loc[i + 1, "state"] == "RETURNING":
            reach_start = runs.loc[i, "first_row"]
            reach_end = runs.loc[i, "last_row"] + 1
            came_from_cue = i > 0 and runs.loc[i - 1, "state"] == "CUED"
            cue = runs.loc[i - 1, "first_row"] if came_from_cue else reach_start
            windows.append((cue, reach_start, reach_end))
    return windows


def rep_trace(samples, rep_number, pad_ms=500):
    """
    Samples around one rep, from the cue until `pad_ms` after the target press.

    Adds a `t_s` column: seconds since the hand left HOME (so the cue is at a
    negative time and the reach starts at 0).
    Returns (trace, reach_end_s), or (None, None) if the rep can't be found.
    """
    if samples is None:
        return None, None
    windows = find_reach_windows(samples)
    if not 1 <= rep_number <= len(windows):
        return None, None

    cue, reach_start, reach_end = windows[rep_number - 1]
    last_row = min(reach_end + pad_ms // SAMPLE_PERIOD_MS, len(samples) - 1)
    trace = samples.loc[cue:last_row].copy()

    start_ms = samples.loc[reach_start, "t_ms"]
    trace["t_s"] = (trace["t_ms"] - start_ms) / 1000
    reach_end_s = (samples.loc[min(reach_end, len(samples) - 1), "t_ms"] - start_ms) / 1000
    return trace, reach_end_s


def order_targets(names):
    """Targets in mat order (nearest first): GREEN, BLUE, RED."""
    return [t for t in TARGETS if t in set(names)]
