'use strict';

const db = require('../config/db');

/**
 * Fetch telemetry history, optionally filtered to rows after `clearedAt`.
 * @param {string | null} clearedAt  ISO datetime string or null
 * @returns {Promise<object[]>}
 */
function getHistory(clearedAt) {
  return new Promise((resolve, reject) => {
    const query = clearedAt
      ? 'SELECT * FROM telemetry_logs WHERE datetime(created_at) > datetime(?) ORDER BY created_at DESC LIMIT 100'
      : 'SELECT * FROM telemetry_logs ORDER BY created_at DESC LIMIT 100';
    const params = clearedAt ? [clearedAt] : [];

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Returns the current `history_cleared_at` setting value, or null.
 * @returns {Promise<string | null>}
 */
function getHistoryClearedAt() {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT value FROM app_settings WHERE key = ?',
      ['history_cleared_at'],
      (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      },
    );
  });
}

/**
 * Stamp the current time as the history cleared threshold.
 * @returns {Promise<string>} The ISO timestamp that was written.
 */
function stampHistoryCleared() {
  const clearedAt = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['history_cleared_at', clearedAt],
      (err) => {
        if (err) reject(err);
        else resolve(clearedAt);
      },
    );
  });
}

/**
 * Persist a telemetry reading.
 * @param {string | null} deviceId
 * @param {number} lat
 * @param {number} lng
 * @param {string | null} status
 * @param {string | null} rssi
 * @returns {Promise<void>}
 */
function insertTelemetry(deviceId, lat, lng, status, rssi) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO telemetry_logs (device_id, lat, lng, status, rssi) VALUES (?, ?, ?, ?, ?)',
      [deviceId, lat, lng, status, rssi],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

/**
 * Delete telemetry rows older than 30 days.
 * @returns {Promise<void>}
 */
function purgeExpired() {
  return new Promise((resolve, reject) => {
    db.run(
      "DELETE FROM telemetry_logs WHERE created_at < datetime('now', '-30 days')",
      [],
      (err) => {
        if (err) {
          console.error('[telemetryRepository] Purge failed:', err);
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
}

module.exports = {
  getHistory,
  getHistoryClearedAt,
  stampHistoryCleared,
  insertTelemetry,
  purgeExpired,
};
