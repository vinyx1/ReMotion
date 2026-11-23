from pathlib import Path

from software.tools.demo import DEMOS, record_one_session
from software.tools.logger import SessionWriter
from software.tools.protocol import plan_command

SAMPLE = Path(__file__).resolve().parents[3] / "data" / "sample" / "fake_session.txt"


def test_demo_plans_are_valid():
    for _, plan, _ in DEMOS.values():
        plan_command(plan)                     # raises if the firmware would refuse it


def test_stops_at_session_end(tmp_path):
    lines = iter(SAMPLE.read_text().splitlines() + ["R,99,RED,1,1,1.0,0,0,POST"])
    writer = SessionWriter(tmp_path)
    assert record_one_session(lines, writer)
    writer.close()
    assert list(lines)[-1].startswith("R,99")  # it stopped at the S line, not the end
    assert writer.rep_count == 63
