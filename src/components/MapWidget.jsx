import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDevice } from "@/lib/DeviceContext";

const safePatientIcon = L.divIcon({
  html: `<div class="patient-pin patient-pin-safe" aria-label="Patient is safe">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="#2563EB" />
      <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
    </svg>
  </div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const alertPatientIcon = L.divIcon({
  html: `<div class="patient-pin patient-pin-alert" aria-label="Patient is outside the safe zone">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="#DC2626" />
      <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
    </svg>
  </div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FitBounds({ boundaryPoints, position }) {
  const map = useMap();
  useEffect(() => {
    if (position && boundaryPoints?.length) {
      const bounds = L.latLngBounds([...boundaryPoints, position]);
      map.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  }, [boundaryPoints, position, map]);
  return null;
}

export default function MapWidget({
  telemetry,
  geofenceBoundary,
  height = 260,
  interactive = true,
}) {
  const device = useDevice();
  const position = telemetry?.coordinates || null;
  const center = position || [6.9270, 79.8612];
  const isBreached = telemetry?.status === "ALERT";
  const boundaryPoints = geofenceBoundary || device.geofenceBoundary;

  return (
    <div style={{ height, borderRadius: "1rem", overflow: "hidden" }}>
      <MapContainer
        center={center}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={interactive}
        zoomControl={interactive}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polygon
          positions={boundaryPoints}
          pathOptions={{
            color: "#2563EB",
            dashArray: "5, 5",
            fillColor: "#3B82F6",
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
        {position && (
          <Marker
            position={position}
            icon={isBreached ? alertPatientIcon : safePatientIcon}
          />
        )}
        <FitBounds boundaryPoints={boundaryPoints} position={position} />
      </MapContainer>
    </div>
  );
}