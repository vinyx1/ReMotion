"""Generate the three perfboard layouts (mat driver, wrist IMU + level shifter, chest IMU) as KiCad boards.

Every pad's net is looked up in the schematic netlist (../IMU_Reach_Tracker.kicad_sch),
so the layouts can't silently drift from the circuit. Then KiCad's DRC checks that the
tracks connect every pad of each net and short nothing.

Run:  python3 make_perfboards.py      (needs KiCad 10: kicad-cli and the pcbnew module)

Perfboard conventions used here:
  - Every pad sits on a 2.54 mm grid. (col, row) = hole coordinates, (0, 0) = top-left hole.
  - B.Cu tracks = bare wire / solder trails on the bottom (solder side). All tracks are
    horizontal or vertical. No top-side jumpers needed.
  - "Wire pads" (J*, A1) are holes where an off-board wire is soldered.

Cable chain: mat (Arduino + driver board) -> wrist board (level shifter + wrist IMU) -> chest board.
The mat -> wrist cable carries 5 V I2C plus 5V, GND and 3V3 (for the shifter's LV side and the
wrist IMU's AD0, which makes the wrist 0x69). The wrist -> chest cable carries 3.3 V I2C.
"""
import json
import os
import re
import subprocess
import tempfile

import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
SCH = os.path.join(HERE, "..", "IMU_Reach_Tracker.kicad_sch")
FPLIB = "/usr/share/kicad/footprints"
PITCH = 2.54
TRACK_MM = 0.8

# Friendlier names for the schematic's auto-named nets.
NET_NAMES = {
    "Net-(A1-+5V)": "+5V", "Net-(A1-3V3)": "+3V3",
    "Net-(U3-B1)": "SDA_5V", "Net-(U3-B2)": "SCL_5V",
    "Net-(U1-SDA)": "SDA_3V3", "Net-(U1-SCL)": "SCL_3V3",
}


def load_schematic_nets():
    """Return {(ref, pin): net_name} from the schematic."""
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "n.net")
        subprocess.run(["kicad-cli", "sch", "export", "netlist", "--format", "kicadsexpr",
                        "-o", out, SCH], check=True, capture_output=True)
        text = open(out).read()
    text = text[text.index("(nets"):]
    pin_net = {}
    for blk in re.split(r"\(net\s*\n", text)[1:]:
        name = re.search(r'\(name "([^"]*)"\)', blk).group(1)
        if name.startswith("unconnected"):
            continue
        name = NET_NAMES.get(name, name.lstrip("/"))
        name = re.sub(r"^Net-\((Q\d)-B\)$", r"\1_BASE", name)
        for ref, pin in re.findall(r'\(ref "([^"]+)"\)\s*\(pin "([^"]+)"\)', blk):
            pin_net[(ref, pin)] = name
    return pin_net


# ---------------------------------------------------------------------------
# Board descriptions
#   lib parts:  (ref, value, library, footprint, (col,row) of pad 1, rotation_deg)
#               pad numbers = schematic pin numbers, nets come from the schematic.
#   wire pads:  (ref, value, [(pad_label, col, row, ["REF.PIN", ...]), ...])
#               each pad stands in for the listed schematic pins (all must share a net).
#               Pads with the same label inside one footprint are joined off-board
#               (e.g. two Arduino GND pins) and are modelled as KiCad jumper pads.
#   tracks:     (net, [(col,row), (col,row), ...]) polyline on B.Cu
# ---------------------------------------------------------------------------
R_FP = ("Resistor_THT", "R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal")
Q_FP = ("Package_TO_SOT_THT", "TO-92_Inline_Wide")  # pads 1,2,3 = E,B,C at 2.54 mm pitch

CHANNELS = [  # (Arduino pin, resistor, transistor, resistor row)
    ("D10", "R1", "Q1", 8), ("D11", "R2", "Q2", 11), ("D12", "R3", "Q3", 14),
    ("D13", "R4", "Q4", 17), ("D9", "R5", "Q5", 20),
]
ARDUINO_PIN = {"3V3": "4", "5V": "5", "GND": "6", "SDA": "13", "SCL": "14",
               "D9": "24", "D10": "25", "D11": "26", "D12": "27", "D13": "28"}
