import pandas as pd
import pytest

from software.analysis.validation import kappa, leaned_at, load_run, make_sheet, parse_label, report, write_sheet


def trace(degs, step_ms=10):
    return pd.DataFrame({"t_ms": [i * step_ms for i in range(len(degs))], "trunk_deg": degs})


def test_sheet_is_blind_and_skips_warm_up():
    reps = pd.DataFrame({"session": [1, 1, 1], "rep": [1, 2, 3], "target": ["RED", "BLUE", "GREEN"],
                         "react_ms": 1, "reach_ms": 1, "peak_deg": [3.0, 15.0, 4.0], "bursts": 1,
                         "compensated": [0, 1, 0], "phase": ["PRACTICE", "BASELINE", "BASELINE"]})
    sheet = make_sheet(reps, tester="alex", video="a.mov")
    assert list(sheet["rep"]) == [2, 3]
    assert "compensated" not in sheet.columns and "peak_deg" not in sheet.columns
    assert set(sheet["tester"]) == {"alex"}


def test_labels():
    assert parse_label("Clean") == 0 and parse_label("L") == 1 and parse_label("unsure") is None
    assert parse_label(float("nan")) is None
    with pytest.raises(ValueError):
        parse_label("maybe")


def test_sustain_like_the_firmware():
    assert not leaned_at(trace([5] * 10 + [12] * 15 + [5] * 10), 10)    # 140 ms over: a jolt
    assert leaned_at(trace([5] * 10 + [12] * 25 + [5] * 10), 10)        # 240 ms over
    assert not leaned_at(trace([12] * 25), 15)


def test_kappa():
    assert kappa([0, 1, 0, 1], [0, 1, 0, 1]) == 1
    assert kappa([0, 1, 0, 1], [1, 0, 1, 0]) == -1


def test_report_end_to_end(tmp_path):
    folder = tmp_path / "alex"
    folder.mkdir()
    reps = pd.DataFrame({"session": 1, "rep": [1, 2, 3, 4], "target": "RED", "react_ms": 300, "reach_ms": [900, 950, 1000, 1100],
                         "peak_deg": [3.0, 14.0, 4.0, 12.0], "bursts": 1, "compensated": [0, 1, 0, 1], "phase": "BASELINE"})
    reps.to_csv(folder / "reps_20261123_140000.csv", index=False)
    sheet = write_sheet(folder / "reps_20261123_140000.csv")
    filled = pd.read_csv(sheet)
    filled["label"] = ["clean", "leaned", "clean", "unsure"]
    filled.to_csv(sheet, index=False)

    run = load_run(sheet)
    assert list(run["video_label"])[:3] == [0, 1, 0]
    text = report([tmp_path])
    assert "**Agreement: 100%**" in text and "1 unsure or blank" in text
    assert "Threshold sweep" in text
