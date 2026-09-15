'use strict';

const { Router } = require('express');
const signalController = require('../controllers/signalController');

const router = Router();

/**
 * POST /api/signal/reset
 * Publish a RESET command to orbitcare/signal MQTT topic.
 * The receiver reads it and mutes any active alarm (same as pressing the
 * physical BTN_RESET on the receiver hardware).
 */
router.post('/reset', signalController.resetSignal);

/**
 * POST /api/signal/alarm
 * Body: { command: 'ALARM_ON' | 'ALARM_OFF', device_id?: string }
 * Explicitly set or clear the alarm on the receiver via MQTT.
 */
router.post('/alarm', signalController.sendAlarm);

module.exports = router;
