import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { ORIGIN, localToLatLon, initGeo } from "./geo/project.js";
import { buildWorld } from "./scene/world.js";
import { bindHud } from "./ui.js";

const app = document.getElementById("app");
const loader = document.getElementById("loader");
const loaderStatus = document.getElementById("loader-status");

function showError(err) {
  console.error(err);
  loader.classList.remove("hide");
  const title = loader.querySelector("h1");
  if (title) title.textContent = "Map failed to load";
  if (loaderStatus) {
    loaderStatus.textContent =
      err?.message || String(err) || "Unknown error while starting the 3D map.";
  }
  const bar = loader.querySelector(".bar");
  if (bar) bar.style.display = "none";
}

async function start() {
  await initGeo();

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  app.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8eb7d8);
  scene.fog = new THREE.Fog(0xb7c9db, 280, 980);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.3,
    4000
  );
  camera.position.set(40, 260, 210);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-6, 0.4, -2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 8;
  controls.maxDistance = 620;
  controls.update();

  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  const world = buildWorld(scene, ORIGIN);
  world.setNight(false);

  const hud = bindHud({ world, camera, controls, scene, labelGroup });
  loader.classList.add("hide");

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tooltip = document.getElementById("tooltip");

  renderer.domElement.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(world.track.trackMesh, false)[0];
    if (hit) {
      const { lat, lon } = localToLatLon(hit.point.x, hit.point.z);
      hud.setCoord(`${Math.abs(lat).toFixed(5)}°S ${lon.toFixed(5)}°E`);
      tooltip.hidden = false;
      tooltip.style.left = `${event.clientX}px`;
      tooltip.style.top = `${event.clientY}px`;
      tooltip.textContent = "Clay oval";
    } else {
      tooltip.hidden = true;
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (hud.state.cars) world.update(dt);
    hud.followDriver(dt);
    hud.updateHud();
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  animate();
}

start().catch(showError);
