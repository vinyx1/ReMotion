"""Button mat for ReMotion, cut from an 18 x 11 x 12 in cardboard box.

Writes, from ONE parameter list:
  button_mat.json          SolidCraft script (parametric model: deck, holes, stand-in parts)
  button_mat.sc            SolidCraft design, if SolidCraft is installed (open it in SolidCraft)
  button-mat-drawing.pdf   Shop drawing: how to cut the box, hole layout, section, 1:1 template

Run:  python3 make_button_mat.py      (needs reportlab; SolidCraft optional)

Coordinates: X = along the reach, from the patient end. Y = across, from the right-hand
long edge as the patient sees it. The origin O is the patient-end, right-hand corner.
Built for a RIGHT-arm reach; for a left-arm mat mirror every Y (y -> 12 in - y).
"""
import glob
import json
import os
import subprocess

from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
IN = 25.4  # mm per inch

# ---------------------------------------------------------------------------
# Parameters (inches unless marked). These names are the SolidCraft parameters too.
# ---------------------------------------------------------------------------
PARAMS = [  # name, expression, comment
    ("deck_len", "18 in", "Box length: the reach direction. X is measured from the patient end"),
    ("deck_wid", "12 in", "Box height, used as the mat's width. Y is from the right-hand long edge"),
    ("skirt_h", "2.5 in", "Skirt height = clearance under the deck for the button switches"),
    ("board_t", "0.16 in", "Cardboard thickness (single-wall corrugated, about 4 mm)"),
    ("reach_D", "13 in", "Design reach: HOME centre to RED centre"),
    ("home_x", "2 in", "HOME centre from the patient end"),
    ("col_y", "8.75 in", "Target column, in front of the right shoulder"),
    ("green_x", "home_x + 0.4 * reach_D", "GREEN at 40% of the reach"),
    ("blue_x", "home_x + 0.7 * reach_D", "BLUE at 70% of the reach"),
    ("red_x", "home_x + reach_D", "RED at 100% of the reach"),
    ("start_x", "51 mm", "START, at the patient end beside the zip ties (matches the real mat)"),
    ("start_y", "109.85 mm", ""),
    ("buzz_x", "51 mm", "Buzzer, taped on top of the deck (no hole)"),
    ("buzz_y", "39.85 mm", ""),
    ("board_z", "40 mm", "How far the Arduino and driver board sit below the deck top"),
    ("pass_x", "6.5 in", "Wire pass-through up to the electronics"),
    ("pass_y", "1 in", ""),
    ("tie_x", "1 in", "Zip-tie holes that anchor the wrist cable"),
    ("tie_y1", "5 in", ""),
    ("tie_y2", "4.5 in", ""),
    ("btn_hole", "28 mm", "Arcade button hole (check against the button's nut thread)"),
    ("pass_hole", "1 in", ""),
    ("tie_hole", "3 mm", ""),
]
V = {}  # values in inches
for _n, _e, _c in PARAMS:
    V[_n] = eval(_e.replace(" in", "").replace(" mm", " / 25.4"), {}, V)

HOLES = [  # id, purpose, x param, y param, diameter param
    ("H1", "HOME button (white)", "home_x", "col_y", "btn_hole"),
    ("H2", "GREEN target (40%)", "green_x", "col_y", "btn_hole"),
    ("H3", "BLUE target (70%)", "blue_x", "col_y", "btn_hole"),
    ("H4", "RED target (100%)", "red_x", "col_y", "btn_hole"),
    ("H5", "START button (yellow)", "start_x", "start_y", "btn_hole"),
    ("H6", "Wire pass-through (optional)", "pass_x", "pass_y", "pass_hole"),
    ("H7", "Zip tie, wrist cable", "tie_x", "tie_y1", "tie_hole"),
    ("H8", "Zip tie, wrist cable", "tie_x", "tie_y2", "tie_hole"),
]
SKETCH_ID = {"H1": "HOME", "H2": "GREEN", "H3": "BLUE", "H4": "RED", "H5": "START",
             "H6": "PASS", "H7": "TIE1", "H8": "TIE2"}
ZONES = [  # label, x0, y0, x1, y1 (inches): boards taped UNDER the deck, so no switch may sit above them
    ("ARDUINO UNO R4", 2.25, 0.2, 2.25 + 53.3 / IN, 0.2 + 68.6 / IN),
    ("DRIVER BOARD", 4.75, 2.5, 4.75 + 70 / IN, 2.5 + 50 / IN),
]
SWITCH_DEPTH = 45 / IN  # arcade button body + microswitch below the panel (measure yours)
BEZEL = 34 / IN


def dia(name):
    return V[name]


