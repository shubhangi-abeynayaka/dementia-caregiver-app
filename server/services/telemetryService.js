'use strict';

const { isValidPolygon, haversineDistanceInMeters } = require('../utils/geo');
const geofenceService = require('./geofenceService');
const telemetryRepository = require('../repositories/telemetryRepository');
const incidentRepository = require('../repositories/incidentRepository');
const socketConfig = require('../config/socket');

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
 * Normalise a raw MQTT boundary payload into an array of [lat, lng] pairs.
 * Returns null if the payload cannot be interpreted as a valid boundary.
 * @param {unknown} data
 * @returns {[number, number][] | null}
 */
function normaliseBoundaryPayload(data) {
  const rawPoints = Array.isArray(data)
    ? data
    : (data?.boundary ?? data?.points ?? null);

  if (!Array.isArray(rawPoints)) return null;

  const points = rawPoints
    .map((point) => {
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
    })
    .filter(
      (p) =>
        p &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        p[0] !== 0 &&
        p[1] !== 0,
    );

  return isValidPolygon(points) ? points : null;
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

// ── Public handlers ───────────────────────────────────────────────────────────

/**
 * Process an `orbitcare/location` MQTT message.
 * Determines status, checks geofence breach, throttles DB writes,
 * and broadcasts the enriched payload via Socket.IO.
 *
 * @param {object} data  Parsed MQTT payload
 */
async function processLocationMessage(data) {
  if (!data || typeof data !== 'object') return;

  const lat = Number(data.lat ?? data.latitude);
  const lng = Number(data.lng ?? data.longitude);
  const hasCoordinates =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0;
  const breached = hasCoordinates && geofenceService.checkBreach(lat, lng, data.device_id ?? null);
  const status = breached ? 'ALERT' : (data.status ?? null);
  const enrichedData = { ...data, status };

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
 * Updates the in-memory geofence (does NOT persist to DB — hardware defines it).
 *
 * @param {unknown} data
 */
function processBoundaryMessage(data) {
  const polygon = normaliseBoundaryPayload(data);
  if (!polygon) return;

  const deviceId = (data && typeof data === 'object' ? data.device_id : null) ?? null;
  geofenceService.setActiveGeofence(deviceId, polygon);

  const enrichedData = typeof data === 'object' ? { ...data, boundary: polygon } : { boundary: polygon };
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
    processBoundaryMessage(data);
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
};