BUTTON_K = {"Q1": "SW1", "Q2": "SW2", "Q3": "SW3", "Q4": "SW4"}


def driver_board():
    lib, wire, tracks = [], [], []
    # Arduino jumper wires (left edge, column 0).
    a1 = [("3V3", 0, 2, ["A1.4"]), ("GND", 0, 3, ["A1.6"]), ("SCL", 0, 4, ["A1.14"]),
          ("SDA", 0, 5, ["A1.13"]), ("5V", 0, 6, ["A1.5"]), ("GND", 0, 9, ["A1.29"])]
    # 5-wire cable to the wrist board (right edge). It lands on the level shifter's
    # Arduino side there, so its pads stand in for the shifter pins.
    wire.append(("J2", "Cable to wrist", [("3V3", 17, 2, ["U3.1"]), ("GND", 17, 3, ["U3.12"]),
                                         ("SCL", 17, 4, ["U3.9"]), ("SDA", 17, 5, ["U3.8"]),
                                         ("VCC", 17, 7, ["U3.7"])]))
    # Arcade-button harness: 4 LED cathodes, shared LED +5V, shared switch GND.
    j3 = [("5V", 10, 8, ["SW1.4", "SW2.4", "SW3.4", "SW4.4"]),
          ("GND", 10, 10, ["SW1.1", "SW2.1", "SW3.1", "SW4.1", "SW5.1"])]
    tracks += [("+5V", [(10, 7), (10, 8)])]

    # Five identical low-side drivers: Arduino pin -> 1k -> base; emitter -> GND bus
    # (column 3, running under the resistor bodies); collector -> button LED or buzzer.
    # The transistor sits one row below and two holes right of its resistor so the
    # TO-92 body clears the resistor lead.
    for pin, r, q, row in CHANNELS:
        a1.append((pin, 0, row, ["A1." + ARDUINO_PIN[pin]]))
        lib.append((r, "1k", *R_FP, (1, row), 0))
        lib.append((q, "2N3904", *Q_FP, (6, row + 1), 0))
        tracks += [(f"{pin}_" + {"Q1": "HOME_LED", "Q2": "GREEN_LED", "Q3": "BLUE_LED",
                                 "Q4": "RED_LED", "Q5": "BUZZER"}[q], [(0, row), (1, row)]),
                   (f"{q}_BASE", [(5, row), (7, row), (7, row + 1)]),
                   ("GND", [(6, row + 1), (3, row + 1)])]
        if q in BUTTON_K:
            sw = BUTTON_K[q]
            name = {"SW1": "HOME", "SW2": "GREEN", "SW3": "BLUE", "SW4": "RED"}[sw]
            j3.append((f"K{name[0]}", 9, row + 1, [f"{sw}.3"]))
            tracks.append((f"{name}_LED_K", [(8, row + 1), (9, row + 1)]))
    wire.append(("J3", "Arcade button harness", j3))
    wire.append(("A1", "Arduino jumper wires", a1))

    # Buzzer + flyback diode (diode cathode to +5V).
    lib.append(("BZ1", "CMI-1295-0585T", "Buzzer_Beeper", "Buzzer_12x9.5RM7.6", (14, 14), 180))
    lib.append(("D1", "1N4148", "Diode_THT", "D_DO-35_SOD27_P7.62mm_Horizontal", (14, 17), 180))

    tracks += [
        # Top section: Arduino straight across to the wrist cable.
        ("+3V3", [(0, 2), (17, 2)]),
        ("GND", [(0, 3), (17, 3)]),
        ("SCL_5V", [(0, 4), (17, 4)]),
        ("SDA_5V", [(0, 5), (17, 5)]),
        ("+5V", [(0, 6), (5, 6), (5, 7), (17, 7), (17, 14), (14, 14)]),
        # GND bus and its branch to the right half.
        ("GND", [(0, 9), (3, 9), (3, 21)]),
        ("GND", [(3, 10), (10, 10)]),
        # Buzzer: Q5 collector -> buzzer(-) and diode anode; diode cathode -> buzzer(+).
        ("BUZZER_NEG", [(8, 21), (10, 21), (10, 14), (11, 14)]),
        ("BUZZER_NEG", [(11, 17), (11, 14)]),
        ("+5V", [(14, 14), (14, 17)]),
    ]
    return dict(name="driver", title="Mat driver board (5x7 cm, 18x24 holes)",
                cols=18, rows=24, lib=lib, wire=wire, tracks=tracks,
                outlines=[], pins=[], prefix={"A1": "Arduino "})


