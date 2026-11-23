"""3D-printed boxes for the two IMU perfboards (ReMotion, ECE 198 Group 19).

    python3 make_enclosures.py

Writes, next to this file:
    chest_box.sc / wrist_box.sc   SolidCraft designs (open them in SolidCraft)
    stl/*.stl                     one file per part, already lying on its print face
    *_iso.png                     pictures of each assembly

Both boards are 40 x 60 mm perfboards. Each box is a tray, a snap-on lid and
a mount, and every part prints flat with no supports:

    base   tray, printed floor down. The board rests on four corner pads; the
           wires leave through notches in the rim that the lid closes to holes,
           so the 1 m wires can be soldered first and laid in.
    lid    printed outer face down. Four corner posts press the board onto the
           pads, and two bumps on its lip snap into grooves in the tray.
    mount  screwed to the tray floor with 2 x M3 x 6 screws from inside (or glued):
             chest: GoPro two-prong mount, joins the harness's three-prong
                    buckle with its thumbscrew (screw axis across the box)
             wrist: a C-clip that slides onto the edge of the 50 mm strap

Change a number below and run the script again. Tolerances assume a typical
FDM printer (0.4 mm nozzle); see README.md for print settings.
"""

import glob
import json
import os
import shutil
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- The board -------------------------------------------------------------
BOARD_L, BOARD_W, BOARD_T = 60.0, 40.0, 1.6
FIT = 2.0            # gap around the board on each side: generous, so a slightly
                     # oversize board still drops in (hot-glue it if it rattles)
PAD_H = 3.5          # pads lift the board so solder joints clear the floor
TOP_CLEAR = 12.0     # room above the board for the GY-521, shifter and wires
POST_GAP = 0.5       # lid posts stop this far above the board, so a thick board never stops the lid

# ---- The tray and lid ------------------------------------------------------
WALL, FLOOR, LID_T = 2.0, 2.0, 2.0
PAD = 6.0            # corner pad and lid post size (square)
LIP_T, LIP_D, LIP_CLR = 1.2, 3.0, 0.15   # lid lip: thickness, depth, gap to the wall
SNAP = 0.4           # how far the snap bump sticks out past the lip
NOTCH_W, NOTCH_D = 8.0, 6.0               # wire notch in the rim: width, depth

# ---- Mounts ----------------------------------------------------------------
M3_CLEAR, M3_PILOT, SCREW_X = 3.4, 2.6, 15.0   # screws at x = +-SCREW_X, y = 0
GOPRO = dict(plate=(40.0, 30.0, 2.0), boss=(7.0, 4.0), finger_t=3.0, gap=3.3, finger_w=15.0,
             hole_h=9.0, radius=7.5, hole=5.3)  # GoPro camera-side prongs
STRAP_W, STRAP_T = 50.0, 3.0
CLIP = dict(depth=30.0, wall=2.5, gap=2.6, lip=0.8)  # gap < strap: neoprene grips

CAV_L, CAV_W = BOARD_L + 2 * FIT, BOARD_W + 2 * FIT
CAV_H = PAD_H + BOARD_T + TOP_CLEAR
OUT_L, OUT_W, BASE_H = CAV_L + 2 * WALL, CAV_W + 2 * WALL, FLOOR + CAV_H


def check():
    assert PAD < min(BOARD_L, BOARD_W) / 4, "corner pads would cover the board's middle"
    assert NOTCH_D < TOP_CLEAR, "wire notch would reach below the board"
    assert SCREW_X + M3_CLEAR / 2 < CAV_L / 2 - PAD, "mount screw under a corner pad"
    assert STRAP_W + 2 < OUT_L + 10, "strap clip much longer than the box"
    assert CLIP["gap"] < STRAP_T, "clip gap must be under the strap thickness to grip"
    assert GOPRO["plate"][0] / 2 > SCREW_X + M3_CLEAR, "GoPro plate too small for its screws"


class Script:
    def __init__(self):
        self.cmd = [{"command": "document.units", "params": {"units": "mm"}}]

    def add(self, c, **p):
        self.cmd.append({"command": c, "params": p})

    def box(self, body, x0, y0, z0, x1, y1, z1, op="join", **kw):
        p = dict(length=round(x1 - x0, 3), width=round(y1 - y0, 3), height=round(z1 - z0, 3),
                 corner=[round(x0, 3), round(y0, 3), round(z0, 3)])
        if op == "new":
            p.update(operation="new", name=body, body_name=body)
        else:
            p.update(operation=op, targets=[body], **kw)
        self.add("solid.box", **p)


