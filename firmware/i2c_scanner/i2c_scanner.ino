/*
  i2c_scanner.ino  —  IMU Reach Tracker, ECE 198 Group 19

  PURPOSE
    First bring-up test. Scans the I2C bus every 3 seconds and prints every
    device that answers. With both IMUs wired correctly you should see:
        0x68  -> wrist IMU (U2, AD0 unconnected)
        0x69  -> chest IMU (U1, AD0 tied to 3.3V)

    It also reads each IMU's WHO_AM_I register (0x75). A genuine MPU-6050
    answers 0x68. Clone chips sometimes answer something else (e.g. 0x70,
    0x72, 0x98). If so, the Adafruit library may refuse to start them, so
    tell the team.

  HOW TO USE
    Flash, open Serial Monitor at 115200 baud. Nothing else to wire.

  TROUBLESHOOTING
    - Nothing found: check 5V / 3.3V / GND to the level shifter, and that
      SDA->B1 and SCL->B2 (Arduino side), A1/A2 to the IMUs (3.3V side).
    - Only 0x68 found: chest AD0 is not reaching 3.3V (both IMUs are at 0x68
      and fighting) or the chest IMU is unplugged.
    - Only 0x69 found: wrist IMU unplugged or its SDA/SCL swapped.
*/

#include <Wire.h>

// ---------------- Settings ----------------
const uint32_t I2C_CLOCK_HZ   = 100000;  // 100 kHz: required for our long IMU cables
const uint32_t SCAN_PERIOD_MS = 3000;    // how often to rescan

const uint8_t ADDR_WRIST = 0x68;
const uint8_t ADDR_CHEST = 0x69;
const uint8_t REG_WHO_AM_I = 0x75;       // MPU-6050 identity register

uint32_t lastScanMs = 0;
bool firstScan = true;

// Read one register from an I2C device. Returns -1 if the device did not answer.
int readRegister(uint8_t addr, uint8_t reg) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return -1;   // false = repeated start
  if (Wire.requestFrom(addr, (uint8_t)1) != 1) return -1;
  return Wire.read();
}

// Print a byte as 0xNN
void printHex(uint8_t value) {
  Serial.print("0x");
  if (value < 0x10) Serial.print('0');
  Serial.print(value, HEX);
}

void scanBus() {
  Serial.println("# ---- scanning I2C bus ----");
  int found = 0;
  bool wristFound = false;
  bool chestFound = false;

  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t result = Wire.endTransmission();
    if (result != 0) continue;            // 0 means the device ACKed

    found++;
    Serial.print("# found ");
    printHex(addr);

    if (addr == ADDR_WRIST || addr == ADDR_CHEST) {
      if (addr == ADDR_WRIST) { Serial.print("  (wrist IMU)"); wristFound = true; }
      else                    { Serial.print("  (chest IMU)"); chestFound = true; }

      int who = readRegister(addr, REG_WHO_AM_I);
      Serial.print("  WHO_AM_I=");
      if (who < 0) {
        Serial.print("read failed");
      } else {
        printHex((uint8_t)who);
        if (who == 0x68) Serial.print(" (genuine MPU-6050)");
        else             Serial.print(" (CLONE / different chip: library may reject it)");
      }
    } else {
      Serial.print("  (unexpected device)");
    }
    Serial.println();
  }

  Serial.print("# devices found: ");
  Serial.println(found);
  if (!wristFound) Serial.println("E,wrist IMU (0x68) not found");
  if (!chestFound) Serial.println("E,chest IMU (0x69) not found");
  if (wristFound && chestFound) Serial.println("# OK: both IMUs present");
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  // Wait up to 3 s for the Serial Monitor so the first scan isn't missed.
  while (!Serial && millis() < 3000) { }

  Wire.begin();
  Wire.setClock(I2C_CLOCK_HZ);
  Serial.println("# I2C scanner ready (expect 0x68 wrist and 0x69 chest)");
}

void loop() {
  uint32_t now = millis();
  if (firstScan || now - lastScanMs >= SCAN_PERIOD_MS) {
    firstScan = false;
    lastScanMs = now;
    scanBus();
  }
}
