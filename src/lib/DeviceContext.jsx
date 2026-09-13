import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
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

  const pointMatch = rawString.match(/(?:POINT|BOUNDARY)\s*:\s*([-0-9.]+)\s*[, ]\s*([-0-9.]+)/i)
  if (pointMatch) addPoint([pointMatch[1], pointMatch[2]])

  return points
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
  const [telemetry, setTelemetry] = useState(HARDWARE_WAITING_TELEMETRY)
  const [geofenceBoundary, setGeofenceBoundary] = useState([])
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
  const bluetoothDevice = useRef(null)
  const telemetryCharacteristic = useRef(null)
  const telemetryHandler = useRef(null)
  const bluetoothDisconnectHandler = useRef(null)

  const TELEMETRY_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
  const TELEMETRY_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

  const requestNotificationPermission = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

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

  const connect = async () => {
    requestNotificationPermission()
    setError(null)

    if (isDemoMode) {
      setTelemetry(DEFAULT_TELEMETRY)
      setConnectionStatus('connected')
      return
    }

    isSosLatched.current = false
    setGeofenceBoundary([])
    setBoundaryWarning(false)
    setTelemetry(HARDWARE_WAITING_TELEMETRY)
    setConnectionStatus('searching')
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      setConnectionStatus('disconnected')
      setError('Hardware Disconnected / Receiver Not Found')
      return
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [TELEMETRY_SERVICE_UUID],
      })
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService(TELEMETRY_SERVICE_UUID)
      const txCharacteristic = await service.getCharacteristic(TELEMETRY_CHARACTERISTIC_UUID)
      const handleBleNotification = (event) => {
        const value = event.target.value
        const rawString = new TextDecoder().decode(value)
        console.log("📡 Raw BLE Packet Received:", rawString)
        receiveTelemetry(rawString)
      }

      const handleDisconnect = () => disconnect()
      device.addEventListener('gattserverdisconnected', handleDisconnect)
      txCharacteristic.addEventListener('characteristicvaluechanged', handleBleNotification)
      await txCharacteristic.startNotifications()
      bluetoothDevice.current = device
      telemetryCharacteristic.current = txCharacteristic
      telemetryHandler.current = handleBleNotification
      bluetoothDisconnectHandler.current = handleDisconnect
      setConnectionStatus('connected')
    } catch {
      setConnectionStatus('disconnected')
      setError('Hardware Disconnected / Receiver Not Found')
    }
  }

  const disconnect = async () => {
    const device = bluetoothDevice.current
    const characteristic = telemetryCharacteristic.current

    if (characteristic && telemetryHandler.current) {
      characteristic.removeEventListener('characteristicvaluechanged', telemetryHandler.current)
      await characteristic.stopNotifications().catch(() => {})
    }
    if (device) {
      if (bluetoothDisconnectHandler.current) {
        device.removeEventListener('gattserverdisconnected', bluetoothDisconnectHandler.current)
      }
      if (device.gatt.connected) device.gatt.disconnect()
    }
    telemetryCharacteristic.current = null
    telemetryHandler.current = null
    bluetoothDisconnectHandler.current = null
    bluetoothDevice.current = null
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

    setGeofenceBoundary(coordinates)
    setBoundaryWarning(false)
    try {
      localStorage.setItem('orbitcare_geofence', JSON.stringify(coordinates))
    } catch {
    }
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
      return nextBoundary
    })
    setBoundaryWarning(false)
  }

  const clearAllHistory = () => {
    try {
      localStorage.removeItem('orbitcare_history')
    } catch {
    }
    setHistoryLogs([])
  }

  const deleteHistoryLog = (id) => {
    setHistoryLogs((currentHistory) => currentHistory.filter((entry) => entry.id !== id))
  }

  const receiveTelemetry = (payload) => {
    let nextTelemetry = payload
    const rawString = typeof payload === 'string' ? payload : ''

    if (rawString) {
      try {
        nextTelemetry = JSON.parse(rawString)
      } catch {
        const coordinateMatch = rawString.match(/Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i)
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

    const normalizedPayload = (rawString || String(nextTelemetry.status ?? '')).toUpperCase()
    if (normalizedPayload.includes('WARN: BOUNDARY NOT SET')) {
      setGeofenceBoundary([])
      setBoundaryWarning(true)
    } else {
      const incomingBoundaryPoints = extractBoundaryPoints(nextTelemetry, rawString)
      if (incomingBoundaryPoints.length > 0) {
        handleHardwareBoundaryStream(incomingBoundaryPoints)
      }
    }

    const [currentLat, currentLng] = telemetry.coordinates || []
    const lat = Number(nextTelemetry.lat ?? nextTelemetry.coordinates?.[0])
    const lng = Number(nextTelemetry.lng ?? nextTelemetry.coordinates?.[1])
    const coordinates = Number.isFinite(lat) && Number.isFinite(lng)
      ? [parseFloat(lat), parseFloat(lng)]
      : [currentLat, currentLng]
    const hasValidCoordinates = Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])
    const rssi = Number(nextTelemetry.rssi)
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
      status = normalizeTelemetryStatus(nextTelemetry.status ?? rawString)
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
      demoMode: isDemoMode,
      telemetry,
      geofenceBoundary,
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
    [connectionStatus, isDemoMode, pushNotifications, audibleAlarm, telemetry, geofenceBoundary, boundaryWarning, historyLogs, error]
  )

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) throw new Error('useDevice must be used within DeviceProvider')
  return context
}