def base(s, name, notches, x_off=0.0):
    """Tray, floor at z=0, centred on (x_off, 0)."""
    X = lambda v: v + x_off
    s.box(name, X(-OUT_L / 2), -OUT_W / 2, 0, X(OUT_L / 2), OUT_W / 2, BASE_H, op="new")
    s.box(name, X(-CAV_L / 2), -CAV_W / 2, FLOOR, X(CAV_L / 2), CAV_W / 2, BASE_H + 1, op="cut")
    for sx in (-1, 1):                       # corner pads
        for sy in (-1, 1):
            x0 = sx * CAV_L / 2 - (PAD if sx > 0 else 0)
            y0 = sy * CAV_W / 2 - (PAD if sy > 0 else 0)
            s.box(name, X(x0), y0, FLOOR - 0.01, X(x0 + PAD), y0 + PAD, FLOOR + PAD_H)
    for side in notches:                     # wire notches in the short walls
        x0 = -OUT_L / 2 - 1 if side < 0 else CAV_L / 2 - 1
        s.box(name, X(x0), -NOTCH_W / 2, BASE_H - NOTCH_D, X(x0 + WALL + 2), NOTCH_W / 2, BASE_H + 1, op="cut")
    for sy in (-1, 1):                       # snap grooves in the long walls
        y0 = CAV_W / 2 - 0.01 if sy > 0 else -CAV_W / 2 - SNAP - 0.15
        s.box(name, X(-15), y0, BASE_H - LIP_D / 2 - 0.6, X(15), y0 + SNAP + 0.16, BASE_H - LIP_D / 2 + 0.6, op="cut")
    for sx in (-1, 1):                       # mount screw holes
        s.add("solid.cylinder", diameter=M3_CLEAR, height=FLOOR + 2, base=[X(sx * SCREW_X), 0, -1],
              operation="cut", targets=[name])


def lid(s, name, notches, x_off=0.0):
    """Lid, outer face at z=0 (as printed), lip and posts pointing up (+z)."""
    X = lambda v: v + x_off
    s.box(name, X(-OUT_L / 2), -OUT_W / 2, 0, X(OUT_L / 2), OUT_W / 2, LID_T, op="new")
    lo_l, lo_w = CAV_L - 2 * LIP_CLR, CAV_W - 2 * LIP_CLR
    s.box(name, X(-lo_l / 2), -lo_w / 2, LID_T - 0.01, X(lo_l / 2), lo_w / 2, LID_T + LIP_D)
    s.box(name, X(-lo_l / 2 + LIP_T), -lo_w / 2 + LIP_T, LID_T, X(lo_l / 2 - LIP_T), lo_w / 2 - LIP_T,
          LID_T + LIP_D + 1, op="cut")
    for side in notches:                     # gaps in the lip where the wires pass
        x0 = -lo_l / 2 - 1 if side < 0 else lo_l / 2 - LIP_T - 1
        s.box(name, X(x0), -(NOTCH_W + 1) / 2, LID_T, X(x0 + LIP_T + 2), (NOTCH_W + 1) / 2, LID_T + LIP_D + 1, op="cut")
    for sy in (-1, 1):                       # snap bumps on the lip
        y0 = lo_w / 2 - 0.01 if sy > 0 else -lo_w / 2 - SNAP
        s.box(name, X(-14), y0, LID_T + LIP_D / 2 - 0.4, X(14), y0 + SNAP + 0.01, LID_T + LIP_D / 2 + 0.4)
    post_h = TOP_CLEAR - POST_GAP            # lid underside to just above the board
    for sx in (-1, 1):                       # posts that press the board corners
        for sy in (-1, 1):
            x0 = sx * (lo_l / 2 - LIP_T) - (PAD if sx > 0 else 0)
            y0 = sy * (lo_w / 2 - LIP_T) - (PAD if sy > 0 else 0)
            s.box(name, X(x0), y0, LID_T - 0.01, X(x0 + PAD), y0 + PAD, LID_T + post_h)


def gopro(s, name, x_off=0.0):
    """GoPro two-prong mount on a plate, plate on z=0. Screw axis along y (across the box)."""
    X = lambda v: v + x_off
    pl, pw, pt = GOPRO["plate"]
    s.box(name, X(-pl / 2), -pw / 2, 0, X(pl / 2), pw / 2, pt, op="new")
    ft, gap, fw, hh, r = GOPRO["finger_t"], GOPRO["gap"], GOPRO["finger_w"], GOPRO["hole_h"], GOPRO["radius"]
    for sy in (-1, 1):
        y0 = gap / 2 if sy > 0 else -gap / 2 - ft
        s.box(name, X(-fw / 2), y0, pt - 0.01, X(fw / 2), y0 + ft, pt + hh)
        s.add("solid.cylinder", radius=r, height=ft, base=[X(0), y0, pt + hh], axis="Y",
              operation="join", targets=[name])
    s.add("solid.cylinder", diameter=GOPRO["hole"], height=gap + 2 * ft + 2,
          base=[X(0), -gap / 2 - ft - 1, pt + hh], axis="Y", operation="cut", targets=[name])
    bd, bh = GOPRO["boss"]                   # thin plate, so each screw gets a boss to bite into
    for sx in (-1, 1):
        s.add("solid.cylinder", diameter=bd, height=bh, base=[X(sx * SCREW_X), 0, 0], operation="join", targets=[name])
        s.add("solid.cylinder", diameter=M3_PILOT, height=bh + 2, base=[X(sx * SCREW_X), 0, -1],
              operation="cut", targets=[name])


