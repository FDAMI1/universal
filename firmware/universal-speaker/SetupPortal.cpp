#include "SetupPortal.h"
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include "AudioPlayer.h"
#include "DeviceConfig.h"
#include "HindiSpeech.h"

namespace SetupPortal {
namespace {

constexpr uint32_t CONNECT_TIMEOUT_MS = 20 * 1000;
constexpr uint32_t RESTART_AFTER_CONNECT_MS = 3 * 60 * 1000;
constexpr uint32_t SETUP_REMINDER_MS = 2 * 60 * 1000;

enum class State { Idle, Connecting, Connected, Failed };

AsyncWebServer portal(80);
DNSServer dns;

volatile State state = State::Idle;
volatile bool connectRequested = false;
volatile bool finishRequested = false;
String pendingSsid;
String pendingPassword;
uint32_t connectStartedAt = 0;
uint32_t connectedAt = 0;
uint32_t lastReminderAt = 0;

const char PAGE[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Speaker Setup</title>
<style>
body{font-family:system-ui,sans-serif;background:#f1f5f9;color:#0f172a;margin:0;padding:16px}
.card{background:#fff;border-radius:12px;padding:20px;max-width:420px;margin:0 auto;box-shadow:0 1px 3px #0002}
h1{font-size:20px;margin:0 0 4px}p{color:#475569;margin:0 0 16px}
label{display:block;font-weight:600;margin:12px 0 4px}
input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font-size:16px}
button{width:100%;margin-top:16px;padding:14px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:16px;font-weight:600}
button:disabled{background:#94a3b8}
.info{background:#ecfdf5;border-radius:8px;padding:12px;margin-top:12px}
.info b{font-family:monospace;font-size:18px}
.err{color:#b91c1c}
</style></head><body><div class="card">
<h1>Universal Speaker setup</h1>
<p>Connect the speaker to the same Wi-Fi (or hotspot) your phone uses.</p>
<div id="form">
<label for="ssid">Wi-Fi name</label><input id="ssid" list="nets" autocomplete="off" required>
<datalist id="nets"></datalist>
<label for="pass">Password</label><input id="pass" type="password">
<button id="go" onclick="connect()">Connect</button>
<p id="msg" role="status" style="margin-top:12px"></p>
</div>
<div id="done" hidden>
<p><b>Connected!</b> Now open the Universal Speaker app &rarr; Devices &rarr; enter manually:</p>
<div class="info">Device ID: <b id="id"></b><br>IP address: <b id="ip"></b><br>PIN: <b id="pin"></b></div>
<p style="margin-top:12px">Write these down. The speaker also reads them aloud. Then switch your phone back to your normal Wi-Fi.</p>
<button onclick="fetch('/finish',{method:'POST'});this.disabled=true;this.textContent='Restarting…'">Done</button>
</div></div>
<script>
fetch('/scan').then(r=>r.json()).then(n=>{nets.innerHTML=n.map(s=>'<option value="'+s.replace(/"/g,'&quot;')+'">').join('')}).catch(()=>{});
function connect(){
  if(!ssid.value){msg.textContent='Enter the Wi-Fi name';return}
  go.disabled=true;msg.className='';msg.textContent='Connecting… (up to 20 seconds)';
  const b=new URLSearchParams({ssid:ssid.value,password:pass.value});
  fetch('/connect',{method:'POST',body:b}).then(poll).catch(()=>{go.disabled=false;msg.textContent='Could not reach the speaker'});
}
function poll(){
  fetch('/status').then(r=>r.json()).then(s=>{
    if(s.state==='connected'){form.hidden=true;done.hidden=false;id.textContent=s.deviceId;ip.textContent=s.ip;pin.textContent=s.pin}
    else if(s.state==='failed'){go.disabled=false;msg.className='err';msg.textContent='Could not connect. Check the name and password.'}
    else setTimeout(poll,1000);
  }).catch(()=>setTimeout(poll,1500));
}
</script></body></html>)HTML";

const char* stateName() {
  switch (state) {
    case State::Connecting: return "connecting";
    case State::Connected: return "connected";
    case State::Failed: return "failed";
    default: return "idle";
  }
}

void announceDetails() {
  ClipId clips[AudioPlayer::MAX_CLIPS_PER_ANNOUNCEMENT];
  AudioPlayer::enqueue(CLIP_WIFI_OK);
  const String ip = WiFi.localIP().toString();
  AudioPlayer::enqueue(clips, buildIpAndPinAnnouncement(ip.c_str(), config.pin.c_str(), clips, AudioPlayer::MAX_CLIPS_PER_ANNOUNCEMENT));
}

void registerRoutes() {
  portal.on("/", HTTP_GET, [](AsyncWebServerRequest* r) { r->send(200, "text/html", PAGE); });

  portal.on("/scan", HTTP_GET, [](AsyncWebServerRequest* r) {
    const int16_t found = WiFi.scanComplete();
    String json = "[";
    for (int16_t i = 0; i < found; ++i) {
      String ssid = WiFi.SSID(i);
      ssid.replace("\\", "\\\\");
      ssid.replace("\"", "\\\"");
      if (i) json += ',';
      json += '"' + ssid + '"';
    }
    json += ']';
    if (found != WIFI_SCAN_RUNNING) WiFi.scanNetworks(true);  // refresh for next time
    r->send(200, "application/json", json);
  });

  portal.on("/connect", HTTP_POST, [](AsyncWebServerRequest* r) {
    if (!r->hasParam("ssid", true) || r->getParam("ssid", true)->value().isEmpty()) {
      r->send(400, "text/plain", "ssid required");
      return;
    }
    pendingSsid = r->getParam("ssid", true)->value();
    pendingPassword = r->hasParam("password", true) ? r->getParam("password", true)->value() : "";
    state = State::Connecting;
    connectRequested = true;  // WiFi.begin runs in loop(), not in this network callback
    r->send(200, "text/plain", "ok");
  });

  portal.on("/status", HTTP_GET, [](AsyncWebServerRequest* r) {
    String json = String("{\"state\":\"") + stateName() + "\"";
    if (state == State::Connected) {
      json += ",\"ip\":\"" + WiFi.localIP().toString() + "\",\"deviceId\":\"" + config.deviceId + "\",\"pin\":\"" + config.pin + "\"";
    }
    r->send(200, "application/json", json + "}");
  });

  portal.on("/finish", HTTP_POST, [](AsyncWebServerRequest* r) {
    finishRequested = true;
    r->send(200, "text/plain", "ok");
  });

  // Phones probe URLs like /generate_204; redirecting them opens the setup page.
  portal.onNotFound([](AsyncWebServerRequest* r) { r->redirect("http://" + WiFi.softAPIP().toString() + "/"); });
}

}  // namespace

void begin() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(("Speaker-Setup-" + config.deviceId.substring(4)).c_str());
  dns.start(53, "*", WiFi.softAPIP());
  WiFi.scanNetworks(true);

  // If Wi-Fi was configured before (e.g. the router was just off), keep trying
  // it in the background; loop() restarts into normal mode once it connects.
  if (config.hasWifi()) WiFi.begin(config.wifiSsid.c_str(), config.wifiPassword.c_str());

  registerRoutes();
  portal.begin();
  AudioPlayer::enqueue(CLIP_SETUP_MODE);
  lastReminderAt = millis();
  Serial.printf("[setup] join Wi-Fi \"Speaker-Setup-%s\" and open http://%s/\n", config.deviceId.substring(4).c_str(),
                WiFi.softAPIP().toString().c_str());
}

void loop() {
  dns.processNextRequest();
  const uint32_t now = millis();

  if (connectRequested) {
    connectRequested = false;
    WiFi.disconnect();
    WiFi.begin(pendingSsid.c_str(), pendingPassword.c_str());
    connectStartedAt = now;
  }

  if (state == State::Connecting) {
    if (WiFi.status() == WL_CONNECTED) {
      saveWifi(pendingSsid, pendingPassword);
      state = State::Connected;
      connectedAt = now;
      Serial.printf("[setup] connected, IP %s, Device ID %s, PIN %s\n", WiFi.localIP().toString().c_str(),
                    config.deviceId.c_str(), config.pin.c_str());
      announceDetails();
    } else if (now - connectStartedAt > CONNECT_TIMEOUT_MS) {
      state = State::Failed;
      WiFi.disconnect();
      AudioPlayer::enqueue(CLIP_WIFI_FAIL);
    }
  } else if (state == State::Idle && config.hasWifi() && WiFi.status() == WL_CONNECTED) {
    Serial.println("[setup] saved Wi-Fi is back, restarting into normal mode");
    ESP.restart();
  }

  if (state == State::Idle && now - lastReminderAt > SETUP_REMINDER_MS) {
    lastReminderAt = now;
    AudioPlayer::enqueue(CLIP_SETUP_MODE);
  }

  const bool doneAnnouncing = !AudioPlayer::isBusy();
  if ((finishRequested && doneAnnouncing) || (state == State::Connected && now - connectedAt > RESTART_AFTER_CONNECT_MS)) {
    delay(500);  // let the HTTP response go out
    ESP.restart();
  }
}

}  // namespace SetupPortal
