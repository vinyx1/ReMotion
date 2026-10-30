# Open confirmations before the formal plan

Check these off and write the answer next to each. Once they are answered, they move into `CLAUDE.md`.

## Blocks firmware

- [ ] **Buy the board.** Recommended: Arduino UNO R4 Minima (alternative: Raspberry Pi Pico 2 H). Which one was bought? Answer: ____
- [ ] **Buy the remaining parts.** Starter kit (breadboard, jumpers incl. male-female, LEDs, resistors, active buzzer), ~2 m USB-C data cable, ~1 m 4-conductor stranded wire, perfboard, header pins, heat shrink. Answer: ____
- [ ] **Soldering access.** Where will the team solder the MPU-6050 header pins (course lab or campus makerspace)? Answer: ____
- [ ] **IMU breakout voltage.** The R4 uses 5 V logic and the MPU-6050 is a 3.3 V chip. Does the breakout have an on-board regulator (GY-521 style)? If not, power it from 3.3 V and don't put 5 V on the I2C lines. Answer: ____

## Blocks validation

- [x] **Video-to-data sync.** Decided: press the calibration button with the LED in camera frame (firmware logs a marker), plus a fixed rep script with rep numbers said aloud as a cross-check. Recorded in `CLAUDE.md`.
- [x] **Labeling protocol.** Decided: the team labels the video themselves, ideally a teammate who didn't perform that session, from the video and not the script, without seeing the system's output. Recorded in `CLAUDE.md`.
- [ ] **Ask the client (Waterloo CCARE)** what real stroke compensation looks like, ideally with example videos, so scripted leaned reps resemble it. Answer: ____
- [ ] **Testers and rep count.** Which teammates and friends are subjects, and how many reps each? The 90% over about 60 reps placeholder assumes at least 3 testers. Answer: ____
- [ ] **Success threshold.** Settle the agreement target after the first recordings, together as a team. Placeholder: about 90% over about 60 reps. Answer: ____

## Blocks the demo

- [ ] **Arm's-length rule in the demo.** The demo has no hard time limit, so a tape-measure step is fine. Decide how the target is moved to the right distance: a target on a sliding rail with a ruler, or a marked board you reposition. Answer: ____

## Blocks the report and schedule

- [ ] **Course requirements.** The real deadline, the required deliverables (report, demo date), and any consent or approval rule for testers outside the team (friends) and for judges trying the device. Answer: ____
- [ ] **Team roles.** Who owns firmware, signal processing, dashboard and storage, and mounting and testing? Answer: ____
- [ ] **GitHub access.** All four teammates added as collaborators. Answer: ____

## Can wait

- [ ] **Multi-target extension (week 3 decision).** Forward, left and right targets. Side targets change the arm's-length rule, since it applies per direction, and the target LEDs each need a wire back to the Arduino. Answer: ____
