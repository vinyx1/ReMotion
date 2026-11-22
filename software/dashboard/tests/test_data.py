"""Tests for software/dashboard/data.py, using a fake session run through the real logger."""

import pandas as pd
import pytest

from software.dashboard.data import (
    find_reach_windows, load_reps, load_samples, rep_trace,
    session_threshold, summarize_phases, summarize_sessions,
)
from software.tools.fake_session import generate
from software.tools.logger import SessionWriter


@pytest.fixture
def session_folder(tmp_path):
    """A folder holding one logger run that contains TWO sessions (8 reps in all blocks, then 5 TRAINING reps)."""
    writer = SessionWriter(tmp_path)
    for line in generate((1, 3, 3, 1), lean_fraction=0.5, seed=1) + generate((0, 0, 5, 0), lean_fraction=0.2, seed=2):
        writer.handle(line)
    writer.close()
    return tmp_path


def test_load_reps_and_summary(session_folder):
    reps = load_reps([session_folder])
    assert len(reps) == 13
    assert reps["session_label"].nunique() == 2          # two sessions get two different names

    summary = summarize_sessions(reps)
    assert list(summary["reps"]) == [8, 5]
    assert list(summary["compensated"]) == [reps[reps["session"] == s]["compensated"].sum() for s in (1, 2)]
    assert summary["pct_compensated"].between(0, 100).all()


def test_missing_folder_gives_empty_table(tmp_path):
    reps = load_reps([tmp_path / "nothing_here"])
    assert reps.empty
    assert summarize_sessions(reps).empty


def test_every_rep_is_found_in_the_samples(session_folder):
    reps = load_reps([session_folder])
    stamp = reps["stamp"].iloc[0]
    for session, session_reps in reps.groupby("session"):
        samples = load_samples(session_folder, stamp, session)
        assert session_threshold(samples) == 10.0
        assert len(find_reach_windows(samples)) == len(session_reps)

        for rep in session_reps.itertuples():
            trace, reach_end_s = rep_trace(samples, rep.rep)
            reach = trace[trace["state"] == "REACHING"]
            # the trace agrees with the R line the firmware printed for this rep
            assert reach_end_s * 1000 == pytest.approx(rep.reach_ms)
            assert reach["trunk_deg"].max() == pytest.approx(rep.peak_deg, abs=0.05)
            assert trace["t_s"].min() * -1000 == pytest.approx(rep.react_ms)


def test_aborted_reach_is_not_counted_as_a_rep():
    states = (["WAIT_HOME"] * 3 + ["CUED"] * 2 + ["REACHING"] * 4 + ["WAIT_HOME"] * 3      # timed out
              + ["CUED"] * 2 + ["REACHING"] * 4 + ["RETURNING"] * 3)                        # finished
    samples = pd.DataFrame({"state": states, "t_ms": range(0, 10 * len(states), 10)})
    assert find_reach_windows(samples) == [(12, 14, 18)]


def test_unknown_rep_returns_none(session_folder):
    reps = load_reps([session_folder])
    samples = load_samples(session_folder, reps["stamp"].iloc[0], 1)
    assert rep_trace(samples, 99) == (None, None)
    assert rep_trace(None, 1) == (None, None)


def test_export_matches_the_rep_lines(session_folder):
    from software.dashboard.export import export_sessions

    data = export_sessions([str(session_folder)])
    assert [len(s["reps"]) for s in data["sessions"]] == [8, 5]
    for s in data["sessions"]:
        assert s["thresholdDeg"] == 10.0
        assert s["summary"]["compensated"] == sum(r["compensated"] for r in s["reps"])
        for r in s["reps"]:
            tr = r["trace"]
            assert tr is not None and len(tr["t"]) == len(tr["trunkDeg"]) == len(tr["state"])
            assert tr["reachEndS"] * 1000 == pytest.approx(r["reachMs"])


