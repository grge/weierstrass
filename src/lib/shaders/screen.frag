precision highp float;
varying vec2 v_uv;

uniform sampler2D u_tile;
uniform vec2 u_resolution;
uniform vec2 u_pan;
uniform float u_zoom;
uniform vec2 u_omega1;
uniform vec2 u_omega2;
uniform int u_view_mode;  // 0 = plane, 1 = torus

vec2 worldFromScreen(vec2 frag, vec2 resolution, vec2 pan, float zoom) {
  vec2 xy = (2.0 * frag - resolution) / min(resolution.x, resolution.y);
  return pan + xy / max(zoom, 1e-4);
}

vec2 solveLatticeCoords(vec2 z, vec2 w1, vec2 w2) {
  float det = w1.x * w2.y - w1.y * w2.x;
  det = abs(det) < 1e-6 ? (det < 0.0 ? -1e-6 : 1e-6) : det;
  return vec2(
    (z.x * w2.y - z.y * w2.x) / det,
    (-z.x * w1.y + z.y * w1.x) / det
  );
}

void main() {
  vec2 uv;
  if (u_view_mode == 1) {
    // Torus: map screen directly to tile UV [0,1]²
    uv = gl_FragCoord.xy / u_resolution;
    uv.y = 1.0 - uv.y;  // flip y to match tile orientation
  } else {
    vec2 z = worldFromScreen(gl_FragCoord.xy, u_resolution, u_pan, u_zoom);
    uv = fract(solveLatticeCoords(z, u_omega1, u_omega2));
  }
  vec3 color = texture2D(u_tile, uv).rgb;
  gl_FragColor = vec4(color, 1.0);
}
