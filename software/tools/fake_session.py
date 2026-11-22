"""
fake_session.py  —  generate a realistic fake session, line for line, in the
same format the Arduino prints (docs/PROTOCOL.md).

Use it to build and test the logger and dashboard before the hardware works.
It walks through the same states as reach_tracker.ino and applies the same
lean rule, so the R lines agree with the D lines.

    python -m software.tools.fake_session                       # print to the screen
    python -m software.tools.fake_session --out data/sample/fake_session.txt
    python -m software.tools.fake_session --plan 0,0,5,0 --lean 0.5 --seed 3

The fake patient leans on about `--lean` of the BASELINE reps, less and less
during TRAINING (the buzzer is teaching them), and keeps part of that gain in
POST. Made up, but it gives the dashboard a realistic before/after to show.

Then feed the file through the logger exactly like a real session:

    python -m software.tools.logger --replay data/sample/fake_session.txt
"""

import argparse
import math
import random

from software.tools.protocol import (
    DEFAULT_PLAN, PHASES, Rep, Sample, SessionEnd, TARGETS,
    format_rep, format_sample, format_session_end,
)

SAMPLE_MS = 10                 # 100 Hz, like the firmware
THRESHOLD_DEG = 10.0           # firmware default
LEAN_SUSTAIN_MS = 200          # firmware: must lean this long to count
BURST_ENTER_DPS = 60.0         # firmware burst hysteresis
BURST_EXIT_DPS = 30.0
TRUNK_ALPHA = 0.15             # firmware smoothing
REST_MS = 30000                # firmware rest before TRAINING and POST
REST_BEFORE = {"TRAINING", "POST"}

# Fraction of `lean` the fake patient keeps in each block (TRAINING goes from
# the first number to the second across the block). Made up; tune on real data.
LEAN_SCALE = {"PRACTICE": (1.0, 1.0), "BASELINE": (1.0, 1.0),
              "TRAINING": (0.9, 0.25), "POST": (0.5, 0.5)}

# Typical sizes for a seated reach (made up but plausible; tune against real data)
CLEAN_PEAK_DEG = (1.0, 6.0)    # upright reach: a little trunk movement
LEAN_PEAK_DEG = (12.0, 25.0)   # deliberate compensation
REACH_MS = {"GREEN": (700, 1100), "BLUE": (900, 1400), "RED": (1100, 1800)}
REACT_MS = (250, 600)
TRUNK_NOISE_DEG = 0.3
WRIST_NOISE_DPS = 4.0


