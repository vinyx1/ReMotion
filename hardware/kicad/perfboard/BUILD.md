# Perfboard build sheet

Three boards, generated from the schematic by `make_perfboards.py`. Open the `.kicad_pcb` files in KiCad to inspect them, or print the PDFs.

| Board | Where it goes | Board stock | Files |
|---|---|---|---|
| Mat driver | On the button mat, next to the Arduino | 5×7 cm, 18×24 holes | `driver.kicad_pcb`, `driver-top.pdf`, `driver-bottom.pdf` |
| Wrist IMU + level shifter | Wrist box on the forearm strap | 2×8 cm, cut to 8×16 holes | `wrist.kicad_pcb`, `wrist-top.pdf`, `wrist-bottom.pdf` |
| Chest IMU | Chest box on the harness | 2×8 cm, cut to 8×8 holes | `chest.kicad_pcb`, `chest-top.pdf`, `chest-bottom.pdf` |

**Coordinates:** a hole is written as row letter + column number, e.g. `J10` = row J, column 10. Arduino pins are always written "Arduino D10" so they can't be confused with holes.

**How to use the prints:** print at 100 % scale (no "fit to page") and lay the board on the print to check it lines up.
- `*-top.pdf` is the component side: where each part goes.
- `*-bottom.pdf` is **mirrored**. It is what you see when you flip the board over to solder. Each thick black line is a solder trail or a bare wire on the bottom. Every line is straight across or straight down, and nothing crosses.

## Decisions baked into this layout

- **Cable chain is mat → wrist → chest.** The level shifter sits on the wrist board, which is the first board in the chain, so both IMUs are on its 3.3 V side.
- **Addresses: wrist 0x69, chest 0x68.** The wrist IMU's AD0 is tied to 3V3 on the wrist board, where 3V3 already arrives for the shifter. The chest AD0 is left unconnected, so the chest cable is a plain 4-wire cable. The firmware uses these addresses.
- **The mat → wrist cable has 5 wires:** SDA and SCL (5 V side), 5V, GND, and 3V3 for the shifter's LV side.
- **The Arduino is not soldered.** It sits on the mat. Solder one end of a jumper wire into each Arduino pad on the driver board and plug the other end into the Arduino's header, so the Arduino can be lifted out.
- **The driver board holds everything else on the mat:** Q1–Q5, base resistors, and the buzzer + flyback diode. There are no result LEDs; the buzzer is the only feedback.
- **Arcade button switch wires go straight to the Arduino:** START D2, HOME D3, GREEN D4, BLUE D5, RED D6. They don't pass through the board. The shared switch GND lands on the board.
- **Not included:** the recommended 10 kΩ base pull-downs. They're not in the schematic yet. Ask before adding them, and if you want them, add them before soldering.

## Check before you solder

1. **Count your holes.** The driver layout assumes 18×24 holes. If your 5×7 board differs, tell Claude, or re-run the script with new `cols`/`rows`.
2. **GY-521 orientation.** The IMU sockets put **VCC on the right** (column 8) and INT on the left (column 1). With the chip side facing up, the module should lie over the board. If your module's pin labels read the other way, plug it so the labels match the socket labels (the module then hangs off the edge instead). That's fine.
3. **Level shifter orientation** (wrist board). The 757 is turned around compared with its silkscreen: its **LV and HV pins face the IMU** (row J) and its **GND pins face the bottom edge** (row O). The LV/A side goes in column 2, the HV/B side in column 6. Match the labels printed on the 757 to the top print before soldering the headers.
4. **Female headers.** Cutting a 14-pin strip costs one pin at the cut. Strip 1 → 8 pins (chest socket). Strip 2 → 8 pins (wrist socket). Strip 3 → 6 + 6 (level shifter, wrist board).

## Mat driver board

**Part placement and orientation**

| Part | Holes | Orientation |
|---|---|---|
| R1–R5 (1 kΩ) | rows I, L, O, R, U, columns 2 → 6 | Either way |
| Q1–Q5 (2N3904) | rows J, M, P, S, V, columns 7-8-9 | **Flat face toward the bottom of the board.** Then E is column 7, B column 8, C column 9 |
| BZ1 buzzer | + at O15, − at O12 | **+ pin to O15** |
| D1 1N4148 | R12 (anode) – R15 (cathode) | **Stripe at R15** (the +5V side) |

