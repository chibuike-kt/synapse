"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePresenceStore } from "@/store/presence-store";

const STATE_INT: Record<string, number> = {
  dormant: -1,
  idle: 0,
  listening: 1,
  thinking: 2,
  speaking: 3,
  processing: 4,
  searching: 5,
  executing: 6,
  alert: 7,
};

export function OrbCore() {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniformsRef = useRef<Record<string, THREE.IUniform>>({
    u_time: { value: 0 },
    u_amplitude: { value: 0 },
    u_energy: { value: 0.5 },
    u_state: { value: 0 },
    u_cameraPos: { value: new THREE.Vector3() },
  });

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.38, 64, 64);
    const mat = new THREE.ShaderMaterial({
      uniforms: uniformsRef.current,
      vertexShader: /* glsl */ `
        uniform float u_time;
        uniform float u_amplitude;
        uniform float u_energy;
        uniform int u_state;

        varying vec3 v_normal;
        varying vec3 v_worldPos;
        varying float v_displacement;

        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }

        float smoothNoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
            f.z);
        }

        void main() {
          vec3 pos = position;
          float breath = sin(u_time * 0.942) * 0.02;
          float noiseVal = smoothNoise(pos * 1.8 + vec3(u_time * 0.12)) * 2.0 - 1.0;
          float dispAmp = 0.03 + u_energy * 0.04 + u_amplitude * 0.06;
          float disp = noiseVal * dispAmp + breath;

          if (u_state == 2) disp += sin(length(pos) * 8.0 - u_time * 3.0) * 0.015;
          if (u_state == 3) disp += u_amplitude * 0.04;

          pos += normal * disp;
          v_displacement = disp;
          v_normal = normalMatrix * normal;
          v_worldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float u_time;
        uniform float u_energy;
        uniform int u_state;
        uniform vec3 u_cameraPos;

        varying vec3 v_normal;
        varying vec3 v_worldPos;
        varying float v_displacement;

        void main() {
          vec3 viewDir = normalize(u_cameraPos - v_worldPos);
          vec3 n = normalize(v_normal);
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, n)), 2.5);

          vec3 base    = vec3(0.76, 0.80, 0.86);
          vec3 fresnelC = vec3(0.92, 0.95, 1.00);
          vec3 color = mix(base, fresnelC, fresnel);

          if (u_state == 3) color = mix(color, vec3(0.95, 0.97, 1.0), u_energy * 0.4);
          if (u_state == 2) color = mix(color, vec3(0.60, 0.65, 0.72), 0.2);

          float highlight = smoothstep(0.02, 0.06, v_displacement);
          color += highlight * 0.12;

          float alpha = fresnel * 0.55 + 0.04;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock, camera }) => {
    const uniforms = uniformsRef.current;
    const store = usePresenceStore.getState();

    uniforms["u_time"]!.value = clock.getElapsedTime();
    uniforms["u_energy"]!.value = store.emotional.energy;
    uniforms["u_state"]!.value = STATE_INT[store.state] ?? 0;
    uniforms["u_cameraPos"]!.value.copy(camera.position);
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}
