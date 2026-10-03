import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TrackData, buildTrackScene } from './trackGenerator';
import { RacerEntity, PhysicsEngine, CollisionEvent } from './physics';
import { createCarModel, updateCarAnimation, disposeCarModel, CarModelInstance } from './carModels';
import { soundSynth } from './audio';
import { BotDriver, updateBotAI } from './aiBots';

export interface HudState {
  speedKmh: number;
  nitroPercent: number;
  playerRank: number;
  playerProgress: number;
  isAirborne: boolean;
  onRamp: boolean;
  slipstreamActive: boolean;
  stunTimer: number;
  racersProgress: { id: string; name: string; color: string; progress: number; isPlayer: boolean }[];
}

interface GameCanvasProps {
  track: TrackData;
  playerEntity: RacerEntity;
  botDrivers: BotDriver[];
  opponentRacersMap: Map<string, RacerEntity>;
  physics: PhysicsEngine;
  inputRef: React.MutableRefObject<{
    throttle: number; // 1: gas, -1: brake, 0: coast
    targetLane: number; // 0..3
    wantsNitro: boolean;
  }>;
  onHudUpdate: (state: HudState) => void;
  onCollisionEvent: (event: CollisionEvent) => void;
  onRaceFinished: () => void;
  countdown: number | null;
  isPaused?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  track,
  playerEntity,
  botDrivers,
  opponentRacersMap,
  physics,
  inputRef,
  onHudUpdate,
  onCollisionEvent,
  onRaceFinished,
  countdown,
  isPaused = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const screenShakeRef = useRef<number>(0);

  // Store stable refs for props used inside RAF to prevent remounting
  const countdownRef = useRef<number | null>(countdown);
  countdownRef.current = countdown;

  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;

  const onCollisionEventRef = useRef(onCollisionEvent);
  onCollisionEventRef.current = onCollisionEvent;

  const onRaceFinishedRef = useRef(onRaceFinished);
  onRaceFinishedRef.current = onRaceFinished;

