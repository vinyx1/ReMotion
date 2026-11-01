# Bill of materials

Board: **Arduino UNO R4 Minima** (5 V logic). Prices are rough CAD estimates. Store stock and part numbers were not checked; if an exact item isn't available, match the spec.

## Teammate

| Item | Status |
|---|---|
| 2× MPU-6050 (GY-521 style) | Bought |
| Chest strap / harness | Bought |
| Wrist / forearm strap (Velcro) | Bought |
| Push buttons | Bought |
| **1× spare MPU-6050**, same listing as the first two | To buy (≈ $6), so the spare is the same board |

## Phase 1: prototyping (weeks 1–3)

Everything on a breadboard. The only soldering is header pins onto the IMUs and the level shifter.

| # | Item | Spec | Why it works | Qty | ≈ CAD |
|---|---|---|---|---|---|
| 1 | Microcontroller | Arduino UNO R4 Minima (genuine, ABX00080) | Official board; 5 V, 8 mA per pin, USB-C | 1 | $30 |
| 2 | USB cable | USB-C to your laptop's port (USB-A or USB-C), **data** cable, about 2 m | The R4 Minima uses USB-C. Charge-only cables won't upload code | 1 | $10 |
| 3 | Level shifter | 4-channel bidirectional, **BSS138** type (e.g. Adafruit 757, SparkFun BOB-12009, or a generic equivalent) | The standard I2C 5 V ↔ 3.3 V shifter; uses 2 of its 4 channels | 1 | $4 |
| 4 | Breadboard | Solderless, full size (830 tie points) | — | 1 | $10 |
| 5 | Jumper wires, male-male | Pack of about 40 | Arduino and breadboard both have female sockets | 1 | $5 |
| 6 | Jumper wires, male-female | Pack of about 40 | Plug onto the MPU-6050 and shifter pins | 1 | $5 |
| 7 | LEDs | 5 mm, red and green | — | 5 each | $2 |
| 8 | Resistors | 1 kΩ, 1/4 W | LEDs at about 3 mA and transistor base at about 4 mA, both under the 8 mA pin limit | 15 | $1 |
| 9 | Buzzer | **Active** piezo buzzer, 5 V | Runs from the Arduino's 5 V pin; beeps when switched on, no tone code | 2 | $4 |
| 10 | Transistor | NPN, 2N3904 or 2N2222 | Switches the buzzer so its current doesn't come from a pin | 2 | $1 |
| 11 | Male header pins | 40-pin breakaway | Soldered onto the IMUs and shifter if they ship with loose pins | 2 | $3 |

Phase 1 total: about $75, plus the teammate's spare MPU-6050.

During testing the wrist IMU connects with chained male-female jumpers. If it drops out, buy and make the real wrist cable (Phase 2, row 3) early.

## Phase 2: final build (weeks 3–4)

The working breadboard circuit is copied onto a soldered board and put in the chest box, so it survives being worn.

| # | Item | Spec | Why | Qty | ≈ CAD |
|---|---|---|---|---|---|
| 1 | Perfboard | About 5 × 7 cm. A solderable breadboard (e.g. Adafruit Perma-Proto, half size) is easier: same layout as the breadboard, copied hole for hole | Permanent circuit board for the chest box | 2 | $4–8 |
| 2 | Female header strip | 40-pin breakaway | IMU, shifter and wrist cable plug in and out | 1 | $2 |
| 3 | Wrist cable | 4-conductor stranded, 22–26 AWG, 1 m (cut to about 70–80 cm when fitting) | Short enough for I2C at 100 kHz | 1 | $5 |
| 4 | Heat shrink | Small assortment | Insulates the wrist cable joints | 1 | $6 |
| 5 | Hookup wire | 22 AWG solid, 2–3 colours | Connections on the board | 1 small roll each | $6 |
| 6 | Zip ties | Small pack | Strain relief at each connector | 1 | $3 |
| 7 | Velcro cable ties | Small pack | Route the wrist cable along the forearm | 1 | $5 |
| 8 | Chest box | 3D-printed at a campus makerspace, sized to the finished board | Protects the electronics on the chest strap | 1 | $5–10 |

Phase 2 total: about $35–45.

### Optional

| Item | Why |
|---|---|
| 4-pin connector pair (JST-XH or similar) | Makes the wrist cable detachable, so a judge can put the device on faster. |
| Adhesive Velcro dots or double-sided foam tape | Holds the wrist sensor case firmly on the strap. |
| Solder (rosin-core, ~0.8 mm), solder wick, flush cutters | Only if your lab or makerspace doesn't supply them. |

## Not bought

- **Soldering iron, multimeter, heat gun:** course lab or makerspace.
- **Pull-up resistors:** each GY-521 has them on its 3.3 V side, the BSS138 board has them on both sides, and buttons use `INPUT_PULLUP`.
- **Power bank or regulator:** the laptop powers everything over USB.

## Soldering

- **Phase 1:** header pins on each MPU-6050 (8 joints each) and the level shifter (about 12). Push the pins into the breadboard to hold them straight while soldering.
- **Phase 2:** the full circuit onto the perfboard (40–80 joints), both ends of the wrist cable with heat shrink (8), and button leads if the buttons sit outside the box. Photograph the working breadboard first, and check each connection with the multimeter's continuity beep.

## Wiring rules

- **IMU power:** if the breakout has an on-board regulator (a small 3-pin chip, often marked 662K, on GY-521 boards), power it from the Arduino's 5 V pin. If it has none, power it from the 3.3 V pin (two MPU-6050s draw only a few mA).
- **Level shifter:** HV to 5 V, LV to 3.3 V, GND to GND. Arduino SDA/SCL on the HV side, IMU SDA/SCL on the LV side.
- **Addresses:** AD0 to GND on the trunk IMU (0x68), AD0 to the Arduino's **3.3 V** pin on the wrist IMU (0x69). Never 5 V.
- **I2C speed:** 100 kHz (the default). Drop to 50 kHz if the wrist sensor drops out.
- **Wrist cable order:** keep SDA and SCL apart, e.g. SDA, GND, SCL, VCC.
- **Buzzer:** buzzer + to 5 V, buzzer − to the transistor's collector, emitter to GND, GPIO to the base through 1 kΩ.
- **LEDs:** GPIO → 1 kΩ → LED → GND.

## Bench test before building anything permanent

1. Upload Blink to confirm the board and USB cable.
2. Wire one IMU through the shifter, run an I2C scanner, expect 0x68.
3. Read WHO_AM_I (register 0x75). Genuine = 0x68; clone chips report other IDs and some libraries refuse them.
4. Add the second IMU (AD0 to 3.3 V), expect 0x68 and 0x69.
5. Repeat step 4 with the wrist IMU at full distance (chained jumpers, later the real cable).
6. Test the LED and buzzer circuits.
