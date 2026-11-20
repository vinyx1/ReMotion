/*
  reach_tracker.ino  —  ReMotion, ECE 198 Group 19

  Seated reaching exercise that detects TRUNK-LEAN COMPENSATION.
    - Chest IMU (0x68) measures how far the trunk tilts from upright.
    - Wrist IMU (0x69) measures how fast the arm is rotating.
    - Arcade buttons on the mat time each reach (HOME -> lit target).
    - Each rep is labelled clean / compensated in the R line (no result LEDs).
    - Everything streams over USB serial for the logger and dashboard.

  ONE PRESS OF START RUNS A WHOLE SESSION, in four blocks (PLAN below):
    PRACTICE   3 reps, buzzer off. Learn the task; left out of the results.
    BASELINE  15 reps, buzzer off. How much the patient leans on their own.
    TRAINING  30 reps, buzzer ON while leaning. Teaches them to stay upright.
    POST      15 reps, buzzer off. Did it stick without the buzzer?
  Lean is measured and labelled the same way in every block; only the buzzer
  changes. BASELINE vs POST is the result. Targets are dealt from a shuffled
  deck so every block has the same number of GREEN, BLUE and RED reaches.
  A 30 s rest comes before TRAINING and before POST.

  Board: Arduino UNO R4 Minima   (FQBN arduino:renesas_uno:minima)
  Libraries: Wire, Adafruit MPU6050 (+ Adafruit Unified Sensor, Adafruit BusIO)
  Wiring: see the KiCad schematic / docs/parts-list.md. Pin table below.

  SESSION FLOW (state machine)
    IDLE         Waiting. Operator presses START to begin.
    CALIBRATING  Patient sits upright and still for 3 s. HOME LED blinks.
                 If they moved too much -> CALIB_FAILED.
    CALIB_FAILED HOME LED blinks fast, 2 low beeps. Press START to retry.
    WAIT_HOME    HOME LED on. Patient rests hand on HOME. After 1 s held,
                 the next target from the block's deck lights up -> CUED.
    CUED         Target LED on. Waiting for the hand to leave HOME.
                 (reaction time = cue -> leaving HOME)
    REACHING     Hand has left HOME. Lean is monitored (buzzer if leaning,
                 TRAINING block only).
                 Pressing the lit target ends the rep -> RETURNING.
                 (reach time = leaving HOME -> target press)
                 Wrong targets are ignored. 15 s timeout aborts the rep.
    RETURNING    Waiting for the hand to come back to HOME -> WAIT_HOME,
                 or to REST / the next block / the end when a block is done.
    REST         Pause between blocks. HOME LED blinks slowly. 2 beeps when
                 the next block starts. 3 beeps when the whole session is done.
    Pressing START in any active state ends the session early (prints S line).

  SERIAL PROTOCOL (115200 baud) — see docs/PROTOCOL.md. Do not change it
  without updating the logger and dashboard too.
    # comment
    D,t_ms,state,trunk_deg,wrist_dps,threshold      every sample (100 Hz)
    R,rep,target,react_ms,reach_ms,peak_deg,bursts,compensated,phase
    S,reps,compensated_reps
    E,message
  Commands from the laptop:  T12 (threshold = 12 deg),  D0 / D1 (sample stream off/on),
                             P3,15,30,15 (reps per block; e.g. P0,0,5,0 for a short demo)
  T and P are only accepted between sessions, so a session's blocks are comparable.
*/

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// =====================================================================
//  PINS  (match the KiCad schematic "ReMotion")
// =====================================================================
// Buttons: one tab to the pin, other tab to GND. INPUT_PULLUP, LOW = pressed.
const uint8_t PIN_BTN_START = 2;   // SW5 yellow, beside the Arduino
const uint8_t PIN_BTN_HOME  = 3;   // SW1 white
const uint8_t PIN_BTN_GREEN = 4;   // SW2 target ~40% reach
const uint8_t PIN_BTN_BLUE  = 5;   // SW3 target ~70% reach
const uint8_t PIN_BTN_RED   = 6;   // SW4 target ~100% reach

