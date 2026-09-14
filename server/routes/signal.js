'use strict';

const { Router } = require('express');
const mqttConfig = require('../config/mqtt');

const router = Router();

router.post('/reset', (req, res) => {
  const client = mqttConfig.getClient();
  if (!client) {
    return res.status(503).json({ error: 'MQTT client is not connected' });
  }

  const payload = {
    device_id: req.body?.device_id || 'DEVICE-002',
    command: 'RESET',
    status: 'RESET',
  };

  client.publish('orbitcare/signal', JSON.stringify(payload), (err) => {
    if (err) {
      console.error('[signal] Failed to publish reset:', err);
      return res.status(502).json({ error: 'Failed to publish reset signal' });
    }
    return res.status(202).json({ published: true, payload });
  });
});

module.exports = router;