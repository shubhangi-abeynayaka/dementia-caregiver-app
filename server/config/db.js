'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(path.join(__dirname, '..', 'orbitcare.db'));

// ── Migrations ────────────────────────────────────────────────────────────────

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS telemetry_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id  TEXT,
      lat        REAL,
      lng        REAL,
      status     TEXT,
      rssi       TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('[db] Failed to create telemetry_logs:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS incident_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id  TEXT,
      event_type TEXT,
      lat        REAL,
      lng        REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('[db] Failed to create incident_logs:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS geofence_zones (
      id           INTEGER PRIMARY KEY,
      device_id    TEXT,
      polygon_json TEXT,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('[db] Failed to create geofence_zones:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `, (err) => {
    if (err) console.error('[db] Failed to create app_settings:', err);
  });
});

module.exports = db;
