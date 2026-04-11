#include <Arduino.h>

#if defined(ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif

#include <time.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <TinyGPSPlus.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#define ONE_WIRE_BUS 2
#define WIFI_SSID "moto g54 5G"
#define WIFI_PASSWORD "123123123"
#define API_KEY "AIzaSyCMDNODPT-oQSa1IzZnVubenDm6y4PhBsU"
#define DATABASE_URL "https://cold-chain-logistics-monitor-default-rtdb.firebaseio.com"
#define DEVICE_PATH "cold_chain/device_1"
#define DEVICE_ID "device_1"
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define GPS_BAUD 9600

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
TinyGPSPlus gps;

#if defined(ESP32)
HardwareSerial GPSSerial(1);
#endif

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;
unsigned long lastPublishMs = 0;
const unsigned long publishIntervalMs = 5000UL;
bool gpsRawEcho = false;

String serialCommandBuffer;

void printHelp();
void printGPSStatus();
void printWiFiStatus();
void printFirebaseStatus();
void printSystemStatus();
void handleSerialCommands();

void printBootBanner() {
  Serial.println("\n=== Cold Chain Telemetry Node ===");
  Serial.printf("Device: %s\n", DEVICE_ID);
  Serial.printf("Publish interval: %lu ms\n", publishIntervalMs);
#if defined(ESP32)
  Serial.printf("GPS UART: RX=%d TX=%d BAUD=%d\n", GPS_RX_PIN, GPS_TX_PIN, GPS_BAUD);
#else
  Serial.println("GPS UART: not configured in this build");
#endif
  Serial.println("Type 'help' for debug commands.");
}

void readGPSStream() {
#if defined(ESP32)
  while (GPSSerial.available() > 0) {
    const char c = static_cast<char>(GPSSerial.read());
    gps.encode(c);
    if (gpsRawEcho) {
      Serial.write(c);
    }
  }
#endif
}

void printGPSStatus() {
  Serial.println("[GPS] ----");

#if defined(ESP32)
  const bool hasFix = gps.location.isValid() && gps.location.age() < 5000;
  Serial.printf("fix=%s ageMs=%lu\n", hasFix ? "yes" : "no", gps.location.isValid() ? gps.location.age() : 0UL);

  if (gps.location.isValid()) {
    Serial.printf("lat=%.6f lon=%.6f\n", gps.location.lat(), gps.location.lng());
  }

  if (gps.satellites.isValid()) {
    Serial.printf("satellites=%u\n", gps.satellites.value());
  }

  if (gps.speed.isValid()) {
    Serial.printf("speedKmph=%.2f\n", gps.speed.kmph());
  }

  if (gps.altitude.isValid()) {
    Serial.printf("altitudeM=%.2f\n", gps.altitude.meters());
  }

  Serial.printf("chars=%lu sentencesWithFix=%lu passedChecksum=%lu failedChecksum=%lu\n",
                gps.charsProcessed(), gps.sentencesWithFix(), gps.passedChecksum(), gps.failedChecksum());

  if (gps.charsProcessed() < 10) {
    Serial.println("warning: very low GPS traffic. Check wiring, power, and baud rate.");
  }
#else
  Serial.println("GPS debugging unavailable in this build target.");
#endif
}

void printWiFiStatus() {
  Serial.println("[WiFi] ----");
  Serial.printf("status=%d connected=%s\n", WiFi.status(), WiFi.status() == WL_CONNECTED ? "yes" : "no");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("ssid=%s rssi=%d ip=%s\n", WIFI_SSID, WiFi.RSSI(), WiFi.localIP().toString().c_str());
  }
}

void printFirebaseStatus() {
  Serial.println("[Firebase] ----");
  Serial.printf("signupOK=%s ready=%s\n", signupOK ? "yes" : "no", Firebase.ready() ? "yes" : "no");
  if (fbdo.httpCode() != 0) {
    Serial.printf("lastHttpCode=%d\n", fbdo.httpCode());
  }
}

void printSystemStatus() {
  Serial.println("[System] ----");
  Serial.printf("uptimeMs=%lu freeHeap=%u\n", millis(), ESP.getFreeHeap());
  printWiFiStatus();
  printFirebaseStatus();
  printGPSStatus();
}

void printHelp() {
  Serial.println("Debug commands:");
  Serial.println("  help      - show this command list");
  Serial.println("  gps       - print current GPS diagnostics");
  Serial.println("  wifi      - print WiFi status");
  Serial.println("  fb        - print Firebase status");
  Serial.println("  status    - print full system status");
  Serial.println("  raw on    - echo raw GPS NMEA stream to serial");
  Serial.println("  raw off   - stop raw GPS echo");
}