def test_fake_history_is_simulated_and_improves(tmp_path, monkeypatch, capsys):
    from software.dashboard import export
    from software.dashboard.fake_history import make_history

    make_history(sessions=6, seed=2, out_dir=tmp_path)
    monkeypatch.setattr(export, "RAW_DIR", tmp_path.parent / "no-real-data-here")
    data = export.export_sessions([str(tmp_path)])

    sessions = data["sessions"]
    assert len(sessions) == 6
    assert all(s["simulated"] for s in sessions)
    ids = [s["id"] for s in sessions]
    assert ids == sorted(ids)                                   # oldest first
    first, last = sessions[0]["summary"], sessions[-1]["summary"]
    assert first["pctCompensated"] > last["pctCompensated"]


def test_simulated_patients_are_tagged_and_kept_apart(tmp_path, monkeypatch, capsys):
    from software.dashboard import export
    from software.dashboard.fake_history import PATIENTS, make_patients

    fake = tmp_path / "fake"
    make_patients(fake)
    monkeypatch.setattr(export, "RAW_DIR", tmp_path / "no-real-data-here")
    monkeypatch.setattr(export, "SAMPLE_DIR", tmp_path / "no-samples-here")
    monkeypatch.setattr(export, "FAKE_DIR", fake)
    sessions = export.export_groups(export.patient_folders())["sessions"]

    # the forward reach, each patient on their own (extra exercises are checked below)
    by_patient = {p["id"]: [s for s in sessions if s["patient"] == p["id"] and s["exercise"] == "forward-reach"] for p in PATIENTS}
    assert {pid: len(ss) for pid, ss in by_patient.items()} == {p["id"]: p["sessions"] for p in PATIENTS}
    assert len({s["id"] for s in sessions}) == len(sessions)          # ids stay unique across patients
    assert all(s["id"][:8].isdigit() for s in sessions)               # and still start with the date
    a, c = by_patient["sim-a"], by_patient["sim-c"]
    assert a[0]["summary"]["pctCompensated"] > a[-1]["summary"]["pctCompensated"]   # sim-a improves
    assert c[0]["summary"]["pctCompensated"] < c[-1]["summary"]["pctCompensated"]   # sim-c gets worse


def test_extra_exercises_come_from_their_subfolders(tmp_path, monkeypatch, capsys):
    from software.dashboard import export
    from software.dashboard.fake_history import EXTRA_EXERCISES, make_patients

    fake = tmp_path / "fake"
    make_patients(fake)
    monkeypatch.setattr(export, "RAW_DIR", tmp_path / "no-real-data-here")
    monkeypatch.setattr(export, "SAMPLE_DIR", tmp_path / "no-samples-here")
    monkeypatch.setattr(export, "FAKE_DIR", fake)
    sessions = export.export_groups(export.patient_folders())["sessions"]

    assert {s["exercise"] for s in sessions} <= set(export.EXERCISES)
    for pid, extras in EXTRA_EXERCISES.items():
        for x in extras:
            mine = [s for s in sessions if s["patient"] == pid and s["exercise"] == x["exercise"]]
            assert len(mine) == x["sessions"]
            assert all(s["id"].endswith(f"-{pid}-{x['exercise']}") for s in mine)   # ids stay unique
    assert len({s["id"] for s in sessions}) == len(sessions)


def test_phase_summary(session_folder):
    reps = load_reps([session_folder])
    first = summarize_phases(reps[reps["session"] == 1])
    assert list(first["phase"]) == ["PRACTICE", "BASELINE", "TRAINING", "POST"]
    assert list(first["reps"]) == [1, 3, 3, 1]
    assert list(first["buzzer"]) == [False, False, True, False]
    assert first["pct_compensated"].between(0, 100).all()
    assert list(summarize_phases(reps[reps["session"] == 2])["phase"]) == ["TRAINING"]


def test_old_logs_without_phase_still_load(tmp_path):
    old = "session,rep,target,react_ms,reach_ms,peak_deg,bursts,compensated\n1,1,BLUE,550,940,3.3,3,0\n"
    (tmp_path / "reps_20261105_134323.csv").write_text(old)
    reps = load_reps([tmp_path])
    assert len(reps) == 1 and reps["phase"].iloc[0] == ""
    assert summarize_phases(reps).empty