// Outputs through 2N3904 low-side switches (pin HIGH = on)
const uint8_t PIN_BUZZER    = 9;   // Q5
const uint8_t PIN_LED_HOME  = 10;  // Q1
const uint8_t PIN_LED_GREEN = 11;  // Q2
const uint8_t PIN_LED_BLUE  = 12;  // Q3
const uint8_t PIN_LED_RED   = 13;  // Q4 (the board's built-in LED follows it)

// IMU I2C addresses
const uint8_t ADDR_WRIST = 0x69;   // AD0 tied to 3.3V on the wrist board
const uint8_t ADDR_CHEST = 0x68;   // AD0 unconnected

// =====================================================================
//  SETTINGS  (change these to tune the device)
// =====================================================================
const uint32_t I2C_CLOCK_HZ       = 100000;  // 100 kHz for long IMU cables
const uint32_t SAMPLE_PERIOD_US   = 10000;   // 10 ms = 100 Hz
const bool     STREAM_SAMPLES_DEFAULT = true;  // print D lines at startup (D0/D1 changes it)

// Trunk angle
const uint32_t CALIB_MS           = 3000;    // sit still this long to calibrate
const float    CALIB_MAX_STD_MS2  = 0.5;     // reject calibration if accel wobbles more than
                                             // this (m/s^2 standard deviation, ~3 deg of tilt)
const float    TRUNK_ALPHA        = 0.15;    // smoothing: trunkDeg += 0.15 * (angle - trunkDeg)
const float    MIN_ACCEL_MS2      = 2.0;     // skip a sample if |a| is this small (free fall / glitch)

// Lean decision
const float    DEFAULT_THRESHOLD_DEG = 10.0; // lean limit; change over serial with T<deg>
const float    MIN_THRESHOLD_DEG  = 1.0;     // allowed range for the T command
const float    MAX_THRESHOLD_DEG  = 60.0;
const uint32_t LEAN_SUSTAIN_MS    = 200;     // must lean this long before the buzzer sounds

// Wrist smoothness ("bursts" of movement)
const float    BURST_ENTER_DPS    = 60.0;    // start of a burst
const float    BURST_EXIT_DPS     = 30.0;    // end of a burst (hysteresis)

// Rep timing
const uint32_t HOME_HOLD_MS       = 1000;    // hold HOME this long before a target lights
const uint32_t REACH_TIMEOUT_MS   = 15000;   // give up on a rep after this long
const uint32_t REST_MS            = 30000;   // rest before TRAINING and before POST
const uint32_t DEBOUNCE_MS        = 20;      // arcade microswitches bounce

// LEDs and buzzer
const uint32_t CALIB_BLINK_MS     = 250;     // HOME LED blink while calibrating
const uint32_t FAIL_BLINK_MS      = 80;      // fast HOME blink after a failed calibration
const uint32_t REST_BLINK_MS      = 1000;    // slow HOME blink during a rest
const uint16_t BEEP_HZ            = 2400;    // normal beep / lean alarm
const uint16_t LOW_BEEP_HZ        = 600;     // error beeps
const bool     BUZZER_USE_TONE    = true;    // tone() works for active and passive buzzers.
                                             // false = plain on/off (active buzzer only)

const float RAD_TO_DEGREES = 57.29578;

// =====================================================================
//  SESSION PLAN: the blocks START runs, in order
// =====================================================================
enum Phase { PRACTICE, BASELINE, TRAINING, POST, NUM_PHASES };
const char* PHASE_NAMES[NUM_PHASES] = { "PRACTICE", "BASELINE", "TRAINING", "POST" };
uint8_t phaseReps[NUM_PHASES]       = { 3, 15, 30, 15 };        // change with P<a>,<b>,<c>,<d>
const bool PHASE_BUZZER[NUM_PHASES] = { false, false, true, false };  // lean alarm on?
const bool PHASE_REST_FIRST[NUM_PHASES] = { false, false, true, true }; // REST_MS pause before it
const uint8_t MAX_PHASE_REPS = 60;

// =====================================================================
//  STATE
// =====================================================================
enum State { IDLE, CALIBRATING, CALIB_FAILED, WAIT_HOME, CUED, REACHING, RETURNING, REST };
const char* STATE_NAMES[] = { "IDLE", "CALIBRATING", "CALIB_FAILED", "WAIT_HOME", "CUED", "REACHING", "RETURNING", "REST" };
State state = IDLE;
uint32_t stateStartMs = 0;            // when we entered the current state

