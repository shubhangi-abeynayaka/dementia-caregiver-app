'use strict';

const { Router } = require('express');
const geofenceController = require('../controllers/geofenceController');

const router = Router();

router.get('/', geofenceController.getGeofence);
router.post('/', geofenceController.saveGeofence);

module.exports = router;
