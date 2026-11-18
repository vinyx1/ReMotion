"""
fake_history.py  —  make a few weeks of fake sessions for building the dashboard.

    python -m software.dashboard.fake_history              # 8 sessions -> data/fake/
    python -m software.dashboard.fake_history --sessions 12 --seed 4
    python -m software.dashboard.export                    # then rebuild sessions.json

The story: one person practising at home about three times a week. Early
sessions lean on most reps; by the end most reps are clean. Each session is
made by software/tools/fake_session.py and saved by the logger's own
SessionWriter, so the files are exactly what a real recording would produce.

The files go in data/fake/ (git-ignored, never mixed with real recordings in
data/raw/). The dashboard marks them "Simulated". Delete the folder to get rid
of them; running this again replaces them.
"""

import argparse
import contextlib
import io
import random
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from software.tools.fake_session import generate
from software.tools.logger import SessionWriter

REPO_ROOT = Path(__file__).resolve().parents[2]
FAKE_DIR = REPO_ROOT / "data" / "fake"

FIRST_SESSION = datetime(2026, 11, 2, 10, 0)   # a Monday
DAYS_BETWEEN = [2, 2, 3]                       # Mon, Wed, Fri, Mon, ...
START_LEAN = 0.6                               # fraction of reps that lean in session 1
END_LEAN = 0.1                                 # ... and in the last session
REPS_RANGE = (10, 14)


def lean_fraction(i, n, rng):
    """Steady improvement from START_LEAN to END_LEAN, with day-to-day wobble."""
    progress = i / max(1, n - 1)
    base = START_LEAN + (END_LEAN - START_LEAN) * progress
    return min(0.9, max(0.0, base + rng.uniform(-0.08, 0.08)))


def make_history(sessions=8, seed=1, out_dir=FAKE_DIR):
    """Write `sessions` fake sessions into out_dir. Returns the reps file paths."""
    rng = random.Random(seed)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    when = FIRST_SESSION
    written = []
    for i in range(sessions):
        lines = generate(
            reps=rng.randint(*REPS_RANGE),
            lean_fraction=lean_fraction(i, sessions, rng),
            seed=rng.randrange(1_000_000),
        )
        # SessionWriter names files by the current time; give each one the
        # session's pretend date instead, so the dashboard shows a timeline.
        tmp = out_dir / f"tmp_{i}"
        writer = SessionWriter(tmp)
        for line in lines:
            writer.handle(line)
        writer.close()

        stamp = (when + timedelta(minutes=rng.randint(0, 90))).strftime("%Y%m%d_%H%M%S")
        for src, prefix in ((writer.samples_path, "samples"), (writer.reps_path, "reps"),
                            (writer.raw_path, "raw")):
            src.rename(out_dir / f"{prefix}_{stamp}{src.suffix}")
        tmp.rmdir()
        written.append(out_dir / f"reps_{stamp}.csv")
        when += timedelta(days=DAYS_BETWEEN[i % len(DAYS_BETWEEN)])
    return written


def main():
    parser = argparse.ArgumentParser(description="Make a few weeks of fake sessions in data/fake/.")
    parser.add_argument("--sessions", type=int, default=8, help="how many sessions (default 8)")
    parser.add_argument("--seed", type=int, default=1, help="random seed, for repeatable data")
    args = parser.parse_args()

    with contextlib.redirect_stdout(io.StringIO()):   # SessionWriter prints every rep
        paths = make_history(args.sessions, args.seed)
    print(f"wrote {len(paths)} fake sessions to {FAKE_DIR}")
    print("now run: python -m software.dashboard.export")


if __name__ == "__main__":
    main()
