/**
 * @fileoverview Telemetry domain model — pure data shapes, constants, and
 * formatters. No React, no side effects, no I/O.
 */

/** @type {{ coordinates: [number, number], status: string, signalStrength: string }} */
export const DEFAULT_TELEMETRY = {
  coordinates: [6.9270, 79.8612],
  status: 'Safe',
  signalStrength: '-68 dBm',
}

/** @type {{ coordinates: null, status: string, signalStrength: null }} */
export const HARDWARE_WAITING_TELEMETRY = {
  coordinates: null,
  status: 'Waiting for GPS Fix...',
  signalStrength: null,
}

/**
 * Normalise a raw status string to one of: 'SOS' | 'ALERT' | 'Safe'
 * @param {unknown} status
 * @returns {'SOS' | 'ALERT' | 'Safe'}
 */
export function normalizeTelemetryStatus(status) {
  const s = String(status ?? '').toUpperCase().trim()
  if (s === 'SOS'           || s.includes('EMERGENCY')) return 'SOS'
  if (s === 'ALERT_OUTSIDE' || s === 'ALERT')           return 'ALERT'
  if (s === 'SAFE')                                      return 'Safe'
  // Unknown / intermediate statuses pass through unchanged so the UI
  // can display them (e.g. "Waiting for GPS Fix...") without triggering alarms.
  return status ?? 'Safe'
}

/**
 * Transform a raw DB telemetry record into a display-ready history log entry.
 * @param {object} record
 * @returns {object}
 */
export function formatHistoricalLog(record) {
  const status = normalizeTelemetryStatus(record.status)
  const createdAt = new Date(`${String(record.created_at).replace(' ', 'T')}Z`)
  const isEmergency = status === 'ALERT' || status === 'SOS'

  return {
    id: record.id,
    timestamp: Number.isNaN(createdAt.getTime())
      ? record.created_at
      : createdAt.toLocaleTimeString(),
    date: Number.isNaN(createdAt.getTime())
      ? ''
      : createdAt.toLocaleDateString(),
    event: status === 'SOS'
      ? 'SOS Alert Triggered'
      : status === 'ALERT'
        ? 'Safe Zone Breached'
        : 'Location Recorded',
    coordinates:
      Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng))
        ? `${Number(record.lat).toFixed(4)}, ${Number(record.lng).toFixed(4)}`
        : 'Waiting for GPS Fix...',
    type: isEmergency ? 'danger' : 'success',
    status,
    signalStrength: record.rssi == null ? null : `${record.rssi} dBm`,
    lat: record.lat,
    lng: record.lng,
    rssi: record.rssi,
    device_id: record.device_id,
  }
}
