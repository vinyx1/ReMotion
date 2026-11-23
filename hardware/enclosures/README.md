# IMU boxes (3D print)

Boxes for the two 40 x 60 mm IMU perfboards. Each is a tray, a snap-on lid and a mount; the mount screws to the tray floor.

| Box | Parts (`stl/`) | Mount | Wire holes |
|---|---|---|---|
| Chest | `chest_base`, `chest_lid`, `chest_gopro_mount` | GoPro two-prong mount: joins the harness's three-prong buckle with its thumbscrew | 1 (to the wrist box) |
| Wrist | `wrist_base`, `wrist_lid`, `wrist_strap_clip` | C-clip that slides onto the edge of the 50 mm outer strap wrap | 2 (from the mat, to the chest box) |

Outside size 68 x 48 x 21 mm per box (the mount adds about 20 mm on the chest and 8 mm on the wrist). The board gets 2 mm of play on every side and the lid posts stop 0.5 mm above it, so a slightly oversize board still fits; hot-glue it to the corner pads if it rattles.

**Sizes in SolidCraft:** open the Parameters panel; every size is listed there (view only). Press **I** (Measure) to measure anything else.

## Print

**Kingroon KP3S Pro, everything in one go:** open `stl/kp3s_pro_plate.3mf` in your slicer. It holds all six parts already laid out on the 200 x 200 mm bed (146 x 146 mm used, 10 mm apart, tallest part 30 mm), each as its own object so you can still move one. `stl/kp3s_pro_plate.stl` is the same plate as a single mesh. Suggested settings: PLA at 205 °C, bed 60 °C, 0.4 mm nozzle, 0.2 mm layers; add a 5 mm brim, since the strap clip stands on a narrow end.

- PLA or PETG, 0.2 mm layers, 3 walls, 20 % infill, **no supports**. The STLs already lie on their print faces: trays floor down, lids outer face down, the GoPro mount plate down, the strap clip standing on its end.
- **Test-fit before printing all six.** The lid snap (0.4 mm bump), the GoPro prong gap (3.3 mm) and the strap clip gap (2.6 mm for a 3 mm strap) depend on your printer. Change them at the top of `make_enclosures.py` and run `python3 make_enclosures.py` again; it rebuilds the STLs, the SolidCraft designs (`*.sc`) and the pictures.

## Hardware

- 4 x M3 x 6 mm pan-head screws (2 per mount), driven from inside the tray into the mount's 2.6 mm pilot holes. No screws? Glue the mount on with CA glue or epoxy instead.
- The GoPro thumbscrew that came with the harness.

## Assemble

1. Solder the 1 m wires to the board first. Lay them in the notch in the rim (the lid closes it into a hole) and put a dab of hot glue on them at the notch, so a tug on the cable pulls on the box, not the solder joints.
2. Screw the mount to the tray floor from inside (screws sit under the board, between the corner pads).
3. Drop the board in, components up, onto the four corner pads.
4. Press the lid on until it clicks. Its four corner posts hold the board down, so keep the board's corners free of parts.

The IMU can face any way in its box: the firmware calibrates the upright direction each session.
