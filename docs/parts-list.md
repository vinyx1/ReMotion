# Parts list (Sayal Electronics run)

Already bought (friend): 2× MPU-6050, chest strap, wrist strap, push buttons.

Stock and part numbers at Sayal were not checked. Ask at the counter for the spec if an exact item isn't on the shelf.

## Must get

| # | Item | Spec | Qty |
|---|---|---|---|
| 1 | Microcontroller | Arduino UNO R4 Minima. If out of stock: Raspberry Pi Pico 2 H (with headers) | 1 |
| 2 | USB cable | USB-C to whatever port your laptop has (USB-A or USB-C), **data** cable, about 2 m | 1 |
| 3 | Breadboard | Solderless, full size (830 tie points) | 1 |
| 4 | Jumper wires, male-male | Pack of about 40 | 1 pack |
| 5 | Jumper wires, male-female | Pack of about 40 (plug onto the MPU-6050 pins) | 1 pack |
| 6 | LEDs | 5 mm, red and green | 5 each |
| 7 | Resistors for LEDs | 1 kΩ, 1/4 W (keeps each LED under the UNO R4's 8 mA pin limit) | 10 |
| 8 | Buzzer | **Active** piezo buzzer, 5 V | 2 (1 spare) |
| 9 | Transistor for buzzer | NPN, 2N3904 or 2N2222 (the buzzer draws more than a pin can supply) | 2 |
| 10 | Base resistor for transistor | 1 kΩ, 1/4 W (covered by #7 if you buy 10+) | — |
| 11 | Wrist cable | 4-conductor stranded cable, 22–26 AWG, about 1.5 m (a bit extra for routing) | 1 |
| 12 | Perfboard | About 5 × 7 cm | 2 |
| 13 | Male header pins | 40-pin breakaway strip | 2 |
| 14 | Female header strip | 40-pin breakaway (lets the IMU and wrist cable plug in and out of the perfboard) | 1 |
| 15 | Heat shrink | Small assortment | 1 |
| 16 | Hookup wire | 22 AWG solid, 2–3 colours (perfboard wiring) | 1 small roll each |
| 17 | Zip ties | Small pack (strain relief on cables) | 1 |

## Optional

| Item | Why |
|---|---|
| 4-pin connector pair (JST-XH or similar) | Makes the wrist cable detachable, so a judge can put the device on faster. |
| Solder | Only if your lab or makerspace doesn't supply it. |

## Not needed

- Pull-up resistors: the MPU-6050 breakout has them on board, and the buttons use the board's internal pull-ups.
- Power bank: the laptop powers the board over USB.
- Soldering iron: use the course lab or a campus makerspace.
