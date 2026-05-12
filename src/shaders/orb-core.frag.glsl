uniform float u_time;
uniform float u_energy;
uniform int u_state;
uniform vec3 u_cameraPos;

varying vec3 v_normal;
varying vec3 v_worldPos;
varying float v_displacement;

void main() {
  vec3 viewDir = normalize(u_cameraPos - v_worldPos);
  vec3 n = normalize(v_normal);

  // Fresnel — edge glow
  float fresnel = 1.0 - max(0.0, dot(viewDir, n));
  fresnel = pow(fresnel, 2.5);

  // Base color — silver-gray
  vec3 baseColor = vec3(0.76, 0.80, 0.86);   // #C2CDD9
  vec3 fresnelColor = vec3(0.92, 0.95, 1.00); // #EBF2FF — cold white edge

  vec3 color = mix(baseColor, fresnelColor, fresnel);

  // State color temperature
  if (u_state == 3) {
    // speaking — brighter, more luminous
    color = mix(color, vec3(0.95, 0.97, 1.0), u_energy * 0.4);
  } else if (u_state == 1) {
    // thinking — slightly darker, interior focus
    color = mix(color, vec3(0.60, 0.65, 0.72), 0.2);
  }

  // Displacement-based edge highlight
  float highlight = smoothstep(0.02, 0.06, v_displacement);
  color += highlight * 0.12;

  // Soft center transparency (the orb is mostly transparent, just edge glow)
  float alpha = fresnel * 0.6 + 0.05;

  gl_FragColor = vec4(color, alpha);
}
