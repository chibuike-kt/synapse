"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePresenceStore } from "@/store/presence-store";
import { generateFaceParticlePositions } from "@/lib/face-geometry";
import { getTierConfig } from "@/lib/hardware-tier";

// State int encoding for shader
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

const TRANSITION_SPEED = 2.5; // blend units per second

export function ParticleField() {
  const config = useMemo(() => getTierConfig(), []);
  const count = config.particleCount;

  // Geometry refs — never in React state
  const meshRef = useRef<THREE.Points>(null);
  const uniformsRef = useRef<Record<string, THREE.IUniform>>({
    u_time: { value: 0 },
    u_amplitude: { value: 0 },
    u_energy: { value: 0.5 },
    u_stateBlend: { value: 1.0 },
    u_state: { value: 0 },
    u_confidence: { value: 0.8 },
  });

  // Current positions — mutated each frame by drift logic
  const currentPositions = useRef<Float32Array | null>(null);
  const restPositions = useRef<Float32Array | null>(null);
  const velocities = useRef<Float32Array | null>(null);

  // Particle geometry — built once
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const restPos = generateFaceParticlePositions(count);
    const currentPos = restPos.slice(); // start at rest

    // Per-particle random attributes
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const indices = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 1.2 + Math.random() * 1.8;
      indices[i] = i;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(currentPos, 3));
    geo.setAttribute(
      "a_restPosition",
      new THREE.BufferAttribute(restPos.slice(), 3),
    );
    geo.setAttribute("a_phase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("a_size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("a_particleIndex", new THREE.BufferAttribute(indices, 1));

    restPositions.current = restPos;
    currentPositions.current = currentPos;
    velocities.current = new Float32Array(count * 3);

    return geo;
  }, [count]);

  // Shader material — built once
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: uniformsRef.current,
      vertexShader: /* glsl */ `
        uniform float u_time;
        uniform float u_amplitude;
        uniform float u_energy;
        uniform float u_stateBlend;
        uniform int u_state;
        uniform float u_confidence;

        attribute float a_phase;
        attribute float a_size;

        varying float v_distToCenter;
        varying float v_energy;
        varying float v_alpha;

        void main() {
          vec3 pos = position;

          float breathAmp = 0.012 + u_energy * 0.018;
          float breath = sin(u_time * 0.942 + a_phase) * breathAmp;

          float stateDisplace = 0.0;
          if (u_state == 1) stateDisplace = -0.015 * u_stateBlend;
          else if (u_state == 2) stateDisplace = sin(u_time * 2.1 + a_phase * 3.14) * 0.025 * u_stateBlend;
          else if (u_state == 3) stateDisplace = u_amplitude * 0.08 * u_stateBlend;
          else if (u_state == 4) stateDisplace = sin(u_time * 4.2 + a_phase * 6.28) * 0.02 * u_stateBlend;
          else if (u_state == 5) stateDisplace = sin(u_time * 1.8 + a_phase * 6.28) * 0.03 * u_stateBlend;

          vec3 dir = normalize(pos);
          pos += dir * (breath + stateDisplace);

          float jitter = 0.002 + u_energy * 0.004;
          pos.x += sin(u_time * 3.7 + a_phase * 12.0) * jitter;
          pos.y += cos(u_time * 2.9 + a_phase * 8.0) * jitter;
          pos.z += sin(u_time * 4.1 + a_phase * 15.0) * jitter * 0.5;

          v_distToCenter = length(pos);
          v_energy = u_energy;

          float distFade = 1.0 - smoothstep(0.6, 1.4, v_distToCenter);
          v_alpha = (0.55 + u_confidence * 0.35) * distFade;

          float sz = a_size * (1.0 + u_energy * 0.4) * (1.0 + u_amplitude * 0.6);
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = sz * (300.0 / -mvPos.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float u_time;
        uniform float u_energy;
        uniform int u_state;

        varying float v_distToCenter;
        varying float v_energy;
        varying float v_alpha;

        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;

          float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * v_alpha;

          vec3 core  = vec3(0.94, 0.96, 1.00);
          vec3 edge  = vec3(0.66, 0.73, 0.82);
          vec3 speak = vec3(0.97, 0.98, 1.00);
          vec3 seek  = vec3(0.72, 0.82, 0.94);

          vec3 color = mix(core, edge, dist * 2.0);

          if (u_state == 3) color = mix(color, speak, v_energy * 0.6);
          if (u_state == 5) color = mix(color, seek, 0.4);
          if (dist < 0.15) color = mix(color, vec3(1.0), v_energy * 0.4);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Cleanup on unmount — explicit disposal
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ clock }, delta) => {
    const uniforms = uniformsRef.current;
    const store = usePresenceStore.getState();

    // Update time uniform
    uniforms["u_time"]!.value = clock.getElapsedTime();

    // Advance transition blend
    const currentBlend = uniforms["u_stateBlend"]!.value as number;
    if (currentBlend < 1.0) {
      const newBlend = Math.min(1.0, currentBlend + delta * TRANSITION_SPEED);
      uniforms["u_stateBlend"]!.value = newBlend;
      usePresenceStore.getState().setTransitionProgress(newBlend);
    }

    // Sync FSM state to shader
    uniforms["u_state"]!.value = STATE_INT[store.state] ?? 0;
    uniforms["u_energy"]!.value = store.emotional.energy;
    uniforms["u_confidence"]!.value = store.emotional.confidence;

    // Reset blend on state change detection
    if (store.transitionProgress === 0) {
      uniforms["u_stateBlend"]!.value = 0;
    }

    // Drift particles toward rest positions — spring force
    const pos = currentPositions.current;
    const rest = restPositions.current;
    const vel = velocities.current;

    if (pos && rest && vel && meshRef.current) {
      const stiffness = 0.8 + store.emotional.urgency * 0.4;
      const damping = 0.85;

      for (let i = 0; i < count; i++) {
        const ix = i * 3,
          iy = i * 3 + 1,
          iz = i * 3 + 2;

        // Spring toward rest
        const dx = rest[ix]! - pos[ix]!;
        const dy = rest[iy]! - pos[iy]!;
        const dz = rest[iz]! - pos[iz]!;

        vel[ix] = (vel[ix]! + dx * stiffness * delta) * damping;
        vel[iy] = (vel[iy]! + dy * stiffness * delta) * damping;
        vel[iz] = (vel[iz]! + dz * stiffness * delta) * damping;

        pos[ix] = pos[ix]! + vel[ix]!;
        pos[iy] = pos[iy]! + vel[iy]!;
        pos[iz] = pos[iz]! + vel[iz]!;
      }

      const posAttr = meshRef.current.geometry.attributes[
        "position"
      ] as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
    }
  });

  return <points ref={meshRef} geometry={geometry} material={material} />;
}
