'use strict';

const { isValidPolygon, isPointInPolygon } = require('../utils/geo');
const geofenceRepository = require('../repositories/geofenceRepository');

/**
 * In-memory cache of the active geofence.
 * Shape: { device_id: string | null, polygon: [number, number][] } | null
 * @type {{ device_id: string | null, polygon: [number, number][] } | null}
 */
let activeGeofence = null;

/**
 * Load the persisted geofence from the database into memory.
 * Should be called once at server startup, after the DB is ready.
 * @returns {Promise<void>}
 */
async function loadActiveGeofence() {
  try {
    const row = await geofenceRepository.getLatestGeofence();
    if (!row) return;

    const polygon = JSON.parse(row.polygon_json);
    if (isValidPolygon(polygon)) {
      activeGeofence = { device_id: row.device_id, polygon };
      console.log('[geofenceService] Loaded active geofence from DB for device:', row.device_id);
    }
  } catch (err) {
    console.error('[geofenceService] Failed to load geofence from DB:', err);
  }
}

/**
 * Returns the currently active in-memory geofence, or null.
 * @returns {{ device_id: string | null, polygon: [number, number][] } | null}
 */
function getActiveGeofence() {
  return activeGeofence;
}

/**
 * Validates, persists, and updates the in-memory geofence.
 * @param {string | null} deviceId
 * @param {[number, number][]} boundary  Array of [lat, lng] pairs (min 3)
 * @returns {Promise<[number, number][]>} The normalised polygon that was saved
 * @throws {Error} If boundary is invalid
 */
async function updateGeofence(deviceId, boundary) {
  if (!isValidPolygon(boundary)) {
    throw new Error('boundary must contain at least 3 valid [lat, lng] points');
  }

  const polygon = boundary.map(([lat, lng]) => [Number(lat), Number(lng)]);
  await geofenceRepository.upsertGeofence(deviceId, JSON.stringify(polygon));
  activeGeofence = { device_id: deviceId, polygon };
  return polygon;
}

/**
 * Set the in-memory geofence directly (used when receiving boundary from MQTT
 * without needing to persist to DB).
 * @param {string | null} deviceId
 * @param {[number, number][]} polygon
 */
function setActiveGeofence(deviceId, polygon) {
  activeGeofence = { device_id: deviceId, polygon };
}

/**
 * Check whether a given coordinate is outside the active geofence.
 * Returns false if there is no active geofence or coordinates are invalid.
 * @param {number} lat
 * @param {number} lng
 * @param {string | null} deviceId
 * @returns {boolean}  true = breached (outside fence)
 */
function checkBreach(lat, lng, deviceId) {
  if (!activeGeofence) return false;

  const deviceMatches =
    !activeGeofence.device_id || activeGeofence.device_id === deviceId;
  if (!deviceMatches) return false;

  return !isPointInPolygon([lat, lng], activeGeofence.polygon);
}

module.exports = {
  loadActiveGeofence,
  getActiveGeofence,
  updateGeofence,
  setActiveGeofence,
  checkBreach,
};