Rows A, B, W and X are empty.

**Wire landing pads**

| To | Hole | Signal |
|---|---|---|
| Arduino 3V3 | C1 | 3.3 V, passed through to the wrist board |
| Arduino GND | D1 | GND (top section) |
| Arduino SCL | E1 | |
| Arduino SDA | F1 | |
| Arduino 5V | G1 | 5 V |
| Arduino D10 | I1 | HOME LED driver |
| Arduino GND | J1 | GND (driver section). **Use a second Arduino GND pin.** The two GND pads are not joined on the board |
| Arduino D11 | L1 | GREEN LED driver |
| Arduino D12 | O1 | BLUE LED driver |
| Arduino D13 | R1 | RED LED driver |
| Arduino D9 | U1 | Buzzer driver |
| Wrist cable 3V3 | C18 | |
| Wrist cable GND | D18 | |
| Wrist cable SCL | E18 | |
| Wrist cable SDA | F18 | |
| Wrist cable VCC | H18 | 5 V |
| Button LEDs + (all 4, chained on the mat) | I11 | 5 V |
| HOME LED − | J10 | |
| Button switch GND (all 5, chained on the mat) | K11 | GND |
| GREEN LED − | M10 | |
| BLUE LED − | P10 | |
| RED LED − | S10 | |

## Wrist board (IMU + level shifter)

| Part / wire | Holes |
|---|---|
| Cable to chest | **Row A:** SDA A5, SCL A6, GND A7, 5V A8 |
| GY-521 socket (8-pin female header) | **Row B:** B1 INT … B8 VCC. AD0 (B2) is tied to 3V3 on the bottom |
| 757 LV / A side (6-pin female header) | **Column 2, rows J–O:** J2 LV, K2 A1, L2 A2, M2 A3, N2 A4, O2 GND |
| 757 HV / B side (6-pin female header) | **Column 6, rows J–O:** J6 HV, K6 B1, L6 B2, M6 B3, N6 B4, O6 GND |
| Cable from mat | 3V3 **J1** (left edge), 5V **J8**, SDA **K8**, SCL **L8**, GND **O8** (right edge) |

On the prints, the chest-cable pads are labelled `c…` and the mat-cable pads `m…`. Row P is empty; it leaves room for the 757's board edge.

## Chest board

- GY-521 socket in row A: A1 INT … A8 VCC. AD0 is left unconnected (address 0x68).
- **From wrist** (row H): SDA H5, SCL H6, GND H7, VCC H8.

## Cables

| Cable | Wires | Mat end | Far end |
|---|---|---|---|
| Mat → wrist | 4-wire flat cable + 1 extra wire | SDA F18, GND D18, SCL E18, VCC H18; extra wire 3V3 C18 | SDA K8, GND O8, SCL L8, VCC J8; extra wire 3V3 J1 |
| Wrist → chest | 4-wire flat cable | Wrist: SDA A5, SCL A6, GND A7, VCC A8 | Chest: SDA H5, SCL H6, GND H7, VCC H8 |

**Conductor order:** keep the recommended order SDA, GND, SCL, VCC along the flat cable, so GND sits between the two data lines. At the boards the pads are in a different order, so the conductors cross over in the last centimetre. That's fine, since they're insulated.

**Mark VCC and 3V3** at both ends of the mat → wrist cable before you solder. Swapping them would put 5 V on the shifter's 3.3 V side and on the wrist IMU's AD0.

## Test before powering up (multimeter, continuity mode)

1. **5V to GND must NOT beep.** Check G1 to D1 on the mat board, J8 to O8 on the wrist board, and H8 to H7 on the chest board.
2. **3V3 to 5V must NOT beep.** Check C1 to G1 on the mat board, and J1 to J8 on the wrist board.
3. **Each wire beeps through to where it should go.** For example: mat E1 → wrist L8 → the 757's B2 pin (L6); wrist A5 → the SDA pin of both IMU sockets.
4. **Plug in the modules only after these pass.** Then run `firmware/tests/i2c_scanner`: expect 0x68 (chest) and 0x69 (wrist).

## Regenerating

```
python3 make_perfboards.py
```

The script reads the schematic's netlist, so if the schematic changes the pad nets follow automatically. It exits non-zero if KiCad's DRC finds any short or unconnected pad.
