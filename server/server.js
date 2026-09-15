'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');

// ── Config / infrastructure ───────────────────────────────────────────────────
const socketConfig = require('./config/socket');
const mqttConfig   = require('./config/mqtt');
const { allowedOrigins } = require('./config/socket');

// ── Services ──────────────────────────────────────────────────────────────────
const geofenceService  = require('./services/geofenceService');
const telemetryService = require('./services/telemetryService');

// ── Repositories (scheduled tasks only) ──────────────────────────────────────
const telemetryRepository = require('./repositories/telemetryRepository');

// ── Routes ────────────────────────────────────────────────────────────────────
const historyRoutes  = require('./routes/history');
const incidentRoutes = require('./routes/incidents');
const geofenceRoutes = require('./routes/geofence');
const signalRoutes   = require('./routes/signal');

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(require('cors')({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) =>
  res.json({ status: 'online', timestamp: new Date().toISOString() }),
);

app.use('/api/history',   historyRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/geofence',  geofenceRoutes);
app.use('/api/signal',    signalRoutes);

// ── HTTP + Socket.IO ──────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
socketConfig.init(httpServer);

// ── Startup tasks ─────────────────────────────────────────────────────────────
geofenceService.loadActiveGeofence();

telemetryRepository.purgeExpired();
setInterval(() => telemetryRepository.purgeExpired(), 24 * 60 * 60 * 1000);

mqttConfig.connect(telemetryService.handleMqttMessage);

// ── Listen ────────────────────────────────────────────────────────────────────
const configuredPort = Number(process.env.PORT) || 5000;
const fallbackPort   = configuredPort === 5000 ? 5001 : null;

function listenOnPort(port, allowFallback = true) {
  let hasListenError = false;

  const handleError = (err) => {
    hasListenError = true;
    if (err.code === 'EADDRINUSE' && allowFallback && fallbackPort) {
      console.warn(`[server] Port ${port} in use — trying ${fallbackPort}…`);
      httpServer.close(() => listenOnPort(fallbackPort, false));
      return;
    }
    console.error(`[server] Cannot start on port ${port}:`, err.message);
    if (err.code === 'EADDRINUSE') {
      console.error('[server] Stop the process using the port or set PORT in server/.env.');
    }
    process.exitCode = 1;
  };

  httpServer.once('error', handleError);
  httpServer.listen(port, () => {
    httpServer.removeListener('error', handleError);
    if (!hasListenError) console.log(`[server] Listening on port ${port}`);
  });
}

listenOnPort(configuredPort);