Adafruit_MPU6050 chest;
Adafruit_MPU6050 wrist;

// Settings that can change while running
float thresholdDeg = DEFAULT_THRESHOLD_DEG;
bool  streamSamples = STREAM_SAMPLES_DEFAULT;

// Sensor values (updated at 100 Hz)
uint32_t lastSampleUs = 0;
float trunkDeg = 0;                   // smoothed trunk angle from upright, degrees
float wristDps = 0;                   // wrist rotation speed, deg/s
bool  inBurst = false;                // wrist currently in a movement burst
bool  haveBaseline = false;
float baseX = 0, baseY = 0, baseZ = 1;   // "upright" direction (unit vector)

// Calibration sums
float calSumX, calSumY, calSumZ, calSumSq;
uint16_t calCount;

// Session / rep bookkeeping
uint16_t repCount = 0;
uint16_t compensatedCount = 0;
uint8_t  target = 0;                  // index into targets[] for the current rep
uint8_t  phase = PRACTICE;            // block we are in
uint8_t  phaseRepCount = 0;           // reps finished in this block
uint8_t  deck[MAX_PHASE_REPS];        // this block's targets, shuffled
uint8_t  deckPos = 0;                 // next card (only moves on a finished rep)
uint32_t cueMs = 0;                   // target lit
uint32_t leftHomeMs = 0;              // hand left HOME
float    peakDeg = 0;                 // biggest trunkDeg during this reach
uint16_t bursts = 0;                  // wrist bursts during this reach
bool     sustainMet = false;          // leaned past threshold for >= LEAN_SUSTAIN_MS this reach
bool     overThreshold = false;       // trunkDeg is currently above threshold
uint32_t overStartMs = 0;             // when it went above threshold
bool     leanAlarm = false;           // leaning past the threshold right now (REACHING)

// =====================================================================
//  BUTTONS (debounced)
// =====================================================================
struct Button {
  uint8_t  pin;
  bool     down;          // debounced state: true = pressed
  bool     lastRaw;       // last raw reading
  uint32_t lastChangeMs;  // when the raw reading last changed
  bool     pressed;       // true for one loop when the button goes down
  bool     released;      // true for one loop when the button goes up
};

Button btnHome  = { PIN_BTN_HOME,  false, false, 0, false, false };
Button btnGreen = { PIN_BTN_GREEN, false, false, 0, false, false };
Button btnBlue  = { PIN_BTN_BLUE,  false, false, 0, false, false };
Button btnRed   = { PIN_BTN_RED,   false, false, 0, false, false };
Button btnStart = { PIN_BTN_START, false, false, 0, false, false };

void updateButton(Button &b, uint32_t now) {
  b.pressed = false;
  b.released = false;
  bool raw = (digitalRead(b.pin) == LOW);       // LOW = pressed
  if (raw != b.lastRaw) {                        // still bouncing: restart the timer
    b.lastRaw = raw;
    b.lastChangeMs = now;
  }
  if (raw != b.down && now - b.lastChangeMs >= DEBOUNCE_MS) {
    b.down = raw;                                // stable long enough: accept it
    if (raw) b.pressed = true; else b.released = true;
  }
}

// The three targets, in one table so we can pick one at random
struct Target {
  const char* name;
  Button*     button;
  uint8_t     ledPin;
};
Target targets[3] = {
  { "GREEN", &btnGreen, PIN_LED_GREEN },
  { "BLUE",  &btnBlue,  PIN_LED_BLUE  },
  { "RED",   &btnRed,   PIN_LED_RED   },
};

// =====================================================================
//  BUZZER: lean alarm + short beep patterns (no delay())
// =====================================================================
uint16_t buzzerHz = 0;          // what the buzzer is doing right now (0 = off)

