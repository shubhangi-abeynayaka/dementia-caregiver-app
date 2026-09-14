'use strict';

const db = require('./db');

/**
 * Repositories are loaded lazily after db is required, so geofenceRepository
 * can call db.get to seed the in-memory geofence without a circular dep.
 */

const telemetryRepository = require('../repositories/telemetryRepository');

const mqtt = require('mqtt');

/** @type {import('mqtt').MqttClient | null} */
let client = null;

const TOPICS = ['orbitcare/location', 'orbitcare/boundary', 'orbitcare/signal'];

/**
 * Connects to the MQTT broker and wires message handling.
 * The `messageHandler` callback receives `(topic, parsedPayload, rawString)`.
 *
 * @param {(topic: string, data: unknown, raw: string) => void} messageHandler
 * @returns {import('mqtt').MqttClient}
 */
function connect(messageHandler) {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  client = mqtt.connect(brokerUrl);

  client.on('connect', () => {
    console.log(`[mqtt] Connected to broker: ${brokerUrl}`);
    client.subscribe(TOPICS, (err) => {
      if (err) {
        console.error('[mqtt] Failed to subscribe:', err);
        return;
      }
      console.log(`[mqtt] Subscribed to: ${TOPICS.join(', ')}`);
    });
  });

  client.on('message', (topic, messageBuffer) => {
    const raw = messageBuffer.toString();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
    console.log(`[mqtt] ${topic}:`, data);
    messageHandler(topic, data, raw);
  });

  client.on('error', (err) => {
    console.error('[mqtt] Client error:', err);
  });

  return client;
}

/**
 * Returns the active MQTT client (or null if not yet connected).
 * @returns {import('mqtt').MqttClient | null}
 */
function getClient() {
  return client;
}

module.exports = { connect, getClient, TOPICS };