# ---------------------------------------------------------------------------
# SolidCraft script
# ---------------------------------------------------------------------------
def solidcraft_script():
    cmd = []
    add = lambda c, **p: cmd.append({"command": c, "params": p})
    add("document.units", units="in")
    for n, e, c in PARAMS:
        add("parameters.add", name=n, expression=e, comment=c)
    # Deck: an upside-down tray, cardboard thick.
    add("solid.box", length="deck_len", width="deck_wid", height="skirt_h", corner=[0, 0, 0],
        name="Mat blank", body_name="Mat")
    add("solid.shell", faces=[[100, 100, 0]], thickness="board_t", direction="inside", body="Mat")
    # Cut layout: one point per hole, dimensioned from O; the holes are drilled at the points.
    add("sketch.create", plane="XY", offset="skirt_h", name="Cut layout")
    for hid, _p, xp, yp, _d in HOLES:
        add("sketch.point", point=[round(V[xp] * IN, 3), round(V[yp] * IN, 3)], id=SKETCH_ID[hid])
    for hid, _p, xp, yp, _d in HOLES:
        add("sketch.dimension", entities=["origin", SKETCH_ID[hid]], type="horizontal", value=xp)
        add("sketch.dimension", entities=["origin", SKETCH_ID[hid]], type="vertical", value=yp)
    add("sketch.finish")
    for d in ("btn_hole", "pass_hole", "tie_hole"):
        add("solid.hole", sketch="Cut layout", points=[SKETCH_ID[h[0]] for h in HOLES if h[4] == d],
            diameter=d, targets=["Mat"], name=f"Holes {d}")
    # Stand-in parts (separate bodies, not cut) so the layout reads at a glance.
    color = {"H1": "#f2f2f2", "H2": "#2e9e44", "H3": "#2f6fd6", "H4": "#d63a2f", "H5": "#f2c230"}
    for hid, purpose, xp, yp, _d in HOLES[:5]:
        name = SKETCH_ID[hid]
        add("solid.cylinder", diameter="34 mm", height="10 mm", base=[xp, yp, "skirt_h"],
            operation="new", name=f"{name} button", body_name=f"{name} button")
        add("solid.cylinder", diameter="btn_hole", height="45 mm", base=[xp, yp, "skirt_h - 45 mm"],
            operation="new", name=f"{name} switch", body_name=f"{name} switch")
        add("appearance.assign", bodies=[f"{name} button", f"{name} switch"], color=color[hid])
    for (label, x0, y0, x1, y1), body, col in zip(ZONES, ("Arduino UNO R4 Minima", "Mat driver perfboard"),
                                                  ("#00878f", "#3a7d3a")):
        add("solid.box", length=f"{(x1 - x0) * IN:.1f} mm", width=f"{(y1 - y0) * IN:.1f} mm",
            height="15 mm", corner=[f"{x0} in", f"{y0} in", "skirt_h - board_z"], operation="new",
            name=label.title(), body_name=body)
        add("appearance.assign", bodies=[body], color=col)
    add("solid.cylinder", diameter="12 mm", height="9.5 mm", base=["buzz_x", "buzz_y", "skirt_h"],
        operation="new", name="Buzzer", body_name="Buzzer")
    add("appearance.assign", bodies=["Buzzer"], color="#202020")
    # See-through so the boards under the deck stay visible.
    add("appearance.assign", bodies=["Mat"], color="#b8895a", opacity=0.35)
    z = (V["skirt_h"] * IN) + 20
    for at, text in (
        ([-60, V["col_y"] * IN, z], "PATIENT END\nPut this edge about 2 in from the table edge.\n"
                                    "Right shoulder directly behind HOME."),
        ([V["red_x"] * IN + 60, V["col_y"] * IN, z], "Reach line: HOME, GREEN (40%), BLUE (70%), RED (100% of reach_D)"),
        ([V["start_x"] * IN, -50, z], "START (operator only) and the buzzer on top; Arduino and driver board taped under the deck.\n"
                                      "USB-C leaves the right-hand edge; the wrist cable leaves the patient end."),
    ):
        add("note.add", anchor=[round(v, 1) for v in at], text=text, hidden=True)  # show from the browser
    return cmd


def find_solidcraft():
    found = sorted(glob.glob(os.path.expanduser("~/Applications/solidcraft-*-linux-x86_64.AppImage")))
    return os.environ.get("SOLIDCRAFT_APPIMAGE") or (found[-1] if found else None)


# ---------------------------------------------------------------------------
# Drawing helpers (points; 72 pt = 1 in on paper)
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = landscape(letter)
M = 36  # border margin
SHEETS = 7


def fmt(v):
    return f"{v:.2f}"


def mm_of(v):
    return f"[{v * IN:.0f}]" if v * IN >= 10 else f"[{v * IN:.1f}]"


