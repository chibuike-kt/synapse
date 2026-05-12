export type HardwareTier = "high" | "mid" | "low";

export interface TierConfig {
  particleCount: number;
  enablePostProcessing: boolean;
  enableBloom: boolean;
  enableChromaticAberration: boolean;
  pixelRatio: number;
  shadowMapEnabled: boolean;
}

const TIER_CONFIGS: Record<HardwareTier, TierConfig> = {
  high: {
    particleCount: 8000,
    enablePostProcessing: true,
    enableBloom: true,
    enableChromaticAberration: true,
    pixelRatio: Math.min(window?.devicePixelRatio ?? 2, 3),
    shadowMapEnabled: false,
  },
  mid: {
    particleCount: 4000,
    enablePostProcessing: true,
    enableBloom: true,
    enableChromaticAberration: false,
    pixelRatio: Math.min(window?.devicePixelRatio ?? 2, 2),
    shadowMapEnabled: false,
  },
  low: {
    particleCount: 1500,
    enablePostProcessing: false,
    enableBloom: false,
    enableChromaticAberration: false,
    pixelRatio: 1,
    shadowMapEnabled: false,
  },
};

function detectTier(): HardwareTier {
  if (typeof window === "undefined") return "high";

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return "low";

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string)
    : "";

  const lowEndPatterns =
    /mali-4|mali-t|adreno [23]|powervr sgx|apple a[1-9][^0-9]/i;
  const highEndPatterns = /rtx|rx 6|rx 7|radeon pro|apple m|apple a1[5-9]|a17/i;

  if (lowEndPatterns.test(renderer)) return "low";
  if (highEndPatterns.test(renderer)) return "high";

  // Fallback: estimate by logical processor count
  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores >= 8) return "high";
  if (cores >= 4) return "mid";
  return "low";
}

let _cachedTier: HardwareTier | null = null;

export function getHardwareTier(): HardwareTier {
  if (_cachedTier) return _cachedTier;
  _cachedTier = detectTier();
  return _cachedTier;
}

export function getTierConfig(): TierConfig {
  return TIER_CONFIGS[getHardwareTier()];
}
