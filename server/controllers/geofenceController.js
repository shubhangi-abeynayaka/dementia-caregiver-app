'use strict';

const geofenceService = require('../services/geofenceService');

/**
 * GET /api/geofence?device_id=<id>
 * Returns the active geofence boundary for the given (optional) device.
 * Boundary is returned as an array of [lat, lng] pairs.
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
 * GET /api/geofence/points?device_id=<id>
 *
 * Returns all stored boundary points for a device from the DB, ordered
 * by the 1-based point_id assigned by the transmitter hardware.
 * Each point includes { id, latitude, longitude } at full IEEE 754 precision.
 *
 * Use this endpoint to restore the full ordered boundary after a page reload
 * or to display the point list in the UI.
 */
async function getGeofencePoints(req, res) {
  const deviceId = req.query.device_id ?? null;
  try {
    const points = await geofenceService.getAllBoundaryPoints(deviceId);
    res.json({ device_id: deviceId, points });
  } catch (err) {
    console.error('[geofenceController] getGeofencePoints error:', err);
    res.status(500).json({ error: err.message });
  }
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

module.exports = { getGeofence, getGeofencePoints, saveGeofence };
