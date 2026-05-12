uniform float u_time;
uniform float u_amplitude;
uniform float u_energy;
uniform int u_state;

varying vec3 v_normal;
varying vec3 v_worldPos;
varying float v_displacement;

// Smooth noise approximation
float noise3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float smoothNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);  // smoothstep

  return mix(
    mix(mix(noise3(i), noise3(i + vec3(1,0,0)), f.x),
        mix(noise3(i + vec3(0,1,0)), noise3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(noise3(i + vec3(0,0,1)), noise3(i + vec3(1,0,1)), f.x),
        mix(noise3(i + vec3(0,1,1)), noise3(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 pos = position;
  vec3 n = normal;

  // Base breathing displacement
  float breathFreq = 0.15;
  float breath = sin(u_time * breathFreq * 6.2831) * 0.02;

  // Noise-driven surface displacement
  vec3 noiseCoord = pos * 1.8 + vec3(u_time * 0.12);
  float noiseVal = smoothNoise(noiseCoord) * 2.0 - 1.0;
  float displaceAmp = 0.03 + u_energy * 0.04 + u_amplitude * 0.06;
  float displacement = noiseVal * displaceAmp + breath;

  // State-specific surface behavior
  if (u_state == 2) {
    // thinking — tighter, faster surface ripple
    float ripple = sin(length(pos) * 8.0 - u_time * 3.0) * 0.015;
    displacement += ripple;
  } else if (u_state == 3) {
    // speaking — amplitude-synced pulse
    displacement += u_amplitude * 0.04;
  }

  pos += n * displacement;
  v_displacement = displacement;
  v_normal = normalMatrix * n;
  v_worldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