void handleSerialCommands() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());

    if (c == '\r') {
      continue;
    }

    if (c == '\n') {
      serialCommandBuffer.trim();
      if (serialCommandBuffer.length() == 0) {
        continue;
      }

      if (serialCommandBuffer.equalsIgnoreCase("help")) {
        printHelp();
      } else if (serialCommandBuffer.equalsIgnoreCase("gps")) {
        printGPSStatus();
      } else if (serialCommandBuffer.equalsIgnoreCase("wifi")) {
        printWiFiStatus();
      } else if (serialCommandBuffer.equalsIgnoreCase("fb")) {
        printFirebaseStatus();
      } else if (serialCommandBuffer.equalsIgnoreCase("status")) {
        printSystemStatus();
      } else if (serialCommandBuffer.equalsIgnoreCase("raw on")) {
        gpsRawEcho = true;
        Serial.println("Raw GPS echo enabled");
      } else if (serialCommandBuffer.equalsIgnoreCase("raw off")) {
        gpsRawEcho = false;
        Serial.println("Raw GPS echo disabled");
      } else {
        Serial.printf("Unknown command: %s\n", serialCommandBuffer.c_str());
        Serial.println("Type 'help' for command list.");
      }

      serialCommandBuffer = "";
      continue;
    }

    serialCommandBuffer += c;
  }
}

bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");
  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - startMs > 20000UL) {
      Serial.println("\nWiFi connection timed out");
      return false;
    }
  }

  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  struct tm timeInfo;
  for (int attempt = 0; attempt < 20; ++attempt) {
    if (getLocalTime(&timeInfo, 1000)) {
      Serial.println("Time synchronized");
      return;
    }
  }

  Serial.println("Time sync failed; fallback timestamps will use uptime seconds");
}

unsigned long getTimestampSeconds() {
  time_t now = time(nullptr);
  if (now > 1700000000UL) {
    return static_cast<unsigned long>(now);
  }

  return millis() / 1000UL;
}

void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    signupOK = true;
  } else {
    Serial.printf("Firebase sign-up error: %s\n", config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void publishTelemetry(float temperatureC) {
  if (!signupOK || !Firebase.ready()) {
    Serial.println("Firebase not ready yet");
    return;
  }

  FirebaseJson payload;
  payload.set("deviceId", DEVICE_ID);
  payload.set("temperature", temperatureC);
  payload.set("timestamp", getTimestampSeconds());

  const bool hasGpsFix = gps.location.isValid() && gps.location.age() < 5000;
  payload.set("gpsFix", hasGpsFix);

  if (hasGpsFix) {
    payload.set("latitude", gps.location.lat());
    payload.set("longitude", gps.location.lng());
    payload.set("gpsAgeMs", gps.location.age());
  }

  if (gps.satellites.isValid()) {
    payload.set("satellites", gps.satellites.value());
  }

  if (gps.speed.isValid()) {
    payload.set("speedKmph", gps.speed.kmph());
  }

  if (gps.altitude.isValid()) {
    payload.set("altitudeMeters", gps.altitude.meters());
  }

  if (Firebase.RTDB.updateNode(&fbdo, DEVICE_PATH, &payload)) {
    Serial.printf("Published temperature: %.2f C\n", temperatureC);
    if (hasGpsFix) {
      Serial.printf("GPS: %.6f, %.6f\n", gps.location.lat(), gps.location.lng());
    } else {
      Serial.println("GPS: no valid fix yet");
    }
  } else {
    Serial.printf("Publish failed: %s\n", fbdo.errorReason().c_str());
    Serial.printf("HTTP code: %d\n", fbdo.httpCode());
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  printBootBanner();

  sensors.begin();

#if defined(ESP32)
  GPSSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("GPS serial initialized");
#endif

  if (!connectWiFi()) {
    return;
  }

  syncTime();
  setupFirebase();
  printSystemStatus();
}

void loop() {
  handleSerialCommands();
  readGPSStream();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (millis() - lastPublishMs < publishIntervalMs) {
    delay(50);
    return;
  }

  lastPublishMs = millis();

  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);

  if (tempC == DEVICE_DISCONNECTED_C) {
    Serial.println("DS18B20 sensor not found");
    return;
  }

  Serial.print("Temperature: ");
  Serial.print(tempC);
  Serial.println(" C");

  publishTelemetry(tempC);
}