void setBuzzer(uint16_t hz) {
  if (hz == buzzerHz) return;   // don't restart tone() every loop
  buzzerHz = hz;
  if (hz == 0) {
    noTone(PIN_BUZZER);
    digitalWrite(PIN_BUZZER, LOW);
  } else if (BUZZER_USE_TONE) {
    tone(PIN_BUZZER, hz);
  } else {
    digitalWrite(PIN_BUZZER, HIGH);
  }
}

// A beep pattern: `count` beeps of `onMs`, separated by `offMs`
uint8_t  beepsLeft = 0;
uint16_t beepHz = 0;
uint16_t beepOnMs = 0, beepOffMs = 0;
bool     beepIsOn = false;
uint32_t beepNextMs = 0;

void playBeeps(uint8_t count, uint16_t hz, uint16_t onMs, uint16_t offMs) {
  beepsLeft = count;
  beepHz = hz;
  beepOnMs = onMs;
  beepOffMs = offMs;
  beepIsOn = false;
  beepNextMs = millis();
}

void updateBuzzer(uint32_t now) {
  if (beepsLeft > 0) {                       // a beep pattern has priority
    if ((int32_t)(now - beepNextMs) >= 0) {
      if (!beepIsOn) {
        setBuzzer(beepHz);
        beepIsOn = true;
        beepNextMs = now + beepOnMs;
      } else {
        setBuzzer(0);
        beepIsOn = false;
        beepsLeft--;
        beepNextMs = now + beepOffMs;
      }
    }
    return;
  }
  setBuzzer(leanAlarm && PHASE_BUZZER[phase] ? BEEP_HZ : 0);   // feedback only in TRAINING
}

// =====================================================================
//  LED helpers
// =====================================================================
void setTargetLeds(int litIndex) {           // -1 = all targets off
  for (uint8_t i = 0; i < 3; i++) digitalWrite(targets[i].ledPin, (int)i == litIndex ? HIGH : LOW);
}

void allLedsOff() {
  digitalWrite(PIN_LED_HOME, LOW);
  setTargetLeds(-1);
}

// Blink an LED at a given period without delay()
void blinkLed(uint8_t pin, uint32_t periodMs, uint32_t now) {
  digitalWrite(pin, ((now / periodMs) % 2 == 0) ? HIGH : LOW);
}

// =====================================================================
//  IMUs
// =====================================================================
void configureImu(Adafruit_MPU6050 &imu) {
  imu.setAccelerometerRange(MPU6050_RANGE_4_G);
  imu.setGyroRange(MPU6050_RANGE_500_DEG);   // fast arm moves stay under 500 deg/s
  imu.setFilterBandwidth(MPU6050_BAND_21_HZ);  // on-chip low-pass, cuts strap jitter
}

// Try to start both IMUs. Prints an E line for each one that is missing.
bool startImus() {
  bool chestOk = chest.begin(ADDR_CHEST, &Wire);
  bool wristOk = wrist.begin(ADDR_WRIST, &Wire);
  Wire.setClock(I2C_CLOCK_HZ);               // begin() may reset the clock, so set it after
  if (!chestOk) Serial.println("E,chest IMU (0x68) not found");
  if (!wristOk) Serial.println("E,wrist IMU (0x69) not found");
  if (chestOk) configureImu(chest);
  if (wristOk) configureImu(wrist);
  return chestOk && wristOk;
}

// Read both IMUs and update trunkDeg, wristDps and the calibration sums.
void readSensors() {
  sensors_event_t ca, cg, ct, wa, wg, wt;
  chest.getEvent(&ca, &cg, &ct);
  wrist.getEvent(&wa, &wg, &wt);

  // ---- Wrist: total rotation speed (length of the gyro vector) ----
  float gx = wg.gyro.x, gy = wg.gyro.y, gz = wg.gyro.z;    // rad/s
  wristDps = sqrt(gx * gx + gy * gy + gz * gz) * RAD_TO_DEGREES;

  // Burst detection with hysteresis
  if (!inBurst && wristDps > BURST_ENTER_DPS) {
    inBurst = true;
    if (state == REACHING) bursts++;
  } else if (inBurst && wristDps < BURST_EXIT_DPS) {
    inBurst = false;
  }

  // ---- Chest: accelerometer = direction of gravity ----
  float ax = ca.acceleration.x, ay = ca.acceleration.y, az = ca.acceleration.z;  // m/s^2

  if (state == CALIBRATING) {
    calSumX += ax; calSumY += ay; calSumZ += az;
    calSumSq += ax * ax + ay * ay + az * az;
    calCount++;
  }

  float mag = sqrt(ax * ax + ay * ay + az * az);
  if (haveBaseline && mag > MIN_ACCEL_MS2) {
    float cosAngle = (ax * baseX + ay * baseY + az * baseZ) / mag;
    if (cosAngle > 1.0)  cosAngle = 1.0;         // rounding can push it just past 1
    if (cosAngle < -1.0) cosAngle = -1.0;
    float angle = acos(cosAngle) * RAD_TO_DEGREES;
    trunkDeg += TRUNK_ALPHA * (angle - trunkDeg);   // exponential low-pass
  }
}

