# Open confirmations before the formal plan

Check these off and write the answer next to each. Once they are answered, they move into `CLAUDE.md`.

## Blocks firmware

- [ ] **Board model.** Read the label on the Arduino. Is it an UNO R4 Minima or an UNO R4 WiFi? Answer: ____
- [ ] **IMU breakout voltage.** The R4 uses 5 V logic and the MPU-6050 is a 3.3 V chip. Does the breakout have an on-board regulator (GY-521 style)? If not, power it from 3.3 V and don't put 5 V on the I2C lines. Answer: ____

## Blocks validation

- [ ] **Video-to-data sync.** How will the side-view video line up with the recorded data? Options: the LED lights when calibration starts and is visible in frame; a hand clap with a logged marker. Decide before the first recording, since fixing it afterward is painful. Answer: ____
- [ ] **Labeling protocol.** Who labels each rep clean or leaned from the video? They should not see the system's output while labeling. Should two people label so agreement can be checked? Answer: ____
- [ ] **Testers and rep count.** Which teammates are subjects, and how many reps each? The 90% over about 60 reps placeholder assumes at least 3 testers. Answer: ____
- [ ] **Success threshold.** Settle the agreement target after the first recordings, together as a team. Placeholder: about 90% over about 60 reps. Answer: ____

## Blocks the demo

- [ ] **Arm's-length rule vs. the 90 s demo.** Measuring a judge's arm and placing the target takes time. Options: a target on a sliding rail with a ruler; a quick tape-measure step; a fixed target for typical arm lengths (weakest). Answer: ____

## Blocks the report and schedule

- [ ] **Course requirements.** The real deadline, the required deliverables (report, demo date), and any approval or consent rule when people outside the team try the device. Answer: ____
- [ ] **Team roles.** Who owns firmware, signal processing, dashboard and storage, and mounting and testing? Answer: ____
- [ ] **GitHub access.** All four teammates added as collaborators. Answer: ____

## Can wait

- [ ] **Multi-target extension (week 3 decision).** Forward, left and right targets. Side targets change the arm's-length rule, since it applies per direction, and the target LEDs each need a wire back to the Arduino. Answer: ____
