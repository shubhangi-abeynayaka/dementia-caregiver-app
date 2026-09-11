import { useEffect, useRef } from "react";
import {
  GoogleMap,
  Marker,
  Polygon,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useDevice } from "@/lib/DeviceContext";

const containerStyle = { width: "100%", height: "100%" };

const mapOptions = (interactive) => ({
  clickableIcons: false,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: interactive,
  gestureHandling: interactive ? "auto" : "none",
});

const patientIcon = (isBreached) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="${isBreached ? "#DC2626" : "#2563EB"}" />
      <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
    </svg>
  `)}`,
  scaledSize: new window.google.maps.Size(24, 24),
  anchor: new window.google.maps.Point(12, 12),
});

export default function MapWidget({
  telemetry,
  geofenceBoundary,
  height = 260,
  interactive = true,
}) {
  const device = useDevice();
  const mapRef = useRef(null);
  const position = telemetry?.coordinates || null;
  const isBreached = telemetry?.status === "ALERT";
  const boundaryPoints = geofenceBoundary || device.geofenceBoundary;
  const positionLatLng = position
    ? { lat: position[0], lng: position[1] }
    : null;
  const boundaryLatLngs = boundaryPoints.map(([lat, lng]) => ({ lat, lng }));
  const { isLoaded, loadError } = useJsApiLoader({
    id: "orbitcare-google-maps",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  const fitMapBounds = (map) => {
    if (!map || !positionLatLng || !boundaryLatLngs.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    boundaryLatLngs.forEach((point) => bounds.extend(point));
    bounds.extend(positionLatLng);
    map.fitBounds(bounds, 40);
  };

  useEffect(() => {
    fitMapBounds(mapRef.current);
  }, [boundaryPoints, position]);

  if (loadError) {
    return <div style={{ height, borderRadius: "1rem" }}>Unable to load Google Maps.</div>;
  }

  if (!isLoaded) {
    return <div style={{ height, borderRadius: "1rem" }}>Loading Google Maps...</div>;
  }

  return (
    <div style={{ height, borderRadius: "1rem", overflow: "hidden" }}>
      <GoogleMap
        center={positionLatLng || { lat: 6.9270, lng: 79.8612 }}
        zoom={16}
        mapContainerStyle={containerStyle}
        options={mapOptions(interactive)}
        onLoad={(map) => {
          mapRef.current = map;
          fitMapBounds(map);
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
      >
        <Polygon
          paths={boundaryLatLngs}
          options={{
            strokeColor: "#2563EB",
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: "#3B82F6",
            fillOpacity: 0.15,
            clickable: false,
          }}
        />
        {positionLatLng && (
          <Marker
            position={positionLatLng}
            icon={patientIcon(isBreached)}
            title={isBreached ? "Patient is outside the safe zone" : "Patient is safe"}
          />
        )}
      </GoogleMap>
    </div>
  );
}