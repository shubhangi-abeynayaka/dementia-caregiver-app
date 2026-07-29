# 🩺 Dementia Caregiver Tracking Platform

A low-cost, subscription-free real-time monitoring web application designed to track dementia patients using custom LoRa/ESP32 GPS hardware devices.

---

## 🚀 Features
- **Live GPS Tracking:** Real-time visual monitoring of patient location on a interactive map.
- **Geofence Safety Zones:** Point-in-polygon boundary logic for instant alerting upon perimeter breaches.
- **Alert System:** Audio and visual notifications for fall detection, signal loss, and boundary breaches.
- **Historical Logs:** Review past wandering incidents and device connection metrics.
- **Zero Subscription Overhead:** Direct-to-caregiver P2P LoRa communication eliminating cellular fees.

---

## 🛠️ Tech Stack
- **Frontend Framework:** React 19 + Vite
- **Styling:** Tailwind CSS + Custom UI Components
- **State Management:** React Context API (`AuthContext`, `DeviceContext`)
- **Mapping:** Mapbox / Leaflet Integration

---

## 💻 Getting Started Locally

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) installed on your machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/dementia-caregiver-app.git](https://github.com/YOUR_USERNAME/dementia-caregiver-app.git)
   cd dementia-caregiver-app

   Install dependencies:

Bash
npm install
Start the development server:

Bash
npm run dev
👥 Team & Contributions
This project was built as part of a University Engineering Module by:

Person 1: UI Shell, Layout Navigation & Auth Screens (feature/ui-shell)

Person 2: Device State Context, Alert Logic & History Engine (feature/device-alerts)

Person 3: Map Visualization, Geofencing & Root Architecture (feature/map-settings)


---

## 🔄 How to Upload This Cleanly via Your 3-Way Split

Since **Person 3** manages root configuration files (`package.json`, `vite.config.js`, `.gitignore`, `README.md`):

1. **Person 3** initializes the repo root with `.gitignore`, `README.md`, configuration files, and `MapWidget.jsx`/`MapView.jsx`, then pushes to `develop`.
2. **Person 1** pulls `develop`, pastes their `pages/` and `components/` files, and opens a Pull Request (`feature/ui-shell` $\rightarrow$ `develop`).
3. **Person 2** pulls `develop`, pastes `context/` and `utils/` files, and opens a Pull Request (`feature/device-alerts` $\rightarrow$ `develop`).