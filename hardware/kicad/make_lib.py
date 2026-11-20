"""Builds ECE198.kicad_sym: every part in the IMU Reach Tracker in one KiCad library.
Run: python3 make_lib.py   (then: kicad-cli sym upgrade ECE198.kicad_sym to normalise)"""
import re, os
KI = "/usr/share/kicad/symbols"
HERE = os.path.dirname(os.path.abspath(__file__))
F = '(effects (font (size 1.27 1.27)))'
FH = '(effects (font (size 1.27 1.27)) (hide yes))'


def block(lib, name):
    txt = open(os.path.join(KI, lib)).read()
    m = re.search(r'^\t\(symbol "%s"\n.*?^\t\)\n' % re.escape(name), txt, re.S | re.M)
    return m.group(0)


def copy(lib, name, new, value, footprint=None, desc=None, datasheet=None, ref=None):
    b = block(lib, name)
    ext = re.search(r'\(extends "([^"]+)"\)', b)
    if ext:  # flatten: take the parent's body, keep the child's properties
        parent = block(lib, ext.group(1))
        child_props = re.findall(r'\t\t\(property "([^"]+)" "((?:[^"\\]|\\.)*)"', b)
        b = parent.replace('"%s"' % ext.group(1), '"%s"' % name, 1)
        b = re.sub(r'"%s_(\d+_\d+)"' % re.escape(ext.group(1)), r'"%s_\1"' % name, b)
        for k, v in child_props:
            b = re.sub(r'(\t\t\(property "%s" )"(?:[^"\\]|\\.)*"' % re.escape(k), lambda m: m.group(1) + '"%s"' % v, b, count=1)
    b = b.replace('(symbol "%s"' % name, '(symbol "%s"' % new, 1)
    b = re.sub(r'"%s_(\d+_\d+)"' % re.escape(name), r'"%s_\1"' % new, b)
    for k, v in (("Value", value), ("Footprint", footprint), ("Description", desc), ("Datasheet", datasheet), ("Reference", ref)):
        if v is not None:
            b = re.sub(r'(\t\t\(property "%s" )"(?:[^"\\]|\\.)*"' % k, lambda m: m.group(1) + '"%s"' % v, b, count=1)
    return b


def pin(kind, x, y, ang, name, num):
    return f'(pin {kind} line (at {x} {y} {ang}) (length 2.54) (name "{name}" {F}) (number "{num}" {F}))'


def custom(name, ref, value, fp, desc, rect, pins, texts=()):
    (x1, y1), (x2, y2) = rect
    props = (f'(property "Reference" "{ref}" (at {x1} {y1 + 1.27} 0) (effects (font (size 1.27 1.27)) (justify left)))'
             f'(property "Value" "{value}" (at {x1} {y2 - 1.27} 0) (effects (font (size 1.27 1.27)) (justify left)))'
             f'(property "Footprint" "{fp}" (at 0 0 0) {FH})'
             f'(property "Datasheet" "" (at 0 0 0) {FH})'
             f'(property "Description" "{desc}" (at 0 0 0) {FH})')
    body = f'(rectangle (start {x1} {y1}) (end {x2} {y2}) (stroke (width 0.254) (type default)) (fill (type background)))'
    body += "".join(f'(text "{t}" (at {tx} {ty} 0) (effects (font (size 1.27 1.27))))' for t, tx, ty in texts)
    return (f'\t(symbol "{name}" (pin_names (offset 1.016)) (exclude_from_sim no) (in_bom yes) (on_board yes) {props}'
            f'(symbol "{name}_0_1" {body}) (symbol "{name}_1_1" {" ".join(pins)}))\n')


syms = []
# --- custom: GY-521 ---------------------------------------------------------
gy = [("VCC", "power_in"), ("GND", "power_in"), ("SCL", "input"), ("SDA", "bidirectional"),
      ("XDA", "bidirectional"), ("XCL", "output"), ("AD0", "input"), ("INT", "output")]
syms.append(custom("GY-521", "U", "GY-521", "Connector_PinHeader_2.54mm:PinHeader_1x08_P2.54mm_Vertical",
                   "GY-521 MPU-6050 accel+gyro breakout (5 V in via onboard 3.3 V regulator; I2C pins are 3.3 V). AD0 open = 0x68, AD0 to 3.3 V = 0x69. Chest = 0x68, wrist = 0x69.",
                   ((-7.62, 12.7), (12.7, -10.16)),
                   [pin(k, -10.16, 10.16 - 2.54 * i, 0, n, i + 1) for i, (n, k) in enumerate(gy)],
                   [("MPU-6050", 6.35, 0)]))
