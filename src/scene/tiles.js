import * as THREE from "three";
import { latLonToLocal } from "../geo/project.js";

function latLonToTile(lat, lon, z) {
  const n = 2 ** z;
  const x = n * ((lon + 180) / 360);
  const latRad = (lat * Math.PI) / 180;
  const y =
    (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2;
  return { x, y };
}

function tileToLatLon(x, y, z) {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lon };
}

const ESRI =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

/**
 * Drapes ESRI World Imagery tiles onto the ground as a georeferenced mosaic.
 */
export function createSatelliteGround(group, origin, zoom = 18, radiusM = 700) {
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  const { x: fx, y: fy } = latLonToTile(origin.lat, origin.lon, zoom);
  const tileM = 40075016.68 * Math.cos((origin.lat * Math.PI) / 180) / 2 ** zoom;
  const span = Math.ceil(radiusM / tileM) + 1;
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);

  const tiles = new THREE.Group();
  tiles.name = "satellite";
  group.add(tiles);

  const fallback = new THREE.MeshStandardMaterial({
    color: 0x3d4a28,
    roughness: 1,
  });

  for (let tx = cx - span; tx <= cx + span; tx++) {
    for (let ty = cy - span; ty <= cy + span; ty++) {
      const nw = tileToLatLon(tx, ty, zoom);
      const se = tileToLatLon(tx + 1, ty + 1, zoom);
      const a = latLonToLocal(nw.lat, nw.lon);
      const b = latLonToLocal(se.lat, se.lon);
      const w = b.x - a.x;
      const d = b.z - a.z;
      const geom = new THREE.PlaneGeometry(Math.abs(w), Math.abs(d));
      geom.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geom, fallback.clone());
      mesh.position.set(a.x + w / 2, -0.35, a.z + d / 2);
      mesh.receiveShadow = true;
      tiles.add(mesh);

      const url = `${ESRI}/${zoom}/${ty}/${tx}`;
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 8;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          mesh.material.dispose();
          mesh.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 1,
            metalness: 0,
          });
        },
        undefined,
        () => {
          /* keep fallback farmland colour */
        }
      );
    }
  }

  return tiles;
}
