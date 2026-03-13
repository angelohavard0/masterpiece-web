#include <SPI.h>
#include <Ethernet2.h>
#include <SoftwareSerial.h>

// =========================
// CONFIG RESEAU
// =========================
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };

// IP fixe Arduino
IPAddress arduinoIp(192, 168, 50, 5);

// DNS (pas important ici si tu utilises une IP serveur locale)
IPAddress dnsServer(192, 168, 50, 1);

// Passerelle
IPAddress gateway(192, 168, 50, 1);

// Masque réseau
IPAddress subnet(255, 255, 255, 0);

// IP du serveur web
IPAddress serverIp(192, 168, 50, 1);

// Port du serveur
const int serverPort = 3000;

// Route
const char* routePath = "/access";

// Token Bearer (A MODIFIER)
const char* bearerToken = "token de arduino 1";

// =========================
// CONFIG RFID SERIE
// =========================
// Adapte les pins selon ton branchement
// Arduino reçoit depuis TX du lecteur RFID
const int RFID_RX_PIN = 2; // RX Arduino (branché sur TX du lecteur)
const int RFID_TX_PIN = 3; // souvent inutile si le lecteur n'a pas besoin de recevoir

SoftwareSerial rfidSerial(RFID_RX_PIN, RFID_TX_PIN);

// =========================
// BUFFER RFID
// =========================
char uidBuffer[64];
int uidIndex = 0;

// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);

  // Shield Ethernet
  pinMode(10, OUTPUT);   // CS Ethernet
  pinMode(4, OUTPUT);    // CS SD
  digitalWrite(4, HIGH); // désactive la SD

  #if defined(__AVR_ATmega2560__)
    pinMode(53, OUTPUT); // Mega : SS hardware
  #endif

  Serial.println("=== Demarrage ===");

  // Init Ethernet IP fixe
  Ethernet.begin(mac, arduinoIp, dns, gateway, subnet);
  delay(1000);

  Serial.print("IP Arduino : ");
  Serial.println(Ethernet.localIP());

  Serial.print("Serveur : ");
  Serial.println(serverIp);

  // Init lecteur RFID
  // IMPORTANT : adapte le baud rate selon ton lecteur
  // Beaucoup de lecteurs sont en 9600
  rfidSerial.begin(9600);

  Serial.println("Lecteur RFID pret.");
  Serial.println("Scanne un badge...");
}

// =========================
// LOOP
// =========================
void loop() {
  readRfidLine();
}

// =========================
// LECTURE RFID LIGNE PAR LIGNE
// =========================
// Cette version suppose que le lecteur envoie l'UID en ASCII
// puis un \n ou \r\n à la fin.
// Exemple reçu : "1234567890AB\r\n"
void readRfidLine() {
  static String tagBuffer = "";
  static unsigned long lastByteTime = 0;
  const unsigned long timeout = 300;

  while (rfidSerial.available()) {
    char c = rfidSerial.read();
    lastByteTime = millis();

    // Debug HEX
    Serial.print("0x");
    if ((uint8_t)c < 16) Serial.print("0");
    Serial.print((uint8_t)c, HEX);
    Serial.print(" ");

    if (isPrintable(c)) {
      tagBuffer += c;
    }
  }

  if (tagBuffer.length() > 0 && millis() - lastByteTime > timeout) {
    tagBuffer.trim();

    if (tagBuffer.length() > 0) {
      Serial.print("Badge lu : ");
      Serial.println(tagBuffer);
    }

    tagBuffer = "";
  }
}

// =========================
// ENVOI POST /access
// Retourne :
//  >=100 code HTTP
//  -1 = connexion impossible
//  -2 = reponse HTTP invalide / timeout
// =========================
int sendAccessRequest(const char* uid) {
  EthernetClient client;

  Serial.println("Connexion au serveur...");

  if (!client.connect(serverIp, serverPort)) {
    return -1;
  }

  // Body JSON
  // {"UID":"123456"}
  char jsonBody[128];
  snprintf(jsonBody, sizeof(jsonBody), "{\"UID\":\"%s\"}", uid);

  int contentLength = strlen(jsonBody);

  Serial.println("Envoi POST /access");

  // Requete HTTP
  client.print("POST ");
  client.print(routePath);
  client.println(" HTTP/1.1");

  // Host obligatoire
  client.print("Host: ");
  client.print(serverIp[0]);
  client.print(".");
  client.print(serverIp[1]);
  client.print(".");
  client.print(serverIp[2]);
  client.print(".");
  client.println(serverIp[3]);

  // Bearer token
  client.print("Authorization: Bearer ");
  client.println(bearerToken);

  client.println("User-Agent: Arduino-W5200");
  client.println("Connection: close");
  client.println("Content-Type: application/json");

  client.print("Content-Length: ");
  client.println(contentLength);

  client.println();
  client.print(jsonBody);

  Serial.print("JSON envoye : ");
  Serial.println(jsonBody);

  // Lire la ligne HTTP/1.1 XXX ...
  int statusCode = readHttpStatusCode(client);

  // Optionnel : afficher le reste de la réponse
  unsigned long timeout = millis();
  while (client.connected() && (millis() - timeout < 3000)) {
    while (client.available()) {
      char c = client.read();
      Serial.write(c);
      timeout = millis();
    }
  }

  client.stop();
  Serial.println();

  return statusCode;
}

// =========================
// LIT LE CODE HTTP
// Exemple : HTTP/1.1 200 OK
// =========================
int readHttpStatusCode(EthernetClient &client) {
  char line[64];
  int idx = 0;
  unsigned long start = millis();

  while (millis() - start < 5000) {
    while (client.available()) {
      char c = client.read();

      if (c == '\r') {
        continue;
      }

      if (c == '\n') {
        line[idx] = '\0';

        Serial.print("Status line : ");
        Serial.println(line);

        // Vérifie que ça commence par HTTP/
        if (strncmp(line, "HTTP/", 5) == 0) {
          char *firstSpace = strchr(line, ' ');
          if (firstSpace != NULL) {
            return atoi(firstSpace + 1);
          }
        }

        return -2;
      }

      if (idx < (int)sizeof(line) - 1) {
        line[idx++] = c;
      }
    }
  }

  return -2;
}

// =========================
// TRIM SIMPLE EN PLACE
// Supprime espaces / \r / \n au début et à la fin
// =========================
void trimString(char *str) {
  int len = strlen(str);
  int start = 0;
  int end = len - 1;

  while (start < len && isTrimChar(str[start])) {
    start++;
  }

  while (end >= start && isTrimChar(str[end])) {
    end--;
  }

  int newLen = end - start + 1;

  if (newLen <= 0) {
    str[0] = '\0';
    return;
  }

  if (start > 0) {
    memmove(str, str + start, newLen);
  }

  str[newLen] = '\0';
}

bool isTrimChar(char c) {
  return c == ' ' || c == '\r' || c == '\n' || c == '\t';
}