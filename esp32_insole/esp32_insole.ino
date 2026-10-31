// ESP32 ADC1 Pins for the 4 FSR Sensors
const int HEEL_PIN  = 32; // Heel Area
const int OUTER_PIN = 33; // Outer Ball Area
const int INNER_PIN = 34; // Inner Ball Area
const int TOE_PIN   = 35; // Big Toe Area

// Read 4 samples and average them for smooth, jitter-free animations
int readSmoothADC(int pin) {
  long sum = 0;
  for (int i = 0; i < 4; i++) {
    sum += analogRead(pin);
  }
  return sum / 4;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // 0 to 4095 range

  pinMode(HEEL_PIN, INPUT);
  pinMode(OUTER_PIN, INPUT);
  pinMode(INNER_PIN, INPUT);
  pinMode(TOE_PIN, INPUT);
}

void loop() {
  int heel  = readSmoothADC(HEEL_PIN);
  int outer = readSmoothADC(OUTER_PIN);
  int inner = readSmoothADC(INNER_PIN);
  int toe   = readSmoothADC(TOE_PIN);

  // Send single-line JSON over USB Serial to Node.js backend
  Serial.print("{\"toe\":");
  Serial.print(toe);
  Serial.print(",\"inner\":");
  Serial.print(inner);
  Serial.print(",\"outer\":");
  Serial.print(outer);
  Serial.print(",\"heel\":");
  Serial.print(heel);
  Serial.println("}");

  delay(50); // 20 updates per second (20 FPS)
}