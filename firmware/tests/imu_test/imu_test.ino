/*
  imu_test.ino  —  IMU Reach Tracker, ECE 198 Group 19

  PURPOSE
    Bench test for both IMUs. Prints the live trunk angle (from the chest IMU)
    and the wrist rotation speed (from the wrist IMU) 10 times per second.

    Output is in Arduino "Serial Plotter" format, e.g.
        trunk_deg:12.3 wrist_dps:45.0 wrist_gx:-3.1 wrist_gy:44.2 wrist_gz:8.0 chest_ax:0.12 chest_ay:9.79 chest_az:0.30
    so you can open Tools > Serial Plotter and see live graphs.

  WHAT EACH VALUE MEANS
    trunk_deg   How far the chest IMU has tilted away from "upright" (set at
                calibration), in degrees, in any direction. This is the number
                the main sketch uses to detect leaning.
    wrist_dps   Total wrist rotation speed in deg/s, whichever way it turns:
                sqrt(gx^2 + gy^2 + gz^2). The main sketch uses it to count
                movement "bursts".
    wrist_gx/gy/gz  The same rotation split into the IMU's three axes (deg/s,
                sign = direction). Use these to see which way the wrist turns.
    chest_ax/ay/az  Raw chest accelerometer, m/s^2. Held still, the axis
                pointing up reads about +9.8.
    wrist_ax/ay/az  Raw wrist accelerometer, only printed if SHOW_WRIST_ACCEL is
                true (the Arduino IDE 2 plotter only shows the first 8 values).

  HOW TO USE
    1. Flash, open Serial Monitor / Plotter at 115200.
    2. Hold the chest IMU still in its "upright" position.
    3. Press START (D2) or send the letter 'c' to calibrate (3 s, keep still).
    4. Tilt the chest IMU: trunk_deg should follow the tilt angle in degrees.
       Spin the wrist IMU: wrist_dps should jump up.

  Uses the same trunk-angle maths as the main sketch:
    base  = average accelerometer direction while upright (normalised)
    angle = acos( dot(a, base) / |a| )   in degrees, then smoothed.

  Libraries: Adafruit MPU6050 (+ Adafruit Unified Sensor, Adafruit BusIO)
*/

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// ---------------- Pins / addresses ----------------
const uint8_t PIN_BTN_START = 2;      // SW5, LOW = pressed
const uint8_t ADDR_WRIST = 0x69;      // AD0 tied to 3.3V on the wrist board
const uint8_t ADDR_CHEST = 0x68;      // AD0 unconnected

// ---------------- Settings ----------------
const uint32_t I2C_CLOCK_HZ     = 100000;   // 100 kHz for long cables
const uint32_t SAMPLE_PERIOD_US = 10000;    // 100 Hz sampling
const uint32_t PRINT_PERIOD_MS  = 100;      // print 10 times per second
const uint32_t CALIB_MS         = 3000;     // calibration length
const float    TRUNK_ALPHA      = 0.15;     // smoothing (0..1, bigger = less smoothing)
const float    MIN_ACCEL_MS2    = 2.0;      // ignore samples with almost no gravity reading
const float    RAD_TO_DEGREES   = 57.29578;
const bool     SHOW_WRIST_ACCEL = false;    // true = also print wrist ax/ay/az (Serial Monitor)

Adafruit_MPU6050 chest;
Adafruit_MPU6050 wrist;

// Calibration
bool calibrating = false;
bool calibrated  = false;
uint32_t calibStartMs = 0;
float sumX = 0, sumY = 0, sumZ = 0;
uint16_t calibCount = 0;
float baseX = 0, baseY = 0, baseZ = 1;   // unit vector "upright"

// Live values
float trunkDeg = 0;
float wristDps = 0;
float lastAx = 0, lastAy = 0, lastAz = 0;        // chest accel, m/s^2
float wristGx = 0, wristGy = 0, wristGz = 0;     // wrist gyro per axis, deg/s
float wristAx = 0, wristAy = 0, wristAz = 0;     // wrist accel, m/s^2

uint32_t lastSampleUs = 0;
uint32_t lastPrintMs = 0;
bool lastStartPressed = false;

