"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePresenceStore } from "@/store/presence-store";
import { buildVoxelFace, VoxelTile } from "@/lib/face-geometry";

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

// Tile size in world units — tweak for pixel density feel
const TILE_SIZE = 0.038;

export function ParticleField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const tiles = useMemo(() => buildVoxelFace(), []);
  const count = tiles.length;

  // Per-instance dynamic data — mutated every frame, never React state
  const currentPos = useRef<Float32Array>(new Float32Array(count * 3));
  const velocity = useRef<Float32Array>(new Float32Array(count * 3));
  const phases = useRef<Float32Array>(new Float32Array(count));

  // Reusable objects — allocated once, reused every frame
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  // Shader material for instanced quads
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 },
          u_amplitude: { value: 0 },
          u_energy: { value: 0.5 },
          u_state: { value: 0 },
          u_stateBlend: { value: 1.0 },
        },
        vertexShader: /* glsl */ `
      attribute float a_brightness;
      attribute float a_phase;

      uniform float u_time;
      uniform float u_amplitude;
      uniform float u_energy;
      uniform int u_state;

      varying float v_brightness;
      varying float v_alpha;

      void main() {
        v_brightness = a_brightness;

        // Alpha — core tiles fully opaque, edge tiles semi-transparent
        float baseAlpha = smoothstep(0.03, 0.4, a_brightness);
        v_alpha = baseAlpha * (0.7 + u_energy * 0.3);

        // Listening: edge tiles pulled slightly inward (attention)
        // Speaking: tiles push out with amplitude
        vec3 pos = (instanceMatrix * vec4(position, 1.0)).xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
        fragmentShader: /* glsl */ `
      uniform float u_time;
      uniform float u_energy;
      uniform int u_state;

      varying float v_brightness;
      varying float v_alpha;

      void main() {
        // Square tile — no discard needed, PlaneGeometry is already square

        // Base palette: cool white → silver-gray
        vec3 brightColor = vec3(0.96, 0.97, 1.00);   // near-white core
        vec3 midColor    = vec3(0.72, 0.78, 0.88);   // silver-gray mid
        vec3 edgeColor   = vec3(0.45, 0.52, 0.62);   // dark steel edge

        vec3 color;
        if (v_brightness > 0.65) {
          color = mix(midColor, brightColor, (v_brightness - 0.65) / 0.35);
        } else if (v_brightness > 0.25) {
          color = mix(edgeColor, midColor, (v_brightness - 0.25) / 0.4);
        } else {
          color = edgeColor * (v_brightness / 0.25);
        }

        // Speaking: push bright tiles toward white
        if (u_state == 3) {
          color = mix(color, vec3(1.0), v_brightness * u_energy * 0.5);
        }

        // Thinking: cool desaturate slightly
        if (u_state == 2) {
          float grey = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(color, vec3(grey), 0.25);
        }

        // Searching: subtle blue tint on bright tiles
        if (u_state == 5) {
          color = mix(color, vec3(0.6, 0.75, 1.0), v_brightness * 0.3);
        }

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

  // Geometry — one shared PlaneGeometry for all instances
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

    // Per-instance attributes
    const brightnessArr = new Float32Array(count);
    const phaseArr = new Float32Array(count);

    tiles.forEach((tile, i) => {
      brightnessArr[i] = tile.brightness;
      phaseArr[i] = Math.random() * Math.PI * 2;
      phases.current[i] = phaseArr[i]!;

      // Set initial positions
      currentPos.current[i * 3 + 0] = tile.x;
      currentPos.current[i * 3 + 1] = tile.y;
      currentPos.current[i * 3 + 2] = tile.z;
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

  // Set all initial instance matrices
  useEffect(() => {
    if (!meshRef.current) return;
    tiles.forEach((tile, i) => {
      dummy.position.set(tile.x, tile.y, tile.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [tiles, dummy]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;

    const t = clock.getElapsedTime();
    const store = usePresenceStore.getState();
    const stateInt = STATE_INT[store.state] ?? 0;
    const energy = store.emotional.energy;
    const urgency = store.emotional.urgency;

    // Update uniforms
    const u = material.uniforms;
    u["u_time"]!.value = t;
    u["u_energy"]!.value = energy;
    u["u_state"]!.value = stateInt;

    const pos = currentPos.current;
    const vel = velocity.current;
    const ph = phases.current;

    // Spring stiffness varies by state
    const stiffness = 6.0 + urgency * 4.0;
    const damping = 0.78;

    for (let i = 0; i < count; i++) {
      const tile = tiles[i]!;
      const ix = i * 3,
        iy = i * 3 + 1,
        iz = i * 3 + 2;
      const phase = ph[i]!;

      // Breathing — slow sinusoidal displacement along face normal (Z)
      const breath = Math.sin(t * 0.942 + phase) * 0.006;

      // State-driven target offsets
      let ox = 0,
        oy = 0,
        oz = breath;

      if (stateInt === 1) {
        // Listening — subtle inward pull, tiles compress slightly
        oz -= 0.012 * tile.brightness;
      } else if (stateInt === 2) {
        // Thinking — individual tile oscillation, higher freq
        ox = Math.sin(t * 2.1 + phase * 3.0) * 0.004 * tile.brightness;
        oy = Math.cos(t * 1.8 + phase * 2.5) * 0.004 * tile.brightness;
        oz += Math.sin(t * 3.0 + phase) * 0.008;
      } else if (stateInt === 3) {
        // Speaking — amplitude pushes bright tiles forward
        const amp = u["u_amplitude"]!.value as number;
        oz += amp * 0.05 * tile.brightness;
        ox = Math.sin(t * 4.0 + phase) * amp * 0.006;
      } else if (stateInt === 5) {
        // Searching — tiles drift in small orbit patterns
        const orbit = t * 1.2 + phase;
        ox = Math.sin(orbit) * 0.008;
        oy = Math.cos(orbit * 0.7) * 0.005;
      }

      // Target position = rest + scatter + state offset
      const tx = tile.restX + tile.scatterX + ox;
      const ty = tile.restY + tile.scatterY + oy;
      const tz = tile.restZ + tile.scatterZ + oz;

      // Spring physics
      vel[ix] = (vel[ix]! + (tx - pos[ix]!) * stiffness * delta) * damping;
      vel[iy] = (vel[iy]! + (ty - pos[iy]!) * stiffness * delta) * damping;
      vel[iz] = (vel[iz]! + (tz - pos[iz]!) * stiffness * delta) * damping;

      pos[ix] = pos[ix]! + vel[ix]!;
      pos[iy] = pos[iy]! + vel[iy]!;
      pos[iz] = pos[iz]! + vel[iz]!;

      // Write instance matrix
      dummy.position.set(pos[ix]!, pos[iy]!, pos[iz]!);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}
