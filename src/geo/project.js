export const ORIGIN = { lat: -38.3871071, lon: 142.5817863 };

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLon() {
  return 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
}

let geojson = { type: "FeatureCollection", origin: ORIGIN, features: [] };

export async function initGeo() {
  const res = await fetch(new URL("./premier-speedway.json", import.meta.url));
  if (!res.ok) {
    throw new Error(`Could not load map data (${res.status})`);
  }
  geojson = await res.json();
  ORIGIN.lat = geojson.origin.lat;
  ORIGIN.lon = geojson.origin.lon;
}

/** Local ENU metres: +X east, +Z south (Three.js Y-up). */
export function latLonToLocal(lat, lon) {
  const x = (lon - ORIGIN.lon) * metersPerDegLon();
  const z = -(lat - ORIGIN.lat) * METERS_PER_DEG_LAT;
  return { x, z };
}

export function localToLatLon(x, z) {
  const lon = ORIGIN.lon + x / metersPerDegLon();
  const lat = ORIGIN.lat - z / METERS_PER_DEG_LAT;
  return { lat, lon };
}

export function ringToLocal(coordinates) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const closed =
    first &&
    last &&
    first[0] === last[0] &&
    first[1] === last[1];
  const ring = closed ? coordinates.slice(0, -1) : coordinates;
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