// Finish calibration. Returns true if the patient sat still enough.
bool finishCalibration() {
  if (calCount < 10) {
    Serial.println("E,calibration got too few samples");
    return false;
  }
  float n = calCount;
  float mx = calSumX / n, my = calSumY / n, mz = calSumZ / n;
  float meanLen = sqrt(mx * mx + my * my + mz * mz);

  // Spread of the samples around the mean: var = E[|a|^2] - |E[a]|^2
  float variance = calSumSq / n - meanLen * meanLen;
  if (variance < 0) variance = 0;
  float stdMs2 = sqrt(variance);

  if (meanLen < MIN_ACCEL_MS2) {
    Serial.println("E,calibration rejected: chest IMU reads no gravity");
    return false;
  }
  if (stdMs2 > CALIB_MAX_STD_MS2) {
    Serial.print("E,calibration rejected: moved too much (std ");
    Serial.print(stdMs2, 2);
    Serial.println(" m/s2)");
    return false;
  }

  baseX = mx / meanLen; baseY = my / meanLen; baseZ = mz / meanLen;
  haveBaseline = true;
  trunkDeg = 0;
  Serial.print("# calibration OK (std ");
  Serial.print(stdMs2, 2);
  Serial.println(" m/s2)");
  return true;
}

// =====================================================================
//  LEAN MONITOR (runs every sample)
// =====================================================================
void updateLean(uint32_t now) {
  if (state != REACHING) {
    overThreshold = false;
    leanAlarm = false;
    return;
  }
  if (trunkDeg > peakDeg) peakDeg = trunkDeg;

  if (trunkDeg > thresholdDeg) {
    if (!overThreshold) {                // just crossed the line
      overThreshold = true;
      overStartMs = now;
    }
    if (now - overStartMs >= LEAN_SUSTAIN_MS) {   // leaning long enough to count
      leanAlarm = true;
      sustainMet = true;
    }
  } else {
    overThreshold = false;
    leanAlarm = false;
  }
}

// =====================================================================
//  STATE MACHINE
// =====================================================================
void enterState(State s, uint32_t now) {
  state = s;
  stateStartMs = now;
}

// Deal this block's targets: equal numbers of GREEN, BLUE, RED, then shuffle
// (Fisher-Yates), so every block asks for the same mix of near and far reaches.
void shuffleDeck(uint8_t n) {
  for (uint8_t i = 0; i < n; i++) deck[i] = i % 3;
  for (uint8_t i = n; i > 1; i--) {
    uint8_t j = random(i);
    uint8_t tmp = deck[i - 1]; deck[i - 1] = deck[j]; deck[j] = tmp;
  }
  deckPos = 0;
}

// Begin block p: 2 beeps, a comment for the log, then the first rep.
void startPhase(uint8_t p, uint32_t now) {
  phase = p;
  phaseRepCount = 0;
  shuffleDeck(phaseReps[p]);
  playBeeps(2, BEEP_HZ, 120, 120);
  Serial.print("# ");
  Serial.print(PHASE_NAMES[p]);
  Serial.print(" block: ");
  Serial.print(phaseReps[p]);
  Serial.println(PHASE_BUZZER[p] ? " reps, buzzer ON when leaning" : " reps, buzzer off");
  Serial.println("# put your hand on HOME");
  digitalWrite(PIN_LED_HOME, HIGH);
  enterState(WAIT_HOME, now);
}

