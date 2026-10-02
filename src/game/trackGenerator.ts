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
  // Spline function for lateral curve / elevation at any Z
  getTrackCenter: (z: number) => { x: number; y: number; pitch: number; yaw: number };
}

export const LANE_X_COORDS = [-4.5, -1.5, 1.5, 4.5];

export function generateTrackData(
  totalLengthMeters: number,
  themeId: TrackThemeId
): TrackData {
  const theme = TRACK_THEMES[themeId] || TRACK_THEMES.cyber;
  const features: TrackFeature[] = [];

  // Generate ramps, boost pads, and obstacles along the track
  // Avoid placing items right at start (first 100m) or at finish (last 80m)
  const usableStart = 120;
  const usableEnd = totalLengthMeters - 100;
  let currentZ = usableStart;

  while (currentZ < usableEnd) {
    const spacing = 70 + Math.random() * 90; // distance to next feature cluster
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
        width: 2.4,
        length: 8.0,
        height: 0.1,
      });
      // Optionally place a second boost pad in an adjacent lane
      if (Math.random() < 0.3) {
        const otherLane = (lane + 2) % 4;
        features.push({
          type: 'boost_pad',
          z: currentZ + 12,
          lane: otherLane,
          width: 2.4,
          length: 8.0,
          height: 0.1,
        });
      }
    } else if (roll < 0.75) {
      // Airborne Jump Ramp across 1 or 2 lanes
      features.push({
        type: 'ramp',
        z: currentZ,
        lane,
        width: 2.6,
        length: 12.0,
        height: 1.8,
      });
    } else {
      // Road Obstacle (Slow bump / hazard barrier)
      features.push({
        type: 'obstacle',
        z: currentZ,
        lane,
        width: 2.4,
        length: 3.5,
        height: 0.6,
      });
    }
  }

  // Track Curvature and Elevation math
  const getTrackCenter = (z: number) => {
    // Gentle S-curves every 400m
    const wave1 = Math.sin(z * 0.004) * 8;
    const wave2 = Math.cos(z * 0.009) * 3;
    const x = wave1 + wave2;

    // Gentle elevation swells
    const hillWave = Math.sin(z * 0.005) * 1.5;
    const y = Math.max(0, hillWave);

    // Approximate derivatives for rotation
    const dx = Math.cos(z * 0.004) * 8 * 0.004 - Math.sin(z * 0.009) * 3 * 0.009;
    const dy = Math.cos(z * 0.005) * 1.5 * 0.005;

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

// Build Three.js 3D Road Meshes, Curbs, Ramps, Boost Pads, and Scenery
export function buildTrackScene(
  track: TrackData
): {
  group: THREE.Group;
  disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[];
} {
  const group = new THREE.Group();
  const disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[] = [];

  const segmentLength = 20;
  const numSegments = Math.ceil(track.length / segmentLength);

  // Road Surface Geometry
  const roadMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(track.theme.roadColor),
    flatShading: true,
  });
  disposables.push({ material: roadMat });

  const curbMat1 = new THREE.MeshLambertMaterial({
    color: new THREE.Color(track.theme.curbColor1),
    flatShading: true,
  });
  const curbMat2 = new THREE.MeshLambertMaterial({
    color: new THREE.Color(track.theme.curbColor2),
    flatShading: true,
  });
  disposables.push({ material: curbMat1 }, { material: curbMat2 });

  const lineMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(track.theme.roadLinesColor),
  });
  disposables.push({ material: lineMat });

  // Instanced or grouped road plates
  const halfWidth = track.roadWidth / 2;

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

    // Left & Right Curbs
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

  // Boost Pads & Ramps & Obstacles
  const boostGeo = new THREE.BoxGeometry(2.4, 0.08, 6.0);
  const boostMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(track.theme.accentGlowColor),
  });
  disposables.push({ geometry: boostGeo, material: boostMat });

  const rampMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(track.theme.curbColor1),
    flatShading: true,
  });
  disposables.push({ material: rampMat });

  const obstacleGeo = new THREE.BoxGeometry(2.4, 0.6, 2.0);
  const obstacleMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color('#ef4444'),
    flatShading: true,
  });
  disposables.push({ geometry: obstacleGeo, material: obstacleMat });

  track.features.forEach((feat) => {
    const center = track.getTrackCenter(feat.z);
    const laneX = track.lanes[feat.lane];

    if (feat.type === 'boost_pad') {
      const boostMesh = new THREE.Mesh(boostGeo, boostMat);
      boostMesh.position.set(center.x + laneX, center.y + 0.06, feat.z);
      boostMesh.rotation.y = center.yaw;
      boostMesh.rotation.x = center.pitch;
      group.add(boostMesh);
    } else if (feat.type === 'ramp') {
      // Wedge Ramp Geometry
      const rampShape = new THREE.Shape();
      rampShape.moveTo(0, 0);
      rampShape.lineTo(feat.length, feat.height);
      rampShape.lineTo(feat.length, 0);
      rampShape.closePath();

      const extrudeSettings = { depth: feat.width, bevelEnabled: false };
      const rampGeometry = new THREE.ExtrudeGeometry(rampShape, extrudeSettings);
      const rampMesh = new THREE.Mesh(rampGeometry, rampMat);
      rampMesh.rotation.y = Math.PI / 2 + center.yaw;
      rampMesh.position.set(center.x + laneX + feat.width / 2, center.y, feat.z - feat.length / 2);
      group.add(rampMesh);
      disposables.push({ geometry: rampGeometry });
    } else if (feat.type === 'obstacle') {
      const obsMesh = new THREE.Mesh(obstacleGeo, obstacleMat);
      obsMesh.position.set(center.x + laneX, center.y + 0.3, feat.z);
      obsMesh.rotation.y = center.yaw;
      group.add(obsMesh);
    }
  });

  // Finish Line Archway
  const finishZ = track.length - 20;
  const finishCenter = track.getTrackCenter(finishZ);
  const pillarGeo = new THREE.BoxGeometry(1.2, 7, 1.2);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x3b82f6, flatShading: true });
  disposables.push({ geometry: pillarGeo, material: pillarMat });

  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(finishCenter.x - halfWidth - 1.5, finishCenter.y + 3.5, finishZ);
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(finishCenter.x + halfWidth + 1.5, finishCenter.y + 3.5, finishZ);
  group.add(rightPillar);

  const crossbarGeo = new THREE.BoxGeometry(track.roadWidth + 4, 1.5, 1.2);
  const crossbarMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, flatShading: true });
  const crossbar = new THREE.Mesh(crossbarGeo, crossbarMat);
  crossbar.position.set(finishCenter.x, finishCenter.y + 6.8, finishZ);
  group.add(crossbar);
  disposables.push({ geometry: crossbarGeo, material: crossbarMat });

  // Neon FINISH text banner simulation
  const bannerGeo = new THREE.BoxGeometry(track.roadWidth, 1.0, 0.2);
  const bannerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.position.set(finishCenter.x, finishCenter.y + 5.5, finishZ);
  group.add(bannerMesh);
  disposables.push({ geometry: bannerGeo, material: bannerMat });

  // Procedural Scenery along road sides
  buildScenery(track, group, disposables);

  return { group, disposables };
}

