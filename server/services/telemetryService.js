'use strict';

const { isValidPolygon, haversineDistanceInMeters } = require('../utils/geo');
const geofenceService = require('./geofenceService');
const telemetryRepository = require('../repositories/telemetryRepository');
const incidentRepository = require('../repositories/incidentRepository');
const socketConfig = require('../config/socket');
const mqttConfig = require('../config/mqtt');

// ── Throttle state ────────────────────────────────────────────────────────────

/** @type {number | null} */
let lastSavedLat = null;
/** @type {number | null} */
let lastSavedLng = null;
/** @type {number | null} */
let lastSavedTime = null;
/** @type {string | null} */
let lastSavedStatus = null;
/** @type {string | null} */
let lastTelemetryStatus = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a raw MQTT boundary payload (orbitcare/boundary) into an array of
 * { id, latitude, longitude } objects that match the hardware packet structure.
 *
 * The receiver publishes:
 *   { "device_id": "DEVICE-009", "points": [{ "id": 1, "latitude": 6.822..., "longitude": 79.966... }, ...] }
 *
 * Returns null if the payload has no usable points.
 *
 * @param {unknown} data
 * @returns {{ id: number, latitude: number, longitude: number }[] | null}
 */
function normaliseBoundaryPayload(data) {
  if (!data || typeof data !== 'object') return null;

  // Primary path: receiver's structured format with id, latitude, longitude
  if (Array.isArray(data.points)) {
    const points = data.points
      .map((p) => {
        if (!p || typeof p !== 'object') return null;
        const id  = typeof p.id === 'number' ? p.id : Number(p.id);
        const lat = Number(p.lat ?? p.latitude);
        const lng = Number(p.lng ?? p.longitude);
        if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (lat === 0 && lng === 0) return null;
        return { id, latitude: lat, longitude: lng };
      })
      .filter(Boolean);
    // Return null (not empty array) only when there are literally no valid points
    // so callers can distinguish "no points received" from "reset (empty array)".
    return points;
  }

  // Fallback: raw array of [lat, lng] or { lat, lng } — assign sequential IDs
  const rawPoints = Array.isArray(data) ? data : (data.boundary ?? null);
  if (!Array.isArray(rawPoints)) return null;

  return rawPoints
    .map((point, idx) => {
      let lat, lng;
      if (Array.isArray(point)) {
        [lat, lng] = [Number(point[0]), Number(point[1])];
      } else if (point && typeof point === 'object') {
        lat = Number(point.lat ?? point.latitude);
        lng = Number(point.lng ?? point.longitude);
      } else {
        return null;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
      return { id: idx + 1, latitude: lat, longitude: lng };
    })
    .filter(Boolean);
}

/**
 * Normalize an `orbitcare/signal` payload into the application signal shape.
 *
 * Supported commands (checked against both `command` and `status` fields):
 *   ALARM_ON  — patient is outside the boundary, alarm should sound
 *   ALARM_OFF — patient is back inside the boundary, alarm should stop
 *   SOS       — emergency/SOS button was pressed
 *   RESET     — caregiver reset / mute command
 *
 * @param {unknown} data
 * @returns {{device_id: string | null, status: string, lat?: number | null, lng?: number | null} | null}
 */
function normaliseSignalPayload(data) {
  if (!data || typeof data !== 'object') return null;

  const command  = String(data.command  ?? '').toUpperCase().trim();
  const status   = String(data.status   ?? '').toUpperCase().trim();
  const deviceId = data.device_id ?? null;

  const lat = Number(data.lat ?? data.latitude);
  const lng = Number(data.lng ?? data.longitude);
  const coords = {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };

  if (command === 'ALARM_ON'  || status === 'ALARM_ON')  return { device_id: deviceId, status: 'ALARM_ON',  ...coords };
  if (command === 'ALARM_OFF' || status === 'ALARM_OFF') return { device_id: deviceId, status: 'ALARM_OFF' };
  if (command === 'SOS'       || status === 'SOS')       return { device_id: deviceId, status: 'SOS',       ...coords };
  if (command === 'RESET'     || status === 'RESET')     return { device_id: deviceId, status: 'RESET' };

  return null;
}

/**
 * Publish a command to the orbitcare/signal MQTT topic.
 * Used by the backend REST API to send false-alarm dismissal commands to the receiver.
 *
 * Payload format (same structure the receiver reads):
 *   { "device_id": "DEVICE-009", "command": "RESET" }
 *
 * @param {string} command   'RESET' | 'ALARM_ON' | 'ALARM_OFF'
 * @param {string | null} deviceId
 */
function publishSignalCommand(command, deviceId) {
  const client = mqttConfig.getClient();
  if (!client || !client.connected) {
    console.warn('[telemetryService] MQTT client not connected — cannot publish signal command.');
    return;
  }

  const payload = JSON.stringify({
    device_id: deviceId ?? 'DEVICE-009',
    command,
  });

  client.publish('orbitcare/signal', payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`[telemetryService] Failed to publish signal ${command}:`, err);
    } else {
      console.log(`[telemetryService] Published orbitcare/signal: ${payload}`);
    }
  });
}

