#version 300 es
precision highp float;

in vec2 v_uv;
layout(location = 0) out vec4 out_color;

uniform vec2  u_tau;
uniform int   u_mode;
uniform float u_halo;
uniform int   u_terms;
uniform float u_g2;
uniform float u_g3;

const int TERMS = 20;  // max; actual loop uses u_terms

// Pole/zero glow constants
const float POLE_THRESHOLD = 3.0;
const float POLE_SOFTNESS  = 6.0;
const float POLE_STRENGTH  = 2.0;
const float ZERO_THRESHOLD = -1.0;
const float ZERO_SOFTNESS  = 3.0;
const float ZERO_STRENGTH  = 2.0;

// ── [complex.glsl]
// ── [colour.glsl]

// ── Weierstrass ℘ and ℘′ ───────────────────────────────────────────────────

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

vec2 wpp(vec2 z, vec2 tau) {
  vec2 sum = vec2(0.0);
  for (int m = -TERMS; m <= TERMS; m++) {
    if (m < -u_terms || m > u_terms) continue;
    for (int n = -TERMS; n <= TERMS; n++) {
      if (n < -u_terms || n > u_terms) continue;
      vec2 w = latticePoint(m, n, tau);
      vec2 diff = cSub(z, w);
      vec2 inv3 = cInv(cMul(diff, cMul(diff, diff)));
      sum = cSub(sum, cScale(2.0, inv3));
    }
  }
  return sum;
}

// ── User expression ────────────────────────────────────────────────────────

vec2 user_expr(vec2 v_wp, vec2 v_wpp, float u_g2, float u_g3) {
  /*__EXPR_BODY__*/
}

// ── Main ───────────────────────────────────────────────────────────────────

void main() {
  vec2 z = vec2(v_uv.x + v_uv.y * u_tau.x, v_uv.y * u_tau.y);
  vec2 v_wp = wp(z, u_tau);
  vec2 v_wpp = wpp(z, u_tau);
  vec2 w = user_expr(v_wp, v_wpp, u_g2, u_g3);

  vec3 color;
  if      (u_mode == 0) color = paletteClassic(w);
  else if (u_mode == 1) color = paletteEmber(w);
  else if (u_mode == 2) color = paletteDusk(w);
  else if (u_mode == 3) color = paletteContours(w);
  else if (u_mode == 4) color = palettePhaseBands(w);
  else                  color = paletteNeon(w);

  // Fixed gamma lift
  color = pow(clamp(color, 0.0, 1.0), vec3(0.8));

  if (u_halo > 0.0) {
    float lw = log(max(cAbs(w), 1e-9));

    float pole = smoothstep(POLE_THRESHOLD, POLE_THRESHOLD + POLE_SOFTNESS, lw)
                 * POLE_STRENGTH * u_halo;
    color = mix(color, vec3(1.0), clamp(pole, 0.0, 1.0));

    float zero = smoothstep(ZERO_THRESHOLD, ZERO_THRESHOLD + ZERO_SOFTNESS, -lw)
                 * ZERO_STRENGTH * u_halo;
    color *= (1.0 - clamp(zero, 0.0, 1.0));
  }

  // Prevent u_g2 and u_g3 from being optimized away (they're function parameters)
  if (u_g2 > 1e10 || u_g3 > 1e10) {
    color = vec3(0.0);  // unreachable but keeps uniforms alive
  }

  out_color = vec4(color, 1.0);
}