def frame(c, sheet, title, scale):
    c.setLineWidth(1.2)
    c.rect(M, M, PAGE_W - 2 * M, PAGE_H - 2 * M)
    # Title block, bottom right: 4 rows, right-hand column for scale / rev / sheet.
    w, h = 330, 86
    x, y = PAGE_W - M - w, M
    rows = [y + 86, y + 64, y + 50, y + 24, y]
    c.setLineWidth(0.8)
    c.rect(x, y, w, h)
    for yy in rows[1:4]:
        c.line(x, yy, x + w, yy)
    c.line(x + 230, rows[4], x + 230, rows[2])
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 6, rows[1] + 7, "REMOTION BUTTON MAT  (RIGHT-ARM REACH)")
    c.setFont("Helvetica", 7)
    c.drawString(x + 6, rows[2] + 4.5, "ReMotion  |  ECE 198 Group 19  |  client: CCCARE")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 6, rows[3] + 14, title)
    c.setFont("Helvetica", 6.5)
    c.drawString(x + 6, rows[3] + 4, "Single-wall corrugated cardboard, from an 18 x 11 x 12 in box")
    c.drawString(x + 236, rows[3] + 14, f"SCALE  {scale}")
    c.drawString(x + 236, rows[3] + 4, "REV A   2026-11-19")
    c.drawString(x + 6, rows[4] + 14, "UNITS: inches [mm]    TOLERANCE: +/- 1/16 in")
    c.drawString(x + 6, rows[4] + 4, "Generated by hardware/mat/make_button_mat.py")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 236, rows[4] + 8, f"SHEET {sheet} OF {SHEETS}")
    return x, y + h


def arrowhead(c, x, y, ang):
    import math
    L, W = 6, 2.2
    dx, dy = math.cos(ang), math.sin(ang)
    p = c.beginPath()
    p.moveTo(x, y)
    p.lineTo(x - L * dx + W * dy, y - L * dy - W * dx)
    p.lineTo(x - L * dx - W * dy, y - L * dy + W * dx)
    p.close()
    c.drawPath(p, fill=1, stroke=0)


