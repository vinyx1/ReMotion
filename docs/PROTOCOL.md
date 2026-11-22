# Serial protocol — ReMotion

USB serial, **115200 baud**, one message per line (`\n`), fields separated by commas. Floats have 1 decimal place.

Changing this format means updating `firmware/reach_tracker`, `software/tools/protocol.py` (the shared parser), `software/tools/logger.py`, `software/tools/fake_session.py`, `software/dashboard/data.py` and the web dashboard (`software/web/src/types.ts`) together.

## Device → laptop

| Prefix | Fields | When |
|---|---|---|
| `#` | free text | Comments and status. Ignore when parsing. |
| `D` | `t_ms,state,trunk_deg,wrist_dps,threshold` | Every sample (100 Hz) while streaming is on |
| `R` | `rep,target,react_ms,reach_ms,peak_deg,bursts,compensated,phase` | After each completed rep |
| `S` | `reps,compensated_reps` | When the session ends (all blocks done, or START / `X` early) |
| `I` | `state,phase,threshold,practice,baseline,training,post,streaming,reps,compensated_reps` | Reply to the `?` command |
| `E` | `message` | Errors (IMU missing, calibration rejected, rep aborted, bad command) |

Field meanings:
- `t_ms`: Arduino `millis()` at the sample (resets when the board resets).
- `state`: one of `IDLE`, `CALIBRATING`, `CALIB_FAILED`, `WAIT_HOME`, `CUED`, `REACHING`, `RETURNING`, `REST` (pause between blocks).
- `trunk_deg`: smoothed trunk angle from the calibrated upright position. It stays 0.0 until the first calibration.
- `wrist_dps`: wrist rotation speed, |gyro| in deg/s.
- `threshold`: current lean threshold in degrees.
- `rep`: rep number, counting from 1 in each session.
- `target`: `GREEN`, `BLUE` or `RED`.
- `react_ms`: time from the target lighting up to the hand leaving HOME.
- `reach_ms`: time from leaving HOME to pressing the target.
- `peak_deg`: highest `trunk_deg` during the reach.
- `bursts`: number of wrist movement bursts during the reach (enter >60 deg/s, exit <30 deg/s).
- `compensated`: `1` if the lean went past the threshold for at least 200 ms, otherwise `0`. Judged the same way in every block, buzzer or not.
- `I` line: `phase` is the block in progress (during `REST`, the block that comes next) and empty before a block has started; `practice`…`post` are the reps per block (the `P` plan); `streaming` is `1` while `D` lines are on; `reps` and `compensated_reps` count the session so far.
- `phase`: the block the rep belongs to: `PRACTICE`, `BASELINE`, `TRAINING` (the only block where the buzzer sounds) or `POST`. Logs from before 2026-11-20 have no `phase` field; the parser reads it as empty.

Example:
```
# BASELINE block: 15 reps, buzzer off
D,15230,REACHING,4.2,85.3,10.0
R,4,BLUE,412,1380,6.8,2,0,BASELINE
R,5,RED,390,1650,14.1,3,1,BASELINE
...
# all blocks done
S,63,20
```

## Session blocks

One press of START runs the whole session: calibration, then the blocks below, back to back. The firmware deals each block's targets from a shuffled deck with equal numbers of GREEN, BLUE and RED, and rests 30 s (`REST` state) before TRAINING and before POST. An aborted rep keeps its target and doesn't count toward the block.

| Block | Default reps | Buzzer | Purpose |
|---|---|---|---|
| `PRACTICE` | 3 | off | Learn the task; left out of the results |
| `BASELINE` | 15 | off | How much the patient compensates on their own |
| `TRAINING` | 30 | on while leaning | Feedback to stay upright |
| `POST` | 15 | off | Whether the change holds without the buzzer |

BASELINE vs POST (percent compensated, median peak lean) is the session's result. `P` changes the block sizes; a block with 0 reps is skipped.

## Laptop (or phone) → device

| Command | Effect |
|---|---|
| `T<deg>` | Set the lean threshold, from 1 to 60 degrees (e.g. `T12`, `T12.5`) |
| `D0` / `D1` | Turn the `D` sample stream off / on |
| `P<a>,<b>,<c>,<d>` | Reps per block: PRACTICE, BASELINE, TRAINING, POST, each 0–60, not all 0 (e.g. `P3,15,30,15`; `P0,0,5,0` for a short demo with the buzzer) |
| `G` | Start a session, exactly as if START were pressed (also retries a failed calibration). Refused while a session runs |
| `X` | End the session now, as if START were pressed during it (prints the `S` line). After a failed calibration, gives up and goes back to `IDLE`. Refused when idle |
| `?` | Reply with one `I` status line |

Every command ends with a newline. Unknown commands get an `E` reply, so firmware from before `G`, `X` and `?` (2026-11-21) answers them with `E,unknown command: G`; an app can use that to say the device needs updating. `T` and `P` are refused with an `E` reply while a session is running, so every block of a session uses the same threshold.
