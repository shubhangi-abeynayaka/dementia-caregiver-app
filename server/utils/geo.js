'use strict';

/**
 * Returns true if `polygon` is an array of at least 3 valid [lat, lng] pairs.
 * @param {unknown} polygon
 * @returns {boolean}
 */
function isValidPolygon(polygon) {
  return (
    Array.isArray(polygon) &&
    polygon.length >= 3 &&
    polygon.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1])) &&
        Number(point[0]) !== 0 &&
        Number(point[1]) !== 0,
    )
  );
}

/**
 * Ray-casting algorithm — returns true if `point` is inside `polygon`.
 * @param {[number, number]} point  [lat, lng]
 * @param {[number, number][]} polygon
 * @returns {boolean}
 */
function isPointInPolygon(point, polygon) {
  if (
    !Array.isArray(point) ||
    point.length < 2 ||
    Number(point[0]) === 0 ||
    Number(point[1]) === 0 ||
    !isValidPolygon(polygon)
  ) {
    return false;
  }

  const [latitude, longitude] = point.map(Number);
  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const [ci, cj] = [polygon[i].map(Number), polygon[j].map(Number)];
    const intersects =
      ci[0] > latitude !== cj[0] > latitude &&
      longitude <
        ((cj[1] - ci[1]) * (latitude - ci[0])) / (cj[0] - ci[0]) + ci[1];

    if (intersects) inside = !inside;
  }

  return inside;
}

/**
 * Haversine great-circle distance in metres between two lat/lng points.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number}
 */
function haversineDistanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = { isValidPolygon, isPointInPolygon, haversineDistanceInMeters };
