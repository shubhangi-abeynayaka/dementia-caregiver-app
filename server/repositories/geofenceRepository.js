'use strict';

const db = require('../config/db');

/**
 * Retrieve the most recently updated geofence zone row.
 * @returns {Promise<{ device_id: string | null, polygon_json: string } | null>}
 */
function getLatestGeofence() {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT device_id, polygon_json FROM geofence_zones ORDER BY updated_at DESC, id DESC LIMIT 1',
      [],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      },
    );
  });
}

/**
 * Insert or update the geofence polygon for a given device.
 * @param {string | null} deviceId
 * @param {string} polygonJson  JSON-stringified [[lat,lng], …]
 * @returns {Promise<void>}
 */
function upsertGeofence(deviceId, polygonJson) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM geofence_zones WHERE device_id IS ? LIMIT 1',
      [deviceId],
      (selectErr, row) => {
        if (selectErr) {
          reject(selectErr);
          return;
        }

        const query = row
          ? 'UPDATE geofence_zones SET polygon_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          : 'INSERT INTO geofence_zones (device_id, polygon_json) VALUES (?, ?)';
        const params = row ? [polygonJson, row.id] : [deviceId, polygonJson];

        db.run(query, params, (saveErr) => {
          if (saveErr) reject(saveErr);
          else resolve();
        });
      },
    );
  });
}

// ── Individual boundary point operations ──────────────────────────────────────

/**
 * Upsert a single boundary point by (device_id, point_id).
 * point_id is the 1-based integer assigned by the transmitter hardware.
 * Coordinates are stored as IEEE 754 doubles — full 12-decimal precision preserved.
 *
 * @param {string | null} deviceId
 * @param {number} pointId   1-based index from the hardware packet
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<void>}
 */
function upsertBoundaryPoint(deviceId, pointId, latitude, longitude) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO boundary_points (device_id, point_id, latitude, longitude, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(device_id, point_id)
       DO UPDATE SET latitude = excluded.latitude,
                     longitude = excluded.longitude,
                     updated_at = CURRENT_TIMESTAMP`,
      [deviceId, pointId, latitude, longitude],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

/**
 * Retrieve all stored boundary points for a device, ordered by point_id ascending.
 * @param {string | null} deviceId
 * @returns {Promise<Array<{ point_id: number, latitude: number, longitude: number }>>}
 */
function getBoundaryPoints(deviceId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT point_id, latitude, longitude
       FROM boundary_points
       WHERE device_id IS ?
       ORDER BY point_id ASC`,
      [deviceId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      },
    );
  });
}

/**
 * Delete all stored boundary points for a device.
 * Called when the transmitter sends an empty BOUNDARY packet (RESET).
 * @param {string | null} deviceId
 * @returns {Promise<void>}
 */
function clearBoundaryPoints(deviceId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM boundary_points WHERE device_id IS ?',
      [deviceId],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

module.exports = {
  getLatestGeofence,
  upsertGeofence,
  upsertBoundaryPoint,
  getBoundaryPoints,
  clearBoundaryPoints,
};