GY521_PINS = ["VCC", "GND", "SCL", "SDA", "XDA", "XCL", "AD0", "INT"]


def gy521(u, value, row):
    """GY-521 on an 8-pin female header in `row`, columns 1-8.

    Socket pad n = GY-521 pin n (1 VCC ... 8 INT). Pin 1 (VCC) is on the RIGHT, so a
    GY-521 plugged in chip-side-up lies over the board, not off its edge.
    """
    lib = [(u, value, "Connector_PinSocket_2.54mm", "PinSocket_1x08_P2.54mm_Vertical", (7, row), 270)]
    pins = [(n, 7 - i, row + 0.6, "C") for i, n in enumerate(GY521_PINS)]
    pins.append(("GY-521, chip side up (approx. outline)", 3.5, row + 3.5, "C"))
    return lib, pins, (-0.67, row - 0.5, 7.67, row + 5.95)


def chest_board():
    """Chest IMU (U1, AD0 unconnected = 0x68). Cable from the wrist board below it."""
    lib, pins, outline = gy521("U1", "GY-521 chest (0x68)", 0)
    wire = [("J6", "Cable from wrist", [("SDA", 4, 7, ["U1.4"]), ("SCL", 5, 7, ["U1.3"]),
                                        ("GND", 6, 7, ["U1.2"]), ("VCC", 7, 7, ["U1.1"])])]
    tracks = [("SDA_3V3", [(4, 0), (4, 7)]), ("SCL_3V3", [(5, 0), (5, 7)]),
              ("GND", [(6, 0), (6, 7)]), ("+5V", [(7, 0), (7, 7)])]
    pins.append(("from wrist", -0.6, 7, "R"))
    return dict(name="chest", title="Chest IMU board (cut from 2x8 cm, 8x8 holes)",
                cols=8, rows=8, lib=lib, wire=wire, tracks=tracks,
                outlines=[outline], pins=pins, prefix={})


def wrist_board():
    """Wrist IMU (U2) plus the level shifter (U3).

    Row 0: pads for the cable to the chest. Row 1: GY-521 socket. Rows 9-14: the 757,
    turned 180 degrees from Adafruit's silkscreen view: LV/HV at the top, GND at the
    bottom, A (3.3 V) side in column 1, B (5 V) side in column 5. The mat cable lands on
    the right edge, except 3V3, which lands on the left edge next to LV.
    U2's AD0 (socket column 1) is tied to 3V3, so the wrist answers at 0x69.
    """
    lib, pins, outline = gy521("U2", "GY-521 wrist (0x69)", 1)
    u3 = [("LV", 1, 9, ["U3.1"]), ("A1", 1, 10, ["U3.2"]), ("A2", 1, 11, ["U3.3"]),
          ("A3", 1, 12, []), ("A4", 1, 13, []), ("GND", 1, 14, ["U3.6"]),
          ("HV", 5, 9, ["U3.7"]), ("B1", 5, 10, ["U3.8"]), ("B2", 5, 11, ["U3.9"]),
          ("B3", 5, 12, []), ("B4", 5, 13, []), ("GND", 5, 14, ["U3.12"])]
    wire = [("U3", "Adafruit 757 (on 2x6 female header)", u3),
            # c = cable to the chest, m = cable from the mat (labels must differ: both have SDA/SCL)
            ("J5", "Cable to chest", [("cSDA", 4, 0, ["U1.4"]), ("cSCL", 5, 0, ["U1.3"]),
                                      ("cGND", 6, 0, ["U1.2"]), ("c5V", 7, 0, ["U1.1"])]),
            ("J4", "Cable from mat", [("m3V3", 0, 9, ["U3.1"]), ("m5V", 7, 9, ["U3.7"]),
                                      ("mSDA", 7, 10, ["U3.8"]), ("mSCL", 7, 11, ["U3.9"]),
                                      ("mGND", 7, 14, ["U3.12"])])]
    tracks = [
        ("+3V3", [(1, 1), (1, 9), (0, 9)]),                       # AD0 -> LV -> mat 3V3
        ("SDA_3V3", [(4, 0), (4, 2), (2, 2), (2, 10), (1, 10)]),  # chest, socket, A1
        ("SCL_3V3", [(5, 0), (5, 3), (3, 3), (3, 11), (1, 11)]),  # chest, socket, A2
        ("GND", [(6, 0), (6, 4), (4, 4), (4, 14), (1, 14)]),      # runs under the 757
        ("GND", [(4, 14), (7, 14)]),
        ("+5V", [(7, 0), (7, 9), (5, 9)]),                        # chest, socket, HV, mat
        ("SDA_5V", [(5, 10), (7, 10)]),
        ("SCL_5V", [(5, 11), (7, 11)]),
    ]
    pins += [(lab, c + 0.45, r, "L") if c == 1 else (lab, c - 0.45, r, "R") for lab, c, r, _ in u3]
    pins.append(("Adafruit 757", 3, 15.1, "C"))
    # 757 outline (15.24 x 20.45 mm, from Adafruit's PCB file): one hole past each pin column.
    return dict(name="wrist", title="Wrist IMU + level shifter (cut from 2x8 cm, 8x16 holes)",
                cols=8, rows=16, lib=lib, wire=wire, tracks=tracks,
                outlines=[outline, (0.0, 7.47, 6.0, 15.53)], pins=pins, prefix={})


