import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { DEFAULT_BOUNDARY } from '@/lib/geofence'

const DeviceContext = createContext(null)
const DEFAULT_TELEMETRY = {
  coordinates: [6.9270, 79.8612],
  status: 'Safe',
  signalStrength: '-68 dBm',
}
const HARDWARE_WAITING_TELEMETRY = {
  coordinates: null,
  status: 'Waiting for GPS Fix...',
  signalStrength: null,
}
const DEFAULT_MQTT_BROKER_URL = 'mqtt://broker.hivemq.com:1883'
const CONFIGURED_BACKEND_URL = String(import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '')
const BACKEND_URL_CANDIDATES = CONFIGURED_BACKEND_URL
  ? [CONFIGURED_BACKEND_URL]
  : ['http://localhost:5000', 'http://localhost:5001']
const GEOFENCE_DEVICE_ID = 'patient-device-01'

function formatHistoricalLog(record) {
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
    coordinates: Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng))
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

function isValidBoundary(boundary) {
  return Array.isArray(boundary)
    && boundary.length >= 3
    && boundary.every((point) => (
      Array.isArray(point)
      && point.length === 2
      && point.every((coordinate) => Number.isFinite(coordinate))
    ))
}

function normalizeBoundaryPoint(point) {
  if (!Array.isArray(point) || point.length < 2) return null

  const lat = Number(point[0])
  const lng = Number(point[1])
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
}

function createMaximumAreaBoundary(points) {
  const uniquePoints = points
    .map(normalizeBoundaryPoint)
    .filter(Boolean)
    .filter((point, index, allPoints) => (
      allPoints.findIndex(([lat, lng]) => lat === point[0] && lng === point[1]) === index
    ))
    .sort(([firstLat, firstLng], [secondLat, secondLng]) => (
      firstLat - secondLat || firstLng - secondLng
    ))

  if (uniquePoints.length <= 2) return uniquePoints

  const crossProduct = (origin, firstPoint, secondPoint) => (
    ((firstPoint[0] - origin[0]) * (secondPoint[1] - origin[1]))
      - ((firstPoint[1] - origin[1]) * (secondPoint[0] - origin[0]))
  )
  const lowerHull = []
  uniquePoints.forEach((point) => {
    while (lowerHull.length >= 2 && crossProduct(lowerHull.at(-2), lowerHull.at(-1), point) <= 0) {
      lowerHull.pop()
    }
    lowerHull.push(point)
  })
  const upperHull = []
  uniquePoints.slice().reverse().forEach((point) => {
    while (upperHull.length >= 2 && crossProduct(upperHull.at(-2), upperHull.at(-1), point) <= 0) {
      upperHull.pop()
    }
    upperHull.push(point)
  })

  return lowerHull.slice(0, -1).concat(upperHull.slice(0, -1))
}

function distanceInMeters(firstPoint, secondPoint) {
  if (!Array.isArray(firstPoint) || !Array.isArray(secondPoint)) return Infinity

  const [firstLat, firstLng] = firstPoint.map(Number)
  const [secondLat, secondLng] = secondPoint.map(Number)
  if (![firstLat, firstLng, secondLat, secondLng].every(Number.isFinite)) return Infinity

  const earthRadius = 6371000
  const toRadians = (degrees) => degrees * Math.PI / 180
  const deltaLat = toRadians(secondLat - firstLat)
  const deltaLng = toRadians(secondLng - firstLng)
  const latitudeFactor = Math.cos(toRadians((firstLat + secondLat) / 2))
  return earthRadius * Math.sqrt(
    (deltaLat * deltaLat) + (latitudeFactor * deltaLng * latitudeFactor * deltaLng),
  )
}

