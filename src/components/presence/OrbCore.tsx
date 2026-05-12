"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePresenceStore } from "@/store/presence-store";

export function OrbCore() {
  const meshRef = useRef<THREE.Mesh>(null);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.08, 0.1, 0.16),
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const geo = useMemo(() => new THREE.SphereGeometry(1.05, 32, 32), []);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame(() => {
    mat.opacity = 0.14 + usePresenceStore.getState().emotional.energy * 0.14;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geo}
      material={mat}
      position={[0, 0, -0.05]}
    />
  );
}