// ── Public handlers ───────────────────────────────────────────────────────────

/**
 * Process an `orbitcare/location` MQTT message.
 *
 * The receiver publishes:
 *   {
 *     "device_id": "DEVICE-009",
 *     "location": [{ "Status": "SAFE", "latitude": 6.823..., "longitude": 79.966... }]
 *   }
 *
 * GPS coordinates are transmitted as 12-decimal-place strings by the transmitter
 * and parsed as JSON doubles by the receiver — full IEEE 754 precision is preserved
 * throughout. We must NOT truncate them at any stage in the backend.
 *
 * @param {object} data  Parsed MQTT payload
 */
async function processLocationMessage(data) {
  if (!data || typeof data !== 'object') return;

  // ── Extract coordinates from receiver's location array format ──────────────
  // Primary: data.location[0].latitude / longitude  (Rx firmware format)
  // Fallback: data.lat / data.lng  (flat format / legacy)
  let lat, lng, statusRaw;

  const locEntry = Array.isArray(data.location) && data.location.length > 0
    ? data.location[0]
    : null;

  if (locEntry) {
    lat       = Number(locEntry.latitude  ?? locEntry.lat);
    lng       = Number(locEntry.longitude ?? locEntry.lng);
    statusRaw = locEntry.Status ?? locEntry.status ?? data.status ?? null;
  } else {
    lat       = Number(data.lat ?? data.latitude);
    lng       = Number(data.lng ?? data.longitude);
    statusRaw = data.status ?? null;
  }

  const hasCoordinates =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0;

  const breached = hasCoordinates && geofenceService.checkBreach(lat, lng, data.device_id ?? null);
  const status = breached ? 'ALERT' : (statusRaw ?? null);

  // Build enriched payload — keep lat/lng at full double precision.
  const enrichedData = {
    ...data,
    lat: hasCoordinates ? lat : undefined,
    lng: hasCoordinates ? lng : undefined,
    status,
  };

  const normalisedStatus = String(status ?? '').toUpperCase();
  const statusChanged = normalisedStatus !== lastTelemetryStatus;
  const isIncidentStatus = ['ALERT', 'SOS'].includes(normalisedStatus);
  const enteredIncidentStatus = breached || (statusChanged && isIncidentStatus);

  // ── Incident log ───────────────────────────────────────────────────────────
  if (enteredIncidentStatus) {
    incidentRepository
      .insertIncident(
        data.device_id ?? null,
        normalisedStatus,
        hasCoordinates ? lat : null,
        hasCoordinates ? lng : null,
      )
      .catch((err) => console.error('[telemetryService] Failed to log incident:', err));
  }

  // ── Throttled telemetry save ───────────────────────────────────────────────
  const distanceMoved =
    hasCoordinates && lastSavedLat !== null
      ? haversineDistanceInMeters(lastSavedLat, lastSavedLng, lat, lng)
      : Infinity;
  const timeElapsed =
    lastSavedTime === null ? Infinity : (Date.now() - lastSavedTime) / 1000;
  const shouldSave =
    hasCoordinates &&
    (lastSavedLat === null ||
      distanceMoved > 5 ||
      normalisedStatus !== lastSavedStatus ||
      timeElapsed > 300);

  if (shouldSave) {
    telemetryRepository
      .insertTelemetry(data.device_id ?? null, lat, lng, status, data.rssi ?? null)
      .then(() => {
        lastSavedLat = lat;
        lastSavedLng = lng;
        lastSavedTime = Date.now();
        lastSavedStatus = normalisedStatus;
      })
      .catch((err) => console.error('[telemetryService] Failed to save telemetry:', err));
  }

  lastTelemetryStatus = normalisedStatus;

  // ── Broadcast ──────────────────────────────────────────────────────────────
  socketConfig.broadcast('telemetry', enrichedData);
}

