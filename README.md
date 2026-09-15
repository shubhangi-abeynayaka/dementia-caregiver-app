# 🩺 OrbitCare — Dementia Patient Tracking Platform

A low-cost, subscription-free real-time monitoring system for tracking dementia patients using custom ESP32 + LoRa + GPS hardware. The system uses a **Transmitter** worn by the patient, a **Receiver** placed at home that bridges to MQTT, and a **web dashboard** for the caregiver.

---

## 📐 System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  PATIENT (Transmitter — ESP32 + LoRa + GPS + MPU-6050)              │
│                                                                      │
│  • Detects motion via IMU (1-second RMS window)                      │
│  • Computes geofence zone from GPS + polygon centroid                │
│  • Sends adaptive-interval LoRa packets (5 s / 10 s / 60 s / none) │
│  • 3 buttons: Add Boundary Point · Reset Boundary · SOS             │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ LoRa 433 MHz
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  HOME (Receiver — ESP32 + LoRa + WiFi)                              │
│                                                                      │
│  • Bridges LoRa packets to MQTT (WiFi)                              │
│  • Publishes: orbitcare/location · orbitcare/boundary               │
│                orbitcare/signal                                      │
│  • Subscribes: orbitcare/signal (receives RESET from app)           │
│  • Physical BTN_RESET mutes false alarms locally                    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ MQTT (TCP 1883)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  BACKEND — Node.js / Express / SQLite / Socket.IO                   │
│                                                                      │
│  • Subscribes to all 3 orbitcare/* topics                           │
│  • Persists boundary points keyed by hardware point_id              │
│  • Broadcasts telemetry / signal events via Socket.IO               │
│  • Publishes RESET / ALARM_OFF back to receiver on caregiver action │
│  • REST API for history, geofence points, and signal commands       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ Socket.IO + HTTP
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND — React 18 + Vite + Tailwind CSS                          │
│                                                                      │
│  • Live map with geofence overlay                                    │
│  • Status cards, alarm panel, incident history                      │
│  • False-alarm dismiss button → POST /api/signal/reset              │
│  • Boundary points loaded from DB on startup (survives reloads)     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📡 MQTT Topics

| Topic | Direction | Publisher | Subscriber |
|---|---|---|---|
| `orbitcare/location` | → backend | Receiver | Backend |
| `orbitcare/boundary` | → backend | Receiver | Backend |
| `orbitcare/signal` | ↔ both | Receiver / Backend | Backend / **Receiver** |

### `orbitcare/location` payload
```json
{
  "device_id": "DEVICE-009",
  "location": [
    {
      "Status": "SAFE",
      "latitude": 6.823286138538,
      "longitude": 79.966008919125
    }
  ]
}
```
Status values: `SAFE` · `ALERT_OUTSIDE` · `WARN_NO_BOUNDARY`

### `orbitcare/boundary` payload (3 points per packet, up to 4 packets for 10 points)
```json
{
  "type": "BOUNDARY",
  "device_id": "DEVICE-009",
  "points": [
    { "id": 1, "latitude": 6.822114000000, "longitude": 79.966147000000 },
    { "id": 2, "latitude": 6.822890000000, "longitude": 79.966530000000 },
    { "id": 3, "latitude": 6.823150000000, "longitude": 79.965900000000 }
  ]
}
```
- Points arrive in **batches of 3** via LoRa. The backend accumulates all batches before using the polygon.
- Maximum **10 boundary points**. An empty `points: []` means **RESET** (clear all).
- All coordinates are transmitted at **12-decimal precision** and stored at full IEEE 754 double precision.

### `orbitcare/signal` payload
```json
{ "device_id": "DEVICE-009", "command": "ALARM_ON" }
```
Commands: `SOS` · `ALARM_ON` · `ALARM_OFF` · `RESET`

---

## 🔁 Adaptive Location Update Interval (Transmitter)

The transmitter uses the **MPU-6050 IMU** to corroborate GPS-based zone detection:

| GPS Zone | IMU `accRMS` | Update Interval |
|---|---|---|
| Person is **STILL** | — | **No send** (GPS unreliable, saves power) |
| **Outside** geofence | any | **5 seconds** |
| **Outer 20%** ring (near boundary) | `> 0.08 g` (fast movement) | **5 seconds** (escalated) |
| **Outer 20%** ring (near boundary) | ≤ 0.08 g (slow/drifting) | **10 seconds** |
| **Inner 80%** zone (safely inside) | any | **60 seconds** |

Zone is computed relative to the **polygon centroid** and **max centroid-to-vertex radius**.

---

## 🗄️ Database Schema (SQLite — `orbitcare.db`)

```sql
-- Location history (throttled: >5 m moved or status changed or >5 min elapsed)
CREATE TABLE telemetry_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id  TEXT,
  lat        REAL,   -- full IEEE 754 double precision
  lng        REAL,
  status     TEXT,
  rssi       TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alarm / SOS incidents
CREATE TABLE incident_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id  TEXT,
  event_type TEXT,
  lat        REAL,
  lng        REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full geofence polygon (rebuilt after each boundary packet batch)
CREATE TABLE geofence_zones (
  id           INTEGER PRIMARY KEY,
  device_id    TEXT,
  polygon_json TEXT,   -- JSON [[lat,lng], ...]
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual boundary points keyed by hardware-assigned point_id
-- Allows incremental accumulation of 3-point LoRa batches
CREATE TABLE boundary_points (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id  TEXT,
  point_id   INTEGER,   -- 1-based ID from transmitter hardware
  latitude   REAL,
  longitude  REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (device_id, point_id)
);
```

---

## 🌐 REST API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/geofence?device_id=` | Active polygon as `[[lat,lng],…]` |
| `GET` | `/api/geofence/points?device_id=` | All boundary points `{id, latitude, longitude}[]` ordered by point_id |
| `POST` | `/api/geofence` | Body: `{device_id, boundary: [[lat,lng],…]}` — save polygon |
| `POST` | `/api/signal/reset` | Body: `{device_id}` — publish RESET to `orbitcare/signal` (mutes receiver alarm) |
| `POST` | `/api/signal/alarm` | Body: `{device_id, command: "ALARM_ON"\|"ALARM_OFF"}` — explicit alarm control |
| `GET` | `/api/history` | Telemetry history (last 100 rows) |
| `POST` | `/api/history/clear` | Stamp history clear timestamp |
| `GET` | `/api/incidents` | Incident log |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Radix UI, Socket.IO client |
| **Backend** | Node.js, Express 5, Socket.IO, MQTT.js, SQLite3 |
| **Hardware** | ESP32, LoRa SX1276 (433 MHz), NEO-6M GPS, MPU-6050 IMU |
| **Protocol** | LoRa (air), MQTT TCP 1883 (LAN), Socket.IO (browser) |
| **Database** | SQLite (file: `server/orbitcare.db`) |

---

## 💻 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- A running MQTT broker on your local network (e.g. [Mosquitto](https://mosquitto.org/))
- Google Maps API key (for map tiles)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/dementia-caregiver-app.git
cd dementia-caregiver-app

# Frontend dependencies
npm install

# Backend dependencies
cd server
npm install
cd ..
```

### 2. Configure environment

**Frontend** — create `.env` in the project root:
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_BACKEND_URL=http://localhost:5000
```

**Backend** — create `.env` in `server/`:
```env
MQTT_BROKER_URL=mqtt://10.24.68.47:1883
PORT=5000
```

Replace `10.24.68.47` with your MQTT broker's IP address (the one configured in the Receiver firmware).

### 3. Run

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000`

---

## 🔧 Hardware Configuration

### Transmitter (`tx_code/tx_code.ino`)

| Parameter | Value | Notes |
|---|---|---|
| `DEVICE_ID` | `"DEVICE-009"` | Must match Receiver |
| `LORA_FREQ` | 433 MHz | |
| `MAX_POINTS` | 10 | Boundary points hard limit |
| `POINTS_PER_PACKET` | 3 | LoRa packet batch size |
| `NEAR_BOUNDARY_RATIO` | 0.80 | 80% radius = inner safe zone |
| `INTERVAL_OUTSIDE` | 5 000 ms | Outside fence → 5 s |
| `INTERVAL_NEAR` | 10 000 ms | Near boundary → 10 s |
| `INTERVAL_NEAR_IMU` | 5 000 ms | Near + high accRMS → 5 s |
| `INTERVAL_SAFE` | 60 000 ms | Inside safe zone → 60 s |

**Buttons on Transmitter:**
- `BTN_ADD_POINT` (GPIO 4) — Short press: adds current GPS fix as a boundary point
- `BTN_RESET` (GPIO 25) — Short press: delete last point · Long press (>2 s): clear all points
- `BTN_SOS` (GPIO 27) — Press: send SOS emergency signal

### Receiver (`Rx_code/Rx_code.ino`)

| Parameter | Value |
|---|---|
| `DEVICE_ID` | `"DEVICE-009"` |
| `MQTT_BROKER` | `10.24.68.47` |
| `MQTT_PORT` | `1883` |
| `TOPIC_BOUNDARY` | `orbitcare/boundary` |
| `TOPIC_LOCATION` | `orbitcare/location` |
| `TOPIC_SIGNAL` | `orbitcare/signal` (publish **and** subscribe) |

**Button on Receiver:**
- `BTN_RESET` (GPIO 4) — Clears SOS latch and mutes alarm locally (same effect as app dismiss button)

**LEDs:**
- Green ON → Safe
- Red fast blink (150 ms) → SOS active
- Red slow blink (500 ms) → Outside boundary alarm
- All off → No boundary / idle

---

## 🔕 False-Alarm Dismissal Flow

1. Caregiver taps **"Dismiss Alarm"** in the web app
2. Frontend calls `POST /api/signal/reset`
3. Backend publishes `{"device_id":"DEVICE-009","command":"RESET"}` to `orbitcare/signal`
4. **Receiver** picks up the MQTT message via its callback → clears SOS latch, turns LEDs off, publishes `RESET` acknowledgement
5. Backend broadcasts `signal: RESET` via Socket.IO → all browser tabs immediately clear the alarm panel

The same outcome happens if the caregiver presses the physical `BTN_RESET` on the receiver hardware.

---

## 📁 Project Structure

```
dementia-caregiver-app/
├── src/                          # React frontend
│   ├── controllers/
│   │   └── useDeviceController.js  # All device state + socket logic
│   ├── models/
│   │   ├── geofence.js             # Boundary validation & geometry
│   │   └── telemetry.js            # Status normalisation
│   ├── services/
│   │   ├── apiService.js           # HTTP client with URL fallback
│   │   └── socketService.js        # Socket.IO client wrapper
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── MapView.jsx
│   │   ├── History.jsx
│   │   └── Settings.jsx
│   └── lib/
│       └── geofence.js             # formatCoords (6 decimal places)
│
└── server/                       # Node.js backend
    ├── config/
    │   ├── db.js                   # SQLite migrations
    │   ├── mqtt.js                 # MQTT broker connection
    │   └── socket.js               # Socket.IO server
    ├── repositories/
    │   ├── geofenceRepository.js   # boundary_points + geofence_zones
    │   ├── telemetryRepository.js
    │   └── incidentRepository.js
    ├── services/
    │   ├── geofenceService.js      # processBoundaryPacket, zone checks
    │   └── telemetryService.js     # MQTT message handlers
    ├── controllers/
    │   ├── geofenceController.js   # GET /points handler
    │   └── signalController.js     # POST /reset, POST /alarm
    ├── routes/
    │   ├── geofence.js
    │   ├── signal.js               # NEW
    │   ├── history.js
    │   └── incidents.js
    └── server.js
```

---

## 🔢 GPS Coordinate Precision

| Stage | Precision | Notes |
|---|---|---|
| Transmitter serial | 12 decimal places | `snprintf("%.12f", value)` |
| LoRa packet | 12 decimal places | JSON string in packet |
| Receiver → MQTT | IEEE 754 double | ArduinoJson `as<double>()` |
| Backend DB | IEEE 754 double | SQLite REAL column |
| Frontend display | **6 decimal places** | ~0.1 m resolution |

---

## 👥 Team

This project was built as part of a University Engineering Module.