# Bill of materials

Board: **Raspberry Pi Pico 2 WH** (3.3 V, matches the MPU-6050). Prices are rough CAD estimates. Sayal stock and part numbers were not checked; ask at the counter for the spec if an exact item isn't on the shelf.

## Teammate

| Item | Status |
|---|---|
| 2× MPU-6050 (GY-521 style) | Bought |
| Chest strap / harness | Bought |
| Wrist / forearm strap (Velcro) | Bought |
| Push buttons | Bought |
| **1× spare MPU-6050**, same listing as the first two | To buy (≈ $6), so the spare is the same board |

## You (Sayal run)

| # | Item | Spec | Qty | ≈ CAD |
|---|---|---|---|---|
| 1 | Microcontroller | Raspberry Pi Pico 2 WH (Pico 2 W, pre-soldered headers). If out of stock: Pico 2 W or Pico 2 H | 1 | $11 |
| 2 | USB cable | Micro-USB to your laptop's port (USB-A or USB-C), **data** cable, about 2 m | 1 | $8 |
| 3 | Breadboard | Solderless, full size (830 tie points) | 1 | $10 |
| 4 | Jumper wires, male-male | Pack of about 40 | 1 | $5 |
| 5 | Jumper wires, male-female | Pack of about 40 (plug onto the MPU-6050 pins) | 1 | $5 |
| 6 | LEDs | 5 mm, red and green | 5 each | $2 |
| 7 | LED resistors | 330 Ω, 1/4 W | 10 | $1 |
| 8 | Base resistors | 1 kΩ, 1/4 W | 5 | $1 |
| 9 | Buzzer | **Active** piezo buzzer, 5 V | 2 | $4 |
| 10 | Transistor | NPN, 2N3904 or 2N2222 | 2 | $1 |
| 11 | Wrist cable | 4-conductor stranded, 22–26 AWG, 1 m (cut to about 70–80 cm when fitting) | 1 | $5 |
| 12 | Perfboard | About 5 × 7 cm | 2 | $4 |
| 13 | Male header pins | 40-pin breakaway | 2 | $3 |
| 14 | Female header strip | 40-pin breakaway (IMU and wrist cable plug in and out) | 1 | $2 |
| 15 | Heat shrink | Small assortment | 1 | $6 |
| 16 | Hookup wire | 22 AWG solid, 2–3 colours | 1 small roll each | $6 |
| 17 | Zip ties | Small pack (strain relief) | 1 | $3 |
| 18 | Velcro cable ties | Small pack (route the wrist cable along the forearm) | 1 | $5 |

Your total: about $80. Teammate's remaining: about $6.

## Optional (either person)

| Item | Why |
|---|---|
| 4-pin connector pair (JST-XH or similar) | Makes the wrist cable detachable, so a judge can put the device on faster. |
| Adhesive Velcro dots or double-sided foam tape | Holds the wrist sensor case firmly on the strap. |
| Solder, flux, solder wick | Only if your lab or makerspace doesn't supply them. |

## Not bought

- **3D-printed chest box:** print at a campus makerspace once the perfboard layout is known.
- **Soldering iron, multimeter:** course lab or makerspace.
- **Pull-up resistors:** each GY-521 has them on board; buttons use the Pico's internal pull-ups.
- **Power bank or regulator:** the laptop powers everything over USB.
- **Level shifter:** not needed, since the Pico is 3.3 V.

## Wiring rules

- **Power the IMUs from the Pico's 3V3 pin.** The GY-521's regulator still passes enough voltage for the chip.
- **Addresses:** AD0 to ground on the trunk IMU (0x68), AD0 to 3V3 on the wrist IMU (0x69). Never 5 V.
- **I2C speed:** 100 kHz (the default). Drop to 50 kHz if the wrist sensor drops out.
- **Wrist cable order:** keep SDA and SCL apart, e.g. SDA, GND, SCL, VCC.
- **Buzzer:** powered from VBUS (5 V), switched by the transistor; GPIO drives the base through 1 kΩ.
- **First bench test:** I2C scanner, then read WHO_AM_I (register 0x75, genuine = 0x68) on both IMUs. Clone chips report other IDs and some libraries refuse them.