# ---------------------------------------------------------------------------
# KiCad board construction
# ---------------------------------------------------------------------------
class Builder:
    def __init__(self, spec, pin_net):
        self.spec, self.pin_net = spec, pin_net
        self.board = pcbnew.BOARD()
        self.nets = {}
        self.margin = 3.0
        self.x0 = self.y0 = 20.0  # top-left hole, mm

    def mm(self, c, r):
        return pcbnew.VECTOR2I_MM(self.x0 + c * PITCH, self.y0 + r * PITCH)

    def net(self, name):
        if name not in self.nets:
            n = pcbnew.NETINFO_ITEM(self.board, name)
            self.board.Add(n)
            self.nets[name] = n
        return self.nets[name]

    def schem_net(self, refpin):
        ref, pin = refpin.split(".")
        assert (ref, pin) in self.pin_net, f"{refpin} is not connected in the schematic"
        return self.pin_net[(ref, pin)]

    def text(self, s, c, r, layer, size=0.9, mirrored=False, justify=None):
        t = pcbnew.PCB_TEXT(self.board)
        t.SetText(s)
        t.SetPosition(pcbnew.VECTOR2I_MM(self.x0 + c * PITCH, self.y0 + r * PITCH))
        t.SetLayer(layer)
        t.SetTextSize(pcbnew.VECTOR2I_MM(size, size))
        t.SetTextThickness(pcbnew.FromMM(size * 0.15))
        if mirrored:
            t.SetMirrored(True)
        if justify is not None:
            t.SetHorizJustify(justify)
        self.board.Add(t)

    def label(self, s, c, r, justify=None, size=0.9):
        """Label on both assembly prints: top (Dwgs.User) and mirrored bottom (Cmts.User)."""
        self.text(s, c, r, pcbnew.Dwgs_User, size=size, justify=justify)
        mj = None if justify is None else (pcbnew.GR_TEXT_H_ALIGN_RIGHT
                                           if justify == pcbnew.GR_TEXT_H_ALIGN_LEFT
                                           else pcbnew.GR_TEXT_H_ALIGN_LEFT)
        self.text(s, c, r, pcbnew.Cmts_User, size=size, mirrored=True, justify=mj)

    def add_lib(self, ref, value, libname, fpname, at, rot):
        fp = pcbnew.FootprintLoad(os.path.join(FPLIB, libname + ".pretty"), fpname)
        fp.SetReference(ref)
        fp.SetValue(value)
        fp.SetPosition(self.mm(*at))
        fp.SetOrientationDegrees(rot)
        self.board.Add(fp)
        for pad in fp.Pads():
            key = (ref, pad.GetNumber())
            if key in self.pin_net:
                pad.SetNet(self.net(self.pin_net[key]))
            self.check_on_grid(pad, ref)
        return fp

    def check_on_grid(self, pad, ref):
        p = pad.GetPosition()
        for v, o in ((p.x, self.x0), (p.y, self.y0)):
            off = (pcbnew.ToMM(v) - o) / PITCH
            # The buzzer's 7.6 mm pin spacing is 0.02 mm short of 3 holes; legs bend that far.
            assert abs(off - round(off)) < 0.02, f"{ref} pad {pad.GetNumber()} is off the 2.54 grid"

    def add_wire_pads(self, ref, value, pads):
        fp = pcbnew.FOOTPRINT(self.board)
        fp.SetReference(ref)
        fp.SetValue(value)
        fp.Reference().SetVisible(False)
        fp.Value().SetVisible(False)
        fp.SetPosition(self.mm(pads[0][1], pads[0][2]))
        self.board.Add(fp)
        labels = [p[0] for p in pads]
        if len(set(labels)) < len(labels):
            fp.SetDuplicatePadNumbersAreJumpers(True)  # e.g. two Arduino GND pins
        for lab, c, r, refpins in pads:
            nets = {self.schem_net(rp) for rp in refpins}
            assert len(nets) <= 1, f"{ref}.{lab} stands in for pins on different nets: {nets}"
            pad = pcbnew.PAD(fp)
            pad.SetNumber(lab)
            pad.SetAttribute(pcbnew.PAD_ATTRIB_PTH)
            pad.SetShape(pcbnew.PADSTACK.ALL_LAYERS, pcbnew.PAD_SHAPE_CIRCLE)
            pad.SetSize(pcbnew.PADSTACK.ALL_LAYERS, pcbnew.VECTOR2I_MM(1.7, 1.7))
            pad.SetDrillSize(pcbnew.VECTOR2I_MM(1.0, 1.0))
            pad.SetLayerSet(pad.PTHMask())
            fp.Add(pad)
            pad.SetPosition(self.mm(c, r))
            if nets:
                pad.SetNet(self.net(nets.pop()))
        return fp

    def build(self):
        s = self.spec
        b = self.board
        w = (s["cols"] - 1) * PITCH + 2 * self.margin
        h = (s["rows"] - 1) * PITCH + 2 * self.margin
        edge = pcbnew.PCB_SHAPE(b)
        edge.SetShape(pcbnew.SHAPE_T_RECTANGLE)
        edge.SetStart(pcbnew.VECTOR2I_MM(self.x0 - self.margin, self.y0 - self.margin))
        edge.SetEnd(pcbnew.VECTOR2I_MM(self.x0 - self.margin + w, self.y0 - self.margin + h))
        edge.SetLayer(pcbnew.Edge_Cuts)
        edge.SetWidth(pcbnew.FromMM(0.1))
        b.Add(edge)

        # Hole grid and coordinates on both print layers.
        for c in range(s["cols"]):
            for r in range(s["rows"]):
                for layer in (pcbnew.Dwgs_User, pcbnew.Cmts_User):
                    dot = pcbnew.PCB_SHAPE(b)
                    dot.SetShape(pcbnew.SHAPE_T_CIRCLE)
                    dot.SetCenter(self.mm(c, r))
                    dot.SetEnd(pcbnew.VECTOR2I_MM(self.x0 + c * PITCH + 0.5, self.y0 + r * PITCH))
                    dot.SetLayer(layer)
                    dot.SetWidth(pcbnew.FromMM(0.1))
                    b.Add(dot)
        for c in range(s["cols"]):
            self.label(str(c + 1), c, -1.6)
        for r in range(s["rows"]):
            self.label(chr(ord("A") + r), -1.6 if s["cols"] > 8 else s["cols"] + 0.3, r)
        self.label(s["title"], (s["cols"] - 1) / 2, s["rows"] + 0.6)

        J = {"L": pcbnew.GR_TEXT_H_ALIGN_LEFT, "R": pcbnew.GR_TEXT_H_ALIGN_RIGHT, "C": None}
        for c1, r1, c2, r2 in s["outlines"]:
            for layer in (pcbnew.Dwgs_User, pcbnew.Cmts_User):
                box = pcbnew.PCB_SHAPE(b)
                box.SetShape(pcbnew.SHAPE_T_RECTANGLE)
                box.SetStart(pcbnew.VECTOR2I_MM(self.x0 + c1 * PITCH, self.y0 + r1 * PITCH))
                box.SetEnd(pcbnew.VECTOR2I_MM(self.x0 + c2 * PITCH, self.y0 + r2 * PITCH))
                box.SetLayer(layer)
                box.SetWidth(pcbnew.FromMM(0.15))
                b.Add(box)
        for lab, c, r, j in s["pins"]:
            self.label(lab, c, r, J[j], size=0.6 if len(lab) <= 3 else 0.8)

        for part in s["lib"]:
            self.add_lib(*part)
        for ref, value, pads in s["wire"]:
            self.add_wire_pads(ref, value, pads)
            for lab, c, r, _ in pads:
                if ref.startswith("U"):
                    continue  # module pins: the module's own silkscreen shows them
                if c == 0:
                    self.label(s["prefix"].get(ref, "") + lab, -2.4, r, pcbnew.GR_TEXT_H_ALIGN_RIGHT)
                elif c == s["cols"] - 1 and s["cols"] > 8:
                    self.label(f"{lab}", c + 0.6, r, pcbnew.GR_TEXT_H_ALIGN_LEFT)
                else:
                    self.label(lab, c, r + 0.55 if r == s["rows"] - 1 else r - 0.5, size=0.6)

        for name, pts in s["tracks"]:
            assert name in self.nets, f"track net {name} has no pads"
            for (c1, r1), (c2, r2) in zip(pts, pts[1:]):
                assert c1 == c2 or r1 == r2, f"diagonal track in {name}"
                t = pcbnew.PCB_TRACK(b)
                t.SetStart(self.mm(c1, r1))
                t.SetEnd(self.mm(c2, r2))
                t.SetWidth(pcbnew.FromMM(TRACK_MM))
                t.SetLayer(pcbnew.B_Cu)
                t.SetNet(self.net(name))
                b.Add(t)
        return b