def clip(s, name, x_off=0.0):
    """C-clip for the strap, drawn as it prints: standing on its end (y = 0 on the bed).
    Back plate (screws to the box) at the top in use; open end at +x."""
    X = lambda v: v + x_off
    w, gap, lip, d = CLIP["wall"], CLIP["gap"], CLIP["lip"], CLIP["depth"]
    L = STRAP_W + 2 + w                      # strap width + clearance + closed end
    # In use z is "up from the wrist": tongue (z 0..w), gap, back plate (w+gap .. 2w+gap)
    s.box(name, X(-L / 2), 0, 0, X(L / 2), d, 2 * w + gap, op="new")
    s.box(name, X(-L / 2 + w), -1, w, X(L / 2 + 1), d + 1, w + gap, op="cut")          # the slot
    s.box(name, X(L / 2 - 3), 0, w - 0.01, X(L / 2), d, w + lip)                    # retaining lip
    for sx in (-1, 1):
        s.add("solid.cylinder", diameter=M3_PILOT, height=w + 2, base=[X(sx * SCREW_X), d / 2, w + gap - 1],
              operation="cut", targets=[name])
    return L


def find_solidcraft():
    found = sorted(glob.glob(os.path.expanduser("~/Applications/solidcraft-*-linux-x86_64.AppImage")))
    return found[-1] if found else shutil.which("solidcraft")   # shortcut: string sort, fine until 0.100


# Shown in SolidCraft's Parameters panel so the sizes can be read there (view only).
REFERENCE = [
    ("board_size", f"{BOARD_L:g} x {BOARD_W:g} x {BOARD_T:g} mm", "the perfboard"),
    ("board_gap", f"{FIT:g} mm", "gap around the board on each side"),
    ("pocket", f"{CAV_L:g} x {CAV_W:g} x {CAV_H:g} mm", "inside the tray"),
    ("outside", f"{OUT_L:g} x {OUT_W:g} x {BASE_H + LID_T:g} mm", "tray + lid, closed"),
    ("pad_height", f"{PAD_H:g} mm", "board lifted off the floor"),
    ("above_board", f"{TOP_CLEAR:g} mm", "room for the parts and wires"),
    ("lid_post_gap", f"{POST_GAP:g} mm", "lid posts stop this far above the board"),
    ("walls", f"{WALL:g} mm walls, {FLOOR:g} mm floor, {LID_T:g} mm lid", ""),
    ("wire_hole", f"{NOTCH_W:g} x {NOTCH_D:g} mm", "notch in the rim, closed by the lid"),
    ("mount_screws", f"2 x M3 at x = +-{SCREW_X:g} mm", "from inside the tray into the mount"),
    ("gopro_prongs", f"{GOPRO['finger_t']:g} mm prongs, {GOPRO['gap']:g} mm gap, {GOPRO['hole']:g} mm hole", "chest"),
    ("strap_clip", f"{CLIP['gap']:g} mm gap for a {STRAP_W:g} x {STRAP_T:g} mm strap", "wrist"),
]


def build(app, tag, parts):
    """parts: [(body name, builder, kwargs, print_point)]; bodies laid side by side."""
    s = Script()
    for name, value, note in REFERENCE:
        s.add("parameters.add", name=name, expression=f'"{value}"', unit="text",
              comment=f"View only, change it in make_enclosures.py. {note}".strip(". ") )
    for name, fn, kw, _ in parts:
        fn(s, name, **kw)
    s.add("appearance.assign", bodies=[p[0] for p in parts], color="#3a4a5c")
    os.makedirs(os.path.join(HERE, "stl"), exist_ok=True)
    for name, _, _, pt in parts:
        s.add("body.print_face", body=name, point=pt)
        s.add("file.export_stl", path=os.path.join(HERE, "stl", f"{name}.stl"), bodies=[name],
              quality="fine", lay_on_print_faces=True)
    script = os.path.join(HERE, ".work", f"{tag}.json")
    os.makedirs(os.path.dirname(script), exist_ok=True)
    json.dump(s.cmd, open(script, "w"), indent=1)
    env = dict(os.environ, SOLIDCRAFT_APPIMAGE_CLI="1")
    design = os.path.join(HERE, f"{tag}.sc")
    subprocess.run([app, "run", script, "--save", design, "--param-check", "strict", "--quiet"], check=True, env=env)
    subprocess.run([app, "snapshot", "--in", design, "--out", os.path.join(HERE, f"{tag}_iso.png"), "--view", "iso",
                    "--width", "1400", "--height", "900", "--no-grid", "--no-axes"], check=True, env=env,
                   stdout=subprocess.DEVNULL)
    print(f"wrote {tag}.sc, {tag}_iso.png and", ", ".join(f"stl/{p[0]}.stl" for p in parts))