function extractBoundaryPoints(payload, rawString) {
  const points = []
  const addPoint = (point) => {
    const normalizedPoint = normalizeBoundaryPoint(point)
    if (normalizedPoint) points.push(normalizedPoint)
  }

  if (Array.isArray(payload)) payload.forEach(addPoint)
  if (Array.isArray(payload?.boundary)) payload.boundary.forEach(addPoint)
  if (Array.isArray(payload?.boundaryPoints)) payload.boundaryPoints.forEach(addPoint)
  if (payload?.point) addPoint(payload.point)
  if (payload?.corner) addPoint(payload.corner)
  if (payload?.boundaryLat != null && payload?.boundaryLng != null) {
    addPoint([payload.boundaryLat, payload.boundaryLng])
  }

  if (Array.isArray(payload?.points)) {
    payload.points
      .filter((point) => point?.latitude !== '' && point?.longitude !== '')
      .sort((firstPoint, secondPoint) => Number(firstPoint.id) - Number(secondPoint.id))
      .forEach((point) => addPoint([point.latitude, point.longitude]))
  }

  const pointMatch = rawString.match(/(?:POINT(?:_ADDED)?|BOUNDARY)[\s\S]*?Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i)
  if (pointMatch) addPoint([pointMatch[1], pointMatch[2]])

  return points
}

function isBoundarySnapshot(payload) {
  return payload && typeof payload === 'object' && Array.isArray(payload.points)
}

function normalizeTelemetryStatus(status) {
  const normalizedStatus = String(status ?? '').toUpperCase()

  if (normalizedStatus.includes('SOS') || normalizedStatus.includes('EMERGENCY')) {
    return 'SOS'
  }
  if (normalizedStatus.includes('ALERT')) return 'ALERT'
  if (normalizedStatus.includes('SAFE') || normalizedStatus.includes('WARN')) return 'Safe'

  return 'Safe'
}

function createEmergencySiren() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return () => {}

  const audioContext = new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  let highTone = true

  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.value = 0.18
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start()

  const intervalId = window.setInterval(() => {
    highTone = !highTone
    oscillator.frequency.setValueAtTime(highTone ? 880 : 440, audioContext.currentTime)
  }, 450)

  audioContext.resume().catch(() => {})

  return () => {
    window.clearInterval(intervalId)
    oscillator.stop()
    oscillator.disconnect()
    gain.disconnect()
    audioContext.close().catch(() => {})
  }
}

