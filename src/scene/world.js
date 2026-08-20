import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import {
  featuresBy,
  geometryCoords,
  ringToLocal,
  lineToLocal,
} from "../geo/project.js";
import { createSatelliteGround } from "./tiles.js";
import { createTrack, textures } from "./track.js";
import { createField } from "./cars.js";

function polyShape(pts) {
  const shape = new THREE.Shape();
  pts.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  return shape;
}

function extrudeBuilding(pts, height, material) {
  const geom = new THREE.ExtrudeGeometry(polyShape(pts), {
    depth: height,
    bevelEnabled: false,
  });
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function centroid(pts) {
  const n = pts.length;
  return {
    x: pts.reduce((s, p) => s + p[0], 0) / n,
    z: pts.reduce((s, p) => s + p[1], 0) / n,
  };
}

function addRibbon(parent, pts, width, y, material) {
  if (pts.length < 2) return;
  const path = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, y, z))
  );
  const geom = new THREE.TubeGeometry(path, Math.max(pts.length * 2, 8), width / 2, 4, false);
  const mesh = new THREE.Mesh(geom, material);
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function buildWorld(scene, origin) {
  const root = new THREE.Group();
  root.name = "world";
  scene.add(root);

  const satellite = createSatelliteGround(root, origin, 18, 720);
  const track = createTrack(root);

  addVenueGrounds(root);
  addBuildings(root, track.centre);
  addRoads(root);
  addRailway(root);
  addMountMax(root, track.turns.t3);
  addBigScreen(root, track.turns.t1, track.turns.t2);
  addLightTowers(root, track.outerPts);
  addParking(root);
  addTrees(root);
  addSky(scene);

  const field = createField(root, track.curve, 8);

  const lights = setupLights(scene, track.outerPts);

  const hotspots = makeHotspots(track);

  return {
    root,
    track,
    field,
    satellite,
    lights,
    hotspots,
    setNight(night) {
      lights.setNight(night);
    },
    setCarsVisible(v) {
      for (const c of field.cars) c.mesh.visible = v;
    },
    setSatelliteVisible(v) {
      satellite.visible = v;
    },
    update(dt) {
      field.update(dt);
    },
  };
}

function addVenueGrounds(root) {
  const grass = featuresBy((p) => p.landuse === "grass")[0];
  if (!grass) return;
  const pts = ringToLocal(geometryCoords(grass));
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(polyShape(pts)),
    new THREE.MeshStandardMaterial({
      map: textures.dirt,
      color: 0x8a7a55,
      roughness: 1,
    })
  );
  mesh.rotateX(-Math.PI / 2);
  mesh.position.y = -0.05;
  mesh.receiveShadow = true;
  root.add(mesh);
}

function addBuildings(root, centre) {
  const buildings = featuresBy((p) => p.building);
  const conc = new THREE.MeshStandardMaterial({
    color: 0xcfc8bb,
    roughness: 0.85,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x6d7380,
    metalness: 0.45,
    roughness: 0.4,
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0x8b1e2d,
    roughness: 0.55,
  });

  for (const f of buildings) {
    const pts = ringToLocal(geometryCoords(f));
    const c = centroid(pts);
    const west = c.x < centre.x - 20;
    if (west) {
      addGrandstand(root, pts, centre, red, conc);
    } else {
      const h = 4 + (Math.abs(c.x) % 5);
      const mesh = extrudeBuilding(pts, h, metal);
      mesh.position.y = 0;
      root.add(mesh);
      // roof
      const roof = extrudeBuilding(pts, 0.35, red);
      roof.position.y = h;
      root.add(roof);
    }
  }
}

function addGrandstand(root, pts, centre, seatMat, concMat) {
  const c = centroid(pts);
  const toward = new THREE.Vector2(centre.x - c.x, centre.z - c.z).normalize();
  const base = extrudeBuilding(pts, 2.2, concMat);
  root.add(base);

  const length = 28;
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const row = new THREE.Mesh(
      new THREE.BoxGeometry(length - r * 0.4, 0.45, 1.15),
      seatMat
    );
    const back = -toward.x * (2 + r * 0.95);
    const backZ = -toward.y * (2 + r * 0.95);
    row.position.set(c.x + back, 2.4 + r * 0.55, c.z + backZ);
    row.lookAt(new THREE.Vector3(centre.x, row.position.y, centre.z));
    row.castShadow = true;
    root.add(row);
  }

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(length + 2, 0.25, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.3, roughness: 0.5 })
  );
  roof.position.set(
    c.x - toward.x * 6,
    8.2,
    c.z - toward.y * 6
  );
  roof.lookAt(new THREE.Vector3(centre.x, 8.2, centre.z));
  root.add(roof);
}

