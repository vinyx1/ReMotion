# Bill of materials

Matches the team's KiCad schematic (`docs/imu-reach-tracker-schematic.pdf`, "ReMotion"). Board: **Arduino UNO R4 Minima** (5 V logic, 8 mA per pin). Prices are CAD from Digi-Key product pages and the team's cart (checked 2026-11-01 to 2026-11-05); confirm at checkout. Orders of $100 CAD or more ship free, usually next day.

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
| Red LED, 5 mm diffused (Kingbright WP7113ID) | — (not used) | [754-1264-ND](https://www.digikey.ca/en/products/detail/kingbright/WP7113ID/1747663) | 10 | $2.30 |
| Green LED, 5 mm diffused (Kingbright WP7113GD) | — (not used) | [754-1263-ND](https://www.digikey.ca/en/products/detail/kingbright/WP7113GD/1747662) | 10 | $2.44 |
| 1 kΩ resistor, 1/4 W (Stackpole CF14JT1K00) | R1–R5 | [CF14JT1K00CT-ND](https://www.digikey.ca/en/products/detail/stackpole-electronics-inc/CF14JT1K00/1741314) | 15 | $0.65 |
| Active buzzer, 5 V, 30 mA (Same Sky CMI-1295-0585T) | BZ1 | [102-CMI-1295-0585T-ND](https://www.digikey.ca/en/products/detail/cui-devices/CMI-1295-0585T/10326184) | 2 | $6.58 |
| NPN transistor (onsemi 2N3904BU) | Q1–Q5 | [2N3904FS-ND](https://www.digikey.ca/en/products/detail/onsemi/2N3904BU/1413) | 10 | $2.83 |
| Diode (onsemi 1N4148) | D1 | 1N4148FS-ND | 10 | $0.89 |
| Male header, 36-pin, 10-pack (Adafruit 392) | — | [1528-392-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/392/21283800) | 1 | $7.35 |

Subtotal: $85.64.

### Add to the cart

| Item | Why | Digi-Key part number | Qty | ≈ CAD |
|---|---|---|---|---|
| 10 kΩ resistor, 1/4 W (Stackpole CF14JT10K0) | Base pull-down on Q1–Q5, so the buzzer doesn't chirp and target LEDs don't flicker at reset. Not in the schematic yet | [CF14JT10K0](https://www.digikey.ca/en/products/detail/stackpole-electronics-inc/CF14JT10K0/1741265) | 10 | ~$0.60 |
| 4-wire silicone ribbon cable, 26 AWG, 1 m (Adafruit 3892) | One for mat → wrist (plus one extra wire for 3V3), one for wrist → chest. Low stock; if gone, Adafruit 3889 is the same cable in 30 AWG | [1528-2695-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/3892/9603618) | 2 | ~$5.80 |
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

- **Button mat:** the Arduino (not soldered; jumper wires plug into its headers) plus the 5×7 cm driver perfboard (Q1–Q5, buzzer; replaces the Perma-Proto). The five arcade buttons mount on the mat and wire to it. Layout and wire map: `hardware/kicad/perfboard/BUILD.md`.
- **Wrist:** wrist IMU (U2) and the level shifter (U3) on one board, on the forearm strap.
- **Chest box:** chest IMU (U1) on the sternum strap, at the end of the chain.
- **Cables:** mat → wrist, 5 wires (SDA, SCL on the 5 V side, plus 5V, GND, 3V3); wrist → chest, 4 wires (VCC, GND, SDA, SCL on the 3.3 V side). The USB cable stays on the mat.

## Pin map (from the schematic)

| Arduino pin | Connects to |
|---|---|
| D2 | SW5 START (yellow) |
| D3–D6 | SW1 HOME, SW2 GREEN, SW3 BLUE, SW4 RED (other side to GND, `INPUT_PULLUP`) |
| D7, D8 | Not used |
| D9 | Q5 → buzzer |
| D10 | Q1 → Home button LED |
| D11 | Q2 → Green button LED |
| D12 | Q3 → Blue button LED |
| D13 | Q4 → Red button LED (the on-board LED follows it) |
| A4 / A5 (SDA / SCL) | Level shifter B1 / B2 |
| 5V | Shifter HV, buzzer +, button LED anodes, IMU VCC (the GY-521 regulator takes 3.3–5 V) |
| 3V3 | Shifter LV, wrist IMU AD0 (both on the wrist board) |

## Wiring rules

- **IMU power:** from 5V. Confirmed: our GY-521 boards have the on-board regulator (3.3–5 V input).
- **Level shifter:** HV to 5V, LV to 3V3, GND to GND. B side (HV) to the Arduino, A side (LV) to the IMUs.
- **Addresses:** wrist IMU AD0 to **3V3** → 0x69. Chest IMU AD0 unconnected → 0x68. Never put 5V on AD0.
- **I2C speed:** 100 kHz (the default). Total run is about 2 m, so drop to 50 kHz if a sensor drops out.
- **Cable wire order:** keep SDA and SCL apart, e.g. SDA, GND, SCL, VCC.
- **Transistor drivers (Q1–Q5):** pin → 1 kΩ → base, 10 kΩ base → GND, emitter → GND, collector → load (−), load (+) → 5V.
- **Buzzer:** 1N4148 across it, cathode (striped end) to 5V.
- **Arcade button LEDs:** if they are bare LEDs with no built-in resistor, add a ~150–220 Ω resistor in series with each.

## Soldering

- **Prototyping:** header pins on each MPU-6050 (8 joints each) and the level shifter (about 12). Push the pins into the breadboard to hold them straight while soldering.
- **Final build:** the circuit onto the Perma-Proto, both ends of both cables with heat shrink (16 joints), and leads on the arcade buttons. Photograph the working breadboard first, and check each connection with the multimeter's continuity beep.

## Bench test before building anything permanent

1. Upload Blink to confirm the board and USB cable.
2. Wire the chest IMU (AD0 unconnected) through the shifter, run an I2C scanner, expect 0x68.
3. Read WHO_AM_I (register 0x75). Genuine = 0x68; clone chips report other IDs and some libraries refuse them.
4. Add the wrist IMU (AD0 to 3V3), expect 0x68 and 0x69.
5. Repeat step 4 at full cable length (mat → wrist → chest).
6. Test each button, each button LED and the buzzer.