def dim_h(c, x1, x2, y_feat, y_dim, label, size=7):
    """Horizontal dimension between feature x1, x2 (paper pt), dimension line at y_dim."""
    import math
    c.setLineWidth(0.4)
    for x in (x1, x2):
        c.line(x, y_feat + (2 if y_dim > y_feat else -2), x, y_dim + (3 if y_dim > y_feat else -3))
    c.line(x1, y_dim, x2, y_dim)
    arrowhead(c, x2, y_dim, 0)
    arrowhead(c, x1, y_dim, math.pi)
    c.setFont("Helvetica", size)
    tw = c.stringWidth(label, "Helvetica", size)
    mid = (x1 + x2) / 2
    c.setFillColorRGB(1, 1, 1)
    c.rect(mid - tw / 2 - 1.5, y_dim - size / 2 - 1, tw + 3, size + 2, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(mid, y_dim - size / 2 + 1, label)


def dim_v(c, y1, y2, x_feat, x_dim, label, size=7):
    import math
    c.setLineWidth(0.4)
    for y in (y1, y2):
        c.line(x_feat + (2 if x_dim > x_feat else -2), y, x_dim + (3 if x_dim > x_feat else -3), y)
    c.line(x_dim, y1, x_dim, y2)
    arrowhead(c, x_dim, y2, math.pi / 2)
    arrowhead(c, x_dim, y1, -math.pi / 2)
    c.saveState()
    c.translate(x_dim, (y1 + y2) / 2)
    c.rotate(90)
    c.setFont("Helvetica", size)
    tw = c.stringWidth(label, "Helvetica", size)
    c.setFillColorRGB(1, 1, 1)
    c.rect(-tw / 2 - 1.5, -size / 2 - 1, tw + 3, size + 2, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(0, -size / 2 + 1, label)
    c.restoreState()


def text_block(c, x, y, lines, size=8, lead=11, bold_first=False):
    for i, line in enumerate(lines):
        c.setFont("Helvetica-Bold" if (bold_first and i == 0) else "Helvetica", size)
        c.drawString(x, y - i * lead, line)
    return y - len(lines) * lead


# ---------------------------------------------------------------------------
# Sheet 1: cutting the box
# ---------------------------------------------------------------------------
def sheet_cut(c):
    frame(c, 1, "SHEET 1: CUT THE DECK OUT OF THE BOX", "1:5")
    s = 72 / 5  # 1:5
    L, W, K = V["deck_len"], V["deck_wid"], V["skirt_h"]
    ox, oy = M + 44, M + 200
    X = lambda v: ox + (v + K) * s
    Y = lambda v: oy + (v + K) * s
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M + 12, PAGE_H - M - 18, "FLAT LAYOUT OF THE ONE PIECE YOU CUT OUT  (outside face up)")
    # Deck + four skirts (cross shape). Solid = cut, dashed = fold.
    c.setLineWidth(1.4)
    pts = [(0, -K), (L, -K), (L, 0), (L + K, 0), (L + K, W), (L, W), (L, W + K), (0, W + K),
           (0, W), (-K, W), (-K, 0), (0, 0)]
    p = c.beginPath()
    p.moveTo(X(pts[0][0]), Y(pts[0][1]))
    for px, py in pts[1:]:
        p.lineTo(X(px), Y(py))
    p.close()
    c.drawPath(p)
    c.setDash(5, 3)
    c.setLineWidth(0.8)
    c.rect(X(0), Y(0), L * s, W * s)
    c.setDash()
    # Corner squares are waste: hatch them.
    c.setLineWidth(0.3)
    for cx, cy in ((-K, -K), (L, -K), (-K, W), (L, W)):
        for i in range(1, 6):
            t = i / 6 * K
            c.line(X(cx + t), Y(cy), X(cx), Y(cy + t))
            c.line(X(cx + K), Y(cy + t), X(cx + t), Y(cy + K))
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(X(L / 2), Y(W / 2) + 6, "DECK")
    c.setFont("Helvetica", 7)
    c.drawCentredString(X(L / 2), Y(W / 2) - 5, "one long 18 x 12 in wall, outside up")
    c.drawCentredString(X(L / 2), Y(W / 2) - 14, "(holes are cut later, sheet 2)")
    c.drawCentredString(X(L / 2), Y(W + K / 2) - 2, "SKIRT: box flap, trimmed to 2.5 in")
    c.drawCentredString(X(L / 2), Y(-K / 2) - 2, "SKIRT: box flap, trimmed to 2.5 in")
    for xx, txt in ((-K / 2, "SKIRT: end-wall strip"), (L + K / 2, "SKIRT: end-wall strip")):
        c.saveState()
        c.translate(X(xx) + 2, Y(W / 2))
        c.rotate(90)
        c.drawCentredString(0, 0, txt)
        c.restoreState()
    c.setFont("Helvetica", 6.5)
    c.drawString(X(L) + 2, Y(-K) - 9, "corners: waste")
    # Dimensions.
    dim_h(c, X(0), X(L), Y(W + K), Y(W + K) + 16, f"{fmt(L)} {mm_of(L)}")
    dim_h(c, X(-K), X(0), Y(-K), Y(-K) - 16, f"{fmt(K)} {mm_of(K)}")
    dim_h(c, X(-K), X(L + K), Y(-K), Y(-K) - 32, f"{fmt(L + 2 * K)} {mm_of(L + 2 * K)} overall")
    dim_v(c, Y(0), Y(W), X(L + K), X(L + K) + 16, f"{fmt(W)} {mm_of(W)}")
    dim_v(c, Y(W), Y(W + K), X(L + K), X(L + K) + 16, f"{fmt(K)}")
    dim_v(c, Y(-K), Y(W + K), X(-K), X(-K) - 16, f"{fmt(W + 2 * K)} {mm_of(W + 2 * K)} overall")
    # Legend.
    lx, ly = M + 44, M + 150
    c.setLineWidth(1.4)
    c.line(lx, ly, lx + 30, ly)
    c.setFont("Helvetica", 7.5)
    c.drawString(lx + 36, ly - 2.5, "CUT")
    c.setLineWidth(0.8)
    c.setDash(5, 3)
    c.line(lx + 80, ly, lx + 110, ly)
    c.setDash()
    c.drawString(lx + 116, ly - 2.5, "FOLD (skirts fold DOWN, 90 deg)")
    # Steps.
    tx, ty = PAGE_W - M - 300, PAGE_H - M - 22
    steps = [
        "STEPS",
        "1. Close and tape the box. Pick one LONG side (18 x 12 in) to be the deck.",
        "   Mark it 'TOP' on the outside.",
        "2. Flaps on the deck's two 18 in edges: keep them attached. Mark a line",
        "   2.5 in from the fold along each flap and cut the rest off.",
        "3. End walls on the deck's two 12 in edges: mark a line 2.5 in from the",
        "   corner fold, parallel to it, and cut along it, top to bottom.",
        "4. Cut the piece free: slit each corner along the fold where a flap meets",
        "   an end wall. Throw the hatched corner squares away (they are already",
        "   missing on a real box: the flaps and walls are separate there).",
        "5. Fold all four skirts DOWN (they are already at 90 deg on the box).",
        "   Tape each of the 4 corners inside and out with packing tape.",
        "6. Stand it on the table, deck up: it must sit flat without rocking.",
        "   Trim the skirt edges if it rocks.",
        "7. Cut the holes from the TOP, using sheet 2 or the 1:1 template",
        "   (sheets 4-7). Test-fit one button hole in a scrap piece first.",
        "",
        "Result: a deck 18 x 12 in, 2.5 in tall. Under the deck there is",
        f"{fmt(V['skirt_h'] - V['board_t'])} in of clearance; the button switches need about",
        f"{fmt(SWITCH_DEPTH)} in, so they stay clear of the table (sheet 3).",
        "",
        "Leftover cardboard: keep it for a stiffening rib if the deck flexes",
        "when a button is pressed (glue a 2.4 in tall strip under the deck",
        "between the reach line and the electronics, with a notch for wires).",
    ]
    text_block(c, tx, ty, steps, size=7.6, lead=10.6, bold_first=True)


# ---------------------------------------------------------------------------
# Sheet 2: deck layout and hole table
# ---------------------------------------------------------------------------
def deck_outline(c, X, Y, s, show_ids=True, crosshair=False):
    L, W = V["deck_len"], V["deck_wid"]
    c.setLineWidth(1.2)
    c.rect(X(0), Y(0), L * s, W * s)
    # Mount zones.
    c.setLineWidth(0.5)
    c.setDash(3, 2)
    for label, x0, y0, x1, y1 in ZONES:
        c.rect(X(x0), Y(y0), (x1 - x0) * s, (y1 - y0) * s)
        c.setFont("Helvetica", 6 if s < 40 else 9)
        c.drawCentredString(X((x0 + x1) / 2), Y((y0 + y1) / 2) - 2, label.split()[0] if s < 40 else label)
    c.setDash()
    for hid, purpose, xp, yp, dp in HOLES:
        x, y, r = X(V[xp]), Y(V[yp]), dia(dp) / 2 * s
        c.setLineWidth(1.0)
        c.circle(x, y, r)
        c.setLineWidth(0.3)
        k = max(r + 4, 6)
        c.line(x - k, y, x + k, y)
        c.line(x, y - k, x, y + k)
        if show_ids:
            c.setFont("Helvetica-Bold", 6.5 if s < 40 else 10)
            c.drawString(x + k + 1, y + 2, hid)
        if crosshair:
            c.setFont("Helvetica", 7)
            c.drawString(x + k + 1, y - 8, purpose)


def sheet_layout(c):
    frame(c, 2, "SHEET 2: DECK HOLE LAYOUT (TOP VIEW)", "1:3")
    s = 72 / 3
    ox, oy = M + 56, M + 196
    X = lambda v: ox + v * s
    Y = lambda v: oy + v * s
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M + 12, PAGE_H - M - 18, "TOP VIEW OF THE DECK, PATIENT SITS AT THE LEFT EDGE FACING RIGHT")
    deck_outline(c, X, Y, s)
    L, W = V["deck_len"], V["deck_wid"]
    # Origin and axes.
    c.setLineWidth(0.8)
    c.circle(X(0), Y(0), 3, fill=1)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(X(0) - 12, Y(0) - 12, "O")
    c.setFont("Helvetica", 7)
    c.drawString(X(0) + 4, Y(0) - 22, "X ->  (reach direction)")
    c.drawString(X(0) - 44, Y(0) + 6, "Y")
    c.drawString(X(0) - 44, Y(0) - 3, "^")
    # Patient marker.
    c.setFont("Helvetica-Bold", 8)
    c.saveState()
    c.translate(X(0) - 26, Y(W / 2) + 10)
    c.rotate(90)
    c.drawCentredString(0, 0, "PATIENT  (right shoulder behind H1)")
    c.restoreState()
    # Chain dimensions along the reach line (above the deck) and overall sizes.
    col = V["col_y"]
    xs = [0, V["home_x"], V["green_x"], V["blue_x"], V["red_x"]]
    for a, b in zip(xs, xs[1:]):
        dim_h(c, X(a), X(b), Y(W), Y(W) + 14, fmt(b - a), size=6.5)
    dim_h(c, X(V["home_x"]), X(V["red_x"]), Y(W), Y(W) + 30, f"reach_D = {fmt(V['reach_D'])} {mm_of(V['reach_D'])}", size=6.5)
    dim_h(c, X(0), X(L), Y(0), Y(0) - 36, f"{fmt(L)} {mm_of(L)}")
    dim_v(c, Y(0), Y(W), X(L), X(L) + 16, f"{fmt(W)} {mm_of(W)}")
    dim_v(c, Y(0), Y(col), X(V["red_x"]) + 0, X(L) + 30, f"{fmt(col)}", size=6.5)
    c.setLineWidth(0.3)
    c.setDash(1, 2)
    c.line(X(V["home_x"]), Y(col), X(L) + 33, Y(col))
    c.setDash()
    # Hole table (ordinate coordinates from O).
    tx, ty = M + 14, oy - 56
    cols = [0, 30, 150, 196, 242, 330]
    heads = ["HOLE", "PURPOSE", "X", "Y", "DIAMETER"]
    rowh = 12.5
    c.setFont("Helvetica-Bold", 9)
    c.drawString(tx, ty + 6, "HOLE TABLE  (hole centres measured from O, inches)")
    c.setLineWidth(0.6)
    rows = [(h[0], h[1], fmt(V[h[2]]), fmt(V[h[3]]),
             f"{V[h[4]] * IN:.0f} mm" if h[4] != "pass_hole" else '1.00 in [25]') for h in HOLES]
    for i, row in enumerate([heads] + rows):
        y = ty - i * rowh
        c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 7)
        for j, cell in enumerate(row):
            c.drawString(tx + cols[j] + 3, y - 9, cell)
        c.line(tx, y - rowh + 0.5, tx + cols[-1], y - rowh + 0.5)
    top, bot = ty, ty - (len(rows) + 1) * rowh + 0.5
    for xcol in cols:
        c.line(tx + xcol, top, tx + xcol, bot)
    c.line(tx, top, tx + cols[-1], top)
    notes = [
        "NOTES",
        "1. Cut every hole from the TOP (outside)",
        "   face: sharp box cutter, or a 1-1/8 in",
        "   hole saw / step drill. Test-fit H1 in",
        "   scrap first. 28 mm suits most 30 mm",
        "   arcade buttons; open to 30 mm if tight.",
        "2. H1-H4 lie on one line, 8.75 in from",
        "   the right-hand edge. GREEN, BLUE and",
        "   RED sit at 40, 70 and 100 % of",
        "   reach_D = 13 in from HOME.",
        "3. Dashed boxes: the Arduino and the",
        "   driver board are taped UNDER the deck,",
        "   clear of the switches. USB-C faces the",
        "   right-hand edge. Buzzer: taped on top",
        f"   at X {fmt(V['buzz_x'])}, Y {fmt(V['buzz_y'])} (no hole).",
        "4. All wiring stays under the deck. H6 is",
        "   only needed for wires that come up",
        "   (e.g. the buzzer's); skip it if none do.",
        "   The wrist cable leaves at the patient",
        "   end, zip-tied through H7 / H8.",
        "5. Left-arm mat: mirror Y (Y' = 12 - Y).",
        "6. Per tester: slide the WHOLE mat until",
        "   H4 (RED) is about 3/4 in inside their",
        "   no-lean reach. Tape it down; record it.",
    ]
    text_block(c, PAGE_W - M - 176, PAGE_H - M - 40, notes, size=7.2, lead=10, bold_first=True)


