# Schematic review: `imu-reach-tracker-schematic.pdf`

Reviewed 2026-11-05 from a high-resolution render of the PDF ("IMU Reach Tracker", Group 19). Every connection was traced. Overall the circuit is correct: one issue depends on which buttons were bought, and the rest are cleanups.

## Issue: arcade button LEDs have no current-limiting resistor

**Severity:** could damage parts, depending on the buttons.

Each button LED (SW1–SW4) has its anode straight on 5V and its cathode on the transistor (Q1–Q4), with nothing limiting the current.

| Button LED type | Result as drawn | Fix |
|---|---|---|
| 5 V LED with a built-in resistor (common in arcade buttons) | Fine | None |
| Bare LED | Too much current; LED burns out | Add ~150–220 Ω in series with each LED |
| 12 V LED | Very dim at 5 V | Use 5 V buttons, or accept dim LEDs |

**Action:** check the listing for the buttons the teammate bought before wiring them. Tracked in `docs/confirmations.md`.

## Cleanups (circuit works without them)

1. **No base pull-downs on Q1–Q5.** While the Arduino resets, its pins float, so the buzzer can chirp and target LEDs can flicker. Add a 10 kΩ resistor from each transistor's base to GND. The resistors are already in the Digi-Key cart.
2. **No connector symbols for the cables.** The IMUs and buttons are drawn wired directly to the board. Add connectors for the table → chest cable, the chest → wrist cable and the button leads, so the harness is documented for the final build.
3. **Buzzer − wire crosses the 5V line.** There's no junction dot, so they aren't connected and it's electrically fine, but someone wiring by hand could join them by mistake. Reroute one of the wires.
4. **IMU VCC is on 5V.** Correct only if each GY-521 has its on-board regulator (small 3-pin chip, often marked 662K). **Confirmed:** ours do (3.3–5 V input), so 5V is right.

## Verified correct

- **Power:** 5V feeds the shifter's HV side, both IMUs' VCC, the buzzer + and the button LED anodes. 3V3 feeds the shifter's LV side and the chest IMU's AD0.
- **I2C:** Arduino SDA (A4) → B1 and SCL (A5) → B2; A1 → both IMUs' SDA, A2 → both IMUs' SCL. Both shifter grounds tied to the common GND.
- **Addresses:** chest IMU (U1) AD0 on 3V3 → 0x69; wrist IMU (U2) AD0 unconnected → 0x68. (Superseded 2026-11-18: swapped to wrist (U2) 0x69, chest (U1) 0x68, with the shifter on the wrist board.)
- **Buttons:** SW1 Home → D2, SW2 Green → D3, SW3 Blue → D4, SW4 Red → D5, SW5 START → D6 (its LED pins are not connected); other side to GND, for `INPUT_PULLUP`. (Superseded 2026-11-19: START D2, Home D3, Green D4, Blue D5, Red D6; button LEDs D10–D13; buzzer D9.)
- **No short between SW1 and SW2:** the 5V junction and the D3 wire sit almost on the same row, but there's a clear gap at full zoom.
- **Buzzer diode (D1):** cathode on the buzzer + / 5V side, the correct direction.
- **Result LEDs (D2, D3):** removed 2026-11-19. The buzzer is the only feedback; Arduino D7/D8 are now the unused pins.
- **Transistors (Q1–Q5):** base through 1 kΩ (R1–R5), emitter to GND, collector to the correct load label.
