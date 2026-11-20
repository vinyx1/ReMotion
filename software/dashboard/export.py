"""
export.py  —  turn the logger's CSV files into one JSON file for the web dashboard.

    python -m software.dashboard.export                 # data/raw + data/sample + data/fake -> software/web/public/sessions.json
    python -m software.dashboard.export --no-sample     # real recordings only (data/raw)

Each session carries a "patient" id. The logger doesn't record who did a session
yet, so the id comes from where the files are:
    data/raw/              "recorded"   (real recordings)
    data/fake/<id>/        <id>         (simulated patients, from fake_history.py)
    data/sample/, data/fake/ (loose files)   "sim-a" (the first simulated patient)

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
    load_reps, load_samples, rep_trace, session_threshold, summarize_sessions,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw"
SAMPLE_DIR = REPO_ROOT / "data" / "sample"
FAKE_DIR = REPO_ROOT / "data" / "fake"         # made by software.dashboard.fake_history
DEFAULT_OUT = REPO_ROOT / "software" / "web" / "public" / "sessions.json"


def export_sessions(folders, patient=None):
    """Build the dictionary that becomes sessions.json, tagging each session with `patient` if given."""
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
            # starts with the time stamp (the dashboard reads the date from it); the patient keeps ids unique
            "id": f"{first['stamp']}-{int(first['session'])}" + (f"-{patient}" if patient else ""),
            **({"patient": patient} if patient else {}),
            "label": label,
            "simulated": str(first["folder"]) != str(RAW_DIR),   # only data/raw is real
            "thresholdDeg": threshold,
            "reps": rep_list,
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


def patient_folders(include_fake=True):
    """[(folders, patient id)] for every patient whose files are on disk."""
    groups = [([str(RAW_DIR)], "recorded")]
    if include_fake:
        groups.append(([str(SAMPLE_DIR), str(FAKE_DIR)], "sim-a"))       # loose example files
        if FAKE_DIR.exists():
            for sub in sorted(p for p in FAKE_DIR.iterdir() if p.is_dir()):
                if sub.name == "sim-a":
                    groups[-1][0].append(str(sub))
                else:
                    groups.append(([str(sub)], sub.name))
    return groups


def export_groups(groups):
    """Export each patient's folders on their own (so their sessions never merge) and combine them."""
    sessions = []
    for folders, patient in groups:
        sessions += export_sessions(folders, patient)["sessions"]
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
