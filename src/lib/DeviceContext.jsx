import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_POLYGON } from '@/lib/geofence'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [demoMode, setDemoMode] = useState(true)
  const [packet, setPacket] = useState({
    lat: 24.7135,
    lng: 46.6755,
    status: 'SAFE',
    timestamp: Date.now(),
    rssi: -68,
  })
  const [geofencePoints, setGeofencePoints] = useState(DEFAULT_POLYGON)
  const [history, setHistory] = useState([])
  const [alarmActive, setAlarmActive] = useState(false)
  const [error, setError] = useState(null)

  const connect = () => {
    setConnectionStatus('connected')
    setError(null)
  }

  const disconnect = () => {
    setConnectionStatus('disconnected')
  }

  const toggleDemoMode = () => {
    setDemoMode((current) => !current)
  }

  const updateGeofence = (points) => {
    setGeofencePoints(points.length >= 3 ? points : DEFAULT_POLYGON)
  }

  const acknowledge = () => {
    setAlarmActive(false)
  }

  const clearAllHistory = () => {
    setHistory([])
  }

  const value = useMemo(
    () => ({
      connectionStatus,
      demoMode,
      packet,
      geofencePoints,
      history,
      alarmActive,
      error,
      connect,
      disconnect,
      toggleDemoMode,
      updateGeofence,
      acknowledge,
      clearAllHistory,
    }),
    [connectionStatus, demoMode, packet, geofencePoints, history, alarmActive, error]
  )

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) {
    throw new Error('useDevice must be used within DeviceProvider')
  }
  return context
}
