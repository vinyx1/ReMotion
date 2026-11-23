"""
validation.py  —  label reps from video, then measure how well the device agrees.

The success measure (AGENTS.md section 9): does the device's clean/compensated label
match what a person sees on the side-view video? Two steps:

1. After recording, make a blank label sheet for each run:

       python -m software.analysis.validation sheet data/validation/alex/reps_20261123_141500.csv --video IMG_0412.MOV

   It writes labels_20261123_141500.csv beside the reps file: one row per scored rep
   (warm-up reps left out), with the rep number and target but NOT the device's
   answer, so the labeler stays blind. The labeler, someone who didn't do that
   session, watches the video and fills the `label` column: clean, leaned or unsure.

2. When sheets are filled in, compare:

       python -m software.analysis.validation report data/validation
       python -m software.analysis.validation report data/validation --out docs/validation-results.md

   For every labels_*.csv under the folders it finds the matching reps and samples
   files and prints: how often device and video agree, the confusion table, Cohen's
   kappa, agreement per tester, and a threshold sweep. The sweep re-judges every rep
   from the recorded trunk angle the way the firmware does (past the threshold for at
   least 200 ms during the reach) at thresholds from 4 to 20 degrees, so the team can
   see which threshold best matches the video. "unsure" labels are left out.

The tester is the name of the folder the files are in (data/validation/<tester>/).
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

from software.dashboard.data import find_reach_windows

LABELS = {"clean": 0, "c": 0, "0": 0, "upright": 0,
          "leaned": 1, "l": 1, "1": 1, "lean": 1, "compensated": 1}
UNSURE = {"unsure", "u", "?", ""}
SHEET_COLUMNS = ["tester", "session", "rep", "phase", "target", "video", "label", "notes"]
LEAN_SUSTAIN_MS = 200            # as in the firmware (LEAN_SUSTAIN_MS)
SWEEP = [x / 2 for x in range(8, 41)]   # 4.0, 4.5, ... 20.0 degrees


# ---------------------------------------------------------------------------
#  1. The blank sheet
# ---------------------------------------------------------------------------

def stamp_of(path):
    """'20261123_141500' from reps_20261123_141500.csv."""
    return Path(path).stem.split("_", 1)[1]


def make_sheet(reps, tester, video=""):
    """The blind label sheet for one run: scored reps only, no device columns."""
    scored = reps[reps["phase"] != "PRACTICE"] if "phase" in reps.columns else reps
    sheet = pd.DataFrame({
        "tester": tester,
        "session": scored["session"].values,
        "rep": scored["rep"].values,
        "phase": scored["phase"].values if "phase" in scored.columns else "",
        "target": scored["target"].values,
        "video": video,
        "label": "",
        "notes": "",
    })
    return sheet[SHEET_COLUMNS]


def write_sheet(reps_path, video="", force=False):
    reps_path = Path(reps_path)
    out = reps_path.with_name(f"labels_{stamp_of(reps_path)}.csv")
    if out.exists() and not force:
        sys.exit(f"{out} already exists (it may hold labels). Use --force to overwrite it.")
    sheet = make_sheet(pd.read_csv(reps_path), tester=reps_path.parent.name, video=video)
    sheet.to_csv(out, index=False)
    print(f"Wrote {out} ({len(sheet)} reps to label). Fill the label column: clean, leaned or unsure.")
    return out


# ---------------------------------------------------------------------------
#  2. Comparing
# ---------------------------------------------------------------------------

def parse_label(value):
    """0 (clean), 1 (leaned), or None (unsure or blank)."""
    v = str(value).strip().lower() if pd.notna(value) else ""
    if v in UNSURE:
        return None
    if v not in LABELS:
        raise ValueError(f"unknown label {value!r}: use clean, leaned or unsure")
    return LABELS[v]


def leaned_at(trace, threshold, sustain_ms=LEAN_SUSTAIN_MS):
    """Would the firmware call this reach compensated at `threshold`? (past it for >= sustain_ms)"""
    over = trace["trunk_deg"] > threshold
    if not over.any():
        return False
    run = (over != over.shift()).cumsum()
    for _, part in trace[over].groupby(run[over]):
        if part["t_ms"].iloc[-1] - part["t_ms"].iloc[0] >= sustain_ms:
            return True
    return False


def reach_traces(samples):
    """{(session, rep): the samples of that rep's reach}, from the firmware's states."""
    out = {}
    for session, part in samples.groupby("session"):
        part = part.reset_index(drop=True)
        for i, (_, start, end) in enumerate(find_reach_windows(part), start=1):
            out[(session, i)] = part.loc[start:end - 1]
    return out


def load_run(labels_path):
    """One labelled run: the sheet joined to the device's reps (and reach traces, if the samples exist)."""
    labels_path = Path(labels_path)
    stamp = stamp_of(labels_path)
    reps = pd.read_csv(labels_path.with_name(f"reps_{stamp}.csv"))
    sheet = pd.read_csv(labels_path, dtype={"label": str, "notes": str})
    run = sheet.merge(reps[["session", "rep", "peak_deg", "compensated", "reach_ms"]], on=["session", "rep"], how="left")
    run["video_label"] = run["label"].map(parse_label)
    run["run"] = stamp
    samples_path = labels_path.with_name(f"samples_{stamp}.csv")
    traces = reach_traces(pd.read_csv(samples_path)) if samples_path.exists() else {}
    run["trace"] = [traces.get((s, r)) for s, r in zip(run["session"], run["rep"])]
    return run


def load_all(folders):
    runs = [load_run(p) for f in folders for p in sorted(Path(f).rglob("labels_*.csv"))]
    if not runs:
        return pd.DataFrame()
    return pd.concat(runs, ignore_index=True)


def kappa(a, b):
    """Cohen's kappa for two 0/1 label lists (agreement beyond chance)."""
    a, b = pd.Series(a).astype(int), pd.Series(b).astype(int)
    n = len(a)
    if n == 0:
        return float("nan")
    observed = (a == b).mean()
    chance = a.mean() * b.mean() + (1 - a.mean()) * (1 - b.mean())
    return 1.0 if chance == 1 else (observed - chance) / (1 - chance)


def sweep(labelled):
    """Agreement with the video at each threshold, re-judging reps from their traces (peak only without one)."""
    rows = []
    for thr in SWEEP:
        device = [leaned_at(t, thr) if t is not None else peak > thr
                  for t, peak in zip(labelled["trace"], labelled["peak_deg"])]
        device = pd.Series(device, index=labelled.index).astype(int)
        video = labelled["video_label"].astype(int)
        rows.append({"threshold": thr, "agree": (device == video).mean(),
                     "missed_leans": int(((device == 0) & (video == 1)).sum()),
                     "false_alarms": int(((device == 1) & (video == 0)).sum()),
                     "kappa": kappa(device, video)})
    return pd.DataFrame(rows)


def report(folders):
    """The whole comparison as markdown text."""
    runs = load_all(folders)
    if runs.empty:
        return "No labels_*.csv found. Make one with `validation sheet <reps csv>` and fill it in."
    total = len(runs)
    missing = runs["compensated"].isna().sum()
    labelled = runs[runs["video_label"].notna() & runs["compensated"].notna()].copy()
    labelled["video_label"] = labelled["video_label"].astype(int)
    labelled["compensated"] = labelled["compensated"].astype(int)
    unsure = total - missing - len(labelled)

    lines = ["# Device vs video", ""]
    lines.append(f"{len(labelled)} reps compared, from {runs['run'].nunique()} runs and "
                 f"{runs['tester'].nunique()} testers. {unsure} unsure or blank, left out."
                 + (f" {missing} rows matched no rep in the reps file." if missing else ""))
    if labelled.empty:
        return "\n".join(lines)

    d, v = labelled["compensated"], labelled["video_label"]
    agree = (d == v).mean()
    lines += ["", f"**Agreement: {agree:.0%}** (target about 90%). Cohen's kappa {kappa(d, v):.2f}.", "",
              "| | video clean | video leaned |", "|---|---|---|",
              f"| device clean | {int(((d == 0) & (v == 0)).sum())} | {int(((d == 0) & (v == 1)).sum())} (missed) |",
              f"| device leaned | {int(((d == 1) & (v == 0)).sum())} (false alarm) | {int(((d == 1) & (v == 1)).sum())} |"]

    lines += ["", "## Per tester", "", "| tester | reps | agree | median peak, clean (°) | median peak, leaned (°) |", "|---|---|---|---|---|"]
    for tester, part in labelled.groupby("tester"):
        clean = part[part["video_label"] == 0]["peak_deg"].median()
        lean = part[part["video_label"] == 1]["peak_deg"].median()
        lines.append(f"| {tester} | {len(part)} | {(part['compensated'] == part['video_label']).mean():.0%} "
                     f"| {clean:.1f} | {lean:.1f} |")

    lines += ["", "## Repeatability (each run)", "", "| tester | run | reps | median peak, clean (°) | median reach (ms) |", "|---|---|---|---|---|"]
    for (tester, run), part in labelled.groupby(["tester", "run"]):
        clean = part[part["video_label"] == 0]
        lines.append(f"| {tester} | {run} | {len(part)} | {clean['peak_deg'].median():.1f} | {part['reach_ms'].median():.0f} |")

    s = sweep(labelled)
    # the best agreement is often a plateau of thresholds: name it, and suggest its middle (the safest pick)
    top = s[(s["agree"] == s["agree"].max())]
    top = top[top["kappa"] == top["kappa"].max()]
    lo, hi = top["threshold"].min(), top["threshold"].max()
    pick = round((lo + hi) / 2 * 2) / 2
    traced = labelled["trace"].notna().mean()
    lines += ["", "## Threshold sweep", "",
              f"Every rep re-judged at each threshold ({LEAN_SUSTAIN_MS} ms sustain, as the firmware does"
              + ("" if traced == 1 else f"; {1 - traced:.0%} of reps had no samples and use peak only") + ").",
              (f"Best match with the video: **{lo:.1f}° to {hi:.1f}°** ({top['agree'].iloc[0]:.0%} agreement); "
               f"the middle, **{pick:.1f}°**, leaves the most room either side." if hi > lo else
               f"Best match with the video: **{lo:.1f}°** ({top['agree'].iloc[0]:.0%} agreement)."),
              "Set it with `--threshold` on the logger (or `T<deg>` over serial). Few reps make this noisy: "
              "trust it once there are 60 or more.", "",
              "| threshold (°) | agree | missed leans | false alarms | kappa |", "|---|---|---|---|---|"]
    for _, r in s.iterrows():
        mark = " ←" if r["threshold"] == pick else ""
        lines.append(f"| {r['threshold']:.1f}{mark} | {r['agree']:.0%} | {int(r['missed_leans'])} | {int(r['false_alarms'])} | {r['kappa']:.2f} |")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Label reps from video and compare with the device.")
    sub = parser.add_subparsers(dest="command", required=True)
    s = sub.add_parser("sheet", help="make a blank label sheet for a recorded run")
    s.add_argument("reps", nargs="+", help="reps_<time>.csv file(s)")
    s.add_argument("--video", default="", help="the video file name, to write on the sheet")
    s.add_argument("--force", action="store_true", help="overwrite an existing sheet")
    r = sub.add_parser("report", help="compare filled sheets with the device")
    r.add_argument("folders", nargs="+", help="folders to search for labels_*.csv")
    r.add_argument("--out", help="also write the report to this markdown file")
    args = parser.parse_args(argv)

    if args.command == "sheet":
        for p in args.reps:
            write_sheet(p, video=args.video, force=args.force)
    else:
        text = report(args.folders)
        print(text)
        if args.out:
            Path(args.out).write_text(text + "\n")
            print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
