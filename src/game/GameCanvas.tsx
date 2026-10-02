import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TrackData, buildTrackScene } from './trackGenerator';
import { RacerEntity, PhysicsEngine, CollisionEvent } from './physics';
import { createCarModel, updateCarAnimation, disposeCarModel, CarModelInstance } from './carModels';
import { soundSynth } from './audio';

interface GameCanvasProps {
  track: TrackData;
  racers: RacerEntity[];
  playerEntity: RacerEntity;
  physics: PhysicsEngine;
  onCollisionEvent: (event: CollisionEvent) => void;
  onRaceFinished: () => void;
  isPaused?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  track,
  racers,
  playerEntity,
  physics,
  onCollisionEvent,
  onRaceFinished,
  isPaused = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const screenShakeRef = useRef<number>(0);
  const prevZRef = useRef<number>(0);

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

    // 3. Build Procedural Track
    const trackScene = buildTrackScene(track);
    scene.add(trackScene.group);

    // 4. Car 3D Models Map
    const carModelInstances = new Map<string, CarModelInstance>();

    racers.forEach((racer) => {
      const carModel = createCarModel(racer.carId, racer.color);
      scene.add(carModel.mesh);
      carModelInstances.set(racer.id, carModel);
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

    // Helper to spawn nitro trail particle
    const emitNitroParticles = (origin: THREE.Vector3) => {
      const pIdx = particleHead;
      particlePositions[pIdx * 3 + 0] = origin.x + (Math.random() - 0.5) * 0.4;
      particlePositions[pIdx * 3 + 1] = origin.y + 0.3 + (Math.random() - 0.5) * 0.2;
      particlePositions[pIdx * 3 + 2] = origin.z - 1.8;
      particleLifes[pIdx] = 1.0;
      particleHead = (particleHead + 1) % particleCount;
    };

    // 6. Camera Chase Positioning vectors
    const cameraIdealOffset = new THREE.Vector3(0, 5.0, -8.5);
    const cameraIdealLookAt = new THREE.Vector3(0, 1.2, 12);
    const currentCameraPos = new THREE.Vector3(0, 5, -8.5);
    const currentCameraLookAt = new THREE.Vector3(0, 1, 10);

    // Initial camera placement
    const pCenterInit = track.getTrackCenter(playerEntity.currentZ);
    camera.position.set(pCenterInit.x, pCenterInit.y + 6, playerEntity.currentZ - 9);
    camera.lookAt(pCenterInit.x, pCenterInit.y + 1, playerEntity.currentZ + 10);

    // Start Procedural Engine Audio
    soundSynth.startEngine();

    // 7. Render Loop
    let lastTime = performance.now();
    let hasAnnouncedFinish = false;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      if (!isPaused) {
        // Drain physics collision events
        const events = physics.drainCollisionEvents();
        events.forEach((evt) => {
          onCollisionEvent(evt);
          if (evt.victimId === playerEntity.id || evt.instigatorId === playerEntity.id) {
            if (evt.type === 'bump') {
              screenShakeRef.current = 0.45 * evt.intensity;
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

        // Update Sound Synthesizer Engine Pitch
        const normalizedSpeed = playerEntity.speed / 50;
        soundSynth.updateEnginePitch(normalizedSpeed);

        // Check player race finish
        if (playerEntity.finished && !hasAnnouncedFinish) {
          hasAnnouncedFinish = true;
          soundSynth.playVictoryFanfare();
          onRaceFinished();
        }
      }

      // Update 3D car meshes based on current physics states
      racers.forEach((racer) => {
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

        // Smooth position interpolation
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

      // Update Nitro Trail Particles decay
      for (let i = 0; i < particleCount; i++) {
        if (particleLifes[i] > 0) {
          particleLifes[i] -= delta * 3.5;
          particlePositions[i * 3 + 2] -= 4.0 * delta; // drag backward
          particlePositions[i * 3 + 1] += 0.4 * delta; // slight rise
          if (particleLifes[i] <= 0) {
            particlePositions[i * 3 + 1] = -100;
          }
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // 8. 2.5D Isometric / Chase Camera Follow
      const pCenter = track.getTrackCenter(playerEntity.currentZ);
      const playerPos = new THREE.Vector3(
        pCenter.x + playerEntity.currentX,
        playerEntity.currentY,
        playerEntity.currentZ
      );

      // Camera Offset calculation
      const targetCamPos = playerPos.clone().add(cameraIdealOffset);
      // Lift slightly higher during airborne jumps
      if (playerEntity.isAirborne) {
        targetCamPos.y += 1.5;
      }
      // Follow smoothing LERP
      currentCameraPos.lerp(targetCamPos, 0.12);

      // LookAt target smoothing
      const targetLookAt = playerPos.clone().add(cameraIdealLookAt);
      currentCameraLookAt.lerp(targetLookAt, 0.16);

      // Apply screen shake
      if (screenShakeRef.current > 0.005) {
        currentCameraPos.x += (Math.random() - 0.5) * screenShakeRef.current * 1.5;
        currentCameraPos.y += (Math.random() - 0.5) * screenShakeRef.current * 1.2;
        screenShakeRef.current *= Math.pow(0.88, delta * 60);
      } else {
        screenShakeRef.current = 0;
      }

      camera.position.copy(currentCameraPos);
      camera.lookAt(currentCameraLookAt);

      // Dynamic FOV widening during Nitro Boost
      const targetFOV = playerEntity.nitroActive ? 72 : 60;
      camera.fov += (targetFOV - camera.fov) * 0.1;
      camera.updateProjectionMatrix();

      // Shadow light follows car
      dirLight.position.set(playerPos.x + 30, playerPos.y + 60, playerPos.z + 20);
      dirLight.target.position.copy(playerPos);

      // Render
      renderer.render(scene, camera);
      prevZRef.current = playerEntity.currentZ;
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

    // Cleanup (ZERO MEMORY LEAKS)
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      soundSynth.stopEngine();

      // Dispose car models
      carModelInstances.forEach((car) => {
        disposeCarModel(car);
        scene.remove(car.mesh);
      });
      carModelInstances.clear();

      // Dispose track scene
      trackScene.disposables.forEach((item) => {
        if (item.geometry) item.geometry.dispose();
        if (item.material) item.material.dispose();
      });
      scene.remove(trackScene.group);

      // Dispose particle system
      particleGeo.dispose();
      particleMat.dispose();
      scene.remove(particleSystem);

      // Dispose renderer
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [track, racers, playerEntity, physics, onCollisionEvent, onRaceFinished, isPaused]);

  return <div ref={mountRef} className="w-full h-full absolute inset-0 select-none overflow-hidden" />;
};
