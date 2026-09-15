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
  const filtered = Array.isArray(boundary)
    ? boundary.filter(
        (p) =>
          Array.isArray(p) &&
          p.length >= 2 &&
          Number.isFinite(Number(p[0])) &&
          Number.isFinite(Number(p[1])) &&
          Number(p[0]) !== 0 &&
          Number(p[1]) !== 0,
      )
    : [];

  if (!isValidPolygon(filtered)) {
    throw new Error('boundary must contain at least 3 valid non-zero [lat, lng] points');
  }

  const polygon = filtered.map(([lat, lng]) => [Number(lat), Number(lng)]);
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
  const filtered = Array.isArray(polygon)
    ? polygon.filter(
        (p) =>
          Array.isArray(p) &&
          p.length >= 2 &&
          Number.isFinite(Number(p[0])) &&
          Number.isFinite(Number(p[1])) &&
          Number(p[0]) !== 0 &&
          Number(p[1]) !== 0,
      )
    : [];

  if (isValidPolygon(filtered)) {
    activeGeofence = { device_id: deviceId, polygon: filtered };
  }
}

/**
 * Process a batch of boundary points received from the receiver's MQTT message.
 *
 * The transmitter sends up to 3 points per LoRa packet (10 points = up to 4 packets).
 * Each point has a 1-based `id` assigned by the transmitter.
 * This function upserts each point into the DB by (device_id, point_id), then
 * rebuilds the full in-memory polygon from ALL stored points for this device.
 *
 * @param {string | null} deviceId
 * @param {Array<{ id: number, latitude: number, longitude: number }>} points
 * @returns {Promise<void>}
 */
async function processBoundaryPacket(deviceId, points) {
  if (!Array.isArray(points) || points.length === 0) {
    // Empty boundary packet = RESET: clear all stored points for this device.
    console.log(`[geofenceService] Empty boundary packet from ${deviceId} — clearing points.`);
    await geofenceRepository.clearBoundaryPoints(deviceId);
    activeGeofence = null;
    return;
  }

  // Upsert each point in this batch.
  const upserts = points
    .filter(
      (p) =>
        p &&
        typeof p.id === 'number' &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude) &&
        p.latitude !== 0 &&
        p.longitude !== 0,
    )
    .map((p) =>
      geofenceRepository
        .upsertBoundaryPoint(deviceId, p.id, p.latitude, p.longitude)
        .catch((err) =>
          console.error(`[geofenceService] Failed to upsert point ${p.id}:`, err),
        ),
    );

  await Promise.all(upserts);

  // Rebuild the in-memory polygon from ALL stored points for this device.
  const allRows = await geofenceRepository.getBoundaryPoints(deviceId);
  const polygon = allRows
    .map((r) => [r.latitude, r.longitude])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0);

  if (isValidPolygon(polygon)) {
    activeGeofence = { device_id: deviceId, polygon };
    // Persist the full polygon to geofence_zones for quick startup recovery.
    await geofenceRepository.upsertGeofence(deviceId, JSON.stringify(polygon));
    console.log(
      `[geofenceService] Boundary updated for ${deviceId}: ${polygon.length} points.`,
    );
  }
}

/**
 * Return all stored boundary points for a device from the DB.
 * Points are returned in point_id order (1-based), preserving the
 * physical order the transmitter placed them.
 *
 * @param {string | null} deviceId
 * @returns {Promise<Array<{ id: number, latitude: number, longitude: number }>>}
 */
async function getAllBoundaryPoints(deviceId) {
  const rows = await geofenceRepository.getBoundaryPoints(deviceId);
  return rows.map((r) => ({
    id: r.point_id,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/**
 * Clear all stored boundary points for a device and reset the in-memory geofence.
 * @param {string | null} deviceId
 * @returns {Promise<void>}
 */
async function resetBoundaryPoints(deviceId) {
  await geofenceRepository.clearBoundaryPoints(deviceId);
  if (activeGeofence && activeGeofence.device_id === deviceId) {
    activeGeofence = null;
  }
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
  if (!activeGeofence || lat === 0 || lng === 0) return false;

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
  processBoundaryPacket,
  getAllBoundaryPoints,
  resetBoundaryPoints,
  checkBreach,
};
