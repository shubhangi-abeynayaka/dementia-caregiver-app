import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BOUNDARY } from '@/lib/geofence'

const DeviceContext = createContext(null)
const DEFAULT_TELEMETRY = {
  coordinates: [6.9270, 79.8612],
  status: 'Safe',
  signalStrength: '-68 dBm',
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
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [audibleAlarm, setAudibleAlarm] = useState(true)
  const [telemetry, setTelemetry] = useState(DEFAULT_TELEMETRY)
  const [geofenceBoundary, setGeofenceBoundary] = useState(() => {
    try {
      const storedBoundary = localStorage.getItem('orbitcare_geofence')
      const parsedBoundary = storedBoundary ? JSON.parse(storedBoundary) : null
      return isValidBoundary(parsedBoundary) ? parsedBoundary : DEFAULT_BOUNDARY
    } catch {
      return DEFAULT_BOUNDARY
    }
  })
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

    const [lat, lng] = telemetry.coordinates
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
        coordinates: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
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

  const connect = async () => {
    requestNotificationPermission()
    setError(null)

    if (isDemoMode) {
      setTelemetry(DEFAULT_TELEMETRY)
      setConnectionStatus('connected')
      return
    }

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
    if (connectionStatus === 'disconnected') return

    disconnect()
    setConnectionStatus('disconnected')
    isSosLatched.current = false
    setTelemetry(DEFAULT_TELEMETRY)
  }, [isDemoMode])

  const toggleDemoMode = () => {
    if (!isDemoMode) {
      requestNotificationPermission()
    }
    setIsDemoMode((current) => !current)
  }

  const updateGeofence = (coordinates) => {
    if (!isValidBoundary(coordinates)) return

    setGeofenceBoundary(coordinates)
    try {
      localStorage.setItem('orbitcare_geofence', JSON.stringify(coordinates))
    } catch {
    }
  }

  const handleHardwareBoundaryStream = (newCoordinatesArray) => {
    updateGeofence(newCoordinatesArray)
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

    const [currentLat, currentLng] = telemetry.coordinates
    const lat = Number(nextTelemetry.lat ?? nextTelemetry.coordinates?.[0])
    const lng = Number(nextTelemetry.lng ?? nextTelemetry.coordinates?.[1])
    const coordinates = Number.isFinite(lat) && Number.isFinite(lng)
      ? [parseFloat(lat), parseFloat(lng)]
      : [currentLat, currentLng]
    const rssi = Number(nextTelemetry.rssi)
    const normalizedPayload = (rawString || String(nextTelemetry.status ?? '')).toUpperCase()
    const isReset = ['RESET PRESSED', 'SOS ALERT CLEARED', 'CAREGIVER RESET']
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

    setTelemetry({
      ...nextTelemetry,
      coordinates,
      status,
      ...(Number.isFinite(rssi) && { signalStrength: `${rssi} dBm` }),
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
    [connectionStatus, isDemoMode, pushNotifications, audibleAlarm, telemetry, geofenceBoundary, historyLogs, error]
  )

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) throw new Error('useDevice must be used within DeviceProvider')
  return context
}