# --- custom: Adafruit 757 level shifter --------------------------------------
L = [("LV", "power_in"), ("A1", "bidirectional"), ("A2", "bidirectional"), ("A3", "bidirectional"), ("A4", "bidirectional"), ("GND", "power_in")]
R = [("HV", "power_in"), ("B1", "bidirectional"), ("B2", "bidirectional"), ("B3", "bidirectional"), ("B4", "bidirectional"), ("GND", "power_in")]
syms.append(custom("Adafruit_757_BSS138", "U", "Adafruit 757", "",
                   "Adafruit 757 4-channel I2C-safe bidirectional level shifter (BSS138). LV = 3.3 V side (A pins), HV = 5 V side (B pins). Pin numbers are by name, not physical order: check the board silkscreen.",
                   ((-10.16, 10.16), (10.16, -7.62)),
                   [pin(k, -12.7, 7.62 - 2.54 * i, 0, n, i + 1) for i, (n, k) in enumerate(L)] +
                   [pin(k, 12.7, 7.62 - 2.54 * i, 180, n, i + 7) for i, (n, k) in enumerate(R)]))
# --- copies with our values preset ---------------------------------------------
syms.append(copy("MCU_Module.kicad_sym", "Arduino_UNO_R3", "Arduino_UNO_R4_Minima", "Arduino UNO R4 Minima",
                 desc="Arduino UNO R4 Minima (Renesas RA4M1, 5 V logic). Same header pinout as the UNO R3. GPIO max ~8 mA per pin.",
                 datasheet="https://docs.arduino.cc/hardware/uno-r4-minima/"))
syms.append(copy("Switch.kicad_sym", "SW_Push_LED", "Arcade_Button_LED", "30mm arcade button",
                 footprint="", desc="30 mm arcade button with built-in 5 V LED. Pins 1-2 = microswitch (pin to Arduino, other to GND, INPUT_PULLUP). Pin 4 = LED A(+) to 5 V, pin 3 = LED K(-) to 2N3904 collector."))
syms.append(copy("Device.kicad_sym", "Buzzer", "CMI-1295-0585T", "CMI-1295-0585T",
                 footprint="Buzzer_Beeper:Buzzer_12x9.5RM7.6",
                 desc="CUI CMI-1295-0585T 5 V magnetic buzzer, 12 mm. Drive via 2N3904 low-side switch with 1N4148 flyback diode (stripe to 5 V).",
                 datasheet="https://www.sameskydevices.com/product/resource/cmi-1295-0585t.pdf"))
syms.append(copy("Transistor_BJT.kicad_sym", "2N3904", "2N3904", "2N3904"))
syms.append(copy("Diode.kicad_sym", "1N4148", "1N4148", "1N4148"))
RFP = "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal"
syms.append(copy("Device.kicad_sym", "R", "R_1k", "1k", footprint=RFP, desc="1 kOhm 1/4 W (transistor base)"))
syms.append(copy("Device.kicad_sym", "R", "R_10k", "10k", footprint=RFP, desc="10 kOhm 1/4 W"))
syms.append(copy("Connector_Generic.kicad_sym", "Conn_01x04", "Cable_Wrist_4pin", "Wrist cable", footprint="Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical",
                 desc="Flat cable to wrist box: 1 VCC, 2 SDA, 3 GND, 4 SCL (GND between SDA and SCL)"))
syms.append(copy("Connector_Generic.kicad_sym", "Conn_01x05", "Cable_Chest_5pin", "Chest cable", footprint="Connector_PinHeader_2.54mm:PinHeader_1x05_P2.54mm_Vertical",
                 desc="Cable to chest box: 1 VCC, 2 SDA, 3 GND, 4 SCL, 5 AD0 (extra wire)"))

open(os.path.join(HERE, "ECE198.kicad_sym"), "w").write(
    '(kicad_symbol_lib\n\t(version 20251024)\n\t(generator "kicad_symbol_editor")\n\t(generator_version "10.0")\n' + "".join(syms) + ')\n')
print("wrote", len(syms), "symbols")
