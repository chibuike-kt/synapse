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

const PARTICLE_COUNT = 8000;

// Fibonacci sphere — evenly distributed points on sphere surface
function fibonacciSphere(count: number, radius: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    positions[i * 3 + 0] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return positions;
}

export function WaveSphere() {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, geometry, material } = useMemo(() => {
    const basePositions = fibonacciSphere(PARTICLE_COUNT, 1.15);

    // Per-particle attributes
    const phases = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const colorSeeds = new Float32Array(PARTICLE_COUNT);
    const layers = new Float32Array(PARTICLE_COUNT); // 0=surface, 1=inner

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 1.5 + Math.random() * 3.5;
      colorSeeds[i] = Math.random();

      // 85% surface particles, 15% inner depth layer
      layers[i] = Math.random() < 0.15 ? 1.0 : 0.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(basePositions.slice(), 3),
    );
    geo.setAttribute("a_base", new THREE.BufferAttribute(basePositions, 3));
    geo.setAttribute("a_phase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("a_size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("a_colorSeed", new THREE.BufferAttribute(colorSeeds, 1));
    geo.setAttribute("a_layer", new THREE.BufferAttribute(layers, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_amplitude: { value: 0 },
        u_energy: { value: 0.5 },
        u_state: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3  a_base;
        attribute float a_phase;
        attribute float a_size;
        attribute float a_colorSeed;
        attribute float a_layer;

        uniform float u_time;
        uniform float u_amplitude;
        uniform float u_energy;
        uniform int   u_state;

        varying float v_colorSeed;
        varying float v_alpha;
        varying float v_rim;
        varying float v_layer;
        varying float v_dispStrength;

        // Simplex-style noise
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f*f*(3.0-2.0*f);
          float n = i.x + i.y*57.0 + i.z*113.0;
          return mix(
            mix(mix(hash(n),      hash(n+1.0),   f.x),
                mix(hash(n+57.0), hash(n+58.0),  f.x), f.y),
            mix(mix(hash(n+113.0),hash(n+114.0), f.x),
                mix(hash(n+170.0),hash(n+171.0), f.x), f.y),
            f.z);
        }
        float fbm(vec3 p) {
          return noise(p)*0.5 + noise(p*2.1)*0.25 + noise(p*4.3)*0.125;
        }

        void main() {
          vec3 base = a_base;
          vec3 dir  = normalize(base);
          float t   = u_time;
          float ph  = a_phase;

          // Inner layer particles — smaller radius, dimmer
          float radius = a_layer > 0.5 ? 0.72 : 1.0;

          // State-driven wave displacement
          float waveAmp = 0.0;
          float waveFreq = 1.0;
          float waveSpeed = 1.0;

          if (u_state == -1) { waveAmp = 0.015; waveFreq = 1.2; waveSpeed = 0.4; }
          else if (u_state == 0) { waveAmp = 0.08 + u_energy*0.03;  waveFreq = 1.5; waveSpeed = 0.7; }
          else if (u_state == 1) { waveAmp = 0.07 + u_energy*0.04;  waveFreq = 2.0; waveSpeed = 1.2; }
          else if (u_state == 2) { waveAmp = 0.12 + u_energy*0.06;  waveFreq = 2.8; waveSpeed = 1.8; }
          else if (u_state == 3) { waveAmp = 0.10 + u_amplitude*0.18 + u_energy*0.05; waveFreq = 2.2; waveSpeed = 2.5; }
          else if (u_state == 4) { waveAmp = 0.09 + u_energy*0.04;  waveFreq = 3.5; waveSpeed = 3.8; }
          else if (u_state == 5) { waveAmp = 0.10 + u_energy*0.05;  waveFreq = 1.8; waveSpeed = 1.4; }
          else if (u_state == 7) { waveAmp = 0.16 + u_energy*0.08;  waveFreq = 4.0; waveSpeed = 5.0; }

          // Layered noise displacement
          float n1 = fbm(dir * waveFreq + vec3(t * waveSpeed * 0.18));
          float n2 = fbm(dir * waveFreq * 2.5 + vec3(t * waveSpeed * 0.28 + ph));
          float displacement = (n1 * 0.65 + n2 * 0.35) * waveAmp;

          // Breathing
          float breath = sin(t * 0.94 + ph) * 0.012;
          displacement += breath;

          // Rim particles — scattered outward for turbulent edge
          // Detect rim: particles near the equator of view (approx by base.z)
          float rimFactor = 1.0 - abs(dir.z);
          rimFactor = pow(rimFactor, 2.5);

          // Extra scatter at rim
          float rimScatter = rimFactor * (0.08 + u_energy * 0.06);
          float scatterNoise = fbm(dir * 5.0 + vec3(t * 0.5 + ph * 3.0));
          rimScatter *= scatterNoise;

          vec3 pos = dir * (radius * 1.15 + displacement + rimScatter);

          v_colorSeed  = a_colorSeed;
          v_rim        = rimFactor;
          v_layer      = a_layer;
          v_dispStrength = clamp(displacement / (waveAmp + 0.001), 0.0, 1.0);

          // Alpha — rim particles more visible, inner layer dimmer
          float baseAlpha = a_layer > 0.5 ? 0.25 : 0.82;
          float rimBoost  = rimFactor * 0.3;
          v_alpha = clamp(baseAlpha + rimBoost, 0.0, 1.0);

          // Point size — rim and displaced particles larger
          float sz = a_size * (1.0 + rimFactor * 1.8 + v_dispStrength * 0.8);
          if (a_layer > 0.5) sz *= 0.55;

          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_Position   = projectionMatrix * mvPos;
          gl_PointSize  = sz * (280.0 / -mvPos.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float u_time;
        uniform float u_energy;
        uniform int   u_state;

        varying float v_colorSeed;
        varying float v_alpha;
        varying float v_rim;
        varying float v_layer;
        varying float v_dispStrength;

        void main() {
          // Soft circular particle
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float soft = 1.0 - smoothstep(0.15, 0.5, dist);

          // Color gradient by seed — matches reference image arc
          // seed 0.0→0.25 : cyan/blue (top)
          // seed 0.25→0.55: purple/violet
          // seed 0.55→0.75: magenta/pink (left)
          // seed 0.75→1.0 : red/orange/yellow (bottom)
          vec3 cyan    = vec3(0.10, 0.85, 1.00);
          vec3 blue    = vec3(0.20, 0.40, 1.00);
          vec3 violet  = vec3(0.55, 0.15, 1.00);
          vec3 magenta = vec3(0.95, 0.10, 0.75);
          vec3 red     = vec3(1.00, 0.08, 0.20);
          vec3 orange  = vec3(1.00, 0.45, 0.05);
          vec3 yellow  = vec3(1.00, 0.85, 0.10);

          vec3 color;
          float s = v_colorSeed;
          if (s < 0.18)
            color = mix(cyan,    blue,    s / 0.18);
          else if (s < 0.38)
            color = mix(blue,    violet,  (s-0.18) / 0.20);
          else if (s < 0.55)
            color = mix(violet,  magenta, (s-0.38) / 0.17);
          else if (s < 0.70)
            color = mix(magenta, red,     (s-0.55) / 0.15);
          else if (s < 0.85)
            color = mix(red,     orange,  (s-0.70) / 0.15);
          else
            color = mix(orange,  yellow,  (s-0.85) / 0.15);

          // State color shifts — overlay tint
          if (u_state == 2) color = mix(color, vec3(0.4, 0.1, 1.0), 0.30);
          if (u_state == 3) color = mix(color, vec3(0.2, 0.9, 1.0), v_dispStrength * 0.40);
          if (u_state == 5) color = mix(color, vec3(0.0, 0.8, 1.0), 0.25);
          if (u_state == 7) color = mix(color, vec3(1.0, 0.2, 0.0), 0.50);

          // Rim particles get boosted brightness
          color *= (1.0 + v_rim * 0.7);

          // Inner layer — dimmer, more blue
          if (v_layer > 0.5) {
            color = mix(color, vec3(0.1, 0.2, 0.6), 0.5);
          }

          float alpha = soft * v_alpha * 1.8;
          alpha = clamp(alpha, 0.0, 1.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    return { positions: basePositions, geometry: geo, material: mat };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }) => {
    const store = usePresenceStore.getState();
    material.uniforms["u_time"]!.value = clock.getElapsedTime();
    material.uniforms["u_energy"]!.value = store.emotional.energy;
    material.uniforms["u_state"]!.value = STATE_INT[store.state] ?? 0;

    const cur = material.uniforms["u_amplitude"]!.value as number;
    material.uniforms["u_amplitude"]!.value = cur * 0.9;
  });

  return <points ref={meshRef} geometry={geometry} material={material} />;
}
