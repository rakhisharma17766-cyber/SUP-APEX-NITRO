import * as THREE from 'three';

export type TrackThemeId = 'cyber' | 'desert' | 'beach';

export interface TrackThemeConfig {
  id: TrackThemeId;
  name: string;
  skyColor: string;
  fogColor: string;
  ambientColor: string;
  dirLightColor: string;
  roadColor: string;
  roadLinesColor: string;
  curbColor1: string;
  curbColor2: string;
  groundColor: string;
  barrierColor: string;
  accentGlowColor: string;
}

export const TRACK_THEMES: Record<TrackThemeId, TrackThemeConfig> = {
  cyber: {
    id: 'cyber',
    name: 'Neon Cyber City',
    skyColor: '#090d16',
    fogColor: '#0a0f1d',
    ambientColor: '#252044',
    dirLightColor: '#38bdf8',
    roadColor: '#111827',
    roadLinesColor: '#06b6d4',
    curbColor1: '#06b6d4',
    curbColor2: '#f43f5e',
    groundColor: '#030712',
    barrierColor: '#1e1b4b',
    accentGlowColor: '#00f0ff',
  },
  desert: {
    id: 'desert',
    name: 'Desert Canyon',
    skyColor: '#fdba74',
    fogColor: '#ea580c',
    ambientColor: '#7c2d12',
    dirLightColor: '#fed7aa',
    roadColor: '#3f3f46',
    roadLinesColor: '#facc15',
    curbColor1: '#dc2626',
    curbColor2: '#ffffff',
    groundColor: '#9a3412',
    barrierColor: '#78350f',
    accentGlowColor: '#f59e0b',
  },
  beach: {
    id: 'beach',
    name: 'Sunset Beach',
    skyColor: '#fda4af',
    fogColor: '#fb7185',
    ambientColor: '#831843',
    dirLightColor: '#fef08a',
    roadColor: '#334155',
    roadLinesColor: '#ffffff',
    curbColor1: '#0284c7',
    curbColor2: '#f43f5e',
    groundColor: '#0369a1',
    barrierColor: '#0f172a',
    accentGlowColor: '#38bdf8',
  },
};

export interface TrackFeature {
  type: 'ramp' | 'boost_pad' | 'obstacle';
  z: number;
  lane: number; // 0, 1, 2, 3
  width: number;
  length: number;
  height: number;
}

export interface TrackData {
  length: number; // in world units
  lanes: number[]; // x coords for 4 lanes: [-4.5, -1.5, 1.5, 4.5]
  roadWidth: number;
  theme: TrackThemeConfig;
  features: TrackFeature[];
  getTrackCenter: (z: number) => { x: number; y: number; pitch: number; yaw: number };
}

export const LANE_X_COORDS = [4.5, 1.5, -1.5, -4.5];

export function generateTrackData(
  totalLengthMeters: number,
  themeId: TrackThemeId
): TrackData {
  const theme = TRACK_THEMES[themeId] || TRACK_THEMES.cyber;
  const features: TrackFeature[] = [];

  const usableStart = 100;
  const usableEnd = totalLengthMeters - 80;
  let currentZ = usableStart;

  while (currentZ < usableEnd) {
    const spacing = 65 + Math.random() * 75;
    currentZ += spacing;
    if (currentZ >= usableEnd) break;

    const roll = Math.random();
    const lane = Math.floor(Math.random() * 4);

    if (roll < 0.45) {
      // Speed Boost Pad
      features.push({
        type: 'boost_pad',
        z: currentZ,
        lane,
        width: 2.8,
        length: 7.0,
        height: 0.1,
      });
      if (Math.random() < 0.35) {
        const otherLane = (lane + 2) % 4;
        features.push({
          type: 'boost_pad',
          z: currentZ + 10,
          lane: otherLane,
          width: 2.8,
          length: 7.0,
          height: 0.1,
        });
      }
    } else if (roll < 0.78) {
      // Airborne Jump Ramp
      features.push({
        type: 'ramp',
        z: currentZ,
        lane,
        width: 3.0,
        length: 14.0,
        height: 2.2,
      });
    } else {
      // Road Obstacle
      features.push({
        type: 'obstacle',
        z: currentZ,
        lane,
        width: 2.8,
        length: 3.0,
        height: 0.9,
      });
    }
  }

  const getTrackCenter = (z: number) => {
    const wave1 = Math.sin(z * 0.0035) * 8.5;
    const wave2 = Math.cos(z * 0.008) * 3.2;
    const x = wave1 + wave2;

    const hillWave = Math.sin(z * 0.0045) * 1.8;
    const y = Math.max(0, hillWave);

    const dx = Math.cos(z * 0.0035) * 8.5 * 0.0035 - Math.sin(z * 0.008) * 3.2 * 0.008;
    const dy = Math.cos(z * 0.0045) * 1.8 * 0.0045;

    const yaw = -Math.atan2(dx, 1);
    const pitch = Math.atan2(dy, 1);

    return { x, y, pitch, yaw };
  };

  return {
    length: totalLengthMeters,
    lanes: LANE_X_COORDS,
    roadWidth: 14,
    theme,
    features,
    getTrackCenter,
  };
}

