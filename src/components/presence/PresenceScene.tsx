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

  const bg = useMemo(() => new Color("#03040a"), []);

  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 42, near: 0.1, far: 100 }}
      dpr={config?.pixelRatio ?? 2}
      scene={{ background: bg }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
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
                intensity={1.2}
                luminanceThreshold={0.18}
                luminanceSmoothing={0.92}
                mipmapBlur
              />
            )}
            {config.enableChromaticAberration && (
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={new Vector2(0.0006, 0.0006)}
                radialModulation={false}
                modulationOffset={0}
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