# ---------------------------------------------------------------------------
# Sheet 3: section A-A along the reach line + iso view
# ---------------------------------------------------------------------------
def sheet_section(c, iso_png):
    frame(c, 3, "SHEET 3: SECTION A-A AND ASSEMBLY VIEW", "1:2.5 (section)")
    s = 72 / 2.5
    ox, oy = M + 52, PAGE_H - M - 160
    X = lambda v: ox + v * s
    Z = lambda v: oy + v * s
    L, K, T = V["deck_len"], V["skirt_h"], V["board_t"]
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M + 12, PAGE_H - M - 18, "SECTION A-A  (cut along the reach line, Y = 8.75 in, seen from the right-hand side)")
    # Table.
    c.setLineWidth(1.5)
    c.line(X(-1), Z(0), X(L + 1), Z(0))
    c.setFont("Helvetica", 7)
    c.drawString(X(L + 1) - 30, Z(0) - 10, "TABLE")
    # Deck and skirts (cardboard hatched as solid fill).
    c.setFillColorRGB(0.72, 0.54, 0.35)
    holes = sorted([(V[h[2]], dia(h[4])) for h in HOLES[:4]])
    x = 0
    for hx, d in holes:
        c.rect(X(x), Z(K - T), (hx - d / 2 - x) * s, T * s, fill=1, stroke=1)
        x = hx + d / 2
    c.rect(X(x), Z(K - T), (L - x) * s, T * s, fill=1, stroke=1)
    c.rect(X(0), Z(0), T * s, (K - T) * s, fill=1, stroke=1)
    c.rect(X(L - T), Z(0), T * s, (K - T) * s, fill=1, stroke=1)
    # Buttons: bezel above the deck, switch body below.
    for (hx, d), (r, g, b) in zip(holes, ((0.93, 0.93, 0.93), (0.2, 0.62, 0.27), (0.18, 0.44, 0.84), (0.84, 0.23, 0.18))):
        c.setFillColorRGB(r, g, b)
        c.rect(X(hx - BEZEL / 2), Z(K), BEZEL * s, (10 / IN) * s, fill=1, stroke=1)
        c.rect(X(hx - d / 2), Z(K - SWITCH_DEPTH), d * s, (SWITCH_DEPTH - T) * s, fill=1, stroke=1)
    c.setFillColorRGB(0, 0, 0)
    names = ["H1 HOME", "H2 GREEN", "H3 BLUE", "H4 RED"]
    c.setFont("Helvetica-Bold", 7)
    for (hx, _d), n in zip(holes, names):
        c.drawCentredString(X(hx), Z(K) + 18, n)
    # Dimensions.
    h4 = holes[-1][0]
    dim_v(c, Z(0), Z(K), X(0), X(0) - 18, f"{fmt(K)} {mm_of(K)}")
    dim_v(c, Z(K - SWITCH_DEPTH), Z(K - T), X(h4) + 14, X(h4) + 30, f"switch ~{fmt(SWITCH_DEPTH)} {mm_of(SWITCH_DEPTH)}", size=6.5)
    dim_v(c, Z(0), Z(K - SWITCH_DEPTH), X(h4) + 14, X(h4) + 52, f"{fmt(K - SWITCH_DEPTH)} clear", size=6.5)
    dim_v(c, Z(K - T), Z(K), X(L), X(L) + 16, f"{fmt(T)} board", size=6.5)
    dim_h(c, X(0), X(L), Z(0), Z(0) - 18, f"{fmt(L)} {mm_of(L)}")
    # Iso view from the SolidCraft model, if rendered.
    if iso_png and os.path.exists(iso_png):
        w = 300
        c.drawImage(iso_png, M + 20, M + 20, width=w, height=w * 2 / 3, preserveAspectRatio=True, mask="auto")
        c.setFont("Helvetica-Bold", 8)
        c.drawString(M + 24, M + 20 + w * 2 / 3 + 2, "ASSEMBLY VIEW (SolidCraft model button_mat.sc)")
    # Wiring notes.
    tx, ty = M + 350, M + 220
    wiring = [
        "WIRING UNDER THE DECK  (pads on the mat driver board, see kicad/perfboard/BUILD.md)",
        "Each arcade button has 4 tabs: 2 switch tabs, LED + and LED -.",
        "  Switch tab 1  ->  Arduino D2 START, D3 HOME, D4 GREEN, D5 BLUE, D6 RED",
        "  Switch tab 2  ->  daisy-chain GND through all 5 buttons  ->  pad K11",
        "  LED +         ->  daisy-chain 5V through HOME, GREEN, BLUE, RED  ->  pad I11",
        "  LED -         ->  HOME J10, GREEN M10, BLUE P10, RED S10  (START LED: none)",
        "Label every wire at both ends; tape them to the underside.",
        "",
        "Wrist cable: 5 wires (3V3, GND, SCL, SDA, VCC) from pads C18-H18. Leave",
        "enough slack to reach H4 with the arm straight (about reach_D + 12 in).",
    ]
    text_block(c, tx, ty, wiring, size=7.2, lead=10.5, bold_first=True)


