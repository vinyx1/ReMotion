"""
export.py  —  turn the logger's CSV files into one JSON file for the web dashboard.

    python -m software.dashboard.export                 # data/raw + data/sample + data/fake -> software/web/public/sessions.json
    python -m software.dashboard.export --no-sample     # real recordings only (data/raw)

Each session carries a "patient" id. The logger doesn't record who did a session
yet, so the id comes from where the files are:
    data/raw/              "recorded"   (real recordings)
    data/fake/<id>/        <id>         (simulated patients, from fake_history.py)
    data/fake/ (loose files)  "sim-a"   (the first simulated patient)
    data/sample/           "sample"     (the committed example session, full length; kept
                                         apart so it doesn't break a simulated patient's story)

Each session also carries an "exercise" id (one of EXERCISES). The logger doesn't
record the exercise yet either (that needs a serial-protocol change), so it also
comes from where the files are: files in a patient's folder are the forward reach,
and files in a sub-folder named after an exercise are that exercise, e.g.
    data/fake/sim-a/hand-to-mouth/reps_*.csv   -> patient sim-a, exercise hand-to-mouth

The web app (software/web/) only reads this file. All the data logic stays in
Python (data.py, which is tested), so the web app never has to understand the
CSV format or how reps are found in the samples.

Run it again after every new recording.
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

from software.dashboard.data import (
    load_reps, load_samples, rep_trace, session_threshold, summarize_phases, summarize_sessions,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw"
SAMPLE_DIR = REPO_ROOT / "data" / "sample"
FAKE_DIR = REPO_ROOT / "data" / "fake"         # made by software.dashboard.fake_history
DEFAULT_OUT = REPO_ROOT / "software" / "web" / "public" / "sessions.json"

# The exercises (AGENTS.md section 1). Forward reach is the one the device does today.
EXERCISES = ("forward-reach", "sideways-reach", "hand-to-mouth", "forearm-rotation")
DEFAULT_EXERCISE = "forward-reach"


def export_sessions(folders, patient=None, exercise=DEFAULT_EXERCISE):
    """Build the dictionary that becomes sessions.json, tagging each session with `patient` (if given) and `exercise`."""
    all_reps = load_reps(folders)
    sessions = []
    if all_reps.empty:
        return {"generated": datetime.now().isoformat(timespec="seconds"), "sessions": []}

    summary = summarize_sessions(all_reps).set_index("session_label")
    for label, reps in all_reps.groupby("session_label", sort=False):
        reps = reps.sort_values("rep")
        first = reps.iloc[0]
        samples = load_samples(first["folder"], first["stamp"], int(first["session"]))
        threshold = session_threshold(samples)

        rep_list = []
        for r in reps.itertuples():
            trace, reach_end_s = rep_trace(samples, int(r.rep))
            rep_list.append({
                "rep": int(r.rep),
                "target": r.target,
                "reactMs": int(r.react_ms),
                "reachMs": int(r.reach_ms),
                "peakDeg": float(r.peak_deg),
                "bursts": int(r.bursts),
                "compensated": bool(r.compensated),
                "phase": r.phase or None,      # None for logs from before the firmware had blocks
                # Samples from the cue to 0.5 s after the target press (null if not found)
                "trace": None if trace is None else {
                    "reachEndS": round(float(reach_end_s), 3),
                    "t": [round(float(x), 3) for x in trace["t_s"]],
                    "trunkDeg": [float(x) for x in trace["trunk_deg"]],
                    "wristDps": [float(x) for x in trace["wrist_dps"]],
                    "state": list(trace["state"]),
                },
            })

        s = summary.loc[label]
        sessions.append({
            # starts with the time stamp (the dashboard reads the date from it); the patient and a
            # non-default exercise keep ids unique
            "id": f"{first['stamp']}-{int(first['session'])}" + (f"-{patient}" if patient else "")
                  + (f"-{exercise}" if exercise != DEFAULT_EXERCISE else ""),
            **({"patient": patient} if patient else {}),
            "exercise": exercise,
            "label": label,
            "simulated": str(first["folder"]) != str(RAW_DIR),   # only data/raw is real
            "thresholdDeg": threshold,
            "reps": rep_list,
            # One entry per block, in session order; [] for logs from before blocks existed
            "phases": [{
                "phase": p.phase,
                "reps": int(p.reps),
                "compensated": int(p.compensated),
                "pctCompensated": round(float(p.pct_compensated), 1),
                "medianPeakDeg": round(float(p.median_peak_deg), 1),
                "buzzer": bool(p.buzzer),
            } for p in summarize_phases(reps).itertuples()],
            "summary": {
                "reps": int(s["reps"]),
                "compensated": int(s["compensated"]),
                "pctCompensated": round(float(s["pct_compensated"]), 1),
                "medianReachS": round(float(s["median_reach_s"]), 3),
                "maxPeakDeg": float(s["max_peak_deg"]),
            },
        })

    sessions.sort(key=lambda x: x["id"])            # oldest first
    return {"generated": datetime.now().isoformat(timespec="seconds"), "sessions": sessions}


def exercise_folders(folder):
    """[(folder, exercise)] for a patient folder: its own files, then any exercise sub-folders."""
    folder = Path(folder)
    out = [(str(folder), DEFAULT_EXERCISE)]
    if folder.is_dir():
        out += [(str(folder / ex), ex) for ex in EXERCISES if ex != DEFAULT_EXERCISE and (folder / ex).is_dir()]
    return out


def patient_folders(include_fake=True):
    """[(folders, patient id, exercise)] for every patient and exercise whose files are on disk."""
    groups = [([str(RAW_DIR)], "recorded", DEFAULT_EXERCISE)]
    if include_fake:
        groups.append(([str(SAMPLE_DIR)], "sample", DEFAULT_EXERCISE))     # the committed example session
        sim_a = [str(FAKE_DIR)]                                             # loose files in data/fake
        if FAKE_DIR.exists():
            for sub in sorted(p for p in FAKE_DIR.iterdir() if p.is_dir()):
                for folder, ex in exercise_folders(sub):
                    if sub.name == "sim-a" and ex == DEFAULT_EXERCISE:
                        sim_a.append(folder)
                    else:
                        groups.append(([folder], sub.name, ex))
        groups.insert(2, (sim_a, "sim-a", DEFAULT_EXERCISE))
    return groups


def export_groups(groups):
    """Export each patient's folders on their own (so their sessions never merge) and combine them."""
    sessions = []
    for folders, patient, exercise in groups:
        sessions += export_sessions(folders, patient, exercise)["sessions"]
    sessions.sort(key=lambda x: x["id"])            # oldest first
    return {"generated": datetime.now().isoformat(timespec="seconds"), "sessions": sessions}


def main():
    parser = argparse.ArgumentParser(description="Export logged sessions to JSON for the web dashboard.")
    parser.add_argument("--no-sample", action="store_true", help="real recordings only: leave out data/sample and data/fake")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output file")
    args = parser.parse_args()

    data = export_groups(patient_folders(include_fake=not args.no_sample))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(",", ":")))
    n_reps = sum(len(s["reps"]) for s in data["sessions"])
    print(f"wrote {len(data['sessions'])} sessions ({n_reps} reps) to {args.out}")


if __name__ == "__main__":
    main()