/**
 * Process an `orbitcare/boundary` MQTT message.
 *
 * The receiver publishes boundary points in batches of up to 3 per message:
 *   { "device_id": "DEVICE-009", "points": [{ "id": 1, "latitude": ..., "longitude": ... }, ...] }
 *
 * Each point is persisted to the `boundary_points` table keyed by (device_id, point_id).
 * After every batch the full polygon is rebuilt from all stored points and broadcast
 * via Socket.IO so the frontend reflects the accumulating boundary.
 *
 * @param {unknown} data
 */
async function processBoundaryMessage(data) {
  const points = normaliseBoundaryPayload(data);
  // null = completely unparseable; [] = explicit reset (empty boundary packet)
  if (points === null) return;

  const deviceId = (data && typeof data === 'object' ? data.device_id : null) ?? null;

  // Delegate to geofenceService which handles the DB upsert + polygon rebuild.
  await geofenceService.processBoundaryPacket(deviceId, points);

  // Broadcast updated boundary — include structured points for the frontend.
  const updatedPoints = await geofenceService.getAllBoundaryPoints(deviceId);
  const enrichedData = {
    type: 'BOUNDARY',
    device_id: deviceId,
    points: updatedPoints,
    boundary: updatedPoints.map((p) => [p.latitude, p.longitude]),
  };
  socketConfig.broadcast('telemetry', enrichedData);
}

/**
 * Process an `orbitcare/signal` MQTT message.
 *
 * - Logs an incident for ALARM_ON and SOS events.
 * - Broadcasts on the dedicated `signal` Socket.IO event so the frontend
 *   can drive an independent alarm state machine without conflating with
 *   location-based `telemetry` events.
 * - Also mirrors onto `telemetry` for backwards-compatibility.
 *
 * @param {unknown} data
 */
async function processSignalMessage(data) {
  const normalized = normaliseSignalPayload(data);
  if (!normalized) {
    console.warn('[telemetryService] Unrecognised orbitcare/signal payload:', data);
    return;
  }

  console.log(`[telemetryService] Signal received: ${normalized.status}`, normalized);

  const incidentStatuses = ['ALARM_ON', 'SOS'];
  if (incidentStatuses.includes(normalized.status)) {
    try {
      await incidentRepository.insertIncident(
        normalized.device_id,
        normalized.status,
        normalized.lat ?? null,
        normalized.lng ?? null,
      );
    } catch (err) {
      console.error('[telemetryService] Failed to log signal incident:', err);
    }
  }

  // Broadcast on a dedicated `signal` event so the frontend alarm state
  // machine can react independently of location telemetry.
  socketConfig.broadcast('signal', normalized);

  // Also mirror onto `telemetry` for backwards-compatibility.
  socketConfig.broadcast('telemetry', normalized);
}

/**
 * Dispatch an MQTT message to the correct handler based on topic.
 * @param {string} topic
 * @param {unknown} data
 */
function handleMqttMessage(topic, data) {
  if (topic === 'orbitcare/location') {
    processLocationMessage(data).catch((err) =>
      console.error('[telemetryService] Unhandled error in processLocationMessage:', err),
    );
    return;
  }

  if (topic === 'orbitcare/boundary') {
    processBoundaryMessage(data).catch((err) =>
      console.error('[telemetryService] Unhandled error in processBoundaryMessage:', err),
    );
    return;
  }

  if (topic === 'orbitcare/signal') {
    processSignalMessage(data).catch((err) =>
      console.error('[telemetryService] Unhandled error in processSignalMessage:', err),
    );
    return;
  }

  console.warn(`[telemetryService] Unknown topic: ${topic}`);
}

module.exports = {
  handleMqttMessage,
  processLocationMessage,
  processBoundaryMessage,
  processSignalMessage,
  normaliseSignalPayload,
  publishSignalCommand,
};
