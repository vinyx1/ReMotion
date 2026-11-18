# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary (the dashboard): a physiotherapist or occupational therapist** working with a stroke survivor between appointments. Their job is to see whether the patient is practising, whether their reaching is getting better, and whether they lean their trunk forward to compensate for limited arm movement. They read the dashboard after a session; it is not a live monitor.
- **The person wearing the device: a stroke survivor or older adult** doing a seated reaching exercise, ideally at home. They interact with the hardware (chest and wrist sensors, a button mat, a buzzer, result lights), not the dashboard.
- **Client:** CCCARE (Centre for Community, Clinical & Applied Research Excellence, Waterloo), through the ECE 198 course challenge: track and assess exercise quality and support at-home rehab.
- **Evaluators:** course staff and judges at the ECE 198 symposium demo (Wed Nov 25, 2026, Ideas Clinic), who will try the device themselves.

## Product Purpose

Clinical reaching assessments score *whether* a reach was completed, not *how*. A patient who leans their trunk forward to make up for a weak arm looks the same on the score sheet as one whose arm has recovered, and at home nobody is watching. Re:Motion measures how the reach was done: it flags reps where the trunk did the arm's work, gives the patient instant feedback (a buzzer while leaning, a green or red light after each rep), and logs every rep so a therapist can follow progress over time.

Success for the prototype: one exercise (the seated reach) detected reliably, with the device's clean/compensated label agreeing with a side-view video label. The agreement target is a placeholder (~90% over ~60 reps from 3+ testers) until the first recordings.

## Positioning

It measures the quality of the reach, not just its completion, with two inexpensive wearable motion sensors (chest and wrist), a button mat that times each reach, and a simple, explainable rule (trunk tilt past a threshold for at least 200 ms) rather than a camera or a machine-learning model. The whole build is about $150 and runs from a laptop's USB port.

## Operating Context

- **Session:** the patient wears a chest harness (trunk sensor on the sternum) and a wrist brace, sits upright facing a button mat (HOME plus GREEN, BLUE and RED targets at about 40%, 70% and 100% of comfortable reach), presses START (yellow), holds still for a 3 s calibration, then reaches from HOME to whichever target lights up, about 10 reps.
- **Data:** the Arduino streams every sample (100 Hz) and every rep over USB; a laptop logger saves CSVs; the dashboard is built from those files after the session.
- **Validation:** testers do scripted clean and leaned reps while a phone films from the side; a teammate who did not perform labels the video blind; device and video labels are compared.
- **Demo:** a judge straps on the sensors, does about 5 reaches, hears the beep when they lean, then sees their session on the dashboard. A pre-recorded session is the fallback.

## Capabilities and Constraints

- Detects forward and sideways trunk lean (angle from a calibrated upright position). **Does not detect trunk twisting.** Sensors give angles, not hand position or distance.
- Per rep: reaction time, reach time, peak trunk lean, wrist movement bursts (a rough smoothness measure), clean/compensated.
- The lean threshold defaults to **10°**, a tuning value only: the literature has no validated degree cutoff. It can be changed over serial.
- Hardware: Arduino UNO R4 Minima, 2× MPU-6050 (GY-521), a level shifter, 5 arcade buttons (4 lit; START unlit), buzzer, result LEDs.
- Software: firmware in C++; Python logger and data export; dashboard in React + TypeScript + Tailwind v4. Post-session only; no live streaming to the dashboard.
- Out of scope: ML, wireless, trunk rotation, multiple exercises, real patient data.
- **Undecided:** where a public-facing page would live (inside `software/web/` or separately).

## Brand Commitments

- **Name: Re:Motion** (with the colon). "IMU Reach Tracker" is the technical/course description (schematic, firmware); the GitHub repo is `vinyx1/ReMotion` only because repo names can't contain a colon.
- ECE 198, University of Waterloo, Group 19.

## Evidence on Hand

- **Research backing** (summarised in `docs/research/stroke-compensations.md`, with full references):
  - Gabler et al. 2026, arXiv:2604.12591 (**preprint, not peer reviewed; abstract only read**): two IMUs on the wrist and trunk detected compensatory trunk movements (Macro-F1 0.80, ROC-AUC > 0.93) in 10 able-bodied people with simulated impairment; lower (ROC-AUC ~0.78) in 4 people with neurological conditions. The closest match to this hardware; note it uses ML, not a threshold.
  - Ranganathan et al. 2017: a two-sensor wearable classifier reached about 90% accuracy against motion capture (19 healthy adults).
  - Seo et al. 2024: a single wrist IMU monitored task quality for 19 stroke survivors at home against therapist video labels (92% accuracy).
  - Foreman & Engsberg 2020: healthy trunk flexion ~0.4° at arm's length vs ~18.7° at +20 cm beyond it, the basis for the arm's-length setup rule.
  - Cirstea & Levin 2000; Levin et al. 2002: trunk compensation during reaching after stroke is well established.
- KiCad schematic: `docs/imu-reach-tracker-schematic.pdf`, `docs/images/schematic.png`.
- Working firmware (compiles in CI); hardware wired, being soldered (Nov 18).
- **Absences that must not be fabricated:** no real recordings yet; no validation/agreement number yet; no patient testing (testers are team members and possibly friends, for ethics reasons); no clinical validation; no testimonials, endorsements, or user counts. Everything currently on the dashboard is **simulated** and must stay labelled so.

## Product Principles

1. **How, not whether.** Every surface leads with the quality of the movement (did the trunk lean?), not completion counts.
2. **Honest about evidence.** It is a student prototype. Claims cite the research for what is possible and our own measured numbers for what we achieved; never imply clinical use, patient testing, or a result we haven't measured. Simulated data is always labelled.
3. **Explainable over clever.** A threshold a therapist can read and change beats an opaque score; show the angle, the limit, and why a rep was flagged.
4. **Built for the therapist's question:** "Is this person improving, and are they compensating?" Progress across sessions matters more than any single session.
5. **Clean vs compensated is never colour alone:** always paired with a label, icon or shape.

## Accessibility & Inclusion

- Results must be distinguishable without colour (see principle 5); the dashboard already pairs colour with icons and shapes.
- Patients may have limited arm and hand function and some may be older; anything a patient touches (the hardware) favours large targets and simple, audible feedback. Strapping on the harness one-handed is a known difficulty.
- Target WCAG 2.2 AA for web surfaces.
