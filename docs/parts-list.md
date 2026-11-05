# Bill of materials

Matches the team's KiCad schematic (`docs/imu-reach-tracker-schematic.pdf`, "IMU Reach Tracker"). Board: **Arduino UNO R4 Minima** (5 V logic, 8 mA per pin). Prices are CAD from Digi-Key product pages and the team's cart (checked 2026-11-01 to 2026-11-05); confirm at checkout. Orders of $100 CAD or more ship free, usually next day.

## Teammate (bought)

| Item | Schematic | Status |
|---|---|---|
| 2× MPU-6050 (GY-521) | U1 chest, U2 wrist | Bought |
| Chest strap / harness | — | Bought |
| Wrist / forearm strap (Velcro) | — | Bought |
| 5× 30 mm arcade buttons, 4 with built-in LEDs | SW1–SW5 | **Confirm** these are what was bought, and the LEDs' rated voltage (see `docs/confirmations.md`) |
| 1× spare MPU-6050, same listing as the first two | — | To buy (≈ $6), Canada Robotix |

## Digi-Key order

### Prototyping (in the cart)

| Item | Schematic | Digi-Key part number | Qty | ≈ CAD |
|---|---|---|---|---|
| Arduino UNO R4 Minima | A1 | [1050-ABX00080-ND](https://www.digikey.ca/en/products/detail/arduino/ABX00080/20371542) | 1 | $29.70 |
| Level shifter, BSS138 4-channel (Adafruit 757) | U3 | [1528-1007-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/757/4990756) | 2 (1 spare) | $11.74 |
| Breadboard, full size 830 (Adafruit 239) | — | [1528-239-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/239/7244929) | 1 | $9.42 |
| Jumpers male-male, 40 × 150 mm (Adafruit 758) | — | [1528-1154-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/758/5353614) | 1 (40 wires) | $5.87 |
| Jumpers male-female, 40 × 150 mm (Adafruit 826) | — | [1528-826-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/826/5353622) | 1 (40 wires) | $5.87 |
| Red LED, 5 mm diffused (Kingbright WP7113ID) | D3 | [754-1264-ND](https://www.digikey.ca/en/products/detail/kingbright/WP7113ID/1747663) | 10 | $2.30 |
| Green LED, 5 mm diffused (Kingbright WP7113GD) | D2 | [754-1263-ND](https://www.digikey.ca/en/products/detail/kingbright/WP7113GD/1747662) | 10 | $2.44 |
| 1 kΩ resistor, 1/4 W (Stackpole CF14JT1K00) | R1–R7 | [CF14JT1K00CT-ND](https://www.digikey.ca/en/products/detail/stackpole-electronics-inc/CF14JT1K00/1741314) | 15 | $0.65 |
| Active buzzer, 5 V, 30 mA (Same Sky CMI-1295-0585T) | BZ1 | [102-CMI-1295-0585T-ND](https://www.digikey.ca/en/products/detail/cui-devices/CMI-1295-0585T/10326184) | 2 | $6.58 |
| NPN transistor (onsemi 2N3904BU) | Q1–Q5 | [2N3904FS-ND](https://www.digikey.ca/en/products/detail/onsemi/2N3904BU/1413) | 10 | $2.83 |
| Diode (onsemi 1N4148) | D1 | 1N4148FS-ND | 10 | $0.89 |
| Male header, 36-pin, 10-pack (Adafruit 392) | — | [1528-392-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/392/21283800) | 1 | $7.35 |

Subtotal: $85.64.

### Add to the cart

| Item | Why | Digi-Key part number | Qty | ≈ CAD |
|---|---|---|---|---|
| 10 kΩ resistor, 1/4 W (Stackpole CF14JT10K0) | Base pull-down on Q1–Q5, so the buzzer doesn't chirp and target LEDs don't flicker at reset. Not in the schematic yet | [CF14JT10K0](https://www.digikey.ca/en/products/detail/stackpole-electronics-inc/CF14JT10K0/1741265) | 10 | ~$0.60 |
| 4-wire silicone ribbon cable, 26 AWG, 1 m (Adafruit 3892) | One for table unit → chest box, one for chest box → wrist. Low stock; if gone, Adafruit 3889 is the same cable in 30 AWG | [1528-2695-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/3892/9603618) | 2 | ~$5.80 |
| Heat shrink kit, ~280 pieces (Adafruit 4559) | Insulates the cable joints | [1528-4559-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/4559/12396896) | 1 | $15.75 |

Running total: about $108, so shipping is free.

### Final build (add now or in a later order)

| Item | Why | Digi-Key part number | Qty | ≈ CAD |
|---|---|---|---|---|
| Perma-Proto half-size (Adafruit 571) | Solderable board with the breadboard's layout, for the table unit | [1528-1143-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/571/5353603) | 1 | $19.79 |
| Female header, 14-pin, 0.1" (Sullins PPTC141LFBN-RC) | IMUs, shifter and cables plug in and out. Replaces Adafruit 598, out of stock until Feb 2027 | [S7012-ND](https://www.digikey.ca/en/products/detail/sullins-connector-solutions/PPTC141LFBN-RC/810152) | 3 | $3.87 |
| Hookup wire, 22 AWG solid, 6 × 25 ft (Adafruit 1311) | Wiring on the Perma-Proto (optional; jumpers and resistor legs also work) | [1528-1743-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/1311/6198255) | 1 | $23.69 |

### Not from Digi-Key

- **USB-C data cable, about 2 m:** an existing phone cable that carries data, or about $10 locally. Digi-Key's cost $33–70.
- **Zip ties and Velcro cable ties:** dollar store or hardware store.
- **Small compartment organizer** for storing parts: dollar store, $3–8. Label the 1 kΩ and 10 kΩ resistors.
- **Chest box and table enclosure:** 3D-printed at a campus makerspace once the board size is known. Size the table unit for the Arduino and Perma-Proto, with the buttons mounted on the target board.

### Optional

| Item | Why |
|---|---|
| 4-pin connector pairs (JST-XH or similar) | Make the cables detachable, so a judge can put the device on faster. |
| Adhesive Velcro dots or double-sided foam tape | Holds the wrist sensor case firmly on the strap. |
| Solder (rosin-core, ~0.8 mm), solder wick, flush cutters | Only if your lab or makerspace doesn't supply them. |

## Not bought

- **Soldering iron, multimeter, heat gun:** course lab or makerspace.
- **Pull-up resistors:** each GY-521 has them on its 3.3 V side, the 757 has them on both sides, and buttons use `INPUT_PULLUP`.
- **Power bank or regulator:** the laptop powers everything over USB.

## Layout

- **Table unit:** Arduino, level shifter, Q1–Q5, buzzer, result LEDs, Perma-Proto. The five arcade buttons mount on the target board and wire back to it.
- **Chest box:** chest IMU (U1) on the sternum strap, plus the junction where the wrist cable continues.
- **Wrist:** wrist IMU (U2) on the forearm strap.
- **Cables:** table → chest about 1 m, chest → wrist about 70–80 cm, each 4 wires (VCC, GND, SDA, SCL). The USB cable stays on the table.

## Pin map (from the schematic)

| Arduino pin | Connects to |
|---|---|
| D2–D6 | SW1–SW5 buttons (other side to GND, `INPUT_PULLUP`). Confirm the exact order in KiCad |
| D7 | Q1 → Home button LED |
| D8 | Q2 → Green button LED |
| D9 | Q3 → Blue button LED |
| D10 | Q4 → Red button LED |
| D11 | Q5 → buzzer |
| D12 | Green result LED (clean rep) via 1 kΩ |
| D13 | Red result LED (compensated rep) via 1 kΩ; also lights the on-board LED |
| A4 / A5 (SDA / SCL) | Level shifter B1 / B2 |
| 5V | Shifter HV, buzzer +, button LED anodes, IMU VCC (if the GY-521 has a regulator) |
| 3V3 | Shifter LV, chest IMU AD0 |

## Wiring rules

- **IMU power:** if the GY-521 has an on-board regulator (small 3-pin chip, often marked 662K), power it from 5V. If not, from 3V3.
- **Level shifter:** HV to 5V, LV to 3V3, GND to GND. B side (HV) to the Arduino, A side (LV) to the IMUs.
- **Addresses:** chest IMU AD0 to **3V3** → 0x69. Wrist IMU AD0 unconnected → 0x68. Never put 5V on AD0.
- **I2C speed:** 100 kHz (the default). Total run is about 2 m, so drop to 50 kHz if a sensor drops out.
- **Cable wire order:** keep SDA and SCL apart, e.g. SDA, GND, SCL, VCC.
- **Transistor drivers (Q1–Q5):** pin → 1 kΩ → base, 10 kΩ base → GND, emitter → GND, collector → load (−), load (+) → 5V.
- **Buzzer:** 1N4148 across it, cathode (striped end) to 5V.
- **Arcade button LEDs:** if they are bare LEDs with no built-in resistor, add a ~150–220 Ω resistor in series with each.
- **Result LEDs:** pin → 1 kΩ → LED → GND.

## Soldering

- **Prototyping:** header pins on each MPU-6050 (8 joints each) and the level shifter (about 12). Push the pins into the breadboard to hold them straight while soldering.
- **Final build:** the circuit onto the Perma-Proto, both ends of both cables with heat shrink (16 joints), and leads on the arcade buttons. Photograph the working breadboard first, and check each connection with the multimeter's continuity beep.

## Bench test before building anything permanent

1. Upload Blink to confirm the board and USB cable.
2. Wire the wrist IMU (AD0 unconnected) through the shifter, run an I2C scanner, expect 0x68.
3. Read WHO_AM_I (register 0x75). Genuine = 0x68; clone chips report other IDs and some libraries refuse them.
4. Add the chest IMU (AD0 to 3V3), expect 0x68 and 0x69.
5. Repeat step 4 at full cable length (table → chest → wrist, about 2 m).
6. Test each button, each button LED, the buzzer and both result LEDs.
