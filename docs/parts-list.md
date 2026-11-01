# Bill of materials

Already bought (friend): 2× MPU-6050 (GY-521 style breakouts), chest strap, wrist strap, push buttons.

Stock and part numbers at Sayal were not checked. Ask at the counter for the spec if an exact item isn't on the shelf. Prices are rough CAD estimates.

## Board choice

**Recommended: Raspberry Pi Pico 2 H.** It runs at 3.3 V like the MPU-6050, so there is no level-shifting question. It is also cheaper and smaller for the chest box. Program it in the Arduino IDE with the arduino-pico board package.

**Alternative: Arduino UNO R4 Minima.** It has more beginner tutorials, but it uses 5 V logic, so add a level shifter (row U2) to keep the I2C lines in spec.

## Essential

| # | Item | Spec | Qty | ≈ CAD |
|---|---|---|---|---|
| 1 | Microcontroller | Raspberry Pi Pico 2 H (pre-soldered headers) | 1 | $9 |
| 2 | USB cable | Micro-USB to your laptop's port, **data** cable, about 2 m | 1 | $8 |
| 3 | Spare IMU | MPU-6050 (GY-521), same as the two already bought | 1 | $6 |
| 4 | Breadboard | Solderless, full size (830 tie points) | 1 | $10 |
| 5 | Jumper wires, male-male | Pack of about 40 | 1 | $5 |
| 6 | Jumper wires, male-female | Pack of about 40 | 1 | $5 |
| 7 | LEDs | 5 mm, red and green | 5 each | $2 |
| 8 | LED resistors | 330 Ω, 1/4 W | 10 | $1 |
| 9 | Buzzer | **Active** piezo buzzer, 5 V | 2 | $4 |
| 10 | Transistor for buzzer | NPN, 2N3904 or 2N2222 | 2 | $1 |
| 11 | Base resistor | 1 kΩ, 1/4 W | 5 | $1 |
| 12 | Wrist cable | 4-conductor stranded, 22–26 AWG, 1 m (cut to about 70–80 cm when fitting) | 1 | $5 |
| 13 | Perfboard | About 5 × 7 cm | 2 | $4 |
| 14 | Male header pins | 40-pin breakaway | 2 | $3 |
| 15 | Female header strip | 40-pin breakaway (IMU and wrist cable plug in and out) | 1 | $2 |
| 16 | Heat shrink | Small assortment | 1 | $6 |
| 17 | Hookup wire | 22 AWG solid, 2–3 colours | 1 small roll each | $6 |
| 18 | Zip ties | Small pack | 1 | $3 |
| 19 | Velcro cable ties | Small pack (route the wrist cable along the forearm) | 1 | $5 |

Total about $85.

## Only if you choose the UNO R4 Minima

| # | Item | Change |
|---|---|---|
| U1 | USB cable | USB-C instead of micro-USB (row 2) |
| U2 | Level shifter | 4-channel bidirectional, BSS138 type, for SDA and SCL (about $4) |
| U3 | LED resistors | 1 kΩ instead of 330 Ω (row 8); the R4 pins supply only about 8 mA |

## Optional

| Item | Why |
|---|---|
| 4-pin connector pair (JST-XH or similar) | Makes the wrist cable detachable, so a judge can put the device on faster. |
| Adhesive Velcro dots or double-sided foam tape | Holds the wrist sensor case firmly on the strap. |
| Solder, flux, solder wick | Only if your lab or makerspace doesn't supply them. |

## Not needed

- **Pull-up resistors:** each GY-521 breakout has them on board. Two in parallel is fine. The buttons use the board's internal pull-ups.
- **A power bank or regulator:** the laptop powers everything over USB.
- **A soldering iron or multimeter:** use the course lab or a campus makerspace.
- **A BNO085:** it is better at full orientation, but pitch and roll from an MPU-6050 with a complementary filter is enough for this project.
- **An I2C extender (P82B715, PCA9615):** only if the wrist cable proves unreliable at 100 kHz.

## Wiring rules

- **Addresses:** tie AD0 to ground on the trunk IMU (0x68) and to **3.3 V** on the wrist IMU (0x69). Never tie AD0 to 5 V.
- **I2C speed:** run at 100 kHz, the Wire default. Drop to 50 kHz if the wrist sensor drops out.
- **Wrist cable order:** keep SDA and SCL apart, e.g. SDA, GND, SCL, VCC, so they don't couple into each other.
- **First test on the bench:** run an I2C scanner and read each IMU's WHO_AM_I register (0x75, expected 0x68) before writing anything else. Many cheap MPU-6050 boards carry clone chips that report a different ID, and some libraries refuse them.
