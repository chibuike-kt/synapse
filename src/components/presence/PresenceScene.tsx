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
import { Suspense } from "react";
import { getTierConfig } from "@/lib/hardware-tier";
import { ParticleField } from "./ParticleField";
import { OrbCore } from "./OrbCore";
import { Vector2 } from "three";

const config = typeof window !== "undefined" ? getTierConfig() : null;

export function PresenceScene() {
  const tier = config;

  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 45, near: 0.1, far: 100 }}
      dpr={tier?.pixelRatio ?? 2}
      gl={{
        antialias: false, // postprocessing handles AA
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      }}
      style={{ position: "fixed", inset: 0, background: "transparent" }}
    >
      <Suspense fallback={null}>
        <OrbCore />
        <ParticleField />

        {tier?.enablePostProcessing && (
          <EffectComposer multisampling={0}>
            {tier.enableBloom && (
              <Bloom
                intensity={0.4}
                luminanceThreshold={0.6}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
            )}
            {tier.enableChromaticAberration && (
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={new Vector2(0.0008, 0.0008)}
                radialModulation={false}
                modulationOffset={0}
              />
            )}
            <Noise opacity={0.028} blendFunction={BlendFunction.ADD} />
            <Vignette eskil={false} offset={0.12} darkness={0.55} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