export function DeviceProvider({ children }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [audibleAlarm, setAudibleAlarm] = useState(true)
  const [mqttBrokerUrl, setMqttBrokerUrl] = useState(() => {
    try {
      return localStorage.getItem('orbitcare_mqtt_broker_url') || import.meta.env.VITE_MQTT_WS_URL || DEFAULT_MQTT_BROKER_URL
    } catch {
      return import.meta.env.VITE_MQTT_WS_URL || DEFAULT_MQTT_BROKER_URL
    }
  })
  const [telemetry, setTelemetry] = useState(HARDWARE_WAITING_TELEMETRY)
  const [boundaryDeviceId, setBoundaryDeviceId] = useState(null)
  const [locationDeviceId, setLocationDeviceId] = useState(null)
  const [geofenceBoundary, setGeofenceBoundary] = useState(() => (
    isDemoMode ? DEFAULT_BOUNDARY : []
  ))
  const [boundaryWarning, setBoundaryWarning] = useState(false)
  const [historyLogs, setHistoryLogs] = useState(() => {
    try {
      const storedHistory = localStorage.getItem('orbitcare_history')
      return storedHistory ? JSON.parse(storedHistory) : []
    } catch {
      return []
    }
  })
  const [error, setError] = useState(null)
  const previousStatus = useRef(telemetry.status)
  const isSosLatched = useRef(false)
  const previousConnectionStatus = useRef(connectionStatus)
  const socketRef = useRef(null)
  const receiveTelemetryRef = useRef(null)
  const backendUrlRef = useRef(CONFIGURED_BACKEND_URL || null)

  const setActiveBackendUrl = (backendUrl) => {
    backendUrlRef.current = backendUrl
  }

  const requestBackend = async (path, options = {}) => {
    const candidateUrls = [
      backendUrlRef.current,
      ...BACKEND_URL_CANDIDATES,
    ].filter((url, index, urls) => url && urls.indexOf(url) === index)
    let lastError

    for (const backendUrl of candidateUrls) {
      try {
        const response = await fetch(`${backendUrl}${path}`, options)
        setActiveBackendUrl(backendUrl)
        return response
      } catch (requestError) {
        if (requestError.name === 'AbortError') throw requestError
        lastError = requestError
      }
    }

    throw lastError || new Error('Unable to connect to backend')
  }

  useEffect(() => {
    const controller = new AbortController()

    requestBackend('/api/history', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`History request failed: ${response.status}`)
        return response.json()
      })
      .then((records) => {
        if (Array.isArray(records)) setHistoryLogs(records.map(formatHistoricalLog))
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') {
          console.error('Failed to load telemetry history:', fetchError)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    requestBackend('/api/geofence', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Geofence request failed: ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        if (isValidBoundary(payload?.boundary)) {
          setGeofenceBoundary(payload.boundary)
          return
        }

        try {
          const storedBoundary = localStorage.getItem('orbitcare_geofence')
          const parsedBoundary = storedBoundary ? JSON.parse(storedBoundary) : null
          if (isValidBoundary(parsedBoundary)) setGeofenceBoundary(parsedBoundary)
        } catch {
        }
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') {
          console.error('Failed to load geofence:', fetchError)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (previousStatus.current === telemetry.status) return

    const [lat, lng] = telemetry.coordinates || []
    if (pushNotifications && ['ALERT', 'SOS'].includes(telemetry.status) && typeof Notification !== 'undefined') {
      const notify = () => new Notification(
        telemetry.status === 'SOS' ? 'EMERGENCY: SOS Alert' : 'EMERGENCY: Safe Zone Breached!',
        {
          body: telemetry.status === 'SOS'
            ? 'The patient has triggered the SOS alert.'
            : 'Patient has left the safe geofence boundary.',
        },
      )

      if (Notification.permission === 'granted') {
        notify()
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') notify()
        }).catch(() => {})
      }
    }

    const isEmergency = telemetry.status === 'ALERT' || telemetry.status === 'SOS'
    setHistoryLogs((currentHistory) => [
      {
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
      },
      ...currentHistory,
    ])
    previousStatus.current = telemetry.status
  }, [telemetry.status, pushNotifications])

  useEffect(() => {
    const isEmergency = telemetry.status === 'ALERT' || telemetry.status === 'SOS'
    if (!isEmergency || !audibleAlarm || typeof window === 'undefined') return undefined

    return createEmergencySiren()
  }, [telemetry.status, audibleAlarm])

  useEffect(() => {
    if (previousConnectionStatus.current === connectionStatus) return

    const connectionEvent = connectionStatus === 'connected'
      ? 'Device Connected'
      : connectionStatus === 'disconnected'
        ? 'Device Disconnected'
        : 'Searching for Device'

    setHistoryLogs((currentHistory) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        event: connectionEvent,
        coordinates: '—',
        type: 'connection',
      },
      ...currentHistory,
    ])
    previousConnectionStatus.current = connectionStatus
  }, [connectionStatus])

  useEffect(() => {
    try {
      localStorage.setItem('orbitcare_history', JSON.stringify(historyLogs))
    } catch {
    }
  }, [historyLogs])

  useEffect(() => {
    console.log('📍 Current Geofence Boundary:', JSON.stringify(geofenceBoundary))
  }, [geofenceBoundary])

  useEffect(() => {
    if (isDemoMode) {
      try {
        const storedBoundary = localStorage.getItem('orbitcare_geofence')
        const parsedBoundary = storedBoundary ? JSON.parse(storedBoundary) : null
        setGeofenceBoundary(isValidBoundary(parsedBoundary) ? parsedBoundary : DEFAULT_BOUNDARY)
      } catch {
        setGeofenceBoundary(DEFAULT_BOUNDARY)
      }
      setBoundaryWarning(false)
      setTelemetry(DEFAULT_TELEMETRY)
      setConnectionStatus('connected')
      return
    }

    setGeofenceBoundary([])
    setBoundaryWarning(false)
    setTelemetry(HARDWARE_WAITING_TELEMETRY)
  }, [isDemoMode])

  const connect = () => {
    socketRef.current?.connect()
  }

  const disconnect = () => {
    socketRef.current?.disconnect()
    setConnectionStatus('disconnected')
  }

  useEffect(() => {
    if (isDemoMode) return
    if (connectionStatus === 'disconnected') return

    disconnect()
    setConnectionStatus('disconnected')
    isSosLatched.current = false
    setTelemetry(isDemoMode ? DEFAULT_TELEMETRY : HARDWARE_WAITING_TELEMETRY)
  }, [isDemoMode])

  const toggleDemoMode = () => {
    if (!isDemoMode) {
      requestNotificationPermission()
      disconnect()
    }
    setIsDemoMode((current) => {
      if (current) {
        setGeofenceBoundary([])
        setBoundaryWarning(false)
        setTelemetry(HARDWARE_WAITING_TELEMETRY)
      } else {
        try {
          const storedBoundary = localStorage.getItem('orbitcare_geofence')
          const parsedBoundary = storedBoundary ? JSON.parse(storedBoundary) : null
          setGeofenceBoundary(isValidBoundary(parsedBoundary) ? parsedBoundary : DEFAULT_BOUNDARY)
        } catch {
          setGeofenceBoundary(DEFAULT_BOUNDARY)
        }
        setBoundaryWarning(false)
        setTelemetry(DEFAULT_TELEMETRY)
      }
      return !current
    })
  }

  const updateGeofence = (coordinates) => {
    if (!isValidBoundary(coordinates)) return

    requestBackend('/api/geofence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: GEOFENCE_DEVICE_ID,
        boundary: coordinates,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Geofence save request failed: ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        const savedBoundary = isValidBoundary(payload?.boundary) ? payload.boundary : coordinates

        setGeofenceBoundary(savedBoundary)
        setBoundaryWarning(false)
        try {
          localStorage.setItem('orbitcare_geofence', JSON.stringify(savedBoundary))
        } catch {
        }
      })
      .catch((saveError) => {
        console.error('Failed to save geofence:', saveError)
        setError(saveError)
      })
  }

  const handleHardwareBoundaryStream = (newCoordinatesArray) => {
    if (!Array.isArray(newCoordinatesArray)) return

    const incomingPoints = newCoordinatesArray
      .map(normalizeBoundaryPoint)
      .filter(Boolean)
    if (incomingPoints.length === 0) return

    setGeofenceBoundary((currentBoundary) => {
      const nextBoundary = [...currentBoundary]
      incomingPoints.forEach((point) => {
        const existingIndex = nextBoundary.findIndex(
          ([lat, lng]) => lat === point[0] && lng === point[1],
        )
        if (existingIndex === -1) nextBoundary.push(point)
      })
      return createMaximumAreaBoundary(nextBoundary)
    })
    setBoundaryWarning(false)
  }

  const clearAllHistory = async () => {
    try {
      const response = await requestBackend('/api/history/clear', { method: 'POST' })
      if (!response.ok) throw new Error(`History clear request failed: ${response.status}`)

      localStorage.removeItem('orbitcare_history')
      setHistoryLogs([])
    } catch (clearError) {
      console.error('Failed to clear telemetry history:', clearError)
      setError(clearError)
    }
  }

  const deleteHistoryLog = (id) => {
    setHistoryLogs((currentHistory) => currentHistory.filter((entry) => entry.id !== id))
  }

  const receiveTelemetry = (payload) => {
    let nextTelemetry = payload
    const rawString = typeof payload === 'string' ? payload : ''
    const normalizedRawString = rawString.toUpperCase()
    const coordinateMatch = rawString.match(/Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i)
    const isBoundaryPointPacket = /POINT_ADDED\s*:/i.test(rawString)
    const isBoundaryResetPacket = normalizedRawString.includes('POINTS_CLEARED')
      || normalizedRawString.includes('CLEARED')
      || /RESET\s*:/i.test(rawString)

    if (rawString) {
      try {
        nextTelemetry = JSON.parse(rawString)
      } catch {
        const rssiMatch = rawString.match(/\bRSSI\s*:\s*(-?\d+(?:\.\d+)?)/i)
        nextTelemetry = {
          lat: coordinateMatch?.[1],
          lng: coordinateMatch?.[2],
          rssi: rssiMatch?.[1],
          status: rawString,
        }
      }
    }

    if (!nextTelemetry || typeof nextTelemetry !== 'object') return

    const locationPoint = Array.isArray(nextTelemetry.location)
      ? nextTelemetry.location
        .filter((point) => point?.latitude !== '' && point?.longitude !== '')
        .sort((firstPoint, secondPoint) => Number(secondPoint.id) - Number(firstPoint.id))[0]
      : null
    const normalizedPayload = (rawString || String(nextTelemetry.status ?? '')).toUpperCase()
    if (nextTelemetry.device_id) setLocationDeviceId(String(nextTelemetry.device_id))
    if (isBoundaryResetPacket) {
      setGeofenceBoundary([])
      setBoundaryWarning(true)
    } else if (isBoundaryPointPacket) {
      const incomingBoundaryPoints = coordinateMatch
        ? [[Number(coordinateMatch[1]), Number(coordinateMatch[2])]]
        : extractBoundaryPoints(nextTelemetry, rawString)
      if (incomingBoundaryPoints.length > 0) {
        handleHardwareBoundaryStream(incomingBoundaryPoints)
        incomingBoundaryPoints.forEach((point) => {
          console.log('📍 Added Boundary Point:', point)
        })
      }
    } else if (normalizedPayload.includes('WARN: BOUNDARY NOT SET')) {
      setGeofenceBoundary([])
      setBoundaryWarning(true)
    }

    if (isBoundaryPointPacket || isBoundaryResetPacket) return

    const [currentLat, currentLng] = telemetry.coordinates || []
    const lat = Number(nextTelemetry.lat ?? nextTelemetry.coordinates?.[0] ?? locationPoint?.latitude)
    const lng = Number(nextTelemetry.lng ?? nextTelemetry.coordinates?.[1] ?? locationPoint?.longitude)
    const coordinates = Number.isFinite(lat) && Number.isFinite(lng)
      ? [parseFloat(lat), parseFloat(lng)]
      : [currentLat, currentLng]
    const hasValidCoordinates = Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])
    const signalValue = nextTelemetry.rssi ?? locationPoint?.Signal
    const rssiMatch = String(signalValue ?? '').match(/-?\d+(?:\.\d+)?/)
    const rssi = rssiMatch ? Number(rssiMatch[0]) : NaN
    const signalStrength = Number.isFinite(rssi)
      ? `${rssi} dBm`
      : '-68 dBm'
    const isReset = ['RESET', 'CAREGIVER RESET', 'SOS ALERT CLEARED']
      .some((marker) => normalizedPayload.includes(marker))
    const isSos = normalizedPayload.includes('EMERGENCY') || normalizedPayload.includes('SOS')
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
      status = normalizeTelemetryStatus(nextTelemetry.status ?? locationPoint?.Status ?? rawString)
    }

    if (!hasValidCoordinates && status !== 'SOS') status = 'Waiting for GPS Fix...'

    const isGpsJitter = hasValidCoordinates
      && distanceInMeters(telemetry.coordinates, coordinates) < 3
    const hasTelemetryChange = status !== telemetry.status || signalStrength !== telemetry.signalStrength
    if (isGpsJitter && !hasTelemetryChange && !isReset) return

    setTelemetry({
      coordinates,
      status,
      signalStrength,
    })
  }

  const receiveBoundarySnapshot = (payload) => {
    let parsedPayload = payload
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload)
      } catch {
        receiveTelemetry(payload)
        return
      }
    }

    if (!isBoundarySnapshot(parsedPayload)) {
      receiveTelemetry(payload)
      return
    }

    const points = createMaximumAreaBoundary(extractBoundaryPoints(parsedPayload, ''))
    if (parsedPayload.device_id) setBoundaryDeviceId(String(parsedPayload.device_id))
    setGeofenceBoundary(points)
    setBoundaryWarning(points.length < 3)
    console.log('📍 MQTT Boundary Snapshot:', JSON.stringify(points))
  }

  receiveTelemetryRef.current = receiveTelemetry

  useEffect(() => {
    if (isDemoMode) return undefined

    setConnectionStatus('searching')
    setError(null)

    let isDisposed = false
    let activeSocket = null

    const connectToBackend = (candidateIndex) => {
      if (isDisposed) return

      const backendUrl = BACKEND_URL_CANDIDATES[candidateIndex]
      const socket = io(backendUrl, {
        reconnection: false,
      })
      activeSocket = socket
      socketRef.current = socket

      socket.on('connect', () => {
        setActiveBackendUrl(backendUrl)
        setConnectionStatus('connected')
      })
      socket.on('telemetry', (payload) => {
        receiveTelemetryRef.current?.(payload)
      })
      socket.on('disconnect', () => {
        setConnectionStatus('disconnected')
      })
      socket.on('connect_error', (socketError) => {
        socket.disconnect()
        if (!isDisposed && candidateIndex < BACKEND_URL_CANDIDATES.length - 1) {
          connectToBackend(candidateIndex + 1)
          return
        }

        setConnectionStatus('disconnected')
        setError(`Unable to connect to backend at ${backendUrl}: ${socketError.message}`)
      })
    }

    connectToBackend(0)

    return () => {
      isDisposed = true
      activeSocket?.off('connect')
      activeSocket?.off('telemetry')
      activeSocket?.off('disconnect')
      activeSocket?.off('connect_error')
      activeSocket?.disconnect()
      if (socketRef.current === activeSocket) socketRef.current = null
    }
  }, [isDemoMode])

  const updateMqttBrokerUrl = (nextUrl) => {
    const normalizedUrl = String(nextUrl || '').trim()
    if (!normalizedUrl) return

    setMqttBrokerUrl(normalizedUrl)
    try {
      localStorage.setItem('orbitcare_mqtt_broker_url', normalizedUrl)
    } catch {
    }
  }

  const clearAlert = () => {
    isSosLatched.current = false
    setTelemetry((currentTelemetry) => ({
      ...currentTelemetry,
      status: 'Safe',
    }))
  }

  const simulateSafeZoneBreach = () => {
    setTelemetry({
      coordinates: [6.9500, 79.9000],
      status: 'ALERT',
      signalStrength: '-82 dBm',
    })
  }

  const simulateSOS = () => {
    isSosLatched.current = true
    setTelemetry({
      coordinates: [6.9500, 79.9000],
      status: 'SOS',
      signalStrength: '-88 dBm',
    })
  }

  const resetToSafe = () => {
    clearAlert()
  }

  const value = useMemo(
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
      demoMode: isDemoMode,
      telemetry,
      geofenceBoundary,
      boundaryDeviceId,
      locationDeviceId,
      boundaryWarning,
      geofencePoints: geofenceBoundary.map(([lat, lng]) => ({ lat, lng })),
      historyLogs,
      error,
      connect,
      disconnect,
      toggleDemoMode,
      updateGeofence,
      handleHardwareBoundaryStream,
      clearAllHistory,
      deleteHistoryLog,
      receiveTelemetry,
      clearAlert,
      simulateSafeZoneBreach,
      simulateSOS,
      resetToSafe,
    }),
    [connectionStatus, isDemoMode, pushNotifications, audibleAlarm, mqttBrokerUrl, telemetry, geofenceBoundary, boundaryWarning, boundaryDeviceId, locationDeviceId, historyLogs, error]
  )

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) throw new Error('useDevice must be used within DeviceProvider')
  return context
}
