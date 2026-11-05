/*
  io_test.ino  —  IMU Reach Tracker, ECE 198 Group 19

  PURPOSE
    Checks every button, LED and the buzzer WITHOUT the IMUs.

    1. Cycles through the outputs one at a time (about 0.6 s each):
         HOME LED (D7) -> GREEN LED (D8) -> BLUE LED (D9) -> RED LED (D10)
         -> result green LED (D12) -> result red LED (D13) -> buzzer beep (D11)
       and prints which one should be on.
    2. Prints a line every time a button is pressed or released.
       While you hold a mat button, its own LED also lights, so you can
       check each button matches its LED.

  WIRING (from the KiCad schematic)
    Buttons: one tab to pin, other tab to GND, INPUT_PULLUP, LOW = pressed.
      D2 HOME (SW1), D3 GREEN (SW2), D4 BLUE (SW3), D5 RED (SW4), D6 START (SW5)
    Button LEDs go through 2N3904 transistors Q1-Q4 (pin HIGH = LED on).
    Buzzer goes through 2N3904 Q5 on D11.
    Result LEDs D12 (green) and D13 (red) are driven directly through 1k.

  What to look for
    - An LED that never lights: check its transistor (E to GND, C to LED -),
      the 1k base resistor, and the LED's + to 5V.
    - A button that prints nothing: check its two wires (pin and GND).
    - A button that prints pressed/released many times per press: it bounces
      (normal; the main sketch debounces), or a loose wire.
*/

// ---------------- Pins ----------------
const uint8_t PIN_BTN_HOME  = 2;
const uint8_t PIN_BTN_GREEN = 3;
const uint8_t PIN_BTN_BLUE  = 4;
const uint8_t PIN_BTN_RED   = 5;
const uint8_t PIN_BTN_START = 6;

const uint8_t PIN_LED_HOME  = 7;
const uint8_t PIN_LED_GREEN = 8;
const uint8_t PIN_LED_BLUE  = 9;
const uint8_t PIN_LED_RED   = 10;
const uint8_t PIN_BUZZER    = 11;
const uint8_t PIN_RESULT_CLEAN = 12;  // green 5 mm LED
const uint8_t PIN_RESULT_COMP  = 13;  // red 5 mm LED

// ---------------- Settings ----------------
const uint32_t STEP_MS   = 600;   // how long each output stays on
const uint16_t BEEP_HZ   = 2400;  // buzzer frequency (works for active or passive buzzers)
const bool BUZZER_USE_TONE = true; // false = plain on/off (only for an active buzzer)

// ---------------- Tables ----------------
const uint8_t NUM_BUTTONS = 5;
const uint8_t buttonPins[NUM_BUTTONS]  = { PIN_BTN_HOME, PIN_BTN_GREEN, PIN_BTN_BLUE, PIN_BTN_RED, PIN_BTN_START };
const char*   buttonNames[NUM_BUTTONS] = { "HOME (D2)", "GREEN (D3)", "BLUE (D4)", "RED (D5)", "START (D6)" };
// The LED that belongs to each button (START has none connected -> 0)
const uint8_t buttonLeds[NUM_BUTTONS]  = { PIN_LED_HOME, PIN_LED_GREEN, PIN_LED_BLUE, PIN_LED_RED, 0 };

// Output sequence. Step 6 is the buzzer.
const uint8_t NUM_STEPS = 7;
const uint8_t stepPins[NUM_STEPS]  = { PIN_LED_HOME, PIN_LED_GREEN, PIN_LED_BLUE, PIN_LED_RED,
                                       PIN_RESULT_CLEAN, PIN_RESULT_COMP, PIN_BUZZER };
const char*   stepNames[NUM_STEPS] = { "HOME button LED (D7)", "GREEN button LED (D8)",
                                       "BLUE button LED (D9)", "RED button LED (D10)",
                                       "result GREEN LED (D12)", "result RED LED (D13)",
                                       "BUZZER (D11)" };

bool lastPressed[NUM_BUTTONS];
uint8_t step = 0;
uint32_t stepStartMs = 0;

void buzzerOn()  { if (BUZZER_USE_TONE) tone(PIN_BUZZER, BEEP_HZ); else digitalWrite(PIN_BUZZER, HIGH); }
void buzzerOff() { if (BUZZER_USE_TONE) noTone(PIN_BUZZER);        digitalWrite(PIN_BUZZER, LOW); }

void allOutputsOff() {
  for (uint8_t i = 0; i < NUM_STEPS; i++) digitalWrite(stepPins[i], LOW);
  buzzerOff();
}

void startStep(uint8_t s) {
  allOutputsOff();
  Serial.print("# ON: ");
  Serial.println(stepNames[s]);
  if (stepPins[s] == PIN_BUZZER) buzzerOn();
  else digitalWrite(stepPins[s], HIGH);
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) { }

  for (uint8_t i = 0; i < NUM_BUTTONS; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
    lastPressed[i] = false;
  }
  for (uint8_t i = 0; i < NUM_STEPS; i++) {
    pinMode(stepPins[i], OUTPUT);
    digitalWrite(stepPins[i], LOW);
  }

  Serial.println("# IO test: cycling outputs, press any button to see it here");
  stepStartMs = millis();
  startStep(step);
}

void loop() {
  uint32_t now = millis();

  // ---- 1. Cycle outputs ----
  if (now - stepStartMs >= STEP_MS) {
    stepStartMs = now;
    step = (step + 1) % NUM_STEPS;
    startStep(step);
  }

  // ---- 2. Report buttons ----
  for (uint8_t i = 0; i < NUM_BUTTONS; i++) {
    bool pressed = (digitalRead(buttonPins[i]) == LOW);   // LOW = pressed
    if (pressed != lastPressed[i]) {
      lastPressed[i] = pressed;
      Serial.print(pressed ? "# PRESSED  " : "# released ");
      Serial.println(buttonNames[i]);
    }
    // While a mat button is held, keep its LED on (overrides the cycle)
    if (pressed && buttonLeds[i] != 0) digitalWrite(buttonLeds[i], HIGH);
    else if (!pressed && buttonLeds[i] != 0 && stepPins[step] != buttonLeds[i]) digitalWrite(buttonLeds[i], LOW);
  }
}
