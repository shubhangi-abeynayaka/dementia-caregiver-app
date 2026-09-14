/**
 * @fileoverview Device domain model — connection states, backend URL config,
 * and other device-level constants.
 */

/** @typedef {'connected' | 'disconnected' | 'searching'} ConnectionStatus */

/** @type {Record<ConnectionStatus, ConnectionStatus>} */
export const ConnectionStatus = Object.freeze({
  CONNECTED:    'connected',
  DISCONNECTED: 'disconnected',
  SEARCHING:    'searching',
})

const CONFIGURED_BACKEND_URL = String(import.meta.env.VITE_BACKEND_URL || '')
  .trim()
  .replace(/\/$/, '')

/**
 * Ordered list of backend URLs to try when connecting.
 * The first successful URL is cached as the active backend.
 * @type {string[]}
 */
export const BACKEND_URL_CANDIDATES = CONFIGURED_BACKEND_URL
  ? [CONFIGURED_BACKEND_URL]
  : ['http://localhost:5000', 'http://localhost:5001']

/** The device_id used when saving geofence zones via the REST API. */
export const GEOFENCE_DEVICE_ID = 'patient-device-01'

export const DEFAULT_MQTT_BROKER_URL = 'mqtt://broker.hivemq.com:1883'
