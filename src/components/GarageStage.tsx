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
    let isDisposed = false;

    const width = Math.max(container.clientWidth || 400, 100);
    const height = Math.max(container.clientHeight || 300, 100);

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.4, 5.8);
    camera.lookAt(0, 0.55, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    const dom = renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    container.appendChild(dom);

    // Upgraded Studio Stage Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 1.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 3.0);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 2.4);
    rimLight.position.set(-5, 6, -5);
    scene.add(rimLight);

    const spotLight1 = new THREE.SpotLight(0x38bdf8, 4.0, 25, Math.PI / 4, 0.4);
    spotLight1.position.set(4, 7, 4);
    scene.add(spotLight1);

    const spotLight2 = new THREE.SpotLight(0xf43f5e, 3.0, 25, Math.PI / 4, 0.4);
    spotLight2.position.set(-4, 6, -3);
    scene.add(spotLight2);

    const bottomGlow = new THREE.PointLight(0x06b6d4, 2.8, 10);
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
      if (isDisposed) return;
      animId = requestAnimationFrame(animate);
      angle += 0.008;
      carModel.mesh.rotation.y = angle;
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      disposeCarModel(carModel);
      platformGeo.dispose();
      platformMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, [carId, customColor]);

  return <div ref={mountRef} className="w-full h-full relative" />;
};
