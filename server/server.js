require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
];
const app = express();
const httpServer = http.createServer(app);
const db = new sqlite3.Database(path.join(__dirname, 'orbitcare.db'));
let activeGeofence = null;
let lastSavedLat = null;
let lastSavedLng = null;
let lastSavedTime = null;
let lastSavedStatus = null;
let lastTelemetryStatus = null;
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
  },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

db.run(`
  CREATE TABLE IF NOT EXISTS telemetry_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    lat REAL,
    lng REAL,
    status TEXT,
    rssi TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (error) => {
  if (error) {
    console.error('Failed to initialize telemetry_logs table:', error);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS incident_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    event_type TEXT,
    lat REAL,
    lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (error) => {
  if (error) {
    console.error('Failed to initialize incident_logs table:', error);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS geofence_zones (
    id INTEGER PRIMARY KEY,
    device_id TEXT,
    polygon_json TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (error) => {
  if (error) {
    console.error('Failed to initialize geofence_zones table:', error);
    return;
  }

  db.get(
    'SELECT device_id, polygon_json FROM geofence_zones ORDER BY updated_at DESC, id DESC LIMIT 1',
    [],
    (selectError, row) => {
      if (selectError) {
        console.error('Failed to load geofence zone:', selectError);
        return;
      }

      if (row) {
        try {
          const polygon = JSON.parse(row.polygon_json);
          if (isValidPolygon(polygon)) {
            activeGeofence = { device_id: row.device_id, polygon };
          }
        } catch {
          console.error('Ignoring invalid saved geofence polygon.');
        }
      }
    },
  );
});

db.run(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`, (error) => {
  if (error) console.error('Failed to initialize app_settings table:', error);
});

function purgeExpiredTelemetry() {
  db.run(
    "DELETE FROM telemetry_logs WHERE created_at < datetime('now', '-30 days')",
    [],
    (error) => {
      if (error) console.error('Failed to purge expired telemetry:', error);
    },
  );
}

purgeExpiredTelemetry();
setInterval(purgeExpiredTelemetry, 24 * 60 * 60 * 1000);

function isValidPolygon(polygon) {
  return Array.isArray(polygon)
    && polygon.length >= 3
    && polygon.every((point) => (
      Array.isArray(point)
      && point.length >= 2
      && Number.isFinite(Number(point[0]))
      && Number.isFinite(Number(point[1]))
    ));
}

function isPointInPolygon(point, polygon) {
  if (!Array.isArray(point) || point.length < 2 || !isValidPolygon(polygon)) return false;

  const [latitude, longitude] = point.map(Number);
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index++) {
    const [currentLatitude, currentLongitude] = polygon[index].map(Number);
    const [previousLatitude, previousLongitude] = polygon[previousIndex].map(Number);
    const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude))
      && (longitude < (previousLongitude - currentLongitude)
        * (latitude - currentLatitude) / (previousLatitude - currentLatitude) + currentLongitude);

    if (intersects) inside = !inside;
  }

  return inside;
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/history', (req, res) => {
  db.get(
    'SELECT value FROM app_settings WHERE key = ?',
    ['history_cleared_at'],
    (settingsError, setting) => {
      if (settingsError) {
        res.status(500).json({ error: settingsError.message });
        return;
      }

      const query = setting
        ? 'SELECT * FROM telemetry_logs WHERE datetime(created_at) > datetime(?) ORDER BY created_at DESC LIMIT 100'
        : 'SELECT * FROM telemetry_logs ORDER BY created_at DESC LIMIT 100';
      const parameters = setting ? [setting.value] : [];

      db.all(query, parameters, (error, rows) => {
        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        res.json(rows);
      });
    },
  );
});

app.post('/api/history/clear', (req, res) => {
  const clearedAt = new Date().toISOString();

  db.run(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['history_cleared_at', clearedAt],
    (error) => {
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ cleared_at: clearedAt });
    },
  );
});

app.get('/api/incidents', (req, res) => {
  db.all(
    'SELECT * FROM incident_logs ORDER BY created_at DESC LIMIT 50',
    [],
    (error, rows) => {
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json(rows);
    },
  );
});

app.get('/api/geofence', (req, res) => {
  const deviceId = req.query.device_id;
  const zone = activeGeofence && (!deviceId || activeGeofence.device_id === deviceId)
    ? activeGeofence
    : null;

  res.json({
    device_id: zone?.device_id ?? deviceId ?? null,
    boundary: zone?.polygon ?? [],
  });
});

app.post('/api/geofence', (req, res) => {
  const { device_id: deviceId = null, boundary } = req.body ?? {};

  if (!isValidPolygon(boundary)) {
    res.status(400).json({ error: 'boundary must contain at least 3 valid [lat, lng] points' });
    return;
  }

  const polygon = boundary.map(([latitude, longitude]) => [Number(latitude), Number(longitude)]);
  const polygonJson = JSON.stringify(polygon);

  db.get(
    'SELECT id FROM geofence_zones WHERE device_id IS ? LIMIT 1',
    [deviceId],
    (selectError, row) => {
      if (selectError) {
        res.status(500).json({ error: selectError.message });
        return;
      }

      const query = row
        ? 'UPDATE geofence_zones SET polygon_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        : 'INSERT INTO geofence_zones (device_id, polygon_json) VALUES (?, ?)';
      const parameters = row ? [polygonJson, row.id] : [deviceId, polygonJson];

      db.run(query, parameters, function saveGeofence(saveError) {
        if (saveError) {
          res.status(500).json({ error: saveError.message });
          return;
        }

        activeGeofence = { device_id: deviceId, polygon };
        res.json({ device_id: deviceId, boundary: polygon });
      });
    },
  );
});

