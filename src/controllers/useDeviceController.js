/**
 * @fileoverview useDeviceController — the primary controller hook.
 *
 * Owns all device state and side effects. Returns a plain object that
 * DeviceContext.Provider exposes to the component tree.
 * Contains zero JSX.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BOUNDARY } from '@/lib/geofence'
import {
  DEFAULT_TELEMETRY,
  HARDWARE_WAITING_TELEMETRY,
  normalizeTelemetryStatus,
  formatHistoricalLog,
} from '@/models/telemetry'
import {
  isValidBoundary,
  normalizeBoundaryPoint,
  createMaximumAreaBoundary,
  extractBoundaryPoints,
  isBoundarySnapshot,
} from '@/models/geofence'
import { GEOFENCE_DEVICE_ID, getStoredBackendUrl } from '@/models/device'
import { apiService, updateBackendUrl as persistBackendUrl } from '@/services/apiService'
import { createSocketService } from '@/services/socketService'

// ── Audio ─────────────────────────────────────────────────────────────────────

function createEmergencySiren() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return () => {}

  const ctx  = new AudioCtx()
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  let high = true

  osc.type = 'sine'
  osc.frequency.value = 880
  gain.gain.value = 0.18
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()

  const intervalId = window.setInterval(() => {
    high = !high
    osc.frequency.setValueAtTime(high ? 880 : 440, ctx.currentTime)
  }, 450)

  ctx.resume().catch(() => {})

  return () => {
    window.clearInterval(intervalId)
    osc.stop()
    osc.disconnect()
    gain.disconnect()
    ctx.close().catch(() => {})
  }
}

// ── Distance helper ───────────────────────────────────────────────────────────

function distanceInMeters(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity
  const [la, lo] = a.map(Number)
  const [lb, lo2] = b.map(Number)
  if (![la, lo, lb, lo2].every(Number.isFinite)) return Infinity
  const R = 6_371_000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lb - la)
  const dLng = toRad(lo2 - lo)
  const f = Math.cos(toRad((la + lb) / 2))
  return R * Math.sqrt(dLat ** 2 + (f * dLng) ** 2)
}

// ── Controller ────────────────────────────────────────────────────────────────

export function useDeviceController() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [audibleAlarm, setAudibleAlarm] = useState(true)
  const [mqttBrokerUrl, setMqttBrokerUrl] = useState(() => {
    try {
      return (
        localStorage.getItem('orbitcare_mqtt_broker_url') ||
        import.meta.env.VITE_MQTT_WS_URL ||
        'mqtt://broker.hivemq.com:1883'
      )
    } catch {
      return import.meta.env.VITE_MQTT_WS_URL || 'mqtt://broker.hivemq.com:1883'
    }
  })
  const [backendUrl, setBackendUrl] = useState(() => {
    return getStoredBackendUrl() || import.meta.env.VITE_BACKEND_URL || ''
  })
  const [telemetry, setTelemetry] = useState(HARDWARE_WAITING_TELEMETRY)
  const [boundaryDeviceId, setBoundaryDeviceId] = useState(null)
  const [locationDeviceId, setLocationDeviceId] = useState(null)
  const [geofenceBoundary, setGeofenceBoundary] = useState([])
  const [boundaryWarning, setBoundaryWarning] = useState(false)
  const [historyLogs, setHistoryLogs] = useState(() => {
    try {
      const stored = localStorage.getItem('orbitcare_history')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [error, setError] = useState(null)
  // Alarm state driven by orbitcare/signal MQTT messages
  // 'idle' | 'ALARM_ON' | 'ALARM_OFF' | 'SOS'
  const [alarmState, setAlarmState] = useState('idle')

  // ── Refs ───────────────────────────────────────────────────────────────────
  const previousStatus         = useRef(telemetry.status)
  const isSosLatched           = useRef(false)
  const previousConnStatus     = useRef(connectionStatus)
  const socketServiceRef       = useRef(null)
  const receiveTelemetryRef    = useRef(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const requestNotificationPermission = useCallback(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const addHistoryEntry = useCallback((entry) => {
    setHistoryLogs((prev) => [entry, ...prev])
  }, [])

  // ── Geofence boundary management ───────────────────────────────────────────

  const handleHardwareBoundaryStream = useCallback((newPoints) => {
    if (!Array.isArray(newPoints)) return
    const incoming = newPoints.map(normalizeBoundaryPoint).filter(Boolean)
    if (incoming.length === 0) return

    setGeofenceBoundary((current) => {
      const next = current.map(normalizeBoundaryPoint).filter(Boolean)
      incoming.forEach((p) => {
        if (!next.find(([a, b]) => a === p[0] && b === p[1])) next.push(p)
      })
      return createMaximumAreaBoundary(next)
    })
    setBoundaryWarning(false)
  }, [])

  const updateGeofence = useCallback((coordinates) => {
    const cleaned = Array.isArray(coordinates)
      ? coordinates.map(normalizeBoundaryPoint).filter(Boolean)
      : []
    if (!isValidBoundary(cleaned)) return

    apiService
      .request('/api/geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: GEOFENCE_DEVICE_ID, boundary: cleaned }),
      })
      .then((res) => {
        if (!res.ok) throw new Error(`Geofence save failed: ${res.status}`)
        return res.json()
      })
      .then((payload) => {
        const saved = isValidBoundary(payload?.boundary)
          ? payload.boundary.map(normalizeBoundaryPoint).filter(Boolean)
          : cleaned
        setGeofenceBoundary(saved)
        setBoundaryWarning(false)
        try { localStorage.setItem('orbitcare_geofence', JSON.stringify(saved)) } catch { /* noop */ }
      })
      .catch((err) => {
        console.error('[useDeviceController] Failed to save geofence:', err)
        setError(err)
      })
  }, [])

  // ── Telemetry receiver ─────────────────────────────────────────────────────

  const receiveTelemetry = useCallback((payload) => {
    let next = payload
    const raw = typeof payload === 'string' ? payload : ''
    const normalRaw = raw.toUpperCase()
    const coordMatch = raw.match(/Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i)
    const isBoundaryPoint  = /POINT_ADDED\s*:/i.test(raw)
    const isBoundaryReset  = normalRaw.includes('POINTS_CLEARED') || normalRaw.includes('CLEARED') || /RESET\s*:/i.test(raw)

    if (raw) {
      try {
        next = JSON.parse(raw)
      } catch {
        const rssiMatch = raw.match(/\bRSSI\s*:\s*(-?\d+(?:\.\d+)?)/i)
        next = { lat: coordMatch?.[1], lng: coordMatch?.[2], rssi: rssiMatch?.[1], status: raw }
      }
    }

    if (!next || typeof next !== 'object') return

    // ── Boundary handling ────────────────────────────────────────────────────
    const normalPayload = (raw || String(next.status ?? '')).toUpperCase()
    if (next.device_id) setLocationDeviceId(String(next.device_id))

    if (isBoundaryReset) {
      setGeofenceBoundary([])
      setBoundaryWarning(true)
    } else if (isBoundaryPoint) {
      const pts = coordMatch
        ? [[Number(coordMatch[1]), Number(coordMatch[2])]]
        : extractBoundaryPoints(next, raw)
      const validPts = pts.map(normalizeBoundaryPoint).filter(Boolean)
      if (validPts.length > 0) {
        handleHardwareBoundaryStream(validPts)
        validPts.forEach((p) => console.log('📍 Added boundary point:', p))
      }
    } else if (normalPayload.includes('WARN: BOUNDARY NOT SET')) {
      setGeofenceBoundary([])
      setBoundaryWarning(true)
    }

    if (isBoundaryPoint || isBoundaryReset) return

    // ── Location handling ────────────────────────────────────────────────────
    const locPoint = Array.isArray(next.location)
      ? next.location
          .filter((p) => p?.latitude != null && p?.longitude != null &&
                         Number(p.latitude) !== 0 && Number(p.longitude) !== 0)
          .sort((a, b) => Number(b.id) - Number(a.id))[0]
      : null

    const [curLat, curLng] = telemetry.coordinates || []
    const lat = Number(next.lat ?? next.coordinates?.[0] ?? locPoint?.latitude)
    const lng = Number(next.lng ?? next.coordinates?.[1] ?? locPoint?.longitude)
    const coordinates =
      Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
        ? [lat, lng]
        : [curLat, curLng]
    const hasCoords =
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1]) &&
      coordinates[0] !== 0 &&
      coordinates[1] !== 0

    const sigVal    = next.rssi ?? locPoint?.Signal
    const rssiMatch = String(sigVal ?? '').match(/-?\d+(?:\.\d+)?/)
    const rssi      = rssiMatch ? Number(rssiMatch[0]) : NaN
    const signalStrength = Number.isFinite(rssi) ? `${rssi} dBm` : '-68 dBm'

    const isReset = ['RESET', 'CAREGIVER RESET', 'SOS ALERT CLEARED']
      .some((m) => normalPayload.includes(m))
    const isSos = normalPayload.includes('EMERGENCY') || normalPayload.includes('SOS')

    let status
    if (isReset) {
      isSosLatched.current = false
      status = 'Safe'
    } else if (isSos) {
      isSosLatched.current = true
      status = 'SOS'
    } else if (isSosLatched.current) {
      status = 'SOS'
    } else {
      status = normalizeTelemetryStatus(next.status ?? locPoint?.Status ?? raw)
    }

    if (!hasCoords && status !== 'SOS') status = 'Waiting for GPS Fix...'

    const isJitter = hasCoords && distanceInMeters(telemetry.coordinates, coordinates) < 3
    const hasChange = status !== telemetry.status || signalStrength !== telemetry.signalStrength
    if (isJitter && !hasChange && !isReset) return

    setTelemetry({ coordinates, status, signalStrength })
  }, [telemetry, handleHardwareBoundaryStream])

  const receiveBoundarySnapshot = useCallback((payload) => {
    let parsed = payload
    if (typeof payload === 'string') {
      try { parsed = JSON.parse(payload) }
      catch { receiveTelemetryRef.current?.(payload); return }
    }
    if (!isBoundarySnapshot(parsed)) {
      receiveTelemetryRef.current?.(payload)
      return
    }
    const points = createMaximumAreaBoundary(extractBoundaryPoints(parsed, ''))
    if (parsed.device_id) setBoundaryDeviceId(String(parsed.device_id))
    setGeofenceBoundary(points)
    setBoundaryWarning(points.length < 3)
    console.log('📍 MQTT boundary snapshot:', JSON.stringify(points))
  }, [])

  receiveTelemetryRef.current = receiveTelemetry

  // ── Alarm signal handling ──────────────────────────────────────────────────

  /**
   * Receive and apply an orbitcare/signal command payload.
   * Transitions alarmState based on payload.status.
   * @param {unknown} payload
   */
  const receiveSignal = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') return
    const status = String(payload.status ?? '').toUpperCase()
    if (['ALARM_ON', 'ALARM_OFF', 'SOS', 'RESET'].includes(status)) {
      setAlarmState(status === 'RESET' ? 'idle' : status)
    }
  }, [])

  const receiveSignalRef = useRef(receiveSignal)
  receiveSignalRef.current = receiveSignal

  /**
   * Send a RESET command via the backend REST API, which publishes it to
   * orbitcare/signal_ch_2 (app → Rx). Also immediately clears the local alarm state.
   */
  const sendReset = useCallback(async (deviceId = null) => {
    // Guard: if a DOM event leaks in as the first arg, treat it as null
    const safeDeviceId = typeof deviceId === 'string' ? deviceId : null
    setAlarmState('idle')
    try {
      const res = await apiService.request('/api/signal/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: safeDeviceId }),
      })
      if (!res.ok) console.error('[useDeviceController] sendReset failed:', res.status)
    } catch (err) {
      console.error('[useDeviceController] sendReset error:', err)
    }
  }, [])

  // ── Socket connection ──────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    socketServiceRef.current?.disconnect()
    setConnectionStatus('disconnected')
  }, [])

  const connect = useCallback(() => {
    socketServiceRef.current?.connect()
  }, [])

  useEffect(() => {
    if (isDemoMode) return undefined

    setConnectionStatus('searching')
    setError(null)

    const svc = createSocketService({
      onConnect: (url) => {
        console.log(`[socket] Connected to ${url}`)
        setConnectionStatus('connected')
        setError(null)
      },
      onTelemetry: (payload) => {
        receiveTelemetryRef.current?.(payload)
      },
      onSignal: (payload) => {
        receiveSignalRef.current?.(payload)
      },
      onDisconnect: () => setConnectionStatus('disconnected'),
      onConnectError: (err, url) => {
        setConnectionStatus('disconnected')
        setError(`Unable to connect to backend at ${url}: ${err.message}`)
      },
    })

    socketServiceRef.current = svc
    svc.connect()

    return () => svc.dispose()
  }, [isDemoMode, backendUrl])

  // ── Demo mode effects ──────────────────────────────────────────────────────

  useEffect(() => {
    if (isDemoMode) {
      try {
        const stored = localStorage.getItem('orbitcare_geofence')
        const parsed = stored ? JSON.parse(stored) : null
        setGeofenceBoundary(isValidBoundary(parsed) ? parsed : DEFAULT_BOUNDARY)
      } catch {
        setGeofenceBoundary(DEFAULT_BOUNDARY)
      }
      setBoundaryWarning(false)
      setTelemetry(DEFAULT_TELEMETRY)
      setConnectionStatus('connected')
    } else {
      setGeofenceBoundary([])
      setBoundaryWarning(false)
      setTelemetry(HARDWARE_WAITING_TELEMETRY)
    }
  }, [isDemoMode])

  // ── Status change → history + notification + alarm ─────────────────────────

  useEffect(() => {
    if (previousStatus.current === telemetry.status) return

    const [lat, lng] = telemetry.coordinates || []
    const isEmergency = telemetry.status === 'ALERT' || telemetry.status === 'SOS'

    if (pushNotifications && isEmergency && typeof Notification !== 'undefined') {
      const notify = () =>
        new Notification(
          telemetry.status === 'SOS' ? 'EMERGENCY: SOS Alert' : 'EMERGENCY: Safe Zone Breached!',
          {
            body: telemetry.status === 'SOS'
              ? 'The patient has triggered the SOS alert.'
              : 'Patient has left the safe geofence boundary.',
          },
        )
      if (Notification.permission === 'granted') notify()
      else if (Notification.permission === 'default') {
        Notification.requestPermission().then((p) => { if (p === 'granted') notify() }).catch(() => {})
      }
    }

    addHistoryEntry({
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      event: telemetry.status === 'SOS'
        ? 'SOS Alert Triggered'
        : telemetry.status === 'ALERT'
          ? 'Safe Zone Breached'
          : 'Restored to Safe',
      coordinates: Number.isFinite(lat) && Number.isFinite(lng)
        ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        : 'Waiting for GPS Fix...',
      type: isEmergency ? 'danger' : 'success',
      status: telemetry.status,
      signalStrength: telemetry.signalStrength,
    })

    previousStatus.current = telemetry.status
  }, [telemetry.status, pushNotifications, addHistoryEntry])

  // ── Audible alarm ──────────────────────────────────────────────────────────

  useEffect(() => {
    const isEmergency = telemetry.status === 'ALERT' || telemetry.status === 'SOS'
    if (!isEmergency || !audibleAlarm || typeof window === 'undefined') return undefined
    return createEmergencySiren()
  }, [telemetry.status, audibleAlarm])

  // ── Connection status → history ────────────────────────────────────────────

  useEffect(() => {
    if (previousConnStatus.current === connectionStatus) return

    const event = connectionStatus === 'connected'
      ? 'Device Connected'
      : connectionStatus === 'disconnected'
        ? 'Device Disconnected'
        : 'Searching for Device'

    addHistoryEntry({
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      event,
      coordinates: '—',
      type: 'connection',
    })
    previousConnStatus.current = connectionStatus
  }, [connectionStatus, addHistoryEntry])

  // ── Persist history ────────────────────────────────────────────────────────

  useEffect(() => {
    try { localStorage.setItem('orbitcare_history', JSON.stringify(historyLogs)) } catch { /* noop */ }
  }, [historyLogs])

  // ── Load initial data from backend ─────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController()
    apiService
      .request('/api/history', { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error(`History fetch: ${res.status}`); return res.json() })
      .then((records) => { if (Array.isArray(records)) setHistoryLogs(records.map(formatHistoricalLog)) })
      .catch((err) => { if (err.name !== 'AbortError') console.error('[useDeviceController] History load failed:', err) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    apiService
      .request('/api/geofence', { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error(`Geofence fetch: ${res.status}`); return res.json() })
      .then((payload) => {
        if (isValidBoundary(payload?.boundary)) { setGeofenceBoundary(payload.boundary); return }
        try {
          const stored = localStorage.getItem('orbitcare_geofence')
          const parsed = stored ? JSON.parse(stored) : null
          if (isValidBoundary(parsed)) setGeofenceBoundary(parsed)
        } catch { /* noop */ }
      })
      .catch((err) => { if (err.name !== 'AbortError') console.error('[useDeviceController] Geofence load failed:', err) })
    return () => controller.abort()
  }, [])

  // Load persisted boundary points from DB (ordered by hardware point_id).
  // This restores the full boundary even when the Tx hasn't re-transmitted it.
  useEffect(() => {
    const controller = new AbortController()
    apiService
      .request('/api/geofence/points', { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error(`Geofence points fetch: ${res.status}`); return res.json() })
      .then((payload) => {
        if (!Array.isArray(payload?.points) || payload.points.length === 0) return
        // Convert { id, latitude, longitude } → [lat, lng] pairs
        const pts = payload.points
          .map((p) => normalizeBoundaryPoint([p.latitude, p.longitude]))
          .filter(Boolean)
        if (pts.length > 0) {
          setGeofenceBoundary(pts)
          setBoundaryWarning(pts.length < 3)
          if (payload.device_id) setBoundaryDeviceId(String(payload.device_id))
          console.log(`📍 Loaded ${pts.length} boundary points from DB.`)
        }
      })
      .catch((err) => { if (err.name !== 'AbortError') console.error('[useDeviceController] Geofence points load failed:', err) })
    return () => controller.abort()
  }, [])

  // ── Log geofence changes ───────────────────────────────────────────────────

  useEffect(() => {
    console.log('📍 Current geofence boundary:', JSON.stringify(geofenceBoundary))
  }, [geofenceBoundary])

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleDemoMode = useCallback(() => {
    if (!isDemoMode) {
      requestNotificationPermission()
      disconnect()
    }
    setIsDemoMode((prev) => !prev)
  }, [isDemoMode, disconnect, requestNotificationPermission])

  const updateMqttBrokerUrl = useCallback((url) => {
    const next = String(url || '').trim()
    if (!next) return
    setMqttBrokerUrl(next)
    try { localStorage.setItem('orbitcare_mqtt_broker_url', next) } catch { /* noop */ }
  }, [])

  const updateBackendUrl = useCallback((url) => {
    const next = String(url || '').trim().replace(/\/$/, '')
    if (!next) return
    persistBackendUrl(next)   // updates localStorage + BACKEND_URL_CANDIDATES
    setBackendUrl(next)       // triggers socket reconnect via useEffect dependency
  }, [])

  const clearAlert = useCallback(() => {
    isSosLatched.current = false
    setTelemetry((t) => ({ ...t, status: 'Safe' }))
  }, [])

  const clearAllHistory = useCallback(async () => {
    try {
      const res = await apiService.request('/api/history/clear', { method: 'POST' })
      if (!res.ok) throw new Error(`History clear failed: ${res.status}`)
      localStorage.removeItem('orbitcare_history')
      setHistoryLogs([])
    } catch (err) {
      console.error('[useDeviceController] clearAllHistory failed:', err)
      setError(err)
    }
  }, [])

  const deleteHistoryLog = useCallback((id) => {
    setHistoryLogs((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const simulateSafeZoneBreach = useCallback(() => {
    setTelemetry({ coordinates: [6.9500, 79.9000], status: 'ALERT', signalStrength: '-82 dBm' })
  }, [])

  const simulateSOS = useCallback(() => {
    isSosLatched.current = true
    setTelemetry({ coordinates: [6.9500, 79.9000], status: 'SOS', signalStrength: '-88 dBm' })
  }, [])

  const resetToSafe = useCallback(() => { clearAlert() }, [clearAlert])

  // ── Exposed interface ──────────────────────────────────────────────────────

  return useMemo(
    () => ({
      connectionStatus,
      isDemoMode,
      setIsDemoMode,
      pushNotifications,
      setPushNotifications,
      audibleAlarm,
      setAudibleAlarm,
      mqttBrokerUrl,
      updateMqttBrokerUrl,
      backendUrl,
      updateBackendUrl,
      demoMode: isDemoMode,
      telemetry,
      geofenceBoundary,
      boundaryDeviceId,
      locationDeviceId,
      boundaryWarning,
      geofencePoints: geofenceBoundary.map(([lat, lng]) => ({ lat, lng })),
      historyLogs,
      error,
      alarmState,
      connect,
      disconnect,
      toggleDemoMode,
      updateGeofence,
      handleHardwareBoundaryStream,
      clearAllHistory,
      deleteHistoryLog,
      receiveTelemetry,
      receiveBoundarySnapshot,
      receiveSignal,
      clearAlert,
      sendReset,
      simulateSafeZoneBreach,
      simulateSOS,
      resetToSafe,
    }),
    [
      connectionStatus, isDemoMode, pushNotifications, audibleAlarm,
      mqttBrokerUrl, backendUrl, telemetry, geofenceBoundary, boundaryWarning,
      boundaryDeviceId, locationDeviceId, historyLogs, error,
      alarmState, connect, disconnect, toggleDemoMode, updateGeofence,
      handleHardwareBoundaryStream, clearAllHistory, deleteHistoryLog,
      receiveTelemetry, receiveBoundarySnapshot, receiveSignal,
      clearAlert, sendReset, simulateSafeZoneBreach, simulateSOS,
      resetToSafe, updateMqttBrokerUrl,
    ],
  )
}
