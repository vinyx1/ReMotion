# Serial protocol — IMU Reach Tracker

USB serial, **115200 baud**, one message per line (`\n`), fields separated by commas. Floats have 1 decimal place.

Changing this format means updating `firmware/reach_tracker`, `software/tools/protocol.py` (the shared parser), `software/tools/logger.py`, `software/tools/fake_session.py`, `software/dashboard/data.py` and the web dashboard (`software/web/src/types.ts`) together.

## Device → laptop

| Prefix | Fields | When |
|---|---|---|
| `#` | free text | Comments and status. Ignore when parsing. |
| `D` | `t_ms,state,trunk_deg,wrist_dps,threshold` | Every sample (100 Hz) while streaming is on |
| `R` | `rep,target,react_ms,reach_ms,peak_deg,bursts,compensated` | After each completed rep |
| `S` | `reps,compensated_reps` | When the session ends (START pressed) |
| `E` | `message` | Errors (IMU missing, calibration rejected, rep aborted, bad command) |

Field meanings:
- `t_ms`: Arduino `millis()` at the sample (resets when the board resets).
- `state`: one of `IDLE`, `CALIBRATING`, `CALIB_FAILED`, `WAIT_HOME`, `CUED`, `REACHING`, `RETURNING`.
- `trunk_deg`: smoothed trunk angle from the calibrated upright position. It stays 0.0 until the first calibration.
- `wrist_dps`: wrist rotation speed, |gyro| in deg/s.
- `threshold`: current lean threshold in degrees.
- `rep`: rep number, counting from 1 in each session.
- `target`: `GREEN`, `BLUE` or `RED`.
- `react_ms`: time from the target lighting up to the hand leaving HOME.
- `reach_ms`: time from leaving HOME to pressing the target.
- `peak_deg`: highest `trunk_deg` during the reach.
- `bursts`: number of wrist movement bursts during the reach (enter >60 deg/s, exit <30 deg/s).
- `compensated`: `1` if the lean went past the threshold for at least 200 ms, otherwise `0`.

Example:
```
# session started: put your hand on HOME
D,15230,REACHING,4.2,85.3,10.0
R,1,BLUE,412,1380,6.8,2,0
R,2,RED,390,1650,14.1,3,1
S,2,1
```

## Laptop → device

| Command | Effect |
|---|---|
| `T<deg>` | Set the lean threshold, from 1 to 60 degrees (e.g. `T12`, `T12.5`) |
| `D0` / `D1` | Turn the `D` sample stream off / on |

Every command ends with a newline. Unknown commands get an `E` reply.
