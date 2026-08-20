import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export function bindHud({
  world,
  camera,
  controls,
  scene,
  labelGroup,
}) {
  const infoTitle = document.getElementById("info-title");
  const infoBody = document.getElementById("info-body");
  const nightBtn = document.getElementById("btn-night");
  const carsBtn = document.getElementById("btn-cars");
  const satBtn = document.getElementById("btn-sat");
  const labelsBtn = document.getElementById("btn-labels");
  const compass = document.getElementById("compass");
  const coord = document.getElementById("coord-readout");

  const state = {
    night: false,
    cars: true,
    satellite: true,
    labels: true,
    view: "aerial",
    followDriver: false,
  };

  const labels = [];
  for (const spot of world.hotspots) {
    const el = document.createElement("div");
    el.className = "label";
    el.textContent = spot.title;
    el.dataset.id = spot.id;
    const obj = new CSS2DObject(el);
    obj.position.copy(spot.position);
    labelGroup.add(obj);
    labels.push({ el, spot });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectSpot(spot);
      flyTo(spot.position.clone().add(new THREE.Vector3(18, 14, 18)), spot.position);
    });
  }

  function selectSpot(spot) {
    infoTitle.textContent = spot.title;
    infoBody.textContent = spot.body;
    for (const l of labels) l.el.classList.toggle("active", l.spot.id === spot.id);
  }

  function flyTo(position, target) {
    state.followDriver = false;
    const startP = camera.position.clone();
    const startT = controls.target.clone();
    const endP = position;
    const endT = target.clone();
    const t0 = performance.now();
    const dur = 1100;
    function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - k) ** 3;
      camera.position.lerpVectors(startP, endP, e);
      controls.target.lerpVectors(startT, endT, e);
      controls.update();
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const views = {
    aerial: () => flyTo(new THREE.Vector3(40, 260, 210), new THREE.Vector3(-6, 0, -2)),
    grandstand: () => flyTo(new THREE.Vector3(-150, 16, 8), new THREE.Vector3(10, 2, 0)),
    mtmax: () => flyTo(new THREE.Vector3(-70, 18, 80), new THREE.Vector3(-6, 2, -2)),
    pits: () => flyTo(new THREE.Vector3(150, 22, 40), new THREE.Vector3(20, 1, 0)),
    t1: () => flyTo(new THREE.Vector3(90, 14, -70), new THREE.Vector3(20, 2, -20)),
    driver: () => {
      state.followDriver = true;
    },
  };

  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.view;
      views[state.view]?.();
    });
  });

  nightBtn.addEventListener("click", () => {
    state.night = !state.night;
    nightBtn.classList.toggle("on", state.night);
    world.setNight(state.night);
  });
  carsBtn.addEventListener("click", () => {
    state.cars = !state.cars;
    carsBtn.classList.toggle("on", state.cars);
    world.setCarsVisible(state.cars);
  });
  satBtn.addEventListener("click", () => {
    state.satellite = !state.satellite;
    satBtn.classList.toggle("on", state.satellite);
    world.setSatelliteVisible(state.satellite);
  });
  labelsBtn.addEventListener("click", () => {
    state.labels = !state.labels;
    labelsBtn.classList.toggle("on", state.labels);
    labelGroup.visible = state.labels;
  });

  function updateHud() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const heading = Math.atan2(dir.x, -dir.z);
    compass.style.transform = `rotate(${-THREE.MathUtils.radToDeg(heading)}deg)`;
  }

  return {
    state,
    labels,
    selectSpot,
    updateHud,
    setCoord(text) {
      coord.textContent = text;
    },
    followDriver(dt) {
      if (!state.followDriver || !world.field.cars[0]) return;
      const car = world.field.cars[0].mesh;
      const back = new THREE.Vector3(0, 2.2, 6.5);
      back.applyQuaternion(car.quaternion);
      camera.position.lerp(car.position.clone().add(back), 1 - Math.pow(0.001, dt));
      controls.target.lerp(car.position.clone().setY(car.position.y + 0.6), 0.15);
    },
  };
}
