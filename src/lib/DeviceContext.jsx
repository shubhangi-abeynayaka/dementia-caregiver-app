import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { connectBluetooth } from "@/lib/bluetooth";
import { startDemo } from "@/lib/demoPacket";
import { startAlarm, stopAlarm } from "@/lib/alertSound";
import { addEvent, clearHistory, loadHistory, saveHistory } from "@/lib/alertHistory";
import { DEFAULT_POLYGON, loadGeofence, saveGeofence } from "@/lib/geofence";

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

  const value = useMemo(
    () => ({
      connectionStatus,
      packet,
      history,
      demoMode,
      geofencePoints,
      alarmActive,
      error,
      connect,
      disconnect,
      acknowledge,
      toggleDemoMode,
      updateGeofence,
      clearAllHistory,
    }),
    [alarmActive, connectionStatus, demoMode, error, geofencePoints, history, packet]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDevice must be used inside a DeviceProvider");
  }
  return context;
}
