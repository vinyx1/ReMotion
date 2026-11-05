# Open confirmations before the formal plan

Check these off and write the answer next to each. Once they are answered, they move into `CLAUDE.md`.

## Blocks firmware

- [ ] **Buy the parts.** Digi-Key order and spare MPU-6050, see `docs/parts-list.md`. Answer: ____
- [ ] **Soldering access.** Where will the team solder the header pins (course lab or campus makerspace)? Answer: ____
- [ ] **IMU regulator check.** Does each GY-521 have an on-board regulator (small 3-pin chip, often marked 662K)? Yes → VCC from 5V; no → VCC from 3V3. Answer: ____
- [ ] **IMU chip check.** After soldering, run an I2C scanner and read WHO_AM_I on both MPU-6050s (genuine = 0x68). Answer: ____
- [ ] **Arcade buttons.** Are the teammate's "buttons" the 5× 30 mm arcade buttons in the schematic (4 with LEDs)? What voltage are the LEDs rated for (5 V or 12 V), and do they have a built-in resistor? Bare LEDs need ~150–220 Ω each; 12 V LEDs will be dim at 5 V. Answer: ____

## Schematic checks (KiCad, before the final build)

Traced from a high-resolution render of `ECE 198 Kicad Design (3).pdf` on 2026-11-05.

- [x] **Chest IMU (U1) AD0 goes to 3V3.** Verified.
- [x] **Level shifter (U3): HV to 5V, LV to 3V3**, B1/B2 to Arduino SDA/SCL, A1/A2 to both IMUs. Verified.
- [x] **Buzzer diode (D1): cathode to 5V / buzzer +.** Verified.
- [x] **Button-to-pin order:** SW1 Home → D2, SW2 Green → D3, SW3 Blue → D4, SW4 Red → D5, SW5 calibrate → D6. Verified.
- [ ] **Arcade button LEDs have no series resistor** (anode straight to 5V, cathode to the transistor). Fine only if the buttons' LEDs are 5 V with a built-in resistor; otherwise add ~150–220 Ω per LED. Answer: ____
- [ ] **Add 10 kΩ base pull-downs** on Q1–Q5 to the schematic. Answer: ____
- [ ] **Add connector symbols** for the table → chest cable, chest → wrist cable and the button leads, so the harness is documented for the final build. Answer: ____
- [ ] **Reroute the buzzer − wire** so it doesn't cross the 5V line (electrically fine, since there's no junction dot, but easy to misread when hand-wiring). Answer: ____

## Blocks validation

- [x] **Video-to-data sync.** Decided: press the calibrate button with a result LED in camera frame (firmware logs a marker), plus a fixed rep script with rep numbers said aloud as a cross-check. Recorded in `CLAUDE.md`.
- [x] **Labeling protocol.** Decided: the team labels the video themselves, ideally a teammate who didn't perform that session, from the video and not the script, without seeing the system's output. Recorded in `CLAUDE.md`.
- [ ] **Full-length I2C test.** With the Arduino on the table, the bus runs about 2 m (table → chest → wrist). Test it early at full length; drop to 50 kHz if a sensor drops out. Answer: ____
- [ ] **Ask the client (Waterloo CCARE)** what real stroke compensation looks like, ideally with example videos, so scripted leaned reps resemble it. Answer: ____
- [ ] **Testers and rep count.** Which teammates and friends are subjects, and how many reps each? The 90% over about 60 reps placeholder assumes at least 3 testers. Answer: ____
- [ ] **Success threshold.** Settle the agreement target after the first recordings, together as a team. Placeholder: about 90% over about 60 reps. Answer: ____
- [ ] **Buttons as rep segmentation.** Use home-release and target-press as rep onset/end, with the wrist IMU as a cross-check? This amends "wrist IMU only segments reps". Answer: ____

## Blocks the demo

- [ ] **Arm's-length rule in the demo.** Decide how the target board is moved to the right distance for each person: a sliding board with a ruler, or marked positions on the table. Answer: ____

## Blocks the report and schedule

- [ ] **Course requirements.** The real deadline, the required deliverables (report, demo date), and any consent or approval rule for testers outside the team (friends) and for judges trying the device. Answer: ____
- [ ] **Team roles.** Who owns firmware, signal processing, dashboard and storage, and mounting and testing? Answer: ____
- [ ] **GitHub access.** All four teammates added as collaborators. Answer: ____

## Can wait

- [ ] **Multi-target sequence (week 3).** The four target buttons are already in the hardware; cycling through them is firmware-only. Side targets change the arm's-length rule, since it applies per direction. Answer: ____
