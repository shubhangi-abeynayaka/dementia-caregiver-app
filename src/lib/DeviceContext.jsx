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
    if (pushNotifications && telemetry.status === 'ALERT' && typeof Notification !== 'undefined') {
      const notify = () => new Notification('EMERGENCY: Safe Zone Breached!', {
        body: 'Patient has left the safe geofence boundary.',
      })

      if (Notification.permission === 'granted') {
        notify()
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') notify()
        }).catch(() => {})
      }
    }

    setHistoryLogs((currentHistory) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        event: telemetry.status === 'ALERT' ? 'Safe Zone Breached' : 'Restored to Safe',
        coordinates: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        type: telemetry.status === 'ALERT' ? 'danger' : 'success',
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
      const characteristic = await service.getCharacteristic(TELEMETRY_CHARACTERISTIC_UUID)
      const handleTelemetry = (event) => {
        const { value } = event.target
        const payload = new TextDecoder().decode(value)

        try {
          let parsed
          try {
            parsed = JSON.parse(payload)
          } catch {
            parsed = {
              lat: payload.match(/\bLat(?:itude)?\s*:\s*(-?\d+(?:\.\d+)?)/i)?.[1],
              lng: payload.match(/\b(?:Lng|Lon|Longitude)\s*:\s*(-?\d+(?:\.\d+)?)/i)?.[1],
              rssi: payload.match(/\bRSSI\s*:\s*(-?\d+(?:\.\d+)?)/i)?.[1],
              status: payload,
            }
          }

          const lat = Number(parsed.lat)
          const lng = Number(parsed.lng)
          const rssi = Number(parsed.rssi)

          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(rssi)) return

          receiveTelemetry({
            coordinates: [lat, lng],
            status: parsed.status,
            signalStrength: `${rssi} dBm`,
          })
        } catch {
          // Ignore incomplete or malformed BLE packets.
        }
      }

      const handleDisconnect = () => disconnect()
      device.addEventListener('gattserverdisconnected', handleDisconnect)
      characteristic.addEventListener('characteristicvaluechanged', handleTelemetry)
      await characteristic.startNotifications()
      bluetoothDevice.current = device
      telemetryCharacteristic.current = characteristic
      telemetryHandler.current = handleTelemetry
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

  const receiveTelemetry = (nextTelemetry) => {
    setTelemetry({
      ...nextTelemetry,
      status: normalizeTelemetryStatus(nextTelemetry.status),
    })
  }

  const simulateSafeZoneBreach = () => {
    setTelemetry({
      coordinates: [6.9500, 79.9000],
      status: 'ALERT',
      signalStrength: '-82 dBm',
    })
  }

  const simulateSOS = () => {
    setTelemetry({
      coordinates: [6.9500, 79.9000],
      status: 'SOS',
      signalStrength: '-88 dBm',
    })
  }

  const resetToSafe = () => {
    setTelemetry(DEFAULT_TELEMETRY)
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
