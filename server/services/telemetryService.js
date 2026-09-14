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
/** @type {Map<string | null, string>} */
const lastTelemetryStatusByDevice = new Map();

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
 * @param {unknown} data
 * @returns {{device_id: string | null, status: string, lat?: number, lng?: number} | null}
 */
function normaliseSignalPayload(data) {
  if (!data || typeof data !== 'object') return null;

  const command = String(data.command ?? '').toUpperCase();
  const status = String(data.status ?? '').toUpperCase();
  const deviceId = data.device_id ?? null;

  if (command === 'ALARM_ON' || status === 'SOS') {
    const lat = Number(data.lat ?? data.latitude);
    const lng = Number(data.lng ?? data.longitude);
    return {
      device_id: deviceId,
      status: 'SOS',
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  }

  if (command === 'RESET' || status === 'RESET') {
    return { device_id: deviceId, status: 'RESET' };
  }

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
  const deviceId = data.device_id ?? null;
  const rawStatus = String(data.status ?? '').toUpperCase();
  const command = String(data.command ?? '').toUpperCase();
  const isExplicitSos = rawStatus === 'SOS' || command === 'ALARM_ON';
  const breached = hasCoordinates && geofenceService.checkBreach(lat, lng, deviceId);
  const status = isExplicitSos
    ? 'SOS'
    : breached || rawStatus === 'ALERT' || rawStatus === 'ALERT_OUTSIDE'
      ? 'ALERT'
      : hasCoordinates
        ? 'SAFE'
        : (data.status ?? null);
  const enrichedData = { ...data, status };

  const normalisedStatus = String(status ?? '').toUpperCase();
  const statusChanged = normalisedStatus !== lastTelemetryStatusByDevice.get(deviceId);
  const enteredIncidentStatus = statusChanged && ['ALERT', 'SOS'].includes(normalisedStatus);

  // ── Incident log ───────────────────────────────────────────────────────────
  if (enteredIncidentStatus) {
    incidentRepository
      .insertIncident(
        deviceId,
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
      .insertTelemetry(deviceId, lat, lng, status, data.rssi ?? null)
      .then(() => {
        lastSavedLat = lat;
        lastSavedLng = lng;
        lastSavedTime = Date.now();
        lastSavedStatus = normalisedStatus;
      })
      .catch((err) => console.error('[telemetryService] Failed to save telemetry:', err));
  }

  lastTelemetryStatusByDevice.set(deviceId, normalisedStatus);

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
 * @param {unknown} data
 */
async function processSignalMessage(data) {
  const normalized = normaliseSignalPayload(data);
  if (!normalized) return;

  if (normalized.status === 'SOS') {
    try {
      await incidentRepository.insertIncident(
        normalized.device_id,
        normalized.status,
        normalized.lat,
        normalized.lng,
      );
    } catch (err) {
      console.error('[telemetryService] Failed to log signal incident:', err);
    }
  }

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
  }
}

module.exports = {
  handleMqttMessage,
  processLocationMessage,
  processBoundaryMessage,
  processSignalMessage,
  normaliseSignalPayload,
};