// The block after `from` that has reps, or NUM_PHASES if there is none.
uint8_t nextPhaseAfter(int from) {
  for (int p = from + 1; p < NUM_PHASES; p++) {
    if (phaseReps[p] > 0) return p;
  }
  return NUM_PHASES;
}

// Move on after a finished block: rest, start the next block, or finish.
void finishPhase(uint32_t now);

void endSession(uint32_t now) {
  Serial.print("S,");
  Serial.print(repCount);
  Serial.print(",");
  Serial.println(compensatedCount);
  Serial.println("# session ended. Press START for a new session.");
  allLedsOff();
  leanAlarm = false;
  enterState(IDLE, now);
}

void finishPhase(uint32_t now) {
  uint8_t next = nextPhaseAfter(phase);
  if (next == NUM_PHASES) {                       // that was the last block
    playBeeps(3, BEEP_HZ, 200, 150);              // 3 beeps = session complete
    Serial.println("# all blocks done");
    endSession(now);
  } else if (PHASE_REST_FIRST[next]) {
    phase = next;                                 // the block we are resting before
    allLedsOff();
    Serial.print("# rest ");
    Serial.print(REST_MS / 1000);
    Serial.print(" s before the ");
    Serial.print(PHASE_NAMES[next]);
    Serial.println(" block");
    enterState(REST, now);
  } else {
    startPhase(next, now);
  }
}

void startCalibration(uint32_t now) {
  calSumX = calSumY = calSumZ = calSumSq = 0;
  calCount = 0;
  repCount = 0;                // a new session starts counting from zero
  compensatedCount = 0;
  allLedsOff();
  Serial.println("# calibrating: sit upright and still for 3 s");
  enterState(CALIBRATING, now);
}

void runStateMachine(uint32_t now) {
  // START ends the session from any active state
  if (btnStart.pressed && state != IDLE && state != CALIB_FAILED) {
    endSession(now);
    return;
  }

  switch (state) {

    case IDLE:
      // Everything off. Wait for the operator.
      if (btnStart.pressed) startCalibration(now);
      break;

    case CALIBRATING:
      // Blink HOME, collect samples (done in readSensors) for CALIB_MS.
      blinkLed(PIN_LED_HOME, CALIB_BLINK_MS, now);
      if (now - stateStartMs >= CALIB_MS) {
        if (finishCalibration()) {
          Serial.println("# session started");
          startPhase(nextPhaseAfter(-1), now);    // first block that has reps
        } else {
          playBeeps(2, LOW_BEEP_HZ, 300, 200);    // 2 low beeps = redo
          Serial.println("# press START to calibrate again");
          enterState(CALIB_FAILED, now);
        }
      }
      break;

    case CALIB_FAILED:
      // HOME blinks fast until the operator presses START to retry.
      blinkLed(PIN_LED_HOME, FAIL_BLINK_MS, now);
      if (btnStart.pressed) startCalibration(now);
      break;

    case WAIT_HOME:
      // HOME LED on. Hand must rest on HOME for HOME_HOLD_MS.
      digitalWrite(PIN_LED_HOME, HIGH);
      if (!btnHome.down) {
        stateStartMs = now;                       // not on HOME: restart the 1 s hold timer
      } else if (now - stateStartMs >= HOME_HOLD_MS) {
        target = deck[deckPos];                   // next target from this block's deck
        digitalWrite(PIN_LED_HOME, LOW);
        setTargetLeds(target);
        cueMs = now;
        enterState(CUED, now);
      }
      break;

    case CUED:
      // Target lit. Wait for the hand to leave HOME.
      if (btnHome.released || !btnHome.down) {
        leftHomeMs = now;
        peakDeg = trunkDeg;
        bursts = inBurst ? 1 : 0;                 // already moving as they lift off
        sustainMet = false;
        overThreshold = false;
        enterState(REACHING, now);
      } else if (now - stateStartMs >= REACH_TIMEOUT_MS) {
        Serial.println("E,rep aborted: hand never left HOME");
        setTargetLeds(-1);
        enterState(WAIT_HOME, now);
      }
      break;

    case REACHING:
      // Lean is checked in updateLean(). Wait for the correct target.
      if (targets[target].button->pressed) {
        uint32_t reactMs = leftHomeMs - cueMs;
        uint32_t reachMs = now - leftHomeMs;
        bool compensated = (peakDeg > thresholdDeg) && sustainMet;

        repCount++;
        phaseRepCount++;
        deckPos++;                                // an aborted rep keeps its card
        if (compensated) compensatedCount++;

        // R,rep,target,react_ms,reach_ms,peak_deg,bursts,compensated,phase
        Serial.print("R,");
        Serial.print(repCount);            Serial.print(",");
        Serial.print(targets[target].name); Serial.print(",");
        Serial.print(reactMs);             Serial.print(",");
        Serial.print(reachMs);             Serial.print(",");
        Serial.print(peakDeg, 1);          Serial.print(",");
        Serial.print(bursts);              Serial.print(",");
        Serial.print(compensated ? 1 : 0); Serial.print(",");
        Serial.println(PHASE_NAMES[phase]);

        setTargetLeds(-1);
        leanAlarm = false;
        enterState(RETURNING, now);
      } else if (now - stateStartMs >= REACH_TIMEOUT_MS) {
        Serial.println("E,rep aborted: reach timeout");
        setTargetLeds(-1);
        leanAlarm = false;
        enterState(WAIT_HOME, now);
      }
      // Pressing a wrong target does nothing.
      break;

    case RETURNING:
      // Wait for the hand back on HOME, then the next rep or the next block.
      if (btnHome.down) {
        if (phaseRepCount >= phaseReps[phase]) finishPhase(now);
        else enterState(WAIT_HOME, now);          // starts the 1 s hold
      }
      break;

    case REST:
      // Pause between blocks. `phase` is already the block that comes next.
      blinkLed(PIN_LED_HOME, REST_BLINK_MS, now);
      if (now - stateStartMs >= REST_MS) startPhase(phase, now);
      break;
  }
}

