"""
fake_history.py  —  make a few weeks of fake sessions for building the dashboard.

    python -m software.dashboard.fake_history              # three simulated patients -> data/fake/<id>/
    python -m software.dashboard.export                    # then rebuild sessions.json

Three made-up people practising at home, each with a different story, so the
dashboard has more than one patient to show:
    sim-a  improves: early sessions lean on most reps, by the end most are clean
    sim-b  holds steady at about a third of reps leaning
    sim-c  gets worse: leans more as the weeks go on
sim-a also does a few hand-to-mouth sessions and sim-b a few sideways reaches, so
the dashboard has patients with more than one exercise. Those go in an exercise
sub-folder, data/fake/<id>/<exercise>/, which is how export.py tells them apart.
(They are made by the same reach generator: the dashboard ignores their targets.)
Each session is made by software/tools/fake_session.py and saved by the
logger's own SessionWriter, so the files are exactly what a real recording
would produce. Each patient's files go in their own folder, data/fake/<id>/;
the folder name is the patient id that export.py writes into sessions.json.

data/fake/ is git-ignored and never mixed with real recordings in data/raw/.
The dashboard marks these sessions "Simulated". Delete the folder to get rid of
them; running this again replaces them.
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
# Reps per block (PRACTICE, BASELINE, TRAINING, POST) for a simulated session: the
# firmware's blocks, shorter than its default 3/15/30/15 so sessions.json stays small
FAKE_PLAN = (3, 6, 6, 6)
MIN_LEAN = 0.1     # never a perfect 0% session: fake data shouldn't look like a finished outcome

# The simulated patients: folder/id, sessions, seed, first session, lean at the start and at the end
PATIENTS = [
    {"id": "sim-a", "sessions": 8, "seed": 1, "first": FIRST_SESSION, "start": 0.6, "end": 0.1},
    {"id": "sim-b", "sessions": 7, "seed": 7, "first": datetime(2026, 11, 3, 14, 0), "start": 0.35, "end": 0.32},
    {"id": "sim-c", "sessions": 6, "seed": 11, "first": datetime(2026, 11, 5, 9, 30), "start": 0.15, "end": 0.5},
]

# Extra exercises some patients also practise: patient id -> sessions of that exercise
EXTRA_EXERCISES = {
    "sim-a": [{"exercise": "hand-to-mouth", "sessions": 4, "seed": 21, "first": datetime(2026, 11, 7, 15, 0), "start": 0.5, "end": 0.2}],
    "sim-b": [{"exercise": "sideways-reach", "sessions": 4, "seed": 27, "first": datetime(2026, 11, 8, 11, 0), "start": 0.4, "end": 0.35}],
}


def lean_fraction(i, n, rng, start=START_LEAN, end=END_LEAN):
    """A steady change from `start` to `end` over the sessions, with day-to-day wobble."""
    progress = i / max(1, n - 1)
    base = start + (end - start) * progress
    return min(0.9, max(MIN_LEAN, base + rng.uniform(-0.08, 0.08)))


def make_history(sessions=8, seed=1, out_dir=FAKE_DIR, first=FIRST_SESSION, start=START_LEAN, end=END_LEAN):
    """Write `sessions` fake sessions into out_dir. Returns the reps file paths."""
    rng = random.Random(seed)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    when = first
    written = []
    for i in range(sessions):
        lean = lean_fraction(i, sessions, rng, start, end)
        # never a 0%-compensated session (it would look like a finished outcome): re-deal if so
        for _ in range(50):
            lines = generate(plan=FAKE_PLAN, lean_fraction=lean, seed=rng.randrange(1_000_000))
            if not any(line.startswith("S,") and line.rstrip().endswith(",0") for line in lines):
                break
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


def make_patients(out_dir=FAKE_DIR):
    """Write every simulated patient's sessions into out_dir/<id>/. Returns {id: reps paths}."""
    if out_dir.exists():
        shutil.rmtree(out_dir)        # also clears files from before patients had folders
    written = {}
    for p in PATIENTS:
        written[p["id"]] = make_history(p["sessions"], p["seed"], out_dir / p["id"], p["first"], p["start"], p["end"])
        for x in EXTRA_EXERCISES.get(p["id"], []):        # after the patient's own folder, which make_history clears
            written[p["id"]] += make_history(x["sessions"], x["seed"], out_dir / p["id"] / x["exercise"], x["first"], x["start"], x["end"])
    return written


def main():
    argparse.ArgumentParser(description="Make a few weeks of fake sessions for three simulated patients in data/fake/.").parse_args()
    with contextlib.redirect_stdout(io.StringIO()):   # SessionWriter prints every rep
        written = make_patients()
    for pid, paths in written.items():
        print(f"wrote {len(paths)} fake sessions to {FAKE_DIR / pid}")
    print("now run: python -m software.dashboard.export")


if __name__ == "__main__":
    main()
