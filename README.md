# IMU Reach Tracker (Re:Motion)

**ECE 198, University of Waterloo, Group 19**

A device that helps stroke survivors practise reaching, and notices when they **lean their body forward** to make up for limited arm movement.

## The problem

After a stroke, people often can't move their arm as far as before. To reach something, they lean their trunk forward to make up the distance. A therapist calls this *compensation*. It gets the job done, but it doesn't train the arm, and it can become a bad habit.

Rehab tests usually only check whether the person reached the target, not *how* they did it, and at home there's no therapist watching.

## How it works

1. The patient sits at a table and wears two small motion sensors: one on the **chest** and one on the **wrist**.
2. They sit up straight for 3 seconds so the device learns what "upright" looks like.
3. They rest their hand on the **HOME** button. One of three coloured target buttons lights up.
4. They reach out and press the lit button, then come back to HOME.
5. If their chest tilts more than 10° during the reach, a **buzzer** goes off.
6. After each reach, a **green light** means a good rep and a **red light** means they leaned.

Every rep is sent to a laptop, which records:
- how quickly they started moving
- how long the reach took
- how far they leaned

This way a therapist can see progress over time.

## Hardware

| Part | What it does |
|---|---|
| Arduino UNO R4 Minima | The brain: reads the sensors and buttons, controls the lights and buzzer |
| 2× MPU-6050 (GY-521) | Motion sensors: chest (tilt) and wrist (arm movement) |
| Adafruit 757 level shifter | Lets the 5 V Arduino talk safely to the 3.3 V sensors |
| 5× 30 mm arcade buttons | HOME, three targets (green, blue, red), and START |
| 5× 2N3904 transistors | Switch the button lights and buzzer, which need more current than an Arduino pin can give |
| Buzzer + red/green LEDs | Instant feedback for the patient |

## Schematic

![IMU Reach Tracker schematic](docs/images/schematic.png)

Full-resolution PDF: [`docs/imu-reach-tracker-schematic.pdf`](docs/imu-reach-tracker-schematic.pdf). KiCad source: [`hardware/kicad/`](hardware/kicad/).

**Reading the schematic:**
- **Top left:** the five arcade buttons, each wired to an Arduino pin (D2–D6).
- **Middle:** the Arduino, with the level shifter to its right.
- **Top right:** the two motion sensors. The chest sensor's AD0 pin is tied to 3.3 V, which gives it address 0x69, so it doesn't clash with the wrist sensor at 0x68.
- **Bottom:** the transistor switches for the four button lights and the buzzer, and the two result LEDs.

## What's in this repo

| Folder | Contents |
|---|---|
| `firmware/reach_tracker/` | The main Arduino program. **This is the one you upload to run the device.** |
| `firmware/tests/` | Small test programs for checking the wiring, one part at a time |
| `software/tools/` | Python: records data from the Arduino, and makes fake data for testing |
| `hardware/` | KiCad schematic and parts list |
| `data/sample/` | Example session recordings |
| `docs/` | Serial protocol, parts list, research notes |

## Running it

**Arduino**
1. Install the Arduino IDE, the **Arduino UNO R4 Boards** package, and the **Adafruit MPU6050** library.
2. Open `firmware/reach_tracker/reach_tracker.ino` and upload it to the board.
3. Press the yellow START button to begin a session.

**Laptop (optional, for recording)**
```bash
pip install -r requirements.txt
python -m software.tools.logger
```

## Limitations

- It can't detect **twisting** of the trunk, only leaning forward or sideways.
- It's a student prototype. It's tested on team members, not real patients, and the 10° limit still needs tuning by a clinician.