// =====================================================================
//  SERIAL COMMANDS:  T<deg>  D0  D1  P<a>,<b>,<c>,<d>
// =====================================================================
char cmdBuf[24];

bool sessionRunning() {
  return state != IDLE && state != CALIB_FAILED;
}

// P3,15,30,15 -> reps for PRACTICE, BASELINE, TRAINING, POST. Returns false if invalid.
bool parsePlan(const char* text) {
  uint8_t newReps[NUM_PHASES];
  uint16_t total = 0;
  for (uint8_t p = 0; p < NUM_PHASES; p++) {
    char* end;
    long n = strtol(text, &end, 10);
    if (end == text || n < 0 || n > MAX_PHASE_REPS) return false;
    newReps[p] = n;
    total += n;
    text = end;
    if (p < NUM_PHASES - 1) {
      if (*text != ',') return false;
      text++;
    }
  }
  if (*text != '\0' || total == 0) return false;
  for (uint8_t p = 0; p < NUM_PHASES; p++) phaseReps[p] = newReps[p];
  return true;
}

void printPlan() {
  Serial.print("# plan:");
  for (uint8_t p = 0; p < NUM_PHASES; p++) {
    Serial.print(" ");
    Serial.print(PHASE_NAMES[p]);
    Serial.print(" ");
    Serial.print(phaseReps[p]);
  }
  Serial.println();
}
uint8_t cmdLen = 0;

void handleCommand(const char* cmd) {
  if ((cmd[0] == 'T' || cmd[0] == 't' || cmd[0] == 'P' || cmd[0] == 'p') && sessionRunning()) {
    Serial.println("E,threshold and plan can only change between sessions");
  } else if (cmd[0] == 'P' || cmd[0] == 'p') {
    if (parsePlan(cmd + 1)) printPlan();
    else Serial.println("E,plan must be 4 numbers 0-60, not all 0 (e.g. P3,15,30,15)");
  } else if (cmd[0] == 'T' || cmd[0] == 't') {
    float value = atof(cmd + 1);
    if (value >= MIN_THRESHOLD_DEG && value <= MAX_THRESHOLD_DEG) {
      thresholdDeg = value;
      Serial.print("# threshold set to ");
      Serial.print(thresholdDeg, 1);
      Serial.println(" deg");
    } else {
      Serial.println("E,threshold out of range (1-60)");
    }
  } else if ((cmd[0] == 'D' || cmd[0] == 'd') && cmd[1] == '0' && cmd[2] == '\0') {
    streamSamples = false;
    Serial.println("# sample stream off");
  } else if ((cmd[0] == 'D' || cmd[0] == 'd') && cmd[1] == '1' && cmd[2] == '\0') {
    streamSamples = true;
    Serial.println("# sample stream on");
  } else if (cmd[0] != '\0') {
    Serial.print("E,unknown command: ");
    Serial.println(cmd);
  }
}

void readCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      cmdBuf[cmdLen] = '\0';
      handleCommand(cmdBuf);
      cmdLen = 0;
    } else if (cmdLen < sizeof(cmdBuf) - 1) {
      cmdBuf[cmdLen++] = c;
    }
  }
}

// D,t_ms,state,trunk_deg,wrist_dps,threshold
void printSample(uint32_t now) {
  Serial.print("D,");
  Serial.print(now);                 Serial.print(",");
  Serial.print(STATE_NAMES[state]);  Serial.print(",");
  Serial.print(trunkDeg, 1);         Serial.print(",");
  Serial.print(wristDps, 1);         Serial.print(",");
  Serial.println(thresholdDeg, 1);
}

// =====================================================================
//  SETUP / LOOP
// =====================================================================
void setup() {
  // Outputs first, all off, so nothing buzzes or lights during start-up
  const uint8_t outputs[] = { PIN_LED_HOME, PIN_LED_GREEN, PIN_LED_BLUE, PIN_LED_RED,
                              PIN_BUZZER };
  for (uint8_t i = 0; i < sizeof(outputs); i++) {
    pinMode(outputs[i], OUTPUT);
    digitalWrite(outputs[i], LOW);
  }
  const uint8_t inputs[] = { PIN_BTN_HOME, PIN_BTN_GREEN, PIN_BTN_BLUE, PIN_BTN_RED, PIN_BTN_START };
  for (uint8_t i = 0; i < sizeof(inputs); i++) pinMode(inputs[i], INPUT_PULLUP);

  Serial.begin(115200);
  uint32_t waitStart = millis();
  while (!Serial && millis() - waitStart < 2000) { }   // don't wait forever without a laptop

  randomSeed(analogRead(A0) ^ micros());     // A0 is unconnected (floating) = some noise

  Serial.println("# ReMotion, ECE 198 Group 19");

  // IMU missing: 3 low beeps, repeat until both are found.
  // (delay() is OK here: this is start-up, not the sampling loop.)
  while (!startImus()) {
    for (uint8_t i = 0; i < 3; i++) {
      setBuzzer(LOW_BEEP_HZ); delay(250);
      setBuzzer(0);           delay(200);
    }
    delay(1500);
  }

  Serial.println("# both IMUs found. Press START to begin a session.");
  Serial.println("# D,t_ms,state,trunk_deg,wrist_dps,threshold");
  Serial.println("# R,rep,target,react_ms,reach_ms,peak_deg,bursts,compensated,phase");
  printPlan();
  Serial.println("# S,reps,compensated_reps");
  lastSampleUs = micros();
  enterState(IDLE, millis());
}

void loop() {
  uint32_t now = millis();

  // 1. Buttons and laptop commands (every loop, so timing is precise)
  updateButton(btnHome, now);
  updateButton(btnGreen, now);
  updateButton(btnBlue, now);
  updateButton(btnRed, now);
  updateButton(btnStart, now);
  readCommands();

  // 2. Sensors at exactly 100 Hz using micros()
  uint32_t nowUs = micros();
  if (nowUs - lastSampleUs >= SAMPLE_PERIOD_US) {
    lastSampleUs += SAMPLE_PERIOD_US;
    if (nowUs - lastSampleUs >= 5 * SAMPLE_PERIOD_US) lastSampleUs = nowUs;  // fell far behind: resync
    readSensors();
    updateLean(now);
    if (streamSamples) printSample(now);
  }

  // 3. Session logic and buzzer
  runStateMachine(now);
  updateBuzzer(now);
}
