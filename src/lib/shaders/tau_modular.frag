#version 300 es
precision highp float;

in vec2 v_uv;
layout(location = 0) out vec4 out_color;

uniform int   u_func;    // 0=j, 1=delta, 2=e4, 3=e6
uniform int   u_mode;    // colour palette index (matches tile.frag modes)
uniform int   u_terms;   // q-series truncation depth
uniform float u_x_min;
uniform float u_x_max;
uniform float u_y_min;
uniform float u_y_max;

// ── [complex.glsl]
// ── [colour.glsl]

// ── Eisenstein series ─────────────────────────────────────────────────────────
// E4(τ) = 1 + 240 Σ σ₃(n) qⁿ
// E6(τ) = 1 - 504 Σ σ₅(n) qⁿ
// where q = exp(2πiτ), convergent for Im(τ) > 0.

const int MAX_N = 60;  // hard cap; actual depth controlled by u_terms

float sigma3(int n) {
  float s = 0.0;
  for (int d = 1; d <= MAX_N; d++) {
    if (d > n) break;
    if (d * (n / d) == n) { float f = float(d); s += f * f * f; }
  }
  return s;
}

float sigma5(int n) {
  float s = 0.0;
  for (int d = 1; d <= MAX_N; d++) {
    if (d > n) break;
    if (d * (n / d) == n) { float f = float(d); s += f * f * f * f * f; }
  }
  return s;
}

vec2 eisensteinE4(vec2 q) {
  vec2 result = vec2(1.0, 0.0);
  vec2 qpow = q;
  for (int n = 1; n <= MAX_N; n++) {
    if (n > u_terms) break;
    result += 240.0 * sigma3(n) * qpow;
    qpow = cMul(qpow, q);
  }
  return result;
}

vec2 eisensteinE6(vec2 q) {
  vec2 result = vec2(1.0, 0.0);
  vec2 qpow = q;
  for (int n = 1; n <= MAX_N; n++) {
    if (n > u_terms) break;
    result -= 504.0 * sigma5(n) * qpow;
    qpow = cMul(qpow, q);
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  float tx = u_x_min + v_uv.x * (u_x_max - u_x_min);
  float ty = u_y_min + v_uv.y * (u_y_max - u_y_min);

  // Fade/mask near the real axis where q-series converges poorly
  if (ty < 0.01) {
    out_color = vec4(0.08, 0.04, 0.02, 1.0);
    return;
  }

  // q = exp(2πiτ),  |q| = exp(-2π Im(τ))
  float qabs = exp(-2.0 * PI * ty);
  vec2  q    = qabs * vec2(cos(2.0 * PI * tx), sin(2.0 * PI * tx));

  vec2 E4v    = eisensteinE4(q);
  vec2 E6v    = eisensteinE6(q);
  vec2 E4sq   = cMul(E4v, E4v);
  vec2 E4cube = cMul(E4sq, E4v);
  vec2 E6sq   = cMul(E6v, E6v);
  vec2 Delta  = (E4cube - E6sq) / 1728.0;  // Ramanujan Δ

  vec2 w;
  if      (u_func == 0) w = cMul(E4cube, cInv(Delta));  // j(τ) = E4³/Δ
  else if (u_func == 1) w = Delta;                       // Δ(τ)
  else if (u_func == 2) w = E4v;                         // E4(τ)
  else                  w = E6v;                         // E6(τ)

  vec3 color;
  if      (u_mode == 0) color = paletteClassic(w);
  else if (u_mode == 1) color = paletteEmber(w);
  else if (u_mode == 2) color = paletteDusk(w);
  else if (u_mode == 3) color = paletteContours(w);
  else if (u_mode == 4) color = palettePhaseBands(w);
  else                  color = paletteNeon(w);

  // Consistent gamma lift with tile shader
  color = pow(clamp(color, 0.0, 1.0), vec3(0.8));

  // Fade near real axis
  float fade = smoothstep(0.01, 0.08, ty);
  color = mix(vec3(0.08, 0.04, 0.02), color, fade);

  out_color = vec4(color, 1.0);
}
