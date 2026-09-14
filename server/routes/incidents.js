'use strict';

const { Router } = require('express');
const incidentController = require('../controllers/incidentController');

const router = Router();

router.get('/', incidentController.getIncidents);

module.exports = router;
