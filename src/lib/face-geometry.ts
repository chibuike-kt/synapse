import { Vector3 } from "three";

export interface FaceRegion {
  center: Vector3;
  radius: number;
  density: number; // 0.0–1.0, fraction of total particles assigned here
  label: string;
}

// Facial landmark regions in normalized space (-1 to 1)
// Designed to suggest a face without rendering one literally
export const FACE_REGIONS: FaceRegion[] = [
  // Forehead
  {
    center: new Vector3(0, 0.75, 0.1),
    radius: 0.35,
    density: 0.06,
    label: "forehead",
  },

  // Left orbital / eye region
  {
    center: new Vector3(-0.28, 0.35, 0.25),
    radius: 0.14,
    density: 0.1,
    label: "eye_left",
  },
  // Right orbital / eye region
  {
    center: new Vector3(0.28, 0.35, 0.25),
    radius: 0.14,
    density: 0.1,
    label: "eye_right",
  },

  // Left brow
  {
    center: new Vector3(-0.28, 0.5, 0.2),
    radius: 0.12,
    density: 0.05,
    label: "brow_left",
  },
  // Right brow
  {
    center: new Vector3(0.28, 0.5, 0.2),
    radius: 0.12,
    density: 0.05,
    label: "brow_right",
  },

  // Nasal bridge
  {
    center: new Vector3(0, 0.18, 0.35),
    radius: 0.09,
    density: 0.07,
    label: "nose_bridge",
  },
  // Nasal tip
  {
    center: new Vector3(0, 0.02, 0.42),
    radius: 0.08,
    density: 0.05,
    label: "nose_tip",
  },

  // Left cheekbone
  {
    center: new Vector3(-0.38, 0.08, 0.18),
    radius: 0.16,
    density: 0.06,
    label: "cheek_left",
  },
  // Right cheekbone
  {
    center: new Vector3(0.38, 0.08, 0.18),
    radius: 0.16,
    density: 0.06,
    label: "cheek_right",
  },

  // Upper lip
  {
    center: new Vector3(0, -0.14, 0.32),
    radius: 0.13,
    density: 0.07,
    label: "lip_upper",
  },
  // Lower lip
  {
    center: new Vector3(0, -0.26, 0.3),
    radius: 0.11,
    density: 0.05,
    label: "lip_lower",
  },

  // Left jaw
  {
    center: new Vector3(-0.32, -0.52, 0.12),
    radius: 0.18,
    density: 0.06,
    label: "jaw_left",
  },
  // Right jaw
  {
    center: new Vector3(0.32, -0.52, 0.12),
    radius: 0.18,
    density: 0.06,
    label: "jaw_right",
  },
  // Chin
  {
    center: new Vector3(0, -0.7, 0.15),
    radius: 0.14,
    density: 0.06,
    label: "chin",
  },

  // Temple left
  {
    center: new Vector3(-0.52, 0.48, -0.05),
    radius: 0.14,
    density: 0.04,
    label: "temple_left",
  },
  // Temple right
  {
    center: new Vector3(0.52, 0.48, -0.05),
    radius: 0.14,
    density: 0.04,
    label: "temple_right",
  },

  // Ambient scatter — loose particles not assigned to any region
  // Gives the "condensed cloud" feel around the face
  {
    center: new Vector3(0, 0, 0),
    radius: 0.85,
    density: 0.07,
    label: "ambient",
  },
];

function randomInSphere(radius: number): Vector3 {
  // Rejection sampling for uniform sphere distribution
  let v: Vector3;
  do {
    v = new Vector3(
      (Math.random() * 2 - 1) * radius,
      (Math.random() * 2 - 1) * radius,
      (Math.random() * 2 - 1) * radius,
    );
  } while (v.length() > radius);
  return v;
}

export function generateFaceParticlePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  // Normalize densities so they sum to 1
  const totalDensity = FACE_REGIONS.reduce((sum, r) => sum + r.density, 0);
  const normalizedRegions = FACE_REGIONS.map((r) => ({
    ...r,
    density: r.density / totalDensity,
  }));

  let particleIndex = 0;
  const scale = 1.1; // world-space scale of the face

  for (let ri = 0; ri < normalizedRegions.length; ri++) {
    const region = normalizedRegions[ri]!;
    // Last region gets all remaining particles to avoid rounding loss
    const regionCount =
      ri === normalizedRegions.length - 1
        ? count - particleIndex
        : Math.floor(region.density * count);

    for (let i = 0; i < regionCount; i++) {
      const offset = randomInSphere(region.radius);
      const worldPos = region.center.clone().add(offset).multiplyScalar(scale);

      positions[particleIndex * 3 + 0] = worldPos.x;
      positions[particleIndex * 3 + 1] = worldPos.y;
      positions[particleIndex * 3 + 2] = worldPos.z;

      particleIndex++;
      if (particleIndex >= count) break;
    }
    if (particleIndex >= count) break;
  }

  return positions;
}

// Rest (home) positions — used for particle drift return force
export function generateRestPositions(count: number): Float32Array {
  // Same seed logic — deterministic if we want, random is fine for v1
  return generateFaceParticlePositions(count);
}
