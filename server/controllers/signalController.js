'use strict';

const { publishSignalCommand } = require('../services/telemetryService');
const socketConfig = require('../config/socket');
const mqttConfig   = require('../config/mqtt');

/**
 * POST /api/signal/reset
 * Body: { device_id?: string }
 *
 * Publishes a RESET command to orbitcare/signal_ch_2 so the receiver's
 * firmware can mute the false alarm — exactly the same JSON the receiver
 * reads from its physical reset button:
 *   { "device_id": "DEVICE-009", "command": "RESET" }
 *
 * Also broadcasts the signal via Socket.IO so other connected frontends
 * immediately reflect the cleared alarm state.
 */
function resetSignal(req, res) {
  const { device_id: deviceId = null } = req.body ?? {};

  // ── Diagnostic: log MQTT client state on every reset request ──────────────
  const mqttClient = mqttConfig.getClient();
  console.log('[signal/reset] MQTT client state:', {
    clientExists: !!mqttClient,
    connected: mqttClient?.connected ?? false,
    deviceId,
  });

  try {
    // Publish to MQTT so the physical receiver picks it up and mutes the alarm.
    publishSignalCommand('RESET', deviceId);
  } catch (err) {
    console.error('[signal/reset] publishSignalCommand threw:', err);
  }

  try {
    // Broadcast to Socket.IO clients so all browser tabs clear immediately.
    socketConfig.broadcast('signal', { device_id: deviceId, status: 'RESET' });
  } catch (err) {
    console.error('[signal/reset] socketConfig.broadcast threw:', err);
  }

  res.json({ ok: true, command: 'RESET', device_id: deviceId });
}

/**
 * POST /api/signal/alarm
 * Body: { device_id?: string, command: 'ALARM_ON' | 'ALARM_OFF' }
 *
 * Allows the backend to explicitly set or clear the alarm on the receiver.
 */
function sendAlarm(req, res) {
  const { device_id: deviceId = null, command } = req.body ?? {};
  const allowed = ['ALARM_ON', 'ALARM_OFF'];

  if (!allowed.includes(String(command ?? '').toUpperCase())) {
    return res.status(400).json({ error: `command must be one of: ${allowed.join(', ')}` });
  }

  const cmd = String(command).toUpperCase();
  publishSignalCommand(cmd, deviceId);
  socketConfig.broadcast('signal', { device_id: deviceId, status: cmd });

  res.json({ ok: true, command: cmd, device_id: deviceId });
}

module.exports = { resetSignal, sendAlarm };