  const onHudUpdateRef = useRef(onHudUpdate);
  onHudUpdateRef.current = onHudUpdate;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(track.theme.skyColor);
    scene.fog = new THREE.FogExp2(track.theme.fogColor, 0.0035);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.5, 1200);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(track.theme.ambientColor, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(track.theme.dirLightColor, 2.2);
    dirLight.position.set(40, 70, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    scene.add(dirLight);

    // 3. Build Procedural Track Scene
    const trackScene = buildTrackScene(track);
    scene.add(trackScene.group);

    // 4. Car 3D Models Map
    const carModelInstances = new Map<string, CarModelInstance>();

    // Add Player car
    const playerCarModel = createCarModel(playerEntity.carId, playerEntity.color);
    scene.add(playerCarModel.mesh);
    carModelInstances.set(playerEntity.id, playerCarModel);

    // Add Bot cars
    botDrivers.forEach((bot) => {
      const botModel = createCarModel(bot.entity.carId, bot.entity.color);
      scene.add(botModel.mesh);
      carModelInstances.set(bot.entity.id, botModel);
    });

    // 5. Particle System for Nitro Spark Trails
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleLifes = new Float32Array(particleCount);

    const nitroCol = new THREE.Color(0x00f0ff);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3 + 0] = 0;
      particlePositions[i * 3 + 1] = -100;
      particlePositions[i * 3 + 2] = 0;

      particleColors[i * 3 + 0] = nitroCol.r;
      particleColors[i * 3 + 1] = nitroCol.g;
      particleColors[i * 3 + 2] = nitroCol.b;

      particleSizes[i] = 0;
      particleLifes[i] = 0;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const particleMat = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);
    let particleHead = 0;

    const emitNitroParticles = (origin: THREE.Vector3) => {
      const pIdx = particleHead;
      particlePositions[pIdx * 3 + 0] = origin.x + (Math.random() - 0.5) * 0.4;
      particlePositions[pIdx * 3 + 1] = origin.y + 0.3 + (Math.random() - 0.5) * 0.2;
      particlePositions[pIdx * 3 + 2] = origin.z - 1.8;
      particleLifes[pIdx] = 1.0;
      particleHead = (particleHead + 1) % particleCount;
    };

    // 6. Camera Chase Positioning vectors
    const cameraIdealOffset = new THREE.Vector3(0, 5.2, -8.8);
    const cameraIdealLookAt = new THREE.Vector3(0, 1.2, 12);
    const currentCameraPos = new THREE.Vector3(0, 5.2, -8.8);
    const currentCameraLookAt = new THREE.Vector3(0, 1.2, 10);

    const pCenterInit = track.getTrackCenter(playerEntity.currentZ);
    camera.position.set(pCenterInit.x, pCenterInit.y + 6, playerEntity.currentZ - 9);
    camera.lookAt(pCenterInit.x, pCenterInit.y + 1, playerEntity.currentZ + 10);

    // Start Procedural Engine Audio
    soundSynth.startEngine();

    // 7. Render & Simulation Loop
    let lastTime = performance.now();
    let hasAnnouncedFinish = false;
    let hudTimer = 0;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      if (!isPausedRef.current) {
        const canDrive = countdownRef.current === null;
        const currentInput = inputRef.current;

        // A. Update Player Physics
        physics.updateRacer(
          playerEntity,
          currentInput.targetLane,
          canDrive ? currentInput.throttle : 0,
          canDrive && currentInput.wantsNitro,
          canDrive ? delta : 0
        );

        // B. Update AI Bots Physics
        const allRacers: RacerEntity[] = [
          playerEntity,
          ...botDrivers.map((b) => b.entity),
          ...Array.from(opponentRacersMap.values()),
        ];

        botDrivers.forEach((bot) => {
          if (canDrive) {
            const { targetLane, wantsNitro } = updateBotAI(bot, track, allRacers, delta);
            // Bots accelerate with full gas
            physics.updateRacer(bot.entity, targetLane, 1, wantsNitro, delta);
          }
        });

        // C. Inter-Vehicle Bumping and Slipstream Interactions
        physics.resolveVehicleInteractions(allRacers);

        // D. Drain and process collision audio / shake events
        const events = physics.drainCollisionEvents();
        events.forEach((evt) => {
          onCollisionEventRef.current(evt);
          if (evt.victimId === playerEntity.id || evt.instigatorId === playerEntity.id) {
            if (evt.type === 'bump') {
              screenShakeRef.current = 0.5 * evt.intensity;
              soundSynth.playBump(evt.intensity);
            } else if (evt.type === 'boost_pad') {
              soundSynth.playBoostPad();
            } else if (evt.type === 'ramp') {
              soundSynth.playJump();
            } else if (evt.type === 'obstacle') {
              soundSynth.playBump(0.6);
            }
          }
        });

        // E. Update Engine Audio Pitch
        const normalizedSpeed = playerEntity.speed / 50;
        soundSynth.updateEnginePitch(normalizedSpeed);

        // F. Check Race Finish
        if (playerEntity.finished && !hasAnnouncedFinish) {
          hasAnnouncedFinish = true;
          soundSynth.playVictoryFanfare();
          onRaceFinishedRef.current();
        }

        // G. Throttled HUD update (every ~60ms / 16Hz)
        hudTimer += delta;
        if (hudTimer >= 0.06) {
          hudTimer = 0;
          const trackLength = track.length - 20;
          const sorted = [...allRacers].sort((a, b) => b.currentZ - a.currentZ);
          const pRank = sorted.findIndex((r) => r.id === playerEntity.id) + 1;
          const pProgress = Math.min(100, Math.max(0, (playerEntity.currentZ / trackLength) * 100));

          onHudUpdateRef.current({
            speedKmh: Math.round((playerEntity.speed / 60) * 180),
            nitroPercent: Math.round(playerEntity.nitroFuel * 100),
            playerRank: pRank,
            playerProgress: pProgress,
            isAirborne: playerEntity.isAirborne,
            onRamp: playerEntity.onRamp,
            slipstreamActive: playerEntity.slipstreamActive,
            stunTimer: playerEntity.stunTimer,
            racersProgress: sorted.map((r) => ({
              id: r.id,
              name: r.name,
              color: r.color,
              progress: Math.min(100, Math.max(0, (r.currentZ / trackLength) * 100)),
              isPlayer: r.id === playerEntity.id,
            })),
          });
        }
      }

      // 8. Update 3D Car Meshes
      const racersToRender = [
        playerEntity,
        ...botDrivers.map((b) => b.entity),
        ...Array.from(opponentRacersMap.values()),
      ];

      racersToRender.forEach((racer) => {
        let car = carModelInstances.get(racer.id);
        if (!car) {
          car = createCarModel(racer.carId, racer.color);
          scene.add(car.mesh);
          carModelInstances.set(racer.id, car);
        }

        const center = track.getTrackCenter(racer.currentZ);
        const worldX = center.x + racer.currentX;
        const worldY = racer.currentY;
        const worldZ = racer.currentZ;

        car.mesh.position.set(worldX, worldY, worldZ);
        car.mesh.rotation.y = racer.yawAngle;
        car.mesh.rotation.x = racer.pitchAngle;
        car.mesh.rotation.z = racer.rollAngle;

        // Animations: wheels & nitro exhaust
        updateCarAnimation(car, racer.speed, racer.nitroActive, delta);

        // Nitro trail particles
        if (racer.nitroActive && Math.random() < 0.8) {
          emitNitroParticles(new THREE.Vector3(worldX, worldY, worldZ));
        }
      });

      // 9. Update Nitro Trail Particles decay
      for (let i = 0; i < particleCount; i++) {
        if (particleLifes[i] > 0) {
          particleLifes[i] -= delta * 3.5;
          particlePositions[i * 3 + 2] -= 4.0 * delta;
          particlePositions[i * 3 + 1] += 0.4 * delta;
          if (particleLifes[i] <= 0) {
            particlePositions[i * 3 + 1] = -100;
          }
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // 10. 2.5D Isometric Chase Camera Follow
      const pCenter = track.getTrackCenter(playerEntity.currentZ);
      const playerPos = new THREE.Vector3(
        pCenter.x + playerEntity.currentX,
        playerEntity.currentY,
        playerEntity.currentZ
      );

      const targetCamPos = playerPos.clone().add(cameraIdealOffset);
      if (playerEntity.isAirborne) {
        targetCamPos.y += 1.8;
      }
      currentCameraPos.lerp(targetCamPos, 0.14);

      const targetLookAt = playerPos.clone().add(cameraIdealLookAt);
      currentCameraLookAt.lerp(targetLookAt, 0.18);

      // Screen shake
      if (screenShakeRef.current > 0.005) {
        currentCameraPos.x += (Math.random() - 0.5) * screenShakeRef.current * 1.5;
        currentCameraPos.y += (Math.random() - 0.5) * screenShakeRef.current * 1.2;
        screenShakeRef.current *= Math.pow(0.86, delta * 60);
      } else {
        screenShakeRef.current = 0;
      }

      camera.position.copy(currentCameraPos);
      camera.lookAt(currentCameraLookAt);

      // Dynamic FOV widening during Nitro Boost
      const targetFOV = playerEntity.nitroActive ? 74 : 60;
      camera.fov += (targetFOV - camera.fov) * 0.1;
      camera.updateProjectionMatrix();

      // Shadow keylight follows player
      dirLight.position.set(playerPos.x + 30, playerPos.y + 60, playerPos.z + 20);
      dirLight.target.position.copy(playerPos);

      // Render Three.js frame
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      soundSynth.stopEngine();

      carModelInstances.forEach((car) => {
        disposeCarModel(car);
        scene.remove(car.mesh);
      });
      carModelInstances.clear();

      trackScene.disposables.forEach((item) => {
        if (item.geometry) item.geometry.dispose();
        if (item.material) item.material.dispose();
      });
      scene.remove(trackScene.group);

      particleGeo.dispose();
      particleMat.dispose();
      scene.remove(particleSystem);

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [track, playerEntity, botDrivers, opponentRacersMap, physics]);

  return <div ref={mountRef} className="w-full h-full absolute inset-0 select-none overflow-hidden" />;
};
