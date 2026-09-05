import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BOUNDARY } from '@/lib/geofence'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [telemetry, setTelemetry] = useState({
    coordinates: [6.9270, 79.8612],
    status: 'Safe',
    signalStrength: '-68 dBm',
  })
  const [geofenceBoundary, setGeofenceBoundary] = useState(DEFAULT_BOUNDARY)
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
  const hardwarePort = useRef(null)

  const requestNotificationPermission = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  useEffect(() => {
    if (previousStatus.current === telemetry.status) return

    const [lat, lng] = telemetry.coordinates
    if (telemetry.status === 'ALERT' && typeof Notification !== 'undefined') {
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
  }, [telemetry.status])

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
      setTelemetry({
        coordinates: [6.9270, 79.8612],
        status: 'Safe',
        signalStrength: '-68 dBm',
      })
      setConnectionStatus('connected')
      return
    }

    setConnectionStatus('searching')
    if (typeof navigator === 'undefined' || !navigator.serial) {
      setConnectionStatus('disconnected')
      setError('Hardware Disconnected / Receiver Not Found')
      return
    }

    try {
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 115200 })
      hardwarePort.current = port
      setConnectionStatus('connected')
    } catch {
      setConnectionStatus('disconnected')
      setError('Hardware Disconnected / Receiver Not Found')
    }
  }

  const disconnect = () => {
    hardwarePort.current?.close().catch(() => {})
    hardwarePort.current = null
    setConnectionStatus('disconnected')
  }

  const toggleDemoMode = () => {
    if (!isDemoMode) {
      requestNotificationPermission()
    } else if (connectionStatus === 'connected') {
      disconnect()
    }
    setIsDemoMode((current) => !current)
  }

  const updateGeofence = (coordinates) => {
    if (coordinates.length >= 3) setGeofenceBoundary(coordinates)
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
    setTelemetry(nextTelemetry)
  }

  const simulateSafeZoneBreach = () => {
    setTelemetry({
      coordinates: [6.9500, 79.9000],
      status: 'ALERT',
      signalStrength: '-82 dBm',
    })
  }

  const resetToSafe = () => {
    setTelemetry({
      coordinates: [6.9270, 79.8612],
      status: 'Safe',
      signalStrength: '-68 dBm',
    })
  }

  const value = useMemo(
    () => ({
      connectionStatus,
      isDemoMode,
      setIsDemoMode,
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
      resetToSafe,
    }),
    [connectionStatus, isDemoMode, telemetry, geofenceBoundary, historyLogs, error]
  )

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) throw new Error('useDevice must be used within DeviceProvider')
  return context
}