# ---------------------------------------------------------------------------
# Sheets 4-7: 1:1 template, tiled over four Letter pages
# ---------------------------------------------------------------------------
def sheet_template(c, sheet, col, row):
    L, W = V["deck_len"], V["deck_wid"]
    s = 72.0
    # Each tile shows a 9.6 x 6.6 in window; neighbours overlap by about 0.6 in.
    win_w, win_h = 9.6, 6.6
    x0 = 0 if col == 0 else L - win_w
    y0 = 0 if row == 0 else W - win_h
    ox, oy = M + 18 - x0 * s, M + 30 - y0 * s
    X = lambda v: ox + v * s
    Y = lambda v: oy + v * s
    c.saveState()
    p = c.beginPath()
    p.rect(M + 18, M + 30, win_w * s, win_h * s)
    c.clipPath(p, stroke=0)
    deck_outline(c, X, Y, s, show_ids=True, crosshair=True)
    # 1-inch grid ticks along the deck edges for alignment.
    c.setLineWidth(0.3)
    for i in range(int(L) + 1):
        c.line(X(i), Y(0), X(i), Y(0) + 6)
        c.line(X(i), Y(W), X(i), Y(W) - 6)
    for j in range(int(W) + 1):
        c.line(X(0), Y(j), X(0) + 6, Y(j))
        c.line(X(L), Y(j), X(L) - 6, Y(j))
    # Alignment crosses at 6 in intervals, shared by neighbouring tiles.
    c.setLineWidth(0.6)
    for ax in (6, 9, 12):
        for ay in (3, 6, 9):
            c.line(X(ax) - 8, Y(ay), X(ax) + 8, Y(ay))
            c.line(X(ax), Y(ay) - 8, X(ax), Y(ay) + 8)
            c.setFont("Helvetica", 5.5)
            c.drawString(X(ax) + 2, Y(ay) + 2, f"{ax},{ay}")
    c.restoreState()
    c.setLineWidth(0.6)
    c.setDash(2, 2)
    c.rect(M + 18, M + 30, win_w * s, win_h * s)
    c.setDash()
    c.setFont("Helvetica-Bold", 10)
    tile = "AB"[col] + "12"[row]
    c.drawString(M + 18, PAGE_H - M - 16, f"1:1 TEMPLATE, TILE {tile}  (print at 100 %, 'actual size', no fit-to-page)")
    c.setFont("Helvetica", 7.5)
    c.drawString(M + 18, PAGE_H - M - 28,
                 "Trim along the dashed window on overlapping sides, line up the crosses (labelled X,Y in inches) with the "
                 "neighbouring tile, tape, then tape the whole template to the deck with O on the deck's corner.")
    # Scale check bar.
    bx, by = M + 18, M + 14
    c.setLineWidth(1)
    c.line(bx, by, bx + 4 * 72, by)
    for i in range(5):
        c.line(bx + i * 72, by - 3, bx + i * 72, by + 3)
    c.setFont("Helvetica", 7)
    c.drawString(bx + 4 * 72 + 6, by - 2.5, "SCALE CHECK: this bar must measure exactly 4 in [101.6 mm]")
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(PAGE_W - M - 6, M + 6, f"SHEET {sheet} OF {SHEETS}   REMOTION BUTTON MAT   1:1")
    c.setLineWidth(1.2)
    c.rect(M, M, PAGE_W - 2 * M, PAGE_H - 2 * M)


