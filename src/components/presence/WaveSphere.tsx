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

const PARTICLE_COUNT = 10000;

function fibonacciSphere(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    positions[i * 3 + 0] = Math.cos(theta) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * r;
  }
  return positions;
}

export function WaveSphere() {
  const pointsRef = useRef<THREE.Points>(null);

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_amplitude: { value: 0 },
      u_energy: { value: 0.5 },
      u_state: { value: 0 },
    }),
    [],
  );

  const geometry = useMemo(() => {
    const base = fibonacciSphere(PARTICLE_COUNT);

    const phases = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);
    // Color driven by vertical position + azimuth angle for the arc effect
    const colorAngle = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      phases[i] = Math.random() * Math.PI * 2;

      // Size: rim particles bigger
      const y = base[i * 3 + 1]!;
      const rimness = 1.0 - Math.abs(y);
      sizes[i] = 1.2 + rimness * 2.5 + Math.random() * 1.2;

      // Color angle: map sphere position to 0–1 arc
      // Use atan2 of x/z + vertical position to create the wrapping gradient
      const px = base[i * 3 + 0]!;
      const py = base[i * 3 + 1]!;
      const pz = base[i * 3 + 2]!;
      const azimuth = (Math.atan2(pz, px) + Math.PI) / (Math.PI * 2); // 0–1
      // Blend azimuth with vertical so top=cyan, sides=purple/magenta, bottom=orange
      colorAngle[i] = azimuth * 0.6 + (1 - (py * 0.5 + 0.5)) * 0.4;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    geo.setAttribute("a_base", new THREE.BufferAttribute(base, 3));
    geo.setAttribute("a_phase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("a_size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("a_colorAngle", new THREE.BufferAttribute(colorAngle, 1));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
      attribute vec3  a_base;
      attribute float a_phase;
      attribute float a_size;
      attribute float a_colorAngle;

      uniform float u_time;
      uniform float u_amplitude;
      uniform float u_energy;
      uniform int   u_state;

      varying float v_colorAngle;
      varying float v_alpha;
      varying float v_rimness;

      float hash(float n) { return fract(sin(n) * 43758.5453); }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f*f*(3.0-2.0*f);
        float n = i.x + i.y*57.0 + i.z*113.0;
        return mix(
          mix(mix(hash(n),hash(n+1.0),f.x), mix(hash(n+57.0),hash(n+58.0),f.x), f.y),
          mix(mix(hash(n+113.0),hash(n+114.0),f.x), mix(hash(n+170.0),hash(n+171.0),f.x), f.y),
          f.z);
      }

      float fbm(vec3 p) {
        return noise(p)*0.50
             + noise(p*2.02)*0.25
             + noise(p*4.01)*0.125
             + noise(p*8.00)*0.0625;
      }

      void main() {
        vec3 dir = normalize(a_base);
        float t  = u_time;
        float ph = a_phase;

        // Wave displacement — this is what makes the surface turbulent
        float waveAmp   = 0.0;
        float waveSpeed = 1.0;
        float waveFreq  = 2.0;

        if (u_state == -1) { waveAmp = 0.02;  waveSpeed = 0.3; waveFreq = 1.5; }
        else if (u_state == 0) { waveAmp = 0.14 + u_energy*0.04; waveSpeed = 0.6; waveFreq = 1.8; }
        else if (u_state == 1) { waveAmp = 0.12 + u_energy*0.05; waveSpeed = 1.0; waveFreq = 2.2; }
        else if (u_state == 2) { waveAmp = 0.20 + u_energy*0.08; waveSpeed = 1.6; waveFreq = 3.0; }
        else if (u_state == 3) { waveAmp = 0.18 + u_amplitude*0.22 + u_energy*0.06; waveSpeed = 2.2; waveFreq = 2.5; }
        else if (u_state == 4) { waveAmp = 0.16 + u_energy*0.06; waveSpeed = 3.5; waveFreq = 4.0; }
        else if (u_state == 5) { waveAmp = 0.18 + u_energy*0.06; waveSpeed = 1.2; waveFreq = 2.0; }
        else if (u_state == 7) { waveAmp = 0.26 + u_energy*0.10; waveSpeed = 5.0; waveFreq = 4.5; }

        // Multi-octave surface noise — creates the wave peaks
        float n = fbm(dir * waveFreq + vec3(t * waveSpeed * 0.2));
        float displacement = n * waveAmp;

        // Breathing
        displacement += sin(t * 0.94 + ph) * 0.008;

        // Rim particles scatter outward more
        float rimness = 1.0 - abs(dir.y);
        rimness = pow(rimness, 2.0);
        float rimScatter = rimness * fbm(dir * 6.0 + vec3(t * 0.4)) * 0.12;

        // Final position — surface shell only, displaced outward
        float radius = 0.85; // base radius kept small so full sphere fits in view
        vec3 pos = dir * (radius + displacement + rimScatter);

        v_colorAngle = a_colorAngle;
        v_rimness    = rimness;

        // Alpha: displaced particles brighter, rim particles visible
        float dispNorm = clamp(displacement / (waveAmp + 0.001), 0.0, 1.0);
        v_alpha = 0.55 + dispNorm * 0.35 + rimness * 0.15;

        // Point size: peaks and rim = larger
        float sz = a_size * (1.0 + dispNorm * 1.2 + rimness * 1.5);
        sz = clamp(sz, 0.8, 5.5);

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position  = projectionMatrix * mvPos;
        gl_PointSize = sz * (220.0 / -mvPos.z);
      }
    `,
        fragmentShader: /* glsl */ `
      uniform float u_time;
      uniform float u_energy;
      uniform int   u_state;

      varying float v_colorAngle;
      varying float v_alpha;
      varying float v_rimness;

      vec3 colorRamp(float t) {
        // Arc gradient matching reference:
        // 0.0 = cyan (top)
        // 0.2 = blue
        // 0.35= violet/purple
        // 0.5 = magenta/pink
        // 0.65= red
        // 0.8 = orange
        // 1.0 = yellow-orange (bottom)
        vec3 c0 = vec3(0.05, 0.90, 1.00); // cyan
        vec3 c1 = vec3(0.15, 0.35, 1.00); // blue
        vec3 c2 = vec3(0.50, 0.08, 1.00); // violet
        vec3 c3 = vec3(0.95, 0.05, 0.70); // magenta
        vec3 c4 = vec3(1.00, 0.06, 0.18); // red
        vec3 c5 = vec3(1.00, 0.42, 0.04); // orange
        vec3 c6 = vec3(1.00, 0.82, 0.08); // yellow

        if (t < 0.2)  return mix(c0, c1, t/0.20);
        if (t < 0.35) return mix(c1, c2, (t-0.20)/0.15);
        if (t < 0.50) return mix(c2, c3, (t-0.35)/0.15);
        if (t < 0.65) return mix(c3, c4, (t-0.50)/0.15);
        if (t < 0.80) return mix(c4, c5, (t-0.65)/0.15);
                      return mix(c5, c6, (t-0.80)/0.20);
      }

      void main() {
        vec2  uv   = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;

        // Soft glow falloff — brighter center
        float soft = 1.0 - smoothstep(0.0, 0.5, dist);
        soft = pow(soft, 1.4);

        vec3 color = colorRamp(fract(v_colorAngle));

        // State tints
        if (u_state == 2) color = mix(color, vec3(0.45, 0.10, 1.00), 0.30);
        if (u_state == 3) color = mix(color, vec3(0.20, 0.90, 1.00), 0.25);
        if (u_state == 5) color = mix(color, vec3(0.00, 0.85, 1.00), 0.20);
        if (u_state == 7) color = mix(color, vec3(1.00, 0.20, 0.00), 0.55);

        // Rim particles slightly brighter
        color *= (1.0 + v_rimness * 0.5);

        float alpha = soft * v_alpha;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }) => {
    const store = usePresenceStore.getState();
    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_energy.value = store.emotional.energy;
    uniforms.u_state.value = STATE_INT[store.state] ?? 0;
    const cur = uniforms.u_amplitude.value as number;
    uniforms.u_amplitude.value = cur * 0.92;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
