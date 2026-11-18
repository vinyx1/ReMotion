"""
export.py  —  turn the logger's CSV files into one JSON file for the web dashboard.

    python -m software.dashboard.export                 # data/raw + data/sample -> software/web/public/sessions.json
    python -m software.dashboard.export --no-sample     # real recordings only

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
DEFAULT_OUT = REPO_ROOT / "software" / "web" / "public" / "sessions.json"


def export_sessions(folders):
    """Build the dictionary that becomes sessions.json."""
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
            "id": f"{first['stamp']}-{int(first['session'])}",
            "label": label,
            "simulated": str(first["folder"]) == str(SAMPLE_DIR),
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


def main():
    parser = argparse.ArgumentParser(description="Export logged sessions to JSON for the web dashboard.")
    parser.add_argument("--no-sample", action="store_true", help="leave out the example data in data/sample")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output file")
    args = parser.parse_args()

    folders = [str(RAW_DIR)] + ([] if args.no_sample else [str(SAMPLE_DIR)])
    data = export_sessions(folders)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(",", ":")))
    n_reps = sum(len(s["reps"]) for s in data["sessions"])
    print(f"wrote {len(data['sessions'])} sessions ({n_reps} reps) to {args.out}")


if __name__ == "__main__":
    main()
