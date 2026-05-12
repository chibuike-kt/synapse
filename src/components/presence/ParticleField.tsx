"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePresenceStore } from "@/store/presence-store";
import { sampleFaceImage, VoxelTile } from "@/lib/face-sampler";

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

// World-space tile size — matches sample grid density
const WORLD_TILE = 0.034;

export function ParticleField() {
  const [tiles, setTiles] = useState<VoxelTile[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const currentPos = useRef<Float32Array>(new Float32Array(0));
  const velocity = useRef<Float32Array>(new Float32Array(0));

  // Load and sample face image on mount
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const result = sampleFaceImage(img);
      const count = result.tiles.length;

      currentPos.current = new Float32Array(count * 3);
      velocity.current = new Float32Array(count * 3);

      result.tiles.forEach((tile, i) => {
        currentPos.current[i * 3 + 0] = tile.wx;
        currentPos.current[i * 3 + 1] = tile.wy;
        currentPos.current[i * 3 + 2] = (tile.brightness - 0.5) * 0.15;
      });

      setTiles(result.tiles);
    };
    img.onerror = () =>
      console.error("[ParticleField] Failed to load /face.jpg");
    img.src = "/face.jpg";
  }, []);

  const count = tiles.length;

  const geometry = useMemo(() => {
    if (count === 0) return new THREE.PlaneGeometry(WORLD_TILE, WORLD_TILE);

    const geo = new THREE.PlaneGeometry(WORLD_TILE, WORLD_TILE);

    const brightnessArr = new Float32Array(count);
    const phaseArr = new Float32Array(count);

    tiles.forEach((tile, i) => {
      brightnessArr[i] = tile.brightness;
      phaseArr[i] = tile.phase;
    });

    geo.setAttribute(
      "a_brightness",
      new THREE.InstancedBufferAttribute(brightnessArr, 1),
    );
    geo.setAttribute(
      "a_phase",
      new THREE.InstancedBufferAttribute(phaseArr, 1),
    );

    return geo;
  }, [tiles, count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 },
          u_amplitude: { value: 0 },
          u_energy: { value: 0.5 },
          u_state: { value: 0 },
        },
        vertexShader: /* glsl */ `
      attribute float a_brightness;
      attribute float a_phase;
      uniform float u_time;
      uniform float u_energy;
      uniform int u_state;
      varying float v_brightness;
      varying float v_alpha;

      void main() {
        v_brightness = a_brightness;
        v_alpha = smoothstep(0.04, 0.45, a_brightness);

        vec4 worldPos = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * worldPos;
      }
    `,
        fragmentShader: /* glsl */ `
      uniform float u_time;
      uniform float u_energy;
      uniform int u_state;
      varying float v_brightness;
      varying float v_alpha;

      void main() {
        if (v_brightness < 0.04) discard;

        // Cool white → silver → steel gradient by brightness
        vec3 bright = vec3(0.96, 0.97, 1.00);
        vec3 mid    = vec3(0.62, 0.70, 0.82);
        vec3 dark   = vec3(0.28, 0.34, 0.44);

        vec3 color;
        if (v_brightness > 0.65)
          color = mix(mid, bright, (v_brightness - 0.65) / 0.35);
        else if (v_brightness > 0.25)
          color = mix(dark, mid, (v_brightness - 0.25) / 0.40);
        else
          color = dark * (v_brightness / 0.25);

        // State tints
        if (u_state == 3)
          color = mix(color, vec3(1.0, 1.0, 1.0), v_brightness * u_energy * 0.55);
        if (u_state == 2) {
          float g = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(color, vec3(g * 0.9, g * 0.95, g * 1.1), 0.4);
        }
        if (u_state == 5)
          color = mix(color, vec3(0.55, 0.75, 1.0), v_brightness * 0.35);
        if (u_state == 7)
          color = mix(color, vec3(1.0, 0.95, 0.85), v_brightness * 0.4);

        gl_FragColor = vec4(color, v_alpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Set initial matrices once tiles load
  useEffect(() => {
    if (!meshRef.current || count === 0) return;
    tiles.forEach((tile, i) => {
      dummy.position.set(tile.wx, tile.wy, (tile.brightness - 0.5) * 0.15);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [tiles, count, dummy]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || count === 0) return;

    const t = clock.getElapsedTime();
    const store = usePresenceStore.getState();
    const stateInt = STATE_INT[store.state] ?? 0;
    const energy = store.emotional.energy;
    const urgency = store.emotional.urgency;

    material.uniforms["u_time"]!.value = t;
    material.uniforms["u_energy"]!.value = energy;
    material.uniforms["u_state"]!.value = stateInt;

    const pos = currentPos.current;
    const vel = velocity.current;
    const stiffness = 5.0 + urgency * 3.0;
    const damping = 0.8;

    for (let i = 0; i < count; i++) {
      const tile = tiles[i]!;
      const ph = tile.phase;
      const b = tile.brightness;
      const ix = i * 3,
        iy = i * 3 + 1,
        iz = i * 3 + 2;

      // Breathing — universal
      const breath = Math.sin(t * 0.94 + ph) * 0.004;

      let ox = tile.scatterX;
      let oy = tile.scatterY + breath;
      let oz = (b - 0.5) * 0.15;

      if (stateInt === 1) {
        // Listening — subtle inward magnetic pull
        ox += Math.sin(t * 0.8 + ph) * 0.003 * b;
        oz -= 0.01 * b;
      } else if (stateInt === 2) {
        // Thinking — individual oscillation, ripple outward
        ox += Math.sin(t * 2.2 + ph * 3.1) * 0.008 * b;
        oy += Math.cos(t * 1.8 + ph * 2.4) * 0.008 * b;
        oz += Math.sin(t * 2.8 + ph) * 0.01;
      } else if (stateInt === 3) {
        // Speaking — amplitude-driven push, high frequency micro-shake
        const amp = 0.5 + 0.5 * Math.sin(t * 7.0);
        ox += Math.sin(t * 5.0 + ph) * amp * 0.006;
        oy += amp * 0.012 * b;
        oz += amp * 0.025 * b;
      } else if (stateInt === 4) {
        // Processing — fast scan-line ripple
        const scan = Math.sin(t * 4.0 - tile.wy * 3.0) * 0.008;
        ox += scan;
        oz += scan * 0.5;
      } else if (stateInt === 5) {
        // Searching — slow orbital drift per tile
        const orbit = t * 1.2 + ph;
        ox += Math.sin(orbit) * 0.01;
        oy += Math.cos(orbit * 0.75) * 0.007;
      } else if (stateInt === 7) {
        // Alert — fast strobe scatter
        ox += (Math.random() - 0.5) * 0.012;
        oy += (Math.random() - 0.5) * 0.012;
      }

      const tx = tile.wx + ox;
      const ty = tile.wy + oy;
      const tz = oz;

      vel[ix] = (vel[ix]! + (tx - pos[ix]!) * stiffness * delta) * damping;
      vel[iy] = (vel[iy]! + (ty - pos[iy]!) * stiffness * delta) * damping;
      vel[iz] = (vel[iz]! + (tz - pos[iz]!) * stiffness * delta) * damping;

      pos[ix] = pos[ix]! + vel[ix]!;
      pos[iy] = pos[iy]! + vel[iy]!;
      pos[iz] = pos[iz]! + vel[iz]!;

      dummy.position.set(pos[ix]!, pos[iy]!, pos[iz]!);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}
