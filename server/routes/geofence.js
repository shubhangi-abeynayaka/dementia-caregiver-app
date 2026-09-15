'use strict';

const { Router } = require('express');
const geofenceController = require('../controllers/geofenceController');

const router = Router();

/** GET /api/geofence — returns active boundary polygon */
router.get('/', geofenceController.getGeofence);

/**
 * GET /api/geofence/points?device_id=<id>
 * Returns all stored boundary points with their hardware-assigned IDs
 * at full IEEE 754 precision — used by the frontend on startup and map view.
 */
router.get('/points', geofenceController.getGeofencePoints);

/** POST /api/geofence — save / update geofence boundary */
router.post('/', geofenceController.saveGeofence);

module.exports = router;
