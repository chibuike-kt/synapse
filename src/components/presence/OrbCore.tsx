"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePresenceStore } from "@/store/presence-store";

// Ambient backlight — soft sphere glow behind the face
export function OrbCore() {
  const meshRef = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.12, 0.14, 0.18),
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const geo = useMemo(() => new THREE.SphereGeometry(0.72, 32, 32), []);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame(() => {
    const store = usePresenceStore.getState();
    // Pulse opacity slightly with energy
    mat.opacity = 0.1 + store.emotional.energy * 0.12;
  });

  return (
    <mesh ref={meshRef} geometry={geo} material={mat} position={[0, 0, -0.1]} />
  );
}