class FakeDevice:
    """Plays the role of the Arduino: keeps a clock and prints lines."""

    def __init__(self, rng, threshold):
        self.rng = rng
        self.threshold = threshold
        self.t_ms = 0
        self.trunk_deg = 0.0       # smoothed, like the firmware
        self.lines = []

    def comment(self, text):
        self.lines.append(f"# {text}")

    def step(self, state, raw_trunk_deg, wrist_dps):
        """Advance 10 ms and print one D line. Returns the smoothed trunk angle."""
        noisy = raw_trunk_deg + self.rng.gauss(0, TRUNK_NOISE_DEG)
        self.trunk_deg += TRUNK_ALPHA * (noisy - self.trunk_deg)
        wrist = max(0.0, wrist_dps + self.rng.gauss(0, WRIST_NOISE_DPS))
        self.lines.append(format_sample(Sample(
            self.t_ms, state, max(0.0, self.trunk_deg), wrist, self.threshold)))
        self.t_ms += SAMPLE_MS
        return self.trunk_deg, wrist

    def hold(self, state, ms, trunk_deg=0.0, wrist_dps=0.0):
        """Stay in one state for a while with the person still."""
        for _ in range(ms // SAMPLE_MS):
            self.step(state, trunk_deg, wrist_dps)


def bump(fraction):
    """Smooth 0 -> 1 -> 0 curve over a movement (fraction goes 0 to 1)."""
    return math.sin(math.pi * fraction) ** 2


def fake_rep(dev, rep_number, target, phase, leaned):
    """Simulate one rep and return its Rep summary (computed the firmware's way)."""
    rng = dev.rng
    peak_wanted = rng.uniform(*(LEAN_PEAK_DEG if leaned else CLEAN_PEAK_DEG))
    react_ms = rng.randint(*REACT_MS) // SAMPLE_MS * SAMPLE_MS
    reach_ms = rng.randint(*REACH_MS[target]) // SAMPLE_MS * SAMPLE_MS
    wrist_peak = rng.uniform(150, 260)
    wobbles = rng.choice([0, 0, 1, 2])        # extra small corrections near the target

    dev.hold("WAIT_HOME", 1000)               # hand rests on HOME for 1 s
    dev.comment(f"target {target}")           # firmware announces the lit target
    dev.hold("CUED", react_ms)                # target lit, person reacting

    # REACHING: trunk tilts in a bump, wrist rotates in a bump plus wobbles
    peak_deg, bursts, in_burst = 0.0, 0, False
    over_since, sustain_met = None, False
    steps = reach_ms // SAMPLE_MS
    for i in range(steps):
        f = i / steps
        wrist = wrist_peak * bump(min(1.0, f / 0.8))
        if f > 0.8 and wobbles:
            wrist = 70 * bump((f - 0.8) / 0.2 * wobbles % 1.0)
        trunk, wrist = dev.step("REACHING", peak_wanted * bump(f), wrist)

        # same rules as the firmware
        peak_deg = max(peak_deg, trunk)
        if not in_burst and wrist > BURST_ENTER_DPS:
            in_burst, bursts = True, bursts + 1
        elif in_burst and wrist < BURST_EXIT_DPS:
            in_burst = False
        if trunk > dev.threshold:
            over_since = dev.t_ms if over_since is None else over_since
            if dev.t_ms - over_since >= LEAN_SUSTAIN_MS:
                sustain_met = True
        else:
            over_since = None

    rep = Rep(rep_number, target, react_ms, reach_ms, peak_deg, bursts,
              compensated=peak_deg > dev.threshold and sustain_met, phase=phase)
    dev.lines.append(format_rep(rep))

    dev.hold("RETURNING", rng.randint(600, 1000), wrist_dps=40.0)   # hand comes back
    return rep


def generate(plan=DEFAULT_PLAN, lean_fraction=0.5, seed=None, threshold=THRESHOLD_DEG):
    """Return the lines of one fake session (all blocks of `plan`), as the Arduino prints them."""
    rng = random.Random(seed)
    dev = FakeDevice(rng, threshold)

    dev.comment("ReMotion, ECE 198 Group 19 (FAKE SESSION)")
    dev.comment("both IMUs found. Press START to begin a session.")
    dev.comment("plan: " + " ".join(f"{p} {n}" for p, n in zip(PHASES, plan)))
    dev.hold("IDLE", 1000)
    dev.comment("calibrating: sit upright and still for 3 s")
    dev.hold("CALIBRATING", 3000)
    dev.comment("calibration OK (std 0.12 m/s2)")
    dev.comment("session started")

    results = []
    for phase, count in zip(PHASES, plan):
        if count == 0:
            continue
        if phase in REST_BEFORE and results:
            dev.comment(f"rest {REST_MS // 1000} s before the {phase} block")
            dev.hold("REST", REST_MS)
        dev.comment(f"{phase} block: {count} reps")
        deck = [TARGETS[i % 3] for i in range(count)]     # equal GREEN/BLUE/RED, like the firmware
        rng.shuffle(deck)
        start, end = LEAN_SCALE[phase]
        for i, target in enumerate(deck):
            p_lean = lean_fraction * (start + (end - start) * i / max(1, count - 1))
            results.append(fake_rep(dev, len(results) + 1, target, phase, rng.random() < p_lean))

    compensated = sum(r.compensated for r in results)
    dev.comment("all blocks done")
    dev.lines.append(format_session_end(SessionEnd(len(results), compensated)))
    dev.comment("session ended. Press START for a new session.")
    return dev.lines


def main():
    parser = argparse.ArgumentParser(description="Generate a fake ReMotion session.")
    parser.add_argument("--plan", default=",".join(map(str, DEFAULT_PLAN)),
                        help="reps per block: PRACTICE,BASELINE,TRAINING,POST (default %(default)s)")
    parser.add_argument("--lean", type=float, default=0.5,
                        help="fraction of BASELINE reps that lean (default 0.5)")
    parser.add_argument("--seed", type=int, help="random seed, for repeatable sessions")
    parser.add_argument("--out", help="write to this file instead of the screen")
    args = parser.parse_args()

    plan = [int(n) for n in args.plan.split(",")]
    if len(plan) != len(PHASES):
        parser.error(f"--plan needs {len(PHASES)} numbers: {','.join(PHASES)}")
    lines = generate(plan, args.lean, args.seed)
    text = "\n".join(lines) + "\n"
    if args.out:
        with open(args.out, "w") as f:
            f.write(text)
        print(f"wrote {len(lines)} lines to {args.out}")
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
