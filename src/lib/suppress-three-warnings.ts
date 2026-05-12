// Suppress known upstream deprecation warnings from Three.js r168+
// Remove this file once @react-three/fiber upgrades internally
const originalWarn = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("THREE.Clock") &&
    args[0].includes("deprecated")
  ) {
    return;
  }
  originalWarn(...args);
};
