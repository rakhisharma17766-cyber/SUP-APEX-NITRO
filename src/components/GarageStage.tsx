import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createCarModel, disposeCarModel, CarModelInstance } from '../game/carModels';

interface GarageStageProps {
  carId: string;
  customColor?: string;
}

export const GarageStage: React.FC<GarageStageProps> = ({ carId, customColor }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animId: number;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();
    scene.background = null; // Transparent background for glassmorphism integration

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 5.8);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // Stage Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const spotLight1 = new THREE.SpotLight(0x38bdf8, 3.5, 20, Math.PI / 4, 0.5);
    spotLight1.position.set(4, 6, 4);
    scene.add(spotLight1);

    const spotLight2 = new THREE.SpotLight(0xf43f5e, 2.5, 20, Math.PI / 4, 0.5);
    spotLight2.position.set(-4, 5, -3);
    scene.add(spotLight2);

    const bottomGlow = new THREE.PointLight(0x06b6d4, 2, 8);
    bottomGlow.position.set(0, 0.1, 0);
    scene.add(bottomGlow);

    // Turntable Platform
    const platformGeo = new THREE.CylinderGeometry(2.4, 2.6, 0.2, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.1;
    scene.add(platform);

    const ringGeo = new THREE.RingGeometry(2.2, 2.35, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Car Model
    const carModel: CarModelInstance = createCarModel(carId, customColor);
    carModel.mesh.position.y = 0.05;
    scene.add(carModel.mesh);

    // Rotate Turntable Animation
    let angle = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      angle += 0.008;
      carModel.mesh.rotation.y = angle;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      disposeCarModel(carModel);
      platformGeo.dispose();
      platformMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [carId, customColor]);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
};