function addRoads(root) {
  const asphalt = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    color: 0x4a4d52,
    roughness: 0.9,
  });
  const dirt = new THREE.MeshStandardMaterial({
    map: textures.dirt,
    color: 0x9a8160,
    roughness: 1,
  });
  const highways = featuresBy(
    (p) =>
      p.highway === "trunk" ||
      p.highway === "tertiary" ||
      p.highway === "residential" ||
      p.highway === "unclassified"
  );
  for (const f of highways) {
    const pts = lineToLocal(geometryCoords(f));
    const trunk = f.properties.highway === "trunk";
    addRibbon(root, pts, trunk ? 12 : 7, 0.04, asphalt);
  }
  const service = featuresBy((p) => p.highway === "service" || p.highway === "track");
  for (const f of service) {
    const pts = lineToLocal(geometryCoords(f));
    addRibbon(root, pts, 4.5, 0.07, dirt);
  }
}

function addRailway(root) {
  const rails = featuresBy((p) => p.railway === "rail");
  const ballast = new THREE.MeshStandardMaterial({ color: 0x5c5348, roughness: 1 });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x889199,
    metalness: 0.8,
    roughness: 0.25,
  });
  for (const f of rails) {
    const pts = lineToLocal(geometryCoords(f));
    addRibbon(root, pts, 3.2, 0.12, ballast);
    addRibbon(root, pts, 0.18, 0.28, steel);
  }
}

function addMountMax(root, t3) {
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: textures.grass,
      color: 0x5d8a3a,
      roughness: 1,
    })
  );
  hill.position.set(t3.x - 18, 0, t3.z + 28);
  hill.scale.set(1.3, 0.42, 1.0);
  hill.castShadow = true;
  hill.receiveShadow = true;
  root.add(hill);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.8 })
  );
  deck.position.set(hill.position.x, 8.6, hill.position.z);
  root.add(deck);

  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(14, 3.2, 7),
    new THREE.MeshStandardMaterial({
      color: 0xf3ead2,
      roughness: 0.7,
      transparent: true,
      opacity: 0.92,
    })
  );
  marquee.position.set(deck.position.x, 10.4, deck.position.z);
  root.add(marquee);
}

function addBigScreen(root, t1, t2) {
  const mid = t1.clone().add(t2).multiplyScalar(0.5);
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(18, 9, 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      emissive: 0x1a3a88,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    })
  );
  screen.position.set(mid.x + 22, 8, mid.z);
  screen.lookAt(new THREE.Vector3(-5.6, 6, -2.1));
  root.add(screen);
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 12, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x44484f, metalness: 0.4 })
  );
  pole.position.set(screen.position.x, 6, screen.position.z);
  root.add(pole);
}

function addLightTowers(root, outerPts) {
  const steel = new THREE.MeshStandardMaterial({
    color: 0x8b929a,
    metalness: 0.65,
    roughness: 0.3,
  });
  const lamp = new THREE.MeshStandardMaterial({
    color: 0xfff3d0,
    emissive: 0xffe7a8,
    emissiveIntensity: 0.8,
  });
  const step = Math.max(1, Math.floor(outerPts.length / 8));
  for (let i = 0; i < outerPts.length; i += step) {
    const p = outerPts[i];
    const tower = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 22, 8), steel);
    pole.position.y = 11;
    pole.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 1.1), lamp);
    head.position.set(0, 21.4, 0);
    tower.add(pole, head);
    tower.position.set(p.x * 1.18, 0, p.z * 1.18);
    root.add(tower);
  }
}

function addParking(root) {
  const carMats = [0x1f2933, 0xb91c1c, 0xdbe4ee, 0x1d4ed8, 0x374151, 0xf59e0b].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2 })
  );
  const body = new THREE.BoxGeometry(1.7, 0.55, 4.1);
  const lots = [
    { x: -220, z: 10, rows: 4, cols: 10, rot: 0.4 },
    { x: -280, z: -40, rows: 3, cols: 8, rot: 0.4 },
    { x: 170, z: 40, rows: 3, cols: 7, rot: -0.3 },
  ];
  const rng = (s) => {
    let a = s;
    return () => {
      a = (a * 16807) % 2147483647;
      return a / 2147483647;
    };
  };
  const rand = rng(42);
  for (const lot of lots) {
    for (let r = 0; r < lot.rows; r++) {
      for (let c = 0; c < lot.cols; c++) {
        if (rand() < 0.22) continue;
        const mesh = new THREE.Mesh(body, carMats[Math.floor(rand() * carMats.length)]);
        mesh.position.set(
          lot.x + c * 6.2 + r * 1.5,
          0.45,
          lot.z + r * 8.5
        );
        mesh.rotation.y = lot.rot;
        mesh.castShadow = true;
        root.add(mesh);
      }
    }
  }
}

function addTrees(root) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b32, roughness: 1 });
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6);
  const leafG = new THREE.SphereGeometry(2.1, 8, 6);
  const positions = [
    [-120, 90], [-160, 70], [-40, 120], [40, 130], [200, 90],
    [240, 20], [210, -80], [-90, -140], [-200, -90], [-320, 20],
    [90, 150], [-250, 80], [260, -40], [-350, -50],
  ];
  for (const [x, z] of positions) {
    const t = new THREE.Mesh(trunkG, trunkMat);
    t.position.set(x, 1.2, z);
    const l = new THREE.Mesh(leafG, leafMat);
    l.position.set(x, 3.6, z);
    l.castShadow = true;
    root.add(t, l);
  }
}