export function buildTrackScene(track: TrackData): {
  group: THREE.Group;
  disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[];
} {
  const group = new THREE.Group();
  const disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[] = [];

  const segmentLength = 20;
  const numSegments = Math.ceil(track.length / segmentLength);

  // Road Surface Materials
  const roadMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(track.theme.roadColor),
    flatShading: true,
  });
  const curbMat1 = new THREE.MeshLambertMaterial({
    color: new THREE.Color(track.theme.curbColor1),
    flatShading: true,
  });
  const curbMat2 = new THREE.MeshLambertMaterial({
    color: new THREE.Color(track.theme.curbColor2),
    flatShading: true,
  });
  const lineMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(track.theme.roadLinesColor),
  });

  disposables.push(
    { material: roadMat },
    { material: curbMat1 },
    { material: curbMat2 },
    { material: lineMat }
  );

  const halfWidth = track.roadWidth / 2;

  // Road segments
  for (let i = 0; i < numSegments; i++) {
    const z1 = i * segmentLength;
    const z2 = Math.min((i + 1) * segmentLength, track.length);
    const zMid = (z1 + z2) / 2;
    const len = z2 - z1;
    const center = track.getTrackCenter(zMid);

    // Road Slab
    const roadGeo = new THREE.BoxGeometry(track.roadWidth, 0.4, len);
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(center.x, center.y - 0.2, zMid);
    roadMesh.rotation.y = center.yaw;
    roadMesh.rotation.x = center.pitch;
    roadMesh.receiveShadow = true;
    group.add(roadMesh);
    disposables.push({ geometry: roadGeo });

    // Curbs
    const curbGeo = new THREE.BoxGeometry(0.8, 0.5, len);
    const leftCurb = new THREE.Mesh(curbGeo, i % 2 === 0 ? curbMat1 : curbMat2);
    leftCurb.position.set(center.x - halfWidth - 0.4, center.y - 0.15, zMid);
    leftCurb.rotation.y = center.yaw;
    leftCurb.rotation.x = center.pitch;
    group.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, i % 2 === 0 ? curbMat2 : curbMat1);
    rightCurb.position.set(center.x + halfWidth + 0.4, center.y - 0.15, zMid);
    rightCurb.rotation.y = center.yaw;
    rightCurb.rotation.x = center.pitch;
    group.add(rightCurb);
    disposables.push({ geometry: curbGeo });

    // Lane divider stripes
    for (let l = 1; l < 4; l++) {
      const lineX = -halfWidth + l * 3.5;
      const lineGeo = new THREE.BoxGeometry(0.2, 0.05, len * 0.6);
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.set(center.x + lineX, center.y + 0.03, zMid);
      lineMesh.rotation.y = center.yaw;
      lineMesh.rotation.x = center.pitch;
      group.add(lineMesh);
      disposables.push({ geometry: lineGeo });
    }
  }

  // Feature Materials
  const boostMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(track.theme.accentGlowColor),
  });
  const boostBorderMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  disposables.push({ material: boostMat }, { material: boostBorderMat });

  const rampMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(0xf59e0b), // Vibrant Yellow/Orange Stunt Ramp
    flatShading: true,
  });
  const rampArrowMat = new THREE.MeshBasicMaterial({
    color: 0x111827,
  });
  const rampSideMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(0xd97706),
    flatShading: true,
  });
  disposables.push({ material: rampMat }, { material: rampArrowMat }, { material: rampSideMat });

  const barrierMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(0xef4444),
    flatShading: true,
  });
  const barrierStripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hazardLightMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  disposables.push(
    { material: barrierMat },
    { material: barrierStripeMat },
    { material: hazardLightMat }
  );

  // Generate 3D Meshes for Features
  track.features.forEach((feat) => {
    const center = track.getTrackCenter(feat.z);
    const laneX = track.lanes[feat.lane];

    // ===================================
    // 1. SPEED BOOST PAD
    // ===================================
    if (feat.type === 'boost_pad') {
      const padGroup = new THREE.Group();
      padGroup.position.set(center.x + laneX, center.y + 0.06, feat.z);
      padGroup.rotation.y = center.yaw;
      padGroup.rotation.x = center.pitch;

      const baseGeo = new THREE.BoxGeometry(feat.width, 0.05, feat.length);
      const baseMesh = new THREE.Mesh(baseGeo, boostMat);
      padGroup.add(baseMesh);
      disposables.push({ geometry: baseGeo });

      // Chevron arrows on pad pointing forward (+Z)
      const arrowCount = 3;
      const arrowGeo = new THREE.ConeGeometry(0.65, 1.2, 3);
      arrowGeo.rotateX(Math.PI / 2); // Point flat along ground toward +Z
      for (let a = 0; a < arrowCount; a++) {
        const arrow = new THREE.Mesh(arrowGeo, boostBorderMat);
        arrow.position.set(0, 0.06, (a - 1) * 2.0);
        padGroup.add(arrow);
      }
      disposables.push({ geometry: arrowGeo });

      group.add(padGroup);
    }

    // ===================================
    // 2. REAL 3D AIRBORNE JUMP RAMP
    // ===================================
    else if (feat.type === 'ramp') {
      const rampGroup = new THREE.Group();
      rampGroup.position.set(center.x + laneX, center.y, feat.z);
      rampGroup.rotation.y = center.yaw;
      rampGroup.rotation.x = center.pitch;

      // Construct authentic inclined wedge along Z:
      // Starts at z = -feat.length / 2 with y = 0, rises to z = +feat.length / 2 with y = feat.height
      const rampShape = new THREE.Shape();
      rampShape.moveTo(-feat.length / 2, 0);
      rampShape.lineTo(feat.length / 2, feat.height);
      rampShape.lineTo(feat.length / 2, 0);
      rampShape.closePath();

      const extrudeSettings = { depth: feat.width, bevelEnabled: false };
      const rampGeo = new THREE.ExtrudeGeometry(rampShape, extrudeSettings);
      // Center width
      rampGeo.translate(0, 0, -feat.width / 2);
      // Rotate shape so length is along Z
      rampGeo.rotateY(Math.PI / 2);

      const rampMesh = new THREE.Mesh(rampGeo, rampMat);
      rampGroup.add(rampMesh);
      disposables.push({ geometry: rampGeo });

      // Side guardrails on ramp
      const railGeo = new THREE.BoxGeometry(0.15, feat.height * 0.4, feat.length);
      const leftRail = new THREE.Mesh(railGeo, rampSideMat);
      leftRail.position.set(-feat.width / 2 - 0.08, feat.height * 0.5, 0);
      leftRail.rotation.x = -Math.atan2(feat.height, feat.length);
      rampGroup.add(leftRail);

      const rightRail = new THREE.Mesh(railGeo, rampSideMat);
      rightRail.position.set(feat.width / 2 + 0.08, feat.height * 0.5, 0);
      rightRail.rotation.x = -Math.atan2(feat.height, feat.length);
      rampGroup.add(rightRail);
      disposables.push({ geometry: railGeo });

      // Warning chevron arrows on the inclined face
      const arrowGeo = new THREE.ConeGeometry(0.7, 1.4, 3);
      arrowGeo.rotateX(Math.PI / 2);
      for (let k = 0; k < 3; k++) {
        const arrow = new THREE.Mesh(arrowGeo, rampArrowMat);
        const zProg = (k - 1) * 3.5;
        const yProg = ((zProg + feat.length / 2) / feat.length) * feat.height + 0.05;
        arrow.position.set(0, yProg, zProg);
        arrow.rotation.x = -Math.atan2(feat.height, feat.length);
        rampGroup.add(arrow);
      }
      disposables.push({ geometry: arrowGeo });

      group.add(rampGroup);
    }

    // ===================================
    // 3. ROAD OBSTACLE (HAZARD BARRIER)
    // ===================================
    else if (feat.type === 'obstacle') {
      const obsGroup = new THREE.Group();
      obsGroup.position.set(center.x + laneX, center.y, feat.z);
      obsGroup.rotation.y = center.yaw;
      obsGroup.rotation.x = center.pitch;

      // Heavy barrier concrete base
      const baseGeo = new THREE.BoxGeometry(feat.width, 0.7, 0.8);
      const baseMesh = new THREE.Mesh(baseGeo, barrierMat);
      baseMesh.position.y = 0.35;
      obsGroup.add(baseMesh);
      disposables.push({ geometry: baseGeo });

      // Diagonal hazard warning stripes
      const stripeGeo = new THREE.BoxGeometry(feat.width + 0.05, 0.25, 0.85);
      const stripeMesh = new THREE.Mesh(stripeGeo, barrierStripeMat);
      stripeMesh.position.y = 0.35;
      obsGroup.add(stripeMesh);
      disposables.push({ geometry: stripeGeo });

      // Two blinking warning beacons on top
      const beaconGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
      const leftBeacon = new THREE.Mesh(beaconGeo, hazardLightMat);
      leftBeacon.position.set(-feat.width / 2 + 0.4, 0.85, 0);
      const rightBeacon = new THREE.Mesh(beaconGeo, hazardLightMat);
      rightBeacon.position.set(feat.width / 2 - 0.4, 0.85, 0);
      obsGroup.add(leftBeacon, rightBeacon);
      disposables.push({ geometry: beaconGeo });

      group.add(obsGroup);
    }
  });

  // Finish Line Archway
  const finishZ = track.length - 20;
  const finishCenter = track.getTrackCenter(finishZ);
  const pillarGeo = new THREE.BoxGeometry(1.2, 7.5, 1.2);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x3b82f6, flatShading: true });
  disposables.push({ geometry: pillarGeo, material: pillarMat });

  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(finishCenter.x - halfWidth - 1.5, finishCenter.y + 3.75, finishZ);
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(finishCenter.x + halfWidth + 1.5, finishCenter.y + 3.75, finishZ);
  group.add(rightPillar);

  const crossbarGeo = new THREE.BoxGeometry(track.roadWidth + 4, 1.6, 1.2);
  const crossbarMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, flatShading: true });
  const crossbar = new THREE.Mesh(crossbarGeo, crossbarMat);
  crossbar.position.set(finishCenter.x, finishCenter.y + 7.2, finishZ);
  group.add(crossbar);
  disposables.push({ geometry: crossbarGeo, material: crossbarMat });

  // Finish Line Checkered Banner
  const bannerGeo = new THREE.BoxGeometry(track.roadWidth, 1.2, 0.2);
  const bannerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.position.set(finishCenter.x, finishCenter.y + 5.8, finishZ);
  group.add(bannerMesh);
  disposables.push({ geometry: bannerGeo, material: bannerMat });

  // Procedural Scenery
  buildScenery(track, group, disposables);

  return { group, disposables };
}

