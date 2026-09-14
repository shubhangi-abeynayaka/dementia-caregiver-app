'use strict';

const db = require('../config/db');

/**
 * Retrieve the most recent 50 incident log entries.
 * @returns {Promise<object[]>}
 */
function getIncidents() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM incident_logs ORDER BY created_at DESC LIMIT 50',
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      },
    );
  });
}

/**
 * Persist a new incident event.
 * @param {string | null} deviceId
 * @param {string} eventType   e.g. 'ALERT' | 'SOS'
 * @param {number | null} lat
 * @param {number | null} lng
 * @returns {Promise<void>}
 */
function insertIncident(deviceId, eventType, lat, lng) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO incident_logs (device_id, event_type, lat, lng) VALUES (?, ?, ?, ?)',
      [deviceId, eventType, lat, lng],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

module.exports = { getIncidents, insertIncident };
