uniform float u_time;
uniform float u_energy;
uniform int u_state;

varying float v_distToCenter;
varying float v_energy;
varying float v_alpha;

void main() {
  // Soft circular particle
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;

  // Soft falloff
  float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * v_alpha;

  // Color — cool white/gray palette
  // Core: near-white. Edge: cooler, more gray.
  vec3 coreColor    = vec3(0.94, 0.96, 1.00);   // #F0F4FF
  vec3 edgeColor    = vec3(0.66, 0.73, 0.82);   // #A8BBCE
  vec3 speakColor   = vec3(0.97, 0.98, 1.00);   // pure white emission
  vec3 searchColor  = vec3(0.72, 0.82, 0.94);   // cooler blue-gray

  // Blend based on distance from particle center
  vec3 particleColor = mix(coreColor, edgeColor, dist * 2.0);

  // State color shift
  if (u_state == 3) {
    // speaking — push toward white
    particleColor = mix(particleColor, speakColor, v_energy * 0.6);
  } else if (u_state == 5) {
    // searching — cool blue shift
    particleColor = mix(particleColor, searchColor, 0.4);
  }

  // Inner glow for high-energy states
  if (dist < 0.15) {
    particleColor = mix(particleColor, vec3(1.0), v_energy * 0.4);
  }

  gl_FragColor = vec4(particleColor, alpha);
}
