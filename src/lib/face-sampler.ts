export interface VoxelTile {
  wx: number;
  wy: number;
  brightness: number;
  phase: number;
  scatterX: number;
  scatterY: number;
}

export interface SampleResult {
  tiles: VoxelTile[];
  cols: number;
  rows: number;
}

const TILE_SIZE = 6; // px in sample space
const GAP = 1; // px gap between tiles
const THRESHOLD = 28; // 0–255 luma cutoff
const SAMPLE_RES = 512; // sample the image at this resolution

export function sampleFaceImage(img: HTMLImageElement): SampleResult {
  const step = TILE_SIZE + GAP;
  const cols = Math.floor(SAMPLE_RES / step);
  const rows = Math.floor(SAMPLE_RES / step);

  // Offscreen canvas — sample image at grid resolution
  const offscreen = document.createElement("canvas");
  offscreen.width = cols;
  offscreen.height = rows;
  const oc = offscreen.getContext("2d", { willReadFrequently: true })!;
  oc.drawImage(img, 0, 0, cols, rows);
  const data = oc.getImageData(0, 0, cols, rows).data;

  const tiles: VoxelTile[] = [];

  // World space: center the grid at origin
  // Each tile maps to world units — total face spans ~2.2 units wide
  const worldStep = 2.4 / cols;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      if (luma < THRESHOLD) continue;

      const brightness = Math.min(luma / 255, 1);

      // Center: col=0 maps to -1.2, col=cols-1 maps to +1.2
      const wx = (col / (cols - 1) - 0.5) * 2.4;
      // Flip Y: row=0 is top of image → positive Y in world
      const wy = (0.5 - row / (rows - 1)) * 2.4 * (rows / cols);

      tiles.push({
        wx,
        wy,
        brightness,
        phase: Math.random() * Math.PI * 2,
        scatterX: (Math.random() - 0.5) * worldStep * 0.3,
        scatterY: (Math.random() - 0.5) * worldStep * 0.3,
      });
    }
  }

  return { tiles, cols, rows };
}
