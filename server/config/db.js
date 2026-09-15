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

  // Individual boundary points keyed by (device_id, point_id).
  // point_id matches the 1-based id assigned by the transmitter hardware.
  db.run(`
    CREATE TABLE IF NOT EXISTS boundary_points (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id  TEXT,
      point_id   INTEGER,
      latitude   REAL,
      longitude  REAL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('[db] Failed to create boundary_points:', err);
  });

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_boundary_points_device_point
    ON boundary_points (device_id, point_id)
  `, (err) => {
    if (err) console.error('[db] Failed to create boundary_points index:', err);
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