function haversineDistanceInMeters(firstLat, firstLng, secondLat, secondLng) {
  const earthRadius = 6371000;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const firstLatitude = toRadians(firstLat);
  const secondLatitude = toRadians(secondLat);
  const deltaLatitude = toRadians(secondLat - firstLat);
  const deltaLongitude = toRadians(secondLng - firstLng);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
}

const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL);
const telemetryTopics = [
  'orbitcare/location',
  'orbitcare/boundary',
  'orbitcare/signal',
];

mqttClient.on('connect', () => {
  console.log('Connected to external Mosquitto broker at:', process.env.MQTT_BROKER_URL);
  mqttClient.subscribe(telemetryTopics, (error) => {
    if (error) {
      console.error('Failed to subscribe to MQTT topics:', error);
      return;
    }

    console.log('Subscribed to telemetry topics:', telemetryTopics.join(', '));
  });
});

mqttClient.on('message', (topic, message) => {
  const rawData = message.toString();
  let data;

  try {
    data = JSON.parse(rawData);
  } catch {
    data = rawData;
  }

  console.log(`MQTT message received on ${topic}:`, data);

  if (topic === 'orbitcare/location' && data && typeof data === 'object') {
    const lat = Number(data.lat ?? data.latitude);
    const lng = Number(data.lng ?? data.longitude);
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
    const matchingGeofence = activeGeofence
      && (!activeGeofence.device_id || activeGeofence.device_id === data.device_id);
    const breachedGeofence = hasCoordinates
      && matchingGeofence
      && !isPointInPolygon([lat, lng], activeGeofence.polygon);
    const status = breachedGeofence ? 'ALERT' : (data.status ?? null);
    data = { ...data, status };
    const normalizedStatus = String(status ?? '').toUpperCase();
    const statusChanged = normalizedStatus !== lastTelemetryStatus;
    const enteredIncidentStatus = breachedGeofence
      || (statusChanged && ['ALERT', 'SOS'].includes(normalizedStatus));

    if (enteredIncidentStatus) {
      db.run(
        `INSERT INTO incident_logs (device_id, event_type, lat, lng)
         VALUES (?, ?, ?, ?)`,
        [data.device_id ?? null, normalizedStatus, Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null],
        (error) => {
          if (error) console.error('Failed to log incident:', error);
        },
      );
    }

    const distanceMoved = hasCoordinates && lastSavedLat !== null
      ? haversineDistanceInMeters(lastSavedLat, lastSavedLng, lat, lng)
      : Infinity;
    const timeElapsed = lastSavedTime === null ? Infinity : (Date.now() - lastSavedTime) / 1000;
    const shouldSave = hasCoordinates && (
      lastSavedLat === null
      || distanceMoved > 5
      || normalizedStatus !== lastSavedStatus
      || timeElapsed > 300
    );

    if (shouldSave) {
      db.run(
        `INSERT INTO telemetry_logs (device_id, lat, lng, status, rssi)
         VALUES (?, ?, ?, ?, ?)`,
        [data.device_id ?? null, lat, lng, status, data.rssi ?? null],
        (error) => {
          if (error) {
            console.error('Failed to log telemetry:', error);
            return;
          }

          lastSavedLat = lat;
          lastSavedLng = lng;
          lastSavedTime = Date.now();
          lastSavedStatus = normalizedStatus;
        },
      );
    }

    lastTelemetryStatus = normalizedStatus;
  }

  if (topic === 'orbitcare/boundary' && data && typeof data === 'object') {
    const boundary = Array.isArray(data)
      ? data
        : (data.boundary ?? data.points);
    const normalizedBoundary = Array.isArray(boundary)
      ? boundary.map((point) => {
        if (Array.isArray(point)) {
          return [Number(point[0]), Number(point[1])];
        }

        if (point && typeof point === 'object') {
          return [
            Number(point.lat ?? point.latitude),
            Number(point.lng ?? point.longitude),
          ];
        }

        return null;
      }).filter((point) => point && point.every(Number.isFinite))
      : null;

    if (normalizedBoundary && isValidPolygon(normalizedBoundary)) {
      activeGeofence = {
        device_id: data.device_id ?? null,
        polygon: normalizedBoundary,
      };
      data = { ...data, boundary: normalizedBoundary };
    }
  }

  io.emit('telemetry', data);
});

mqttClient.on('error', (error) => {
  console.error('MQTT client error:', error);
});

io.on('connection', (socket) => {
  console.log(`Socket.io client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket.io client disconnected: ${socket.id}`);
  });
});

const configuredPort = Number(process.env.PORT) || 5000;
const fallbackPort = configuredPort === 5000 ? 5001 : null;

function listenOnPort(port, allowFallback = true) {
  let hasListenError = false;
  const handleError = (error) => {
    hasListenError = true;
    if (error.code === 'EADDRINUSE' && allowFallback && fallbackPort) {
      console.warn(`Port ${port} is already in use. Trying port ${fallbackPort}...`);
      httpServer.close(() => listenOnPort(fallbackPort, false));
      return;
    }

    console.error(`Unable to start server on port ${port}:`, error.message);
    if (error.code === 'EADDRINUSE') {
      console.error('Stop the process using the port or set PORT to another available port in server/.env.');
    }
    process.exitCode = 1;
  };

  httpServer.once('error', handleError);
  httpServer.listen(port, () => {
    httpServer.removeListener('error', handleError);
    if (hasListenError) return;
    console.log(`Server listening on port ${port}`);
  });
}

listenOnPort(configuredPort);
