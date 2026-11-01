# Bill of materials

Board: **Arduino UNO R4 Minima** (5 V logic). Prices are rough CAD estimates. Sayal stock and part numbers were not checked; ask at the counter for the spec if an exact item isn't on the shelf.

## Teammate

| Item | Status |
|---|---|
| 2× MPU-6050 (GY-521 style) | Bought |
| Chest strap / harness | Bought |
| Wrist / forearm strap (Velcro) | Bought |
| Push buttons | Bought |
| **1× spare MPU-6050**, same listing as the first two | To buy (≈ $6), so the spare is the same board |

## You (Sayal run)

| # | Item | Spec | Why it works | Qty | ≈ CAD |
|---|---|---|---|---|---|
| 1 | Microcontroller | Arduino UNO R4 Minima (genuine, ABX00080) | Official board; 5 V, 8 mA per pin, USB-C | 1 | $30 |
| 2 | USB cable | USB-C to your laptop's port (USB-A or USB-C), **data** cable, about 2 m | The R4 Minima uses USB-C. Charge-only cables won't upload code | 1 | $10 |
| 3 | Level shifter | 4-channel bidirectional, **BSS138** type (e.g. Adafruit 757 or SparkFun BOB-12009, or an equivalent generic) | This MOSFET design is the standard I2C 5 V ↔ 3.3 V shifter; uses 2 of its 4 channels | 1 | $4 |
| 4 | Breadboard | Solderless, full size (830 tie points) | Fits the UNO's jumpers and the shifter | 1 | $10 |
| 5 | Jumper wires, male-male | Pack of about 40 | UNO headers are female, breadboard is female | 1 | $5 |
| 6 | Jumper wires, male-female | Pack of about 40 | Plug onto the MPU-6050 and shifter pins | 1 | $5 |
| 7 | LEDs | 5 mm, red and green | — | 5 each | $2 |
| 8 | Resistors | 1 kΩ, 1/4 W | LEDs at about 3 mA and transistor base at about 4 mA, both under the 8 mA pin limit | 15 | $1 |
| 9 | Buzzer | **Active** piezo buzzer, 5 V | Runs from the Arduino's 5 V pin; beeps when switched on, no tone code | 2 | $4 |
| 10 | Transistor | NPN, 2N3904 or 2N2222 | Switches the buzzer so its current doesn't come from a pin | 2 | $1 |
| 11 | Wrist cable | 4-conductor stranded, 22–26 AWG, 1 m (cut to about 70–80 cm when fitting) | Short enough for I2C at 100 kHz | 1 | $5 |
| 12 | Perfboard | About 5 × 7 cm | Final build | 2 | $4 |
| 13 | Male header pins | 40-pin breakaway | — | 2 | $3 |
| 14 | Female header strip | 40-pin breakaway | IMU, shifter and wrist cable plug in and out | 1 | $2 |
| 15 | Heat shrink | Small assortment | — | 1 | $6 |
| 16 | Hookup wire | 22 AWG solid, 2–3 colours | Perfboard wiring | 1 small roll each | $6 |
| 17 | Zip ties | Small pack | Strain relief | 1 | $3 |
| 18 | Velcro cable ties | Small pack | Route the wrist cable along the forearm | 1 | $5 |

Your total: about $105. Teammate's remaining: about $6.

## Optional (either person)

| Item | Why |
|---|---|
| 4-pin connector pair (JST-XH or similar) | Makes the wrist cable detachable, so a judge can put the device on faster. |
| Adhesive Velcro dots or double-sided foam tape | Holds the wrist sensor case firmly on the strap. |
| Solder, flux, solder wick | Only if your lab or makerspace doesn't supply them. |

## Not bought

- **3D-printed chest box:** print at a campus makerspace once the perfboard layout is known.
- **Soldering iron, multimeter:** course lab or makerspace.
- **Pull-up resistors:** each GY-521 has them on its 3.3 V side, the BSS138 board has them on both sides, and buttons use `INPUT_PULLUP`.
- **Power bank or regulator:** the laptop powers everything over USB.

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
5. Repeat step 4 with the wrist IMU on the full-length cable.
6. Test the LED and buzzer circuits.
