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

export function WaveSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_amplitude: { value: 0 },
      u_energy: { value: 0.5 },
      u_state: { value: 0 },
      u_blend: { value: 1.0 },
    }),
    [],
  );

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.SphereGeometry(1.1, 128, 128);

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float u_time;
        uniform float u_amplitude;
        uniform float u_energy;
        uniform int u_state;

        varying vec3 v_normal;
        varying float v_displacement;
        varying vec3 v_pos;

        // 3D noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          vec3 pos = position;
          float t = u_time;

          // Base slow breathing
          float breathSpeed = 0.18;
          float breath = sin(t * breathSpeed * 6.2831) * 0.018;

          // Primary wave noise — large undulating surface
          float n1 = snoise(pos * 1.2 + vec3(t * 0.22, t * 0.18, t * 0.14));
          float n2 = snoise(pos * 2.8 + vec3(t * 0.38, t * 0.30, t * 0.25));
          float n3 = snoise(pos * 5.5 + vec3(t * 0.55, t * 0.48, t * 0.60));

          // State-specific wave behavior
          float waveAmp = 0.0;
          float waveSpeed = 1.0;
          float detailAmp = 0.0;

          if (u_state == -1) {
            // Dormant — almost flat, faint pulse
            waveAmp = 0.012 + breath * 0.5;
            detailAmp = 0.004;
          } else if (u_state == 0) {
            // Idle — gentle slow waves
            waveAmp = 0.055 + u_energy * 0.02;
            detailAmp = 0.015;
            waveSpeed = 0.8;
          } else if (u_state == 1) {
            // Listening — surface tightens, focused ripple
            waveAmp = 0.04 + u_energy * 0.025;
            detailAmp = 0.022;
            waveSpeed = 1.3;
          } else if (u_state == 2) {
            // Thinking — complex multi-layer interference
            waveAmp = 0.07 + u_energy * 0.04;
            detailAmp = 0.035;
            waveSpeed = 1.8;
          } else if (u_state == 3) {
            // Speaking — amplitude-driven, high energy
            waveAmp = 0.08 + u_amplitude * 0.12 + u_energy * 0.05;
            detailAmp = 0.04 + u_amplitude * 0.06;
            waveSpeed = 2.2;
          } else if (u_state == 4) {
            // Processing — fast scan ripple
            waveAmp = 0.06 + u_energy * 0.03;
            detailAmp = 0.028;
            waveSpeed = 3.5;
          } else if (u_state == 5) {
            // Searching — slow orbital swell
            waveAmp = 0.065 + u_energy * 0.035;
            detailAmp = 0.02;
            waveSpeed = 1.1;
          } else if (u_state == 7) {
            // Alert — sharp fast spikes
            waveAmp = 0.09 + u_energy * 0.06;
            detailAmp = 0.055;
            waveSpeed = 4.0;
          }

          float displacement =
            n1 * waveAmp +
            n2 * detailAmp +
            n3 * detailAmp * 0.4 +
            breath;

          pos += normal * displacement;
          v_displacement = displacement;
          v_normal = normalMatrix * normal;
          v_pos = pos;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float u_time;
        uniform float u_energy;
        uniform int u_state;
        uniform float u_amplitude;

        varying vec3 v_normal;
        varying float v_displacement;
        varying vec3 v_pos;

        void main() {
          vec3 n = normalize(v_normal);

          // Fake view direction for fresnel (no camera uniform needed)
          vec3 viewDir = normalize(-v_pos);
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, n)), 3.0);

          // Displacement drives brightness — peaks glow, valleys dark
          float dispNorm = clamp((v_displacement + 0.12) / 0.24, 0.0, 1.0);

          // Base palette: near-black core → silver mid → cold white peaks
          vec3 coreColor  = vec3(0.04, 0.05, 0.07);
          vec3 midColor   = vec3(0.55, 0.62, 0.74);
          vec3 peakColor  = vec3(0.92, 0.95, 1.00);
          vec3 fresnelColor = vec3(0.80, 0.88, 1.00);

          vec3 baseColor;
          if (dispNorm > 0.6)
            baseColor = mix(midColor, peakColor, (dispNorm - 0.6) / 0.4);
          else if (dispNorm > 0.2)
            baseColor = mix(coreColor, midColor, (dispNorm - 0.2) / 0.4);
          else
            baseColor = coreColor;

          // Fresnel edge glow
          baseColor = mix(baseColor, fresnelColor, fresnel * 0.65);

          // State color shifts
          if (u_state == 2) {
            // Thinking — subtle blue pulse
            baseColor = mix(baseColor, vec3(0.70, 0.82, 1.00), dispNorm * 0.25);
          }
          if (u_state == 3) {
            // Speaking — amplitude brightens peaks toward white
            baseColor = mix(baseColor, vec3(1.0, 1.0, 1.0), dispNorm * u_amplitude * 0.5);
          }
          if (u_state == 5) {
            // Searching — cool teal tint
            baseColor = mix(baseColor, vec3(0.60, 0.90, 0.95), dispNorm * 0.20);
          }
          if (u_state == 7) {
            // Alert — warm white flash
            baseColor = mix(baseColor, vec3(1.0, 0.97, 0.90), dispNorm * u_energy * 0.45);
          }

          // Alpha — transparent at core, opaque at surface peaks and edges
          float alpha = clamp(dispNorm * 0.7 + fresnel * 0.55, 0.0, 1.0);

          gl_FragColor = vec4(baseColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });

    return { geometry: geo, material: mat };
  }, [uniforms]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }, delta) => {
    const store = usePresenceStore.getState();
    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_energy.value = store.emotional.energy;
    uniforms.u_state.value = STATE_INT[store.state] ?? 0;

    // Smooth amplitude decay when no audio (will be driven by Web Audio in Phase 2)
    const current = uniforms.u_amplitude.value as number;
    uniforms.u_amplitude.value = current * 0.92;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}
