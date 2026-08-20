import * as THREE from "three";

const WING_COLOURS = [
  0xe31c23, 0x1c4ea8, 0xf5c400, 0x111111, 0xf4f4f4, 0x1f8a3b, 0xef6b00, 0x6b2d8b,
];

function wheel() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
  );
  tyre.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.34, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.7, roughness: 0.3 })
  );
  rim.rotation.z = Math.PI / 2;
  g.add(tyre, rim);
  return g;
}

export function createSprintcar(colour, number) {
  const car = new THREE.Group();
  car.name = "sprintcar";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colour,
    metalness: 0.35,
    roughness: 0.4,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    metalness: 0.8,
    roughness: 0.25,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 2.15), bodyMat);
  chassis.position.y = 0.38;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.7), bodyMat);
  nose.position.set(0, 0.36, -1.28);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.45), dark);
  tail.position.set(0, 0.4, 1.15);

  const cage = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.04, 6, 12),
    metal
  );
  cage.position.set(0, 0.78, 0.15);
  cage.rotation.x = Math.PI / 2;

  const topWing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 1.05), bodyMat);
  topWing.position.set(0, 1.28, 0.55);
  const wingSideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 1.05), bodyMat);
  wingSideL.position.set(-0.85, 1.1, 0.55);
  const wingSideR = wingSideL.clone();
  wingSideR.position.x = 0.85;

  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.05, 0.38), bodyMat);
  frontWing.position.set(0, 0.28, -1.55);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.7), dark);
  engine.position.set(0, 0.62, -0.35);

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 42px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), 64, 34);
  const numTex = new THREE.CanvasTexture(canvas);
  numTex.colorSpace = THREE.SRGBColorSpace;
  const num = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.35),
    new THREE.MeshBasicMaterial({ map: numTex, transparent: true })
  );
  num.position.set(0, 1.33, 0.55);
  num.rotation.x = -Math.PI / 2;

  const fl = wheel();
  fl.position.set(-0.58, 0.38, -0.85);
  const fr = wheel();
  fr.position.set(0.58, 0.38, -0.85);
  const rl = wheel();
  rl.position.set(-0.62, 0.4, 0.85);
  rl.scale.set(1.15, 1.15, 1.15);
  const rr = wheel();
  rr.position.set(0.62, 0.4, 0.85);
  rr.scale.set(1.15, 1.15, 1.15);

  car.add(
    chassis, nose, tail, cage, topWing, wingSideL, wingSideR,
    frontWing, engine, num, fl, fr, rl, rr
  );
  car.userData.wheels = [fl, fr, rl, rr];
  return car;
}

export function createField(parent, curve, count = 8) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const car = createSprintcar(WING_COLOURS[i % WING_COLOURS.length], [2, 5, 7, 14, 17, 21, 42, 88][i]);
    parent.add(car);
    cars.push({
      mesh: car,
      t: i / count,
      speed: 0.045 + (i % 3) * 0.004,
      lane: (i % 3) * 1.6 - 1.4,
    });
  }
  return {
    cars,
    update(dt) {
      const up = new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3();
      for (const c of this.cars) {
        c.t = (c.t + c.speed * dt) % 1;
        const p = curve.getPointAt(c.t);
        const tan = curve.getTangentAt(c.t).normalize();
        side.crossVectors(up, tan).normalize();
        const pos = p.clone().addScaledVector(side, c.lane);
        c.mesh.position.copy(pos);
        c.mesh.position.y = p.y + 0.05;
        const look = pos.clone().add(tan);
        look.y = pos.y;
        c.mesh.lookAt(look);
        for (const w of c.mesh.userData.wheels) w.rotation.x -= dt * 18;
      }
    },
  };
}