BED = 200.0          # Kingroon KP3S Pro: 200 x 200 mm bed
SPACE = 10.0         # between parts on the plate


def build_plate(app):
    """All six parts on one KP3S Pro bed, each lying on its print face, as one 3MF and one STL."""
    s = Script()
    cx = (OUT_L + SPACE) / 2                 # two columns: chest, wrist
    rows = {"base": OUT_W + SPACE, "lid": 0.0, "small": -(OUT_W / 2 + SPACE + GOPRO["plate"][1] / 2)}
    for col, (box, notches) in ((-cx, ("chest", (-1,))), (cx, ("wrist", (-1, 1)))):
        base(s, f"{box}_base", notches)
        s.add("solid.move", bodies=[f"{box}_base"], translate=[col, rows["base"], 0])
        lid(s, f"{box}_lid", notches)
        s.add("solid.move", bodies=[f"{box}_lid"], translate=[col, rows["lid"], 0])
    gopro(s, "chest_gopro_mount")
    s.add("solid.move", bodies=["chest_gopro_mount"], translate=[-cx, rows["small"], 0])
    clip(s, "wrist_strap_clip")              # stand it on its end: y (depth) becomes height
    s.add("solid.move", bodies=["wrist_strap_clip"], axis=[1, 0, 0], angle="90 deg", origin=[0, 0, 0])
    s.add("solid.move", bodies=["wrist_strap_clip"], translate=[cx, rows["small"] + 4, 0])
    s.add("appearance.assign", bodies=["chest_base", "chest_lid", "chest_gopro_mount", "wrist_base", "wrist_lid",
                                       "wrist_strap_clip"], color="#3a4a5c")
    s.add("file.export_3mf", path=os.path.join(HERE, "stl", "kp3s_pro_plate.3mf"), quality="fine", objects="body")
    s.add("file.export_stl", path=os.path.join(HERE, "stl", "kp3s_pro_plate.stl"), quality="fine")
    script = os.path.join(HERE, ".work", "plate.json")
    json.dump(s.cmd, open(script, "w"), indent=1)
    env = dict(os.environ, SOLIDCRAFT_APPIMAGE_CLI="1")
    design = os.path.join(HERE, ".work", "plate.sc")
    subprocess.run([app, "run", script, "--save", design, "--param-check", "strict", "--quiet"], check=True, env=env)
    subprocess.run([app, "snapshot", "--in", design, "--out", os.path.join(HERE, "kp3s_pro_plate.png"), "--view", "top",
                    "--width", "1200", "--height", "1200", "--no-grid", "--no-axes"], check=True, env=env,
                   stdout=subprocess.DEVNULL)
    print("wrote stl/kp3s_pro_plate.3mf, stl/kp3s_pro_plate.stl and kp3s_pro_plate.png")


def main():
    check()
    app = find_solidcraft()
    if not app:
        raise SystemExit("SolidCraft not found (expected ~/Applications/solidcraft-*-linux-x86_64.AppImage)")
    gap = 15.0
    clip_l = STRAP_W + 2 + CLIP["wall"]
    # print_point: a point on the face that goes on the bed
    build(app, "chest_box", [
        ("chest_base", base, dict(notches=(-1,)), [0, 0, 0]),
        ("chest_lid", lid, dict(notches=(-1,), x_off=OUT_L + gap), [OUT_L + gap, 0, 0]),
        ("chest_gopro_mount", gopro, dict(x_off=2 * (OUT_L + gap)), [2 * (OUT_L + gap), 0, 0]),
    ])
    build(app, "wrist_box", [
        ("wrist_base", base, dict(notches=(-1, 1)), [0, 0, 0]),
        ("wrist_lid", lid, dict(notches=(-1, 1), x_off=OUT_L + gap), [OUT_L + gap, 0, 0]),
        ("wrist_strap_clip", clip, dict(x_off=2 * (OUT_L + gap)), [2 * (OUT_L + gap), 0, 1.0]),
    ])
    build_plate(app)
    print(f"box outside: {OUT_L:.1f} x {OUT_W:.1f} x {BASE_H + LID_T:.1f} mm; strap clip {clip_l:.1f} mm long")


if __name__ == "__main__":
    main()
