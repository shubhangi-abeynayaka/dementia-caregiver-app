import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const patientIcon = L.divIcon({
  html: '<div class="patient-pin"></div>',
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 16, { animate: true });
  }, [position, map]);
  return null;
}

export default function MapWidget({
  packet,
  geofencePoints,
  height = 260,
  interactive = true,
}) {
  const position =
    packet && !isNaN(packet.lat) && !isNaN(packet.lng)
      ? [packet.lat, packet.lng]
      : null;
  const center = position || [24.7135, 46.6755];

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
        {geofencePoints.length >= 3 && (
          <Polygon
            positions={geofencePoints.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: "#F4A261",
              fillColor: "#F4A261",
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}
        {position && <Marker position={position} icon={patientIcon} />}
        <Recenter position={position} />
      </MapContainer>
    </div>
  );
}