"""Tests for software/dashboard/data.py, using a fake session run through the real logger."""

import pandas as pd
import pytest

from software.dashboard.data import (
    find_reach_windows, load_reps, load_samples, rep_trace,
    session_threshold, summarize_sessions,
)
from software.tools.fake_session import generate
from software.tools.logger import SessionWriter


@pytest.fixture
def session_folder(tmp_path):
    """A folder holding one logger run that contains TWO sessions (8 reps, then 5)."""
    writer = SessionWriter(tmp_path)
    for line in generate(reps=8, lean_fraction=0.5, seed=1) + generate(reps=5, lean_fraction=0.2, seed=2):
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
