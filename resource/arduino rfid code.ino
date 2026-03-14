#include <SoftwareSerial.h>

// Pins du lecteur
#define RFID_RX 3
#define RFID_TX 6  // inutile si le lecteur ne reçoit rien

SoftwareSerial rfidSerial(RFID_RX, RFID_TX);

String tagBuffer = "";
unsigned long lastByteTime = 0;
const unsigned long timeout = 300; // ms sans octet = fin de trame

void setup() {
  Serial.begin(115200);
  while (!Serial);

  rfidSerial.begin(9600);
  pinMode(RFID_RX, INPUT_PULLUP);

  Serial.println("\n=== Lecteur RFID prêt ===");
  Serial.println("Approchez un badge RFID...");
  Serial.println("Données brutes en HEX:");
}

void loop() {
  while (rfidSerial.available()) {
    char c = rfidSerial.read();
    lastByteTime = millis();

    // Affichage HEX pour debug
    Serial.print("0x");
    if ((uint8_t)c < 16) Serial.print("0");
    Serial.print((uint8_t)c, HEX);
    Serial.print(" ");

    // Buffer uniquement caractères imprimables
    if (isPrintable(c)) tagBuffer += c;
  }

  // Timeout = fin de trame
  if (tagBuffer.length() > 0 && millis() - lastByteTime > timeout) {
    processTag(tagBuffer);
    tagBuffer = "";
  }
}

void processTag(String tag) {
  tag.trim();
  if (tag.length() >= 8) {  // longueur minimale UID
    Serial.print("\n[UID détecté] ");
    Serial.println(tag);
  } else if (tag.length() > 0) {
    Serial.print("\n[Trame incomplète] ");
    Serial.println(tag);
  }
}