# Courtyard margins only: these leads sit one hole (2.54 mm) apart, which is normal on
# perfboard, and no part bodies touch. Any other DRC error fails the run.
ACCEPTED_DRC = set()


def main():
    pin_net = load_schematic_nets()
    failed = False
    for spec in (driver_board(), wrist_board(), chest_board()):
        path = os.path.join(HERE, spec["name"] + ".kicad_pcb")
        board = Builder(spec, pin_net).build()
        board.BuildConnectivity()
        pcbnew.SaveBoard(path, board)

        report = os.path.join(HERE, spec["name"] + "-drc.json")
        subprocess.run(["kicad-cli", "pcb", "drc", "--format", "json", "--severity-error",
                        "-o", report, path], check=True, capture_output=True)
        drc = json.load(open(report))
        os.remove(report)
        errs = []
        for v in drc.get("violations", []):
            items = " / ".join(sorted(i["description"] for i in v["items"]))
            if (v["description"], items) in ACCEPTED_DRC:
                continue
            errs.append(f'{v["description"]}: {items}')
        unconnected = drc.get("unconnected_items", [])
        print(f"{spec['name']:7s} errors={len(errs)} unconnected={len(unconnected)}")
        for e in errs[:10]:
            print("   ", e)
        for u in unconnected[:10]:
            print("    unconnected:", [i["description"] for i in u["items"]])
        failed |= bool(errs or unconnected)

        common = ["kicad-cli", "pcb", "export", "pdf", "--mode-single", "--black-and-white",
                  "--drill-shape-opt", "2"]
        subprocess.run(common + ["--layers", "Edge.Cuts,F.Fab,Dwgs.User",
                                 "-o", os.path.join(HERE, spec["name"] + "-top.pdf"), path],
                       check=True, capture_output=True)
        subprocess.run(common + ["--mirror", "--layers", "Edge.Cuts,B.Cu,Cmts.User",
                                 "-o", os.path.join(HERE, spec["name"] + "-bottom.pdf"), path],
                       check=True, capture_output=True)
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
