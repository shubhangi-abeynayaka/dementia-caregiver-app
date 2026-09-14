'use strict';

const geofenceService = require('../services/geofenceService');

/**
 * GET /api/geofence?device_id=<id>
 * Returns the active geofence boundary for the given (optional) device.
 */
function getGeofence(req, res) {
  const deviceId = req.query.device_id ?? null;
  const active = geofenceService.getActiveGeofence();
  const matches = active && (!deviceId || active.device_id === deviceId);
  const zone = matches ? active : null;

  res.json({
    device_id: zone?.device_id ?? deviceId,
    boundary: zone?.polygon ?? [],
  });
}

/**
 * POST /api/geofence
 * Body: { device_id?: string, boundary: [number, number][] }
 * Validates, persists, and updates the active geofence.
 */
async function saveGeofence(req, res) {
  const { device_id: deviceId = null, boundary } = req.body ?? {};

  try {
    const polygon = await geofenceService.updateGeofence(deviceId, boundary);
    res.json({ device_id: deviceId, boundary: polygon });
  } catch (err) {
    const isValidation = err.message.includes('boundary must contain');
    res.status(isValidation ? 400 : 500).json({ error: err.message });
  }
}

module.exports = { getGeofence, saveGeofence };
