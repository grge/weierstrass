precision highp float;
varying vec2 v_uv;

uniform vec2  u_tau;
uniform int   u_mode;
uniform float u_halo;
uniform int   u_terms;

const int TERMS = 20;  // max; actual loop uses u_terms

// Pole/zero glow constants (previously tunable uniforms, fixed at tuned values)
const float POLE_THRESHOLD = 3.0;
const float POLE_SOFTNESS  = 6.0;
const float POLE_STRENGTH  = 2.0;
const float ZERO_THRESHOLD = -1.0;
const float ZERO_SOFTNESS  = 3.0;
const float ZERO_STRENGTH  = 2.0;

// ── [complex.glsl]
// ── [colour.glsl]

// ── Weierstrass ℘ ─────────────────────────────────────────────────────────────

vec2 latticePoint(int m, int n, vec2 tau) {
  return vec2(float(m) + float(n) * tau.x, float(n) * tau.y);
}

vec2 wp(vec2 z, vec2 tau) {
  vec2 sum = cInvSq(z);
  for (int m = -TERMS; m <= TERMS; m++) {
    if (m < -u_terms || m > u_terms) continue;
    for (int n = -TERMS; n <= TERMS; n++) {
      if (n < -u_terms || n > u_terms) continue;
      if (m == 0 && n == 0) continue;
      vec2 w = latticePoint(m, n, tau);
      sum += cInvSq(cSub(z, w)) - cInvSq(w);
    }
  }
  return sum;
}

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  vec2 z = vec2(v_uv.x + v_uv.y * u_tau.x, v_uv.y * u_tau.y);
  vec2 w = wp(z, u_tau);

  vec3 color;
  if      (u_mode == 0) color = paletteClassic(w);
  else if (u_mode == 1) color = paletteEmber(w);
  else if (u_mode == 2) color = paletteDusk(w);
  else                  color = paletteContours(w);

  // Fixed gamma lift (contrast=1.0 → exponent 0.8)
  color = pow(clamp(color, 0.0, 1.0), vec3(0.8));

  if (u_halo > 0.0) {
    float lw = log(max(cAbs(w), 1e-9));  // log|w|: +∞ near poles, -∞ near zeros

    // Pole: white glow where log|w| exceeds threshold
    float pole = smoothstep(POLE_THRESHOLD, POLE_THRESHOLD + POLE_SOFTNESS, lw)
                 * POLE_STRENGTH * u_halo;
    color = mix(color, vec3(1.0), clamp(pole, 0.0, 1.0));

    // Zero: black darkening where -log|w| (i.e. log|1/w|) exceeds threshold
    float zero = smoothstep(ZERO_THRESHOLD, ZERO_THRESHOLD + ZERO_SOFTNESS, -lw)
                 * ZERO_STRENGTH * u_halo;
    color *= (1.0 - clamp(zero, 0.0, 1.0));
  }

  gl_FragColor = vec4(color, 1.0);
}