function buildScenery(
  track: TrackData,
  group: THREE.Group,
  disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[]
) {
  const sceneryInterval = 35;
  const count = Math.floor(track.length / sceneryInterval);

  if (track.theme.id === 'cyber') {
    const bldgGeo = new THREE.BoxGeometry(14, 45, 14);
    const bldgMat = new THREE.MeshLambertMaterial({ color: 0x090e1a, flatShading: true });
    disposables.push({ geometry: bldgGeo, material: bldgMat });

    const neonWindowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    disposables.push({ material: neonWindowMat });

    for (let i = 0; i < count; i++) {
      const z = i * sceneryInterval + 15;
      const center = track.getTrackCenter(z);
      const side = i % 2 === 0 ? 1 : -1;
      const x = center.x + side * (24 + Math.random() * 12);
      const height = 28 + Math.random() * 38;

      const bldg = new THREE.Mesh(bldgGeo, bldgMat);
      bldg.scale.set(1, height / 45, 1);
      bldg.position.set(x, center.y + height / 2 - 5, z);
      group.add(bldg);

      const stripeGeo = new THREE.BoxGeometry(0.4, height * 0.7, 0.4);
      const stripeMesh = new THREE.Mesh(stripeGeo, neonWindowMat);
      stripeMesh.position.set(x - side * 7.1, center.y + height / 2, z);
      group.add(stripeMesh);
      disposables.push({ geometry: stripeGeo });
    }
  } else if (track.theme.id === 'desert') {
    const rockGeo = new THREE.DodecahedronGeometry(8, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a3412, flatShading: true });
    disposables.push({ geometry: rockGeo, material: rockMat });

    for (let i = 0; i < count; i++) {
      const z = i * sceneryInterval + 15;
      const center = track.getTrackCenter(z);
      const side = i % 2 === 0 ? 1 : -1;
      const x = center.x + side * (22 + Math.random() * 14);
      const scale = 1.0 + Math.random() * 2.0;

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(scale, scale * 1.5, scale);
      rock.position.set(x, center.y + scale * 3.8, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(rock);
    }
  } else {
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.7, 10, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f, flatShading: true });
    const foliageGeo = new THREE.ConeGeometry(4, 5, 5);
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x15803d, flatShading: true });
    disposables.push(
      { geometry: trunkGeo, material: trunkMat },
      { geometry: foliageGeo, material: foliageMat }
    );

    for (let i = 0; i < count; i++) {
      const z = i * sceneryInterval + 15;
      const center = track.getTrackCenter(z);
      const side = i % 2 === 0 ? 1 : -1;
      const x = center.x + side * (18 + Math.random() * 10);

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 5;
      trunk.rotation.z = side * 0.1;
      tree.add(trunk);

      const leaves = new THREE.Mesh(foliageGeo, foliageMat);
      leaves.position.y = 10;
      tree.add(leaves);

      tree.position.set(x, center.y, z);
      group.add(tree);
    }

    const waterGeo = new THREE.PlaneGeometry(600, track.length + 400);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, -2, track.length / 2);
    group.add(waterMesh);
    disposables.push({ geometry: waterGeo, material: waterMat });
  }
}
