import geojson from "./premier-speedway.json";

export const ORIGIN = geojson.origin;

const METERS_PER_DEG_LAT = 111_320;
const METERS_PER_DEG_LON =
  111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

/** Local ENU metres: +X east, +Z south (Three.js Y-up). */
export function latLonToLocal(lat, lon) {
  const x = (lon - ORIGIN.lon) * METERS_PER_DEG_LON;
  const z = -(lat - ORIGIN.lat) * METERS_PER_DEG_LAT;
  return { x, z };
}

export function localToLatLon(x, z) {
  const lon = ORIGIN.lon + x / METERS_PER_DEG_LON;
  const lat = ORIGIN.lat - z / METERS_PER_DEG_LAT;
  return { lat, lon };
}

export function ringToLocal(coordinates) {
  const ring = coordinates[0] === coordinates[coordinates.length - 1]
    ? coordinates.slice(0, -1)
    : coordinates;
  return ring.map(([lon, lat]) => {
    const { x, z } = latLonToLocal(lat, lon);
    return [x, z];
  });
}

export function lineToLocal(coordinates) {
  return coordinates.map(([lon, lat]) => {
    const { x, z } = latLonToLocal(lat, lon);
    return [x, z];
  });
}

export function featuresBy(predicate) {
  return geojson.features.filter((f) => predicate(f.properties, f));
}

export function geometryCoords(feature) {
  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") return coordinates[0];
  return coordinates;
}

export { geojson };
