import * as THREE from "three";
import { featuresBy, geometryCoords, ringToLocal } from "../geo/project.js";

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function makeNoiseTexture(size, colourFn) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b] = colourFn(x / size, y / size, hash(x, y));
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const textures = {
  clay: makeNoiseTexture(256, (u, v, n) => {
    const groove = Math.abs(Math.sin(u * 40 + n * 3)) * 18;
    const r = 176 + n * 40 - groove;
    const g = 92 + n * 28 - groove * 0.4;
    const b = 38 + n * 16;
    return [r, g, b];
  }),
  grass: makeNoiseTexture(256, (u, v, n) => {
    const r = 46 + n * 28;
    const g = 92 + n * 50;
    const b = 32 + n * 20;
    return [r, g, b];
  }),
  dirt: makeNoiseTexture(128, (u, v, n) => {
    const r = 92 + n * 40;
    const g = 72 + n * 28;
    const b = 42 + n * 16;
    return [r, g, b];
  }),
  asphalt: makeNoiseTexture(128, (u, v, n) => {
    const v2 = 42 + n * 22;
    return [v2, v2, v2 + 4];
  }),
};

textures.clay.repeat.set(14, 3);
textures.grass.repeat.set(18, 18);
textures.dirt.repeat.set(10, 10);
textures.asphalt.repeat.set(8, 8);

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/**
 * Build a banked clay oval from the OSM raceway centreline.
 * Returns the racing curve (counter-clockwise), centre, and turn positions.
 */
export function createTrack(parent) {
  const raceway = featuresBy((p) => p.highway === "raceway")[0];
  let pts = ringToLocal(geometryCoords(raceway));

  // OSM way is clockwise; Australian dirt ovals race counter-clockwise.
  if (signedArea(pts) > 0) pts = pts.slice().reverse();

  const vectors = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  vectors.push(vectors[0].clone());
  const curve = new THREE.CatmullRomCurve3(vectors, true, "catmullrom", 0.12);

  const samples = 256;
  const halfWidth = 9.2;
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];

  const innerPts = [];
  const outerPts = [];
  const racingPts = [];

  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    curve.getTangentAt(t, tangent).normalize();
    binormal.crossVectors(up, tangent).normalize(); // outward-ish
    // Ensure outward: from centre
    const cx = -5.6;
    const cz = -2.1;
    const fromC = new THREE.Vector3(p.x - cx, 0, p.z - cz);
    if (binormal.dot(fromC) < 0) binormal.negate();

    const prev = curve.getPointAt((t + 1 / samples) % 1);
    const next = curve.getPointAt((t + 2 / samples) % 1);
    const v1 = prev.clone().sub(p);
    const v2 = next.clone().sub(prev);
    v1.y = v2.y = 0;
    const curvature = 1 - tangent.dot(v2.normalize());
    const bankDeg = 9 + curvature * 38;
    const bank = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(bankDeg, 8, 24));
    const width = halfWidth + curvature * 3.5;

    const innerY = 0.15;
    const outerY = innerY + Math.tan(bank) * (width * 2);

    const inner = p.clone().addScaledVector(binormal, -width);
    inner.y = innerY;
    const outer = p.clone().addScaledVector(binormal, width);
    outer.y = outerY;

    innerPts.push(inner.clone());
    outerPts.push(outer.clone());
    racingPts.push(
      p.clone().addScaledVector(binormal, width * 0.15).setY((innerY + outerY) * 0.45 + 0.12)
    );

    positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
    uvs.push(0, t * 8, 1, t * 8);

    const across = outer.clone().sub(inner);
    const along = tangent;
    normal.copy(across).cross(along).normalize();
    if (normal.y < 0) normal.negate();
    normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
  }

  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const clayMat = new THREE.MeshStandardMaterial({
    map: textures.clay,
    roughness: 0.92,
    metalness: 0.02,
    color: 0xffc48a,
  });
  const trackMesh = new THREE.Mesh(geom, clayMat);
  trackMesh.receiveShadow = true;
  trackMesh.castShadow = true;
  trackMesh.name = "track";
  parent.add(trackMesh);

  // Inner apron
  const apronPos = [];
  const apronIdx = [];
  for (let i = 0; i <= samples; i++) {
    const inner = innerPts[i];
    const deeper = inner.clone().lerp(
      new THREE.Vector3(-5.6, 0.08, -2.1),
      0.12
    );
    deeper.y = 0.08;
    apronPos.push(deeper.x, deeper.y, deeper.z, inner.x, inner.y, inner.z);
  }
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    apronIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const apronGeom = new THREE.BufferGeometry();
  apronGeom.setAttribute("position", new THREE.Float32BufferAttribute(apronPos, 3));
  apronGeom.setIndex(apronIdx);
  apronGeom.computeVertexNormals();
  const apron = new THREE.Mesh(
    apronGeom,
    new THREE.MeshStandardMaterial({
      map: textures.dirt,
      color: 0xc4a574,
      roughness: 1,
    })
  );
  apron.receiveShadow = true;
  parent.add(apron);

  // Infield grass disc from inner ring
  const infieldShape = new THREE.Shape();
  innerPts.forEach((p, i) => {
    if (i === 0) infieldShape.moveTo(p.x, -p.z);
    else infieldShape.lineTo(p.x, -p.z);
  });
  const infieldGeom = new THREE.ShapeGeometry(infieldShape, 12);
  infieldGeom.rotateX(-Math.PI / 2);
  // ShapeGeometry is in X/Y; after rotateX -90, Y becomes Z but we used (x, -z) so Z maps back.
  const infield = new THREE.Mesh(
    infieldGeom,
    new THREE.MeshStandardMaterial({
      map: textures.grass,
      color: 0x6aa334,
      roughness: 1,
    })
  );
  infield.position.y = 0.06;
  infield.receiveShadow = true;
  infield.name = "infield";
  parent.add(infield);

  parent.add(makeStartFinish(curve));

  // Catch fence + tyre wall
  addWalls(parent, outerPts, samples);

  const racingCurve = new THREE.CatmullRomCurve3(racingPts, true, "catmullrom", 0.1);

  const centre = new THREE.Vector3(-5.6, 0, -2.1);
  const turns = locateTurns(curve, centre);

  return { curve: racingCurve, centre, turns, innerPts, outerPts, trackMesh };
}

