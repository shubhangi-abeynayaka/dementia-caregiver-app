/**
 * @fileoverview useSettingsController — settings-specific state and actions.
 *
 * Pulls settings state from DeviceContext and provides derived helpers
 * so the Settings page stays as a thin view.
 */

import { useCallback } from 'react'
import { useDevice } from '@/lib/DeviceContext'

export function useSettingsController() {
  const {
    isDemoMode,
    toggleDemoMode,
    pushNotifications,
    setPushNotifications,
    audibleAlarm,
    setAudibleAlarm,
    mqttBrokerUrl,
    updateMqttBrokerUrl,
    backendUrl,
    updateBackendUrl,
    telemetry,
    geofenceBoundary,
    updateGeofence,
    simulateSafeZoneBreach,
    simulateSOS,
    resetToSafe,
  } = useDevice()

  const togglePushNotifications = useCallback(() => {
    setPushNotifications((prev) => !prev)
  }, [setPushNotifications])

  const toggleAudibleAlarm = useCallback(() => {
    setAudibleAlarm((prev) => !prev)
  }, [setAudibleAlarm])

  const applyGeofencePreset = useCallback((boundary) => {
    updateGeofence(boundary)
  }, [updateGeofence])

  const updateBoundaryPoint = useCallback((index, lat, lng) => {
    if (!Number.isFinite(lat) && !Number.isFinite(lng)) return
    const next = geofenceBoundary.map((point, i) => {
      if (i !== index) return point
      return [
        Number.isFinite(lat) ? lat : point[0],
        Number.isFinite(lng) ? lng : point[1],
      ]
    })
    updateGeofence(next)
  }, [geofenceBoundary, updateGeofence])

  return {
    isDemoMode,
    toggleDemoMode,
    pushNotifications,
    togglePushNotifications,
    audibleAlarm,
    toggleAudibleAlarm,
    mqttBrokerUrl,
    updateMqttBrokerUrl,
    backendUrl,
    updateBackendUrl,
    telemetryStatus: telemetry.status,
    geofenceBoundary,
    applyGeofencePreset,
    updateBoundaryPoint,
    simulateSafeZoneBreach,
    simulateSOS,
    resetToSafe,
  }
}
