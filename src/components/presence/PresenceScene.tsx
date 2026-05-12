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
import { ParticleField } from "./ParticleField";
import { OrbCore } from "./OrbCore";

export function PresenceScene() {
  const config = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getTierConfig();
  }, []);

  const sceneBackground = useMemo(() => new Color("#03040a"), []);

  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 45, near: 0.1, far: 100 }}
      dpr={config?.pixelRatio ?? 2}
      scene={{ background: sceneBackground }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      <Suspense fallback={null}>
        <OrbCore />
        <ParticleField />

        {config?.enablePostProcessing && (
          <EffectComposer multisampling={0}>
            {config.enableBloom && (
              <Bloom
                intensity={0.4}
                luminanceThreshold={0.6}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
            )}
            {config.enableChromaticAberration && (
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
