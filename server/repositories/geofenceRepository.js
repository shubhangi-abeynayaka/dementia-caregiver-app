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
    // Check if a row already exists for this device
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

module.exports = { getLatestGeofence, upsertGeofence };