void startCalibration() {
  calibrating = true;
  calibStartMs = millis();
  sumX = sumY = sumZ = 0;
  calibCount = 0;
  Serial.println("# calibrating: keep the chest IMU still for 3 s...");
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) { }
  pinMode(PIN_BTN_START, INPUT_PULLUP);

  bool chestOk = chest.begin(ADDR_CHEST, &Wire);
  bool wristOk = wrist.begin(ADDR_WRIST, &Wire);
  Wire.setClock(I2C_CLOCK_HZ);

  if (!chestOk) Serial.println("E,chest IMU (0x68) not found - run i2c_scanner");
  if (!wristOk) Serial.println("E,wrist IMU (0x69) not found - run i2c_scanner");
  while (!chestOk || !wristOk) { }   // stop here; fix wiring and press reset

  // Same sensor settings as the main sketch
  chest.setAccelerometerRange(MPU6050_RANGE_4_G);
  chest.setGyroRange(MPU6050_RANGE_500_DEG);
  chest.setFilterBandwidth(MPU6050_BAND_21_HZ);
  wrist.setAccelerometerRange(MPU6050_RANGE_4_G);
  wrist.setGyroRange(MPU6050_RANGE_500_DEG);
  wrist.setFilterBandwidth(MPU6050_BAND_21_HZ);

  Serial.println("# both IMUs found. Press START or send 'c' to calibrate.");
  lastSampleUs = micros();
}

void loop() {
  // ---- Calibrate on START press or 'c' over serial ----
  bool startPressed = (digitalRead(PIN_BTN_START) == LOW);
  if (startPressed && !lastStartPressed && !calibrating) startCalibration();
  lastStartPressed = startPressed;
  if (Serial.available()) {
    char c = Serial.read();
    if ((c == 'c' || c == 'C') && !calibrating) startCalibration();
  }

  // ---- 100 Hz sampling with micros() timing ----
  uint32_t nowUs = micros();
  if (nowUs - lastSampleUs < SAMPLE_PERIOD_US) return;
  lastSampleUs += SAMPLE_PERIOD_US;

  sensors_event_t ca, cg, ct, wa, wg, wt;
  chest.getEvent(&ca, &cg, &ct);
  wrist.getEvent(&wa, &wg, &wt);

  float ax = ca.acceleration.x, ay = ca.acceleration.y, az = ca.acceleration.z;
  lastAx = ax; lastAy = ay; lastAz = az;

  // Wrist speed = length of the gyro vector, in deg/s
  float gx = wg.gyro.x, gy = wg.gyro.y, gz = wg.gyro.z;
  wristDps = sqrt(gx * gx + gy * gy + gz * gz) * RAD_TO_DEGREES;
  wristGx = gx * RAD_TO_DEGREES;
  wristGy = gy * RAD_TO_DEGREES;
  wristGz = gz * RAD_TO_DEGREES;
  wristAx = wa.acceleration.x; wristAy = wa.acceleration.y; wristAz = wa.acceleration.z;

  // ---- Calibration: average the accel vector ----
  if (calibrating) {
    sumX += ax; sumY += ay; sumZ += az;
    calibCount++;
    if (millis() - calibStartMs >= CALIB_MS) {
      float mx = sumX / calibCount, my = sumY / calibCount, mz = sumZ / calibCount;
      float len = sqrt(mx * mx + my * my + mz * mz);
      if (len > MIN_ACCEL_MS2) {
        baseX = mx / len; baseY = my / len; baseZ = mz / len;
        calibrated = true;
        trunkDeg = 0;
        Serial.println("# calibration done");
      } else {
        Serial.println("E,calibration failed (no gravity reading?)");
      }
      calibrating = false;
    }
  }

  // ---- Trunk angle from the calibrated upright direction ----
  float mag = sqrt(ax * ax + ay * ay + az * az);
  if (calibrated && mag > MIN_ACCEL_MS2) {
    float cosAngle = (ax * baseX + ay * baseY + az * baseZ) / mag;
    if (cosAngle > 1.0)  cosAngle = 1.0;
    if (cosAngle < -1.0) cosAngle = -1.0;
    float angle = acos(cosAngle) * RAD_TO_DEGREES;
    trunkDeg += TRUNK_ALPHA * (angle - trunkDeg);
  }

  // ---- Print at 10 Hz ----
  uint32_t nowMs = millis();
  if (nowMs - lastPrintMs >= PRINT_PERIOD_MS) {
    lastPrintMs = nowMs;
    Serial.print("trunk_deg:");   Serial.print(trunkDeg, 1);
    Serial.print(" wrist_dps:");  Serial.print(wristDps, 1);
    Serial.print(" wrist_gx:");   Serial.print(wristGx, 1);
    Serial.print(" wrist_gy:");   Serial.print(wristGy, 1);
    Serial.print(" wrist_gz:");   Serial.print(wristGz, 1);
    Serial.print(" chest_ax:");   Serial.print(lastAx, 2);
    Serial.print(" chest_ay:");   Serial.print(lastAy, 2);
    Serial.print(" chest_az:");   Serial.print(lastAz, 2);
    if (SHOW_WRIST_ACCEL) {
      Serial.print(" wrist_ax:"); Serial.print(wristAx, 2);
      Serial.print(" wrist_ay:"); Serial.print(wristAy, 2);
      Serial.print(" wrist_az:"); Serial.print(wristAz, 2);
    }
    Serial.println();
  }
}
