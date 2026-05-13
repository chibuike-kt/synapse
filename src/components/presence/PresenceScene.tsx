"use client";

import { Canvas } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Suspense, useMemo } from "react";
import { Color, Vector2 } from "three";
import { getTierConfig } from "@/lib/hardware-tier";
import { WaveSphere } from "./WaveSphere";
import { OrbCore } from "./OrbCore";

export function PresenceScene() {
  const config = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getTierConfig();
  }, []);

  const bg = useMemo(() => new Color("#020408"), []);

  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 55, near: 0.1, far: 100 }}
      dpr={Math.min(config?.pixelRatio ?? 1.5, 2)}
      scene={{ background: bg }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          console.warn("[Synapse] WebGL context lost — will attempt restore");
        });
        canvas.addEventListener("webglcontextrestored", () => {
          console.info("[Synapse] WebGL context restored");
        });
      }}
      style={{ position: "fixed", inset: 0 }}
    >
      <Suspense fallback={null}>
        <OrbCore />
        <WaveSphere />

        {config?.enablePostProcessing && (
          <EffectComposer multisampling={0}>
            {config.enableBloom && (
              <Bloom
                intensity={1.4}
                luminanceThreshold={0.3}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
            )}
            <Noise opacity={0.032} blendFunction={BlendFunction.ADD} />
            <Vignette eskil={false} offset={0.1} darkness={0.65} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
