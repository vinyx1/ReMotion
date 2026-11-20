"""Tests for software/tools/protocol.py and software/tools/fake_session.py. Run: python -m pytest"""

from software.tools.fake_session import generate
from software.tools.protocol import (
    Comment, DeviceError, Rep, Sample, SessionEnd,
    format_rep, format_sample, parse_line, threshold_command,
)


def test_parses_the_examples_in_protocol_md():
    assert parse_line("D,15230,REACHING,4.2,85.3,10.0") == Sample(15230, "REACHING", 4.2, 85.3, 10.0)
    assert parse_line("R,1,BLUE,412,1380,6.8,2,0") == Rep(1, "BLUE", 412, 1380, 6.8, 2, False)
    assert parse_line("R,2,RED,390,1650,14.1,3,1").compensated is True
    assert parse_line("S,2,1") == SessionEnd(2, 1)
    assert parse_line("E,chest IMU (0x68) not found") == DeviceError("chest IMU (0x68) not found")
    assert parse_line("# session started") == Comment("session started")


def test_bad_lines_return_none():
    for line in ["", "   ", "D,152", "D,abc,REACHING,4.2,85.3,10.0", "X,1,2,3", "R,1,BLUE"]:
        assert parse_line(line) is None, line


def test_extra_columns_are_kept_not_rejected():
    sample = parse_line("D,10,IDLE,0.0,0.0,10.0,0.01,-0.02,0.99")
    assert sample.t_ms == 10
    assert sample.extra == ["0.01", "-0.02", "0.99"]


def test_format_and_parse_round_trip():
    sample = Sample(100, "CUED", 3.5, 12.0, 10.0)
    rep = Rep(4, "GREEN", 300, 900, 11.2, 1, True)
    assert parse_line(format_sample(sample)) == sample
    assert parse_line(format_rep(rep)) == rep


def test_threshold_command():
    assert threshold_command(12) == "T12.0"


def test_fake_session_is_valid_and_consistent():
    lines = generate(reps=12, lean_fraction=0.5, seed=1)
    messages = [parse_line(line) for line in lines]
    assert None not in messages                       # every line parses

    reps = [m for m in messages if isinstance(m, Rep)]
    end = [m for m in messages if isinstance(m, SessionEnd)][0]
    assert len(reps) == 12
    assert end.reps == 12
    assert end.compensated_reps == sum(r.compensated for r in reps)
    assert 3 <= end.compensated_reps <= 9             # about half leaned

    times = [m.t_ms for m in messages if isinstance(m, Sample)]
    assert all(b - a == 10 for a, b in zip(times, times[1:]))   # steady 100 Hz
