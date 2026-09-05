import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_BOUNDARY, DEFAULT_POLYGON } from '@/lib/geofence'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [packet, setPacket] = useState({
    lat: 6.9270,
    lng: 79.8612,
    status: 'SAFE',
    timestamp: Date.now(),
    rssi: -68,
  })
  const [geofenceBoundary, setGeofenceBoundary] = useState(DEFAULT_BOUNDARY)
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
    setIsDemoMode((current) => !current)
  }

  const updateGeofence = (coordinates) => {
    if (coordinates.length >= 3) {
      setGeofenceBoundary(coordinates)
    }
  }

  const handleHardwareBoundaryStream = (newCoordinatesArray) => {
    updateGeofence(newCoordinatesArray)
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
      isDemoMode,
      demoMode: isDemoMode,
      packet,
      geofenceBoundary,
      geofencePoints: geofenceBoundary.map(([lat, lng]) => ({ lat, lng })),
      history,
      alarmActive,
      error,
      connect,
      disconnect,
      toggleDemoMode,
      updateGeofence,
      handleHardwareBoundaryStream,
      acknowledge,
      clearAllHistory,
    }),
    [connectionStatus, isDemoMode, packet, geofenceBoundary, history, alarmActive, error]
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
