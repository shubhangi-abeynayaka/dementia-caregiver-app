 feature/map-updates
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BOUNDARY } from '@/lib/geofence'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { connectBluetooth } from "@/lib/bluetooth";
import { startDemo } from "@/lib/demoPacket";
import { startAlarm, stopAlarm } from "@/lib/alertSound";
import { addEvent, clearHistory, loadHistory, saveHistory } from "@/lib/alertHistory";
import { DEFAULT_POLYGON, loadGeofence, saveGeofence } from "@/lib/geofence";
 main

const DeviceContext = createContext(null);

function normalizePacket(packet) {
  if (!packet) return null;

  const status = String(packet.status || "SAFE").toUpperCase();
  if (!["SAFE", "ALERT", "SOS"].includes(status)) return null;

  const lat = Number(packet.lat);
  const lng = Number(packet.lng);
  const rssi = packet.rssi == null ? null : Number(packet.rssi);

  return {
    status,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    rssi: Number.isFinite(rssi) ? rssi : null,
    timestamp: packet.timestamp || Date.now(),
  };
}

export function DeviceProvider({ children }) {
 feature/map-updates
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
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [packet, setPacket] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [demoMode, setDemoMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("dementiaguard.demoMode") === "1";
  });
  const [geofencePoints, setGeofencePoints] = useState(() => {
    const saved = loadGeofence();
    return saved.length >= 3 ? saved : DEFAULT_POLYGON;
  });
  const [alarmActive, setAlarmActive] = useState(false);
  const [error, setError] = useState(null);

  const bluetoothConnectionRef = useRef(null);
  const demoCleanupRef = useRef(null);
  const previousStatusRef = useRef(null);

  const cleanupConnection = () => {
    if (bluetoothConnectionRef.current) {
      try {
        bluetoothConnectionRef.current.disconnect();
      } catch {}
      bluetoothConnectionRef.current = null;
    }

    if (demoCleanupRef.current) {
      demoCleanupRef.current();
      demoCleanupRef.current = null;
    }

    stopAlarm();
  };

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, []);

  const handlePacket = (nextPacket) => {
    const normalized = normalizePacket(nextPacket);
    if (!normalized) return;

    setPacket(normalized);

    const status = normalized.status;
    if (status === "SAFE") {
      setAlarmActive(false);
      stopAlarm();
    } else if (previousStatusRef.current !== status && (status === "ALERT" || status === "SOS")) {
      setAlarmActive(true);
      startAlarm(status);
    }

    previousStatusRef.current = status;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status,
      lat: normalized.lat,
      lng: normalized.lng,
      rssi: normalized.rssi,
      timestamp: normalized.timestamp,
    };

    const nextHistory = addEvent(entry);
    setHistory(nextHistory);
  };

  const connect = async () => {
    if (connectionStatus === "connecting") return;

    setConnectionStatus("connecting");
    setError(null);
    cleanupConnection();

    if (demoMode) {
      demoCleanupRef.current = startDemo((packetData) => handlePacket(packetData));
      setConnectionStatus("connected");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.bluetooth) {
      setConnectionStatus("disconnected");
      setError("Web Bluetooth is not supported in this browser.");
      return;
    }

    try {
      const connection = await connectBluetooth({
        onPacket: handlePacket,
        onDisconnect: () => {
          setConnectionStatus("disconnected");
          setError("Receiver disconnected.");
        },
        onError: (err) => {
          setConnectionStatus("disconnected");
          setError(err?.message || "Unable to connect to the receiver.");
        },
      });

      bluetoothConnectionRef.current = connection;
      setConnectionStatus("connected");
      setError(null);
    } catch (err) {
      setConnectionStatus("disconnected");
      setError(err?.message || "Unable to connect to the receiver.");
    }
  };

  const disconnect = () => {
    cleanupConnection();
    setConnectionStatus("disconnected");
    setError(null);
  };

  const acknowledge = () => {
    setAlarmActive(false);
    stopAlarm();
  };

  const toggleDemoMode = (checked) => {
    setDemoMode(checked);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dementiaguard.demoMode", checked ? "1" : "0");
    }

    if (connectionStatus === "connected" || connectionStatus === "connecting") {
      disconnect();
    }
  };

  const updateGeofence = (points) => {
    setGeofencePoints(points);
    saveGeofence(points);
  };

  const clearAllHistory = () => {
    clearHistory();
    setHistory([]);
  };
 main

  const value = useMemo(
    () => ({
      connectionStatus,
 feature/map-updates
      isDemoMode,
      setIsDemoMode,
      demoMode: isDemoMode,
      telemetry,
      geofenceBoundary,
      geofencePoints: geofenceBoundary.map(([lat, lng]) => ({ lat, lng })),
      historyLogs,

      packet,
      history,
      demoMode,
      geofencePoints,
      alarmActive,
 main
      error,
      connect,
      disconnect,
      acknowledge,
      toggleDemoMode,
      updateGeofence,
 feature/map-updates
      handleHardwareBoundaryStream,

 main
      clearAllHistory,
      deleteHistoryLog,
      receiveTelemetry,
      simulateSafeZoneBreach,
      resetToSafe,
    }),
 feature/map-updates
    [connectionStatus, isDemoMode, telemetry, geofenceBoundary, historyLogs, error]
  )

    [alarmActive, connectionStatus, demoMode, error, geofencePoints, history, packet]
  );
 main

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
 feature/map-updates
  const context = useContext(DeviceContext)
  if (!context) throw new Error('useDevice must be used within DeviceProvider')
  return context

  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDevice must be used inside a DeviceProvider");
  }
  return context;
 main
}