function addSky(scene) {
  const sky = new Sky();
  sky.scale.setScalar(4500);
  sky.name = "sky";
  scene.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = 4;
  u.rayleigh.value = 2.2;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.7;
  const sun = new THREE.Vector3();
  sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(82), THREE.MathUtils.degToRad(160));
  u.sunPosition.value.copy(sun);
  scene.userData.sky = sky;
  scene.userData.sunDir = sun;
}

function setupLights(scene, outerPts) {
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3d2a18, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d0, 1.35);
  sun.position.set(-180, 220, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 600;
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  scene.add(sun);

  const floods = [];
  const step = Math.max(1, Math.floor(outerPts.length / 8));
  for (let i = 0; i < outerPts.length; i += step) {
    const p = outerPts[i];
    const light = new THREE.SpotLight(0xffe7b0, 0, 120, 0.7, 0.45, 1.1);
    light.position.set(p.x * 1.18, 21, p.z * 1.18);
    light.target.position.set(-5.6, 0, -2.1);
    scene.add(light, light.target);
    floods.push(light);
  }

  const nightHemi = { day: 0.7, night: 0.08 };
  return {
    setNight(night) {
      hemi.intensity = night ? nightHemi.night : nightHemi.day;
      sun.intensity = night ? 0.04 : 1.35;
      sun.color.set(night ? 0x8899cc : 0xfff1d0);
      for (const f of floods) f.intensity = night ? 3.4 : 0;
      scene.fog.color.set(night ? 0x05070d : 0xb7c9db);
      scene.background = new THREE.Color(night ? 0x05070d : 0x8eb7d8);
      const sky = scene.userData.sky;
      if (sky) {
        sky.visible = !night;
        const u = sky.material.uniforms;
        u.rayleigh.value = night ? 0.2 : 2.2;
        u.turbidity.value = night ? 0.5 : 4;
      }
    },
  };
}

function makeHotspots(track) {
  const { turns } = track;
  return [
    {
      id: "t1",
      title: "Turn 1",
      body: "Northeast corner off the front straight. Sprintcars hit the high clay bank here after the start/finish — one of the fastest entries on the 410 m oval.",
      position: turns.t1.clone().add(new THREE.Vector3(8, 6, -6)),
    },
    {
      id: "t2",
      title: "Turn 2",
      body: "Southeast corner onto the back straight. Big-screen replays are planned for the T1/T2 end of the venue.",
      position: turns.t2.clone().add(new THREE.Vector3(10, 6, 8)),
    },
    {
      id: "t3",
      title: "Turn 3",
      body: "Southwest corner on the railway side of Sungold Stadium. A new grass bank here is planned to add about 2,500 extra spectators.",
      position: turns.t3.clone().add(new THREE.Vector3(-8, 6, 10)),
    },
    {
      id: "t4",
      title: "Turn 4",
      body: "Northwest corner leading onto the front straight and the Warrnambool-side grandstand.",
      position: turns.t4.clone().add(new THREE.Vector3(-10, 6, -6)),
    },
    {
      id: "sf",
      title: "Start / Finish",
      body: "Front straight on the Princes Highway side of the 410-metre banked clay oval. Home of the Flying Horse Grand Annual Sprintcar Classic.",
      position: turns.start.clone().add(new THREE.Vector3(0, 7, -8)),
    },
    {
      id: "grandstand",
      title: "Grandstand · Warrnambool",
      body: "Main covered seating and terrace on the Warrnambool side. Merchandise sits here; corporate boxes are planned behind the terrace.",
      position: new THREE.Vector3(-95, 10, 5),
    },
    {
      id: "pits",
      title: "Pit area",
      body: "Allansford / Melbourne side compound. Recent works stripped the pits into one large, safer truck compound with inward-opening track gates.",
      position: new THREE.Vector3(110, 8, 15),
    },
    {
      id: "mtmax",
      title: "Mount Max",
      body: "Signature viewing mound on the south side near Turn 3. Corporate marquees go up here for the Classic and Max’s Race.",
      position: new THREE.Vector3(turns.t3.x - 18, 14, turns.t3.z + 28),
    },
    {
      id: "screen",
      title: "Big screen",
      body: "LED replay screen at the Turn 1 / Turn 2 end of the venue.",
      position: new THREE.Vector3(
        (turns.t1.x + turns.t2.x) / 2 + 22,
        14,
        (turns.t1.z + turns.t2.z) / 2
      ),
    },
    {
      id: "highway",
      title: "Princes Highway",
      body: "A1 Princes Highway — the Allansford approach. Venue address: 10275 Princes Hwy, Allansford VIC 3277.",
      position: new THREE.Vector3(-40, 8, -90),
    },
  ];
}