def write_pdf(path, iso_png):
    c = canvas.Canvas(path, pagesize=landscape(letter))
    c.setTitle("ReMotion button mat: shop drawing")
    c.setAuthor("ECE 198 Group 19")
    sheet_cut(c)
    c.showPage()
    sheet_layout(c)
    c.showPage()
    sheet_section(c, iso_png)
    c.showPage()
    for sheet, (col, row) in zip(range(4, 8), ((0, 0), (1, 0), (0, 1), (1, 1))):
        sheet_template(c, sheet, col, row)
        c.showPage()
    c.save()


def check():
    """Holes sit on the deck, clear of each other, the skirts and the mount zones."""
    L, W, T = V["deck_len"], V["deck_wid"], V["board_t"]
    pts = [(h[0], V[h[2]], V[h[3]], dia(h[4]) / 2 + (BEZEL / 2 - dia(h[4]) / 2 if h[4] == "btn_hole" else 0))
           for h in HOLES]
    for hid, x, y, r in pts:
        assert T + r <= x <= L - T - r and T + r <= y <= W - T - r, f"{hid} runs into a skirt"
        for _l, x0, y0, x1, y1 in ZONES:
            assert not (x0 - r < x < x1 + r and y0 - r < y < y1 + r), f"{hid} is under a mounted board"
    for i, (a, xa, ya, ra) in enumerate(pts):
        for b, xb, yb, rb in pts[i + 1:]:
            assert ((xa - xb) ** 2 + (ya - yb) ** 2) ** 0.5 > ra + rb + 0.1, f"{a} and {b} are too close"
    assert V["skirt_h"] - V["board_t"] > SWITCH_DEPTH, "switches would touch the table"
    assert 15 / IN < V["board_z"] - V["board_t"] < V["skirt_h"], "boards must fit between the table and the deck"


def main():
    check()
    script = os.path.join(HERE, "button_mat.json")
    json.dump(solidcraft_script(), open(script, "w"), indent=1)
    iso = None
    app = find_solidcraft()
    if app:
        env = dict(os.environ, SOLIDCRAFT_APPIMAGE_CLI="1")
        design = os.path.join(HERE, "button_mat.sc")
        subprocess.run([app, "run", script, "--save", design, "--param-check", "strict", "--quiet"],
                       check=True, env=env)
        iso = os.path.join(HERE, "button_mat_iso.png")
        subprocess.run([app, "snapshot", "--in", design, "--out", iso, "--view", "iso", "--width", "1500",
                        "--height", "1000", "--no-grid", "--no-axes"], check=True, env=env,
                       stdout=subprocess.DEVNULL)
        print("wrote button_mat.sc and button_mat_iso.png")
    else:
        print("SolidCraft not found: wrote button_mat.json only (run it with solidcraft-cli run)")
    write_pdf(os.path.join(HERE, "button-mat-drawing.pdf"), iso)
    print("wrote button-mat-drawing.pdf")


if __name__ == "__main__":
    main()
