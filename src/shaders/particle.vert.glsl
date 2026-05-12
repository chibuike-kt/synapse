uniform float u_time;
uniform float u_amplitude;
uniform float u_energy;
uniform float u_stateBlend;
uniform int u_state;
uniform float u_confidence;

attribute vec3 a_restPosition;
attribute float a_particleIndex;
attribute float a_size;
attribute float a_phase;      // per-particle random phase offset

varying float v_distToCenter;
varying float v_energy;
varying float v_alpha;

// Simple hash for per-particle pseudo-random
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vec3 pos = position;  // current position (updated by CPU/worker)

  // Breathing oscillation — idle base motion
  float breathFreq = 0.15;  // Hz
  float breathAmp = 0.012 + u_energy * 0.018;
  float breath = sin(u_time * breathFreq * 6.2831 + a_phase) * breathAmp;

  // State-driven displacement
  float stateDisplace = 0.0;

  if (u_state == 1) {
    // listening — slight inward pull, attention focus
    stateDisplace = -0.015 * u_stateBlend;
  } else if (u_state == 2) {
    // thinking — radial oscillation at mid frequency
    stateDisplace = sin(u_time * 2.1 + a_phase * 3.14) * 0.025 * u_stateBlend;
  } else if (u_state == 3) {
    // speaking — amplitude-driven outward pulse
    stateDisplace = u_amplitude * 0.08 * u_stateBlend;
  } else if (u_state == 4) {
    // processing — faster oscillation
    stateDisplace = sin(u_time * 4.2 + a_phase * 6.28) * 0.02 * u_stateBlend;
  } else if (u_state == 5) {
    // searching — orbital drift
    float orbitAngle = u_time * 1.8 + a_phase * 6.28;
    stateDisplace = sin(orbitAngle) * 0.03 * u_stateBlend;
  }

  // Apply breath + state displacement along particle's direction from origin
  vec3 dir = normalize(pos - vec3(0.0));
  pos += dir * (breath + stateDisplace);

  // Micro-jitter — keeps individual particles alive, scaled by energy
  float jitterAmp = 0.002 + u_energy * 0.004;
  pos.x += sin(u_time * 3.7 + a_phase * 12.0) * jitterAmp;
  pos.y += cos(u_time * 2.9 + a_phase * 8.0) * jitterAmp;
  pos.z += sin(u_time * 4.1 + a_phase * 15.0) * jitterAmp * 0.5;

  v_distToCenter = length(pos);
  v_energy = u_energy;

  // Alpha — confidence affects coherence of the face
  float baseAlpha = 0.6 + u_confidence * 0.3;
  // Ambient scatter particles (far from face regions) are more transparent
  float distanceFade = 1.0 - smoothstep(0.6, 1.2, v_distToCenter);
  v_alpha = baseAlpha * distanceFade;

  // Point size — closer particles appear larger
  float sz = a_size * (1.0 + u_energy * 0.4) * (1.0 + u_amplitude * 0.6);

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = sz * (300.0 / -mvPos.z);
}
