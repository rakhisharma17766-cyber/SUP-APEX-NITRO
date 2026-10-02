import * as THREE from 'three';
import { VEHICLES } from './cars';

export interface CarModelInstance {
  mesh: THREE.Group;
  wheels: THREE.Mesh[];
  exhaustPlumes: THREE.Mesh[];
  headlights: THREE.Mesh[];
  disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[];
}

export function createCarModel(
  carId: string,
  customColor?: string
): CarModelInstance {
  const def = VEHICLES[carId] || VEHICLES.red_storm;
  const primaryColor = customColor || def.primaryColor;
  const accentColor = def.accentColor;

  const rootGroup = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const exhaustPlumes: THREE.Mesh[] = [];
  const headlights: THREE.Mesh[] = [];
  const disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[] = [];

  // Common materials
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(primaryColor),
    roughness: 0.35,
    metalness: 0.65,
    flatShading: true,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColor),
    roughness: 0.4,
    metalness: 0.5,
    flatShading: true,
  });
  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.8,
    metalness: 0.2,
    flatShading: true,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.85,
    flatShading: true,
  });
  const wheelRubberMat = new THREE.MeshLambertMaterial({
    color: 0x1f242d,
    flatShading: true,
  });
  const wheelRimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.8,
    roughness: 0.2,
    flatShading: true,
  });
  const headlightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const nitroFlameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.9,
  });

  disposables.push(
    { material: bodyMat },
    { material: accentMat },
    { material: blackMat },
    { material: glassMat },
    { material: wheelRubberMat },
    { material: wheelRimMat },
    { material: headlightMat },
    { material: nitroFlameMat }
  );

  // Helper to add wheel assembly
  const addWheel = (x: number, y: number, z: number, radius = 0.55, width = 0.45) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(x, y, z);

    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 12);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, wheelRubberMat);
    wheelGroup.add(tire);
    disposables.push({ geometry: tireGeo });

    const rimGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, wheelRimMat);
    wheelGroup.add(rim);
    disposables.push({ geometry: rimGeo });

    rootGroup.add(wheelGroup);
    wheels.push(tire); // For rotation animation
  };

  // Helper to add exhaust flames
  const addExhaust = (x: number, y: number, z: number) => {
    const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.35, 8);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, blackMat);
    nozzle.position.set(x, y, z);
    rootGroup.add(nozzle);
    disposables.push({ geometry: nozzleGeo });

    // Flame cone
    const flameGeo = new THREE.ConeGeometry(0.18, 1.2, 8);
    flameGeo.rotateX(-Math.PI / 2);
    const flame = new THREE.Mesh(flameGeo, nitroFlameMat);
    flame.position.set(x, y, z - 0.7);
    flame.scale.set(0.001, 0.001, 0.001); // hidden by default
    rootGroup.add(flame);
    exhaustPlumes.push(flame);
    disposables.push({ geometry: flameGeo });
  };

  // ==========================================
  // CAR 1: "RED STORM F1"
  // ==========================================
  if (carId === 'red_storm') {
    // Narrow Main Monocoque
    const monoGeo = new THREE.BoxGeometry(1.0, 0.45, 3.4);
    const monocoque = new THREE.Mesh(monoGeo, bodyMat);
    monocoque.position.set(0, 0.45, 0);
    rootGroup.add(monocoque);
    disposables.push({ geometry: monoGeo });

    // Tapered Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.5, 1.4, 6);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.35, 2.3);
    rootGroup.add(nose);
    disposables.push({ geometry: noseGeo });

    // Front Wing
    const fWingGeo = new THREE.BoxGeometry(2.4, 0.08, 0.6);
    const fWing = new THREE.Mesh(fWingGeo, blackMat);
    fWing.position.set(0, 0.25, 2.8);
    rootGroup.add(fWing);
    disposables.push({ geometry: fWingGeo });

    // Sidepods (Air Intakes)
    const podGeo = new THREE.BoxGeometry(0.5, 0.4, 1.6);
    const leftPod = new THREE.Mesh(podGeo, bodyMat);
    leftPod.position.set(-0.7, 0.4, -0.1);
    const rightPod = new THREE.Mesh(podGeo, bodyMat);
    rightPod.position.set(0.7, 0.4, -0.1);
    rootGroup.add(leftPod, rightPod);
    disposables.push({ geometry: podGeo });

    // Cockpit & Halo
    const cockpitGeo = new THREE.BoxGeometry(0.65, 0.3, 0.9);
    const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
    cockpit.position.set(0, 0.72, 0.2);
    rootGroup.add(cockpit);
    disposables.push({ geometry: cockpitGeo });

    // Airbox Scoop above driver
    const scoopGeo = new THREE.BoxGeometry(0.35, 0.35, 0.8);
    const scoop = new THREE.Mesh(scoopGeo, accentMat);
    scoop.position.set(0, 0.85, -0.5);
    rootGroup.add(scoop);
    disposables.push({ geometry: scoopGeo });

    // Tall Rear Wing & Endplates
    const rWingGeo = new THREE.BoxGeometry(2.2, 0.1, 0.7);
    const rWing = new THREE.Mesh(rWingGeo, accentMat);
    rWing.position.set(0, 1.15, -1.7);
    rootGroup.add(rWing);
    disposables.push({ geometry: rWingGeo });

    const strutGeo = new THREE.BoxGeometry(0.08, 0.7, 0.4);
    const leftStrut = new THREE.Mesh(strutGeo, blackMat);
    leftStrut.position.set(-0.4, 0.8, -1.6);
    const rightStrut = new THREE.Mesh(strutGeo, blackMat);
    rightStrut.position.set(0.4, 0.8, -1.6);
    rootGroup.add(leftStrut, rightStrut);
    disposables.push({ geometry: strutGeo });

    // Wheels (Exposed F1 Style)
    addWheel(-1.15, 0.5, 1.5, 0.5, 0.45);
    addWheel(1.15, 0.5, 1.5, 0.5, 0.45);
    addWheel(-1.25, 0.6, -1.3, 0.6, 0.55);
    addWheel(1.25, 0.6, -1.3, 0.6, 0.55);

    // Dual Exhaust
    addExhaust(-0.25, 0.45, -1.75);
    addExhaust(0.25, 0.45, -1.75);
  }

  // ==========================================
  // CAR 2: "CYBER BEAST"
  // ==========================================
  else if (carId === 'cyber_beast') {
    // Angular Cyber Body
    const mainBodyGeo = new THREE.BoxGeometry(2.0, 0.7, 3.6);
    const mainBody = new THREE.Mesh(mainBodyGeo, bodyMat);
    mainBody.position.set(0, 0.65, 0);
    rootGroup.add(mainBody);
    disposables.push({ geometry: mainBodyGeo });

    // Faceted Slanted Cabin
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.6, 1.8);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.25, -0.2);
    rootGroup.add(cabin);
    disposables.push({ geometry: cabinGeo });

    // Reinforced Ramming Cowl / Bullbar
    const bullbarGeo = new THREE.BoxGeometry(2.2, 0.45, 0.5);
    const bullbar = new THREE.Mesh(bullbarGeo, blackMat);
    bullbar.position.set(0, 0.5, 1.95);
    rootGroup.add(bullbar);
    disposables.push({ geometry: bullbarGeo });

    // Armored Fender Flares
    const fenderGeo = new THREE.BoxGeometry(0.25, 0.5, 1.1);
    const fL = new THREE.Mesh(fenderGeo, blackMat);
    fL.position.set(-1.08, 0.55, 1.2);
    const fR = new THREE.Mesh(fenderGeo, blackMat);
    fR.position.set(1.08, 0.55, 1.2);
    const rL = new THREE.Mesh(fenderGeo, blackMat);
    rL.position.set(-1.08, 0.55, -1.2);
    const rR = new THREE.Mesh(fenderGeo, blackMat);
    rR.position.set(1.08, 0.55, -1.2);
    rootGroup.add(fL, fR, rL, rR);
    disposables.push({ geometry: fenderGeo });

    // Heavy Roof Lightbar
    const lightBarGeo = new THREE.BoxGeometry(1.3, 0.12, 0.2);
    const lightBar = new THREE.Mesh(lightBarGeo, headlightMat);
    lightBar.position.set(0, 1.58, 0.6);
    rootGroup.add(lightBar);
    headlights.push(lightBar);
    disposables.push({ geometry: lightBarGeo });

    // Heavy Industrial Wheels
    addWheel(-1.05, 0.6, 1.2, 0.6, 0.5);
    addWheel(1.05, 0.6, 1.2, 0.6, 0.5);
    addWheel(-1.05, 0.65, -1.2, 0.65, 0.55);
    addWheel(1.05, 0.65, -1.2, 0.65, 0.55);

    // Quad Heavy Exhausts
    addExhaust(-0.55, 0.5, -1.85);
    addExhaust(-0.2, 0.5, -1.85);
    addExhaust(0.2, 0.5, -1.85);
    addExhaust(0.55, 0.5, -1.85);
  }

  // ==========================================
  // CAR 3: "NITRO APEX"
  // ==========================================
  else {
    // Sleek Hypercar Fuselage
    const fuseGeo = new THREE.BoxGeometry(1.85, 0.5, 3.8);
    const fuse = new THREE.Mesh(fuseGeo, bodyMat);
    fuse.position.set(0, 0.55, 0);
    rootGroup.add(fuse);
    disposables.push({ geometry: fuseGeo });

    // Aerodynamic Teardrop Cockpit Bubble
    const bubbleGeo = new THREE.SphereGeometry(0.85, 12, 8);
    bubbleGeo.scale(0.9, 0.55, 1.8);
    const bubble = new THREE.Mesh(bubbleGeo, glassMat);
    bubble.position.set(0, 0.85, 0.1);
    rootGroup.add(bubble);
    disposables.push({ geometry: bubbleGeo });

    // Front Splitter with Neon Accents
    const splitterGeo = new THREE.BoxGeometry(2.0, 0.08, 0.8);
    const splitter = new THREE.Mesh(splitterGeo, blackMat);
    splitter.position.set(0, 0.22, 1.85);
    rootGroup.add(splitter);
    disposables.push({ geometry: splitterGeo });

    // Twin Cylindrical Jet Rocket Thrusters on Rear
    const jetGeo = new THREE.CylinderGeometry(0.3, 0.35, 1.4, 12);
    jetGeo.rotateX(Math.PI / 2);
    const leftJet = new THREE.Mesh(jetGeo, accentMat);
    leftJet.position.set(-0.5, 0.7, -1.4);
    const rightJet = new THREE.Mesh(jetGeo, accentMat);
    rightJet.position.set(0.5, 0.7, -1.4);
    rootGroup.add(leftJet, rightJet);
    disposables.push({ geometry: jetGeo });

    // Jet Aperture Rings (Glowing Cyan)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ringGeo = new THREE.TorusGeometry(0.32, 0.06, 8, 16);
    const leftRing = new THREE.Mesh(ringGeo, ringMat);
    leftRing.position.set(-0.5, 0.7, -2.1);
    const rightRing = new THREE.Mesh(ringGeo, ringMat);
    rightRing.position.set(0.5, 0.7, -2.1);
    rootGroup.add(leftRing, rightRing);
    disposables.push({ geometry: ringGeo, material: ringMat });

    // Extended High-Downforce Rear Diffuser & Wing
    const wingGeo = new THREE.BoxGeometry(2.3, 0.08, 0.6);
    const wing = new THREE.Mesh(wingGeo, blackMat);
    wing.position.set(0, 1.1, -1.8);
    rootGroup.add(wing);
    disposables.push({ geometry: wingGeo });

    // Hypercar Wheels
    addWheel(-0.98, 0.52, 1.3, 0.52, 0.45);
    addWheel(0.98, 0.52, 1.3, 0.52, 0.45);
    addWheel(-1.02, 0.58, -1.2, 0.58, 0.5);
    addWheel(1.02, 0.58, -1.2, 0.58, 0.5);

    // Twin High-Power Nitro Thruster Plumes
    addExhaust(-0.5, 0.7, -2.1);
    addExhaust(0.5, 0.7, -2.1);
  }

  // Forward Headlights
  const headGeo = new THREE.BoxGeometry(0.35, 0.12, 0.1);
  const leftHead = new THREE.Mesh(headGeo, headlightMat);
  leftHead.position.set(-0.65, 0.55, 1.85);
  const rightHead = new THREE.Mesh(headGeo, headlightMat);
  rightHead.position.set(0.65, 0.55, 1.85);
  rootGroup.add(leftHead, rightHead);
  headlights.push(leftHead, rightHead);
  disposables.push({ geometry: headGeo });

  return {
    mesh: rootGroup,
    wheels,
    exhaustPlumes,
    headlights,
    disposables,
  };
}

export function updateCarAnimation(
  car: CarModelInstance,
  speed: number, // units/sec
  nitroActive: boolean,
  delta: number
) {
  // Rotate wheels proportional to ground speed
  const wheelAngularVelocity = speed * 1.8 * delta;
  car.wheels.forEach((w) => {
    w.rotation.x += wheelAngularVelocity;
  });

  // Animate Nitro Exhaust Flames
  const targetScale = nitroActive ? 1.0 + Math.random() * 0.35 : 0.001;
  car.exhaustPlumes.forEach((flame) => {
    flame.scale.lerp(new THREE.Vector3(targetScale, targetScale * (nitroActive ? 1.4 : 1), targetScale), 0.25);
  });
}

export function disposeCarModel(car: CarModelInstance) {
  car.disposables.forEach((item) => {
    if (item.geometry) item.geometry.dispose();
    if (item.material) item.material.dispose();
  });
}