function buildScenery(
  track: TrackData,
  group: THREE.Group,
  disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[]
) {
  const sceneryInterval = 40;
  const count = Math.floor(track.length / sceneryInterval);

  if (track.theme.id === 'cyber') {
    // Cyberpunk skyscrapers & neon towers
    const bldgGeo = new THREE.BoxGeometry(14, 45, 14);
    const bldgMat = new THREE.MeshLambertMaterial({ color: 0x090e1a, flatShading: true });
    disposables.push({ geometry: bldgGeo, material: bldgMat });

    const neonWindowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    disposables.push({ material: neonWindowMat });

    for (let i = 0; i < count; i++) {
      const z = i * sceneryInterval + 20;
      const center = track.getTrackCenter(z);
      const side = i % 2 === 0 ? 1 : -1;
      const x = center.x + side * (26 + Math.random() * 15);
      const height = 30 + Math.random() * 40;

      const bldg = new THREE.Mesh(bldgGeo, bldgMat);
      bldg.scale.set(1, height / 45, 1);
      bldg.position.set(x, center.y + height / 2 - 5, z);
      group.add(bldg);

      // Neon accent stripe
      const stripeGeo = new THREE.BoxGeometry(0.4, height * 0.7, 0.4);
      const stripeMesh = new THREE.Mesh(stripeGeo, neonWindowMat);
      stripeMesh.position.set(x - side * 7.1, center.y + height / 2, z);
      group.add(stripeMesh);
      disposables.push({ geometry: stripeGeo });
    }
  } else if (track.theme.id === 'desert') {
    // Canyon rock mesas & boulders
    const rockGeo = new THREE.DodecahedronGeometry(8, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a3412, flatShading: true });
    disposables.push({ geometry: rockGeo, material: rockMat });

    for (let i = 0; i < count; i++) {
      const z = i * sceneryInterval + 20;
      const center = track.getTrackCenter(z);
      const side = i % 2 === 0 ? 1 : -1;
      const x = center.x + side * (22 + Math.random() * 16);
      const scale = 1.0 + Math.random() * 2.2;

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(scale, scale * 1.6, scale);
      rock.position.set(x, center.y + scale * 4, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(rock);
    }
  } else {
    // Sunset Beach: Tropical palms and ocean plane
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.7, 10, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f, flatShading: true });
    const foliageGeo = new THREE.ConeGeometry(4, 5, 5);
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x15803d, flatShading: true });
    disposables.push(
      { geometry: trunkGeo, material: trunkMat },
      { geometry: foliageGeo, material: foliageMat }
    );

    for (let i = 0; i < count; i++) {
      const z = i * sceneryInterval + 20;
      const center = track.getTrackCenter(z);
      const side = i % 2 === 0 ? 1 : -1;
      const x = center.x + side * (18 + Math.random() * 12);

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

    // Ocean Water plane
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