function makeStartFinish(curve) {
  const t = northStraightT(curve);
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t).normalize();
  const sideways = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tan).normalize();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.08, 1.35),
    new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.55 })
  );
  mesh.position.set(p.x, 0.58, p.z);
  mesh.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().lookAt(p, p.clone().add(sideways), new THREE.Vector3(0, 1, 0))
  );
  return mesh;
}

function northStraightT(curve) {
  let best = 0;
  let bestZ = Infinity;
  for (let i = 0; i < 64; i++) {
    const t = i / 64;
    const p = curve.getPointAt(t);
    if (p.z < bestZ) {
      bestZ = p.z;
      best = t;
    }
  }
  return best;
}

function addWalls(parent, outerPts, samples) {
  const wallPos = [];
  const wallIdx = [];
  const h = 1.15;
  for (let i = 0; i <= samples; i++) {
    const p = outerPts[i];
    wallPos.push(p.x, p.y, p.z, p.x, p.y + h, p.z);
  }
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    wallIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const wallGeom = new THREE.BufferGeometry();
  wallGeom.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeom.setIndex(wallIdx);
  wallGeom.computeVertexNormals();
  const wall = new THREE.Mesh(
    wallGeom,
    new THREE.MeshStandardMaterial({
      color: 0xd8d2c6,
      roughness: 0.7,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })
  );
  wall.castShadow = true;
  parent.add(wall);

  const fenceMat = new THREE.MeshStandardMaterial({
    color: 0x9aa3ad,
    metalness: 0.6,
    roughness: 0.35,
  });
  const postGeom = new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6);
  for (let i = 0; i < samples; i += 4) {
    const p = outerPts[i];
    const post = new THREE.Mesh(postGeom, fenceMat);
    post.position.set(p.x, p.y + 2.1, p.z);
    post.castShadow = true;
    parent.add(post);
  }

  // Catch-fence mesh (two rails + mesh)
  const fencePos = [];
  const fenceIdx = [];
  for (let i = 0; i <= samples; i++) {
    const p = outerPts[i];
    fencePos.push(p.x, p.y + 1.2, p.z, p.x, p.y + 4.0, p.z);
  }
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    fenceIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const fenceGeom = new THREE.BufferGeometry();
  fenceGeom.setAttribute("position", new THREE.Float32BufferAttribute(fencePos, 3));
  fenceGeom.setIndex(fenceIdx);
  fenceGeom.computeVertexNormals();
  parent.add(
    new THREE.Mesh(
      fenceGeom,
      new THREE.MeshStandardMaterial({
        color: 0xc5ced6,
        metalness: 0.4,
        roughness: 0.4,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      })
    )
  );
}

function locateTurns(curve, centre) {
  const samples = [];
  for (let i = 0; i < 128; i++) {
    const t = i / 128;
    const p = curve.getPointAt(t);
    const ang = Math.atan2(-(p.z - centre.z), p.x - centre.x); // east=0, north=+
    samples.push({ t, p, ang });
  }
  const pick = (target) => {
    let best = samples[0];
    let bestD = Infinity;
    for (const s of samples) {
      let d = Math.abs(s.ang - target);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best.p.clone();
  };
  // Counter-clockwise, front stretch on the north (highway) side:
  // T1 NE, T2 SE, T3 SW, T4 NW
  return {
    t1: pick(Math.PI * 0.25),
    t2: pick(-Math.PI * 0.25),
    t3: pick(-Math.PI * 0.75),
    t4: pick(Math.PI * 0.75),
    start: pick(Math.PI * 0.5),
  };
}
