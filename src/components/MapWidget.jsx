import { useEffect, useRef } from "react";
import {
  GoogleMap,
  Marker,
  Polygon,
  useJsApiLoader,
} from "@react-google-maps/api";
import { LocateFixed } from "lucide-react";
import { useDevice } from "@/lib/DeviceContext";

const containerStyle = { width: "100%", height: "100%" };
const fallbackCenter = { lat: 6.9270, lng: 79.8612 };

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

function toLatLng(point) {
  if (!Array.isArray(point) || point.length < 2) return null;
  const lat = Number(point[0]);
  const lng = Number(point[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export default function MapWidget({
  telemetry,
  geofenceBoundary,
  height = 260,
  interactive = true,
}) {
  const { geofenceBoundary: deviceGeofenceBoundary, connectionStatus } = useDevice();
  const mapRef = useRef(null);
  const hasCenteredOnFirstPosition = useRef(false);
  const hadValidBoundary = useRef(false);
  const initialCenter = useRef(fallbackCenter);
  const rawPosition = connectionStatus === "connected" && Array.isArray(telemetry?.coordinates)
    ? telemetry.coordinates
    : null;
  const position = toLatLng(rawPosition);
  const boundaryPoints = (geofenceBoundary || deviceGeofenceBoundary || [])
    .map(toLatLng)
    .filter(Boolean);
  const hasValidBoundary = boundaryPoints.length >= 3;
  const isBreached = telemetry?.status === "ALERT" || telemetry?.status === "SOS";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "dementia-caregiver-google-maps",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  const fitMapBounds = (map) => {
    if (!map || !window.google || !position || boundaryPoints.length < 3) return false;

    const bounds = new window.google.maps.LatLngBounds();
    boundaryPoints.forEach((point) => bounds.extend(point));
    bounds.extend(position);
    map.fitBounds(bounds, 40);
    return true;
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position || hasCenteredOnFirstPosition.current) return;

    if (!fitMapBounds(map)) {
      map.panTo(position);
      map.setZoom(17);
    }
    hasCenteredOnFirstPosition.current = true;
  }, [position?.lat, position?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && position && hasValidBoundary && !hadValidBoundary.current) {
      fitMapBounds(map);
    }
    hadValidBoundary.current = hasValidBoundary;
  }, [hasValidBoundary, position?.lat, position?.lng]);

  if (loadError) {
    return <div className="map-widget-container" style={{ "--map-height": `${height}px` }}>Unable to load Google Maps.</div>;
  }

  if (!isLoaded) {
    return <div className="map-widget-container" style={{ "--map-height": `${height}px` }}>Loading Google Maps...</div>;
  }

  return (
    <div
      className="map-widget-container relative"
      style={{ "--map-height": `${height}px` }}
    >
      <GoogleMap
        center={initialCenter.current}
        zoom={16}
        mapContainerStyle={containerStyle}
        options={mapOptions(interactive)}
        onLoad={(map) => {
          mapRef.current = map;
          if (position && !hasCenteredOnFirstPosition.current) {
            if (!fitMapBounds(map)) {
              map.panTo(position);
              map.setZoom(17);
            }
            hasCenteredOnFirstPosition.current = true;
          }
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
      >
        {position && (
          <button
            type="button"
            className="absolute right-3 top-3 z-[1000] inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => mapRef.current?.panTo(position)}
            title="Recenter on Patient"
            aria-label="Recenter on Patient"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            <span>Recenter</span>
          </button>
        )}
        {hasValidBoundary && (
          <Polygon
            paths={boundaryPoints}
            options={{
              strokeColor: "#2563EB",
              strokeOpacity: 1,
              strokeWeight: 2,
              fillColor: "#3B82F6",
              fillOpacity: 0.15,
              clickable: false,
            }}
          />
        )}
        {position && (
          <Marker
            position={position}
            icon={patientIcon(isBreached)}
            title={isBreached ? "Patient is outside the safe zone" : "Patient is safe"}
          />
        )}
      </GoogleMap>
    </div>
  );
}
