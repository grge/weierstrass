precision highp float;
varying vec2 v_uv;

uniform vec2  u_tau;
uniform int   u_mode;
uniform float u_halo;
uniform int   u_terms;
const float PI = 3.141592653589793;
const int TERMS = 20;  // max; actual loop uses u_terms

// Pole/zero glow constants (previously tunable uniforms, fixed at tuned values)
const float POLE_THRESHOLD = 3.0;
const float POLE_SOFTNESS  = 6.0;
const float POLE_STRENGTH  = 2.0;
const float ZERO_THRESHOLD = -1.0;
const float ZERO_SOFTNESS  = 3.0;
const float ZERO_STRENGTH  = 2.0;

// ── complex arithmetic ────────────────────────────────────────────────────────

vec2 cSub(vec2 a, vec2 b) { return a - b; }
vec2 cMul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
float cAbs(vec2 a) { return sqrt(dot(a, a)); }
vec2 cInv(vec2 a) { float d = dot(a,a); return vec2(a.x, -a.y) / max(d, 1e-8); }
vec2 cInvSq(vec2 a) { vec2 inv = cInv(a); return cMul(inv, inv); }

vec2 latticePoint(int m, int n, vec2 tau) {
  return vec2(float(m) + float(n) * tau.x, float(n) * tau.y);
}

// ── Weierstrass ℘ ─────────────────────────────────────────────────────────────

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

// ── colour helpers ────────────────────────────────────────────────────────────

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// Inigo Quilez cosine palette
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(2.0 * PI * (c * t + d));
}

// ── palettes ──────────────────────────────────────────────────────────────────

// 1. Classic: Wegert-style — full rainbow hue, conformal rings from log₂|w|
vec3 paletteClassic(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);
  float hue = fract(arg / (2.0 * PI));
  float lm  = log2(max(mag, 1e-7));
  // fract(lm) cycles 0→1 on every octave of magnitude → conformal rings
  float v = 0.4 + 0.55 * (1.0 - fract(lm));
  return hsv2rgb(vec3(hue, 0.95, v));
}

// 2. Ember: argument → warm cosine palette, magnitude → brightness
vec3 paletteEmber(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);
  float t   = fract(arg / (2.0 * PI));

  // Cycles: bright amber-gold → deep orange → near-black → back
  vec3 col = cosPalette(t,
    vec3(0.65, 0.28, 0.04),   // a: centre of oscillation
    vec3(0.35, 0.26, 0.04),   // b: amplitude
    vec3(1.0,  1.0,  1.0),    // c: frequency (1 cycle per t)
    vec3(0.0,  0.08, 0.30)    // d: phase offset per channel
  );

  // t=0.0 → gold (1.0, 0.54, 0.08)
  // t=0.5 → dark (0.30, 0.02, 0.00)
  // t=1.0 → gold again (cyclic)

  float v = 1.0 - 1.0 / (1.0 + 2.2 * pow(mag, 0.28));
  return col * (0.08 + 0.92 * v);
}

// 3. Dusk: pure phase portrait, minimal magnitude modulation
vec3 paletteDusk(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);
  float t   = fract(arg / (2.0 * PI));

  // Narrow warm range: deep amber → pale gold → deep amber
  // Restricted frequency to stay within warm tones (no full rainbow)
  vec3 col = cosPalette(t,
    vec3(0.60, 0.42, 0.15),   // a
    vec3(0.38, 0.28, 0.12),   // b
    vec3(1.0,  1.0,  0.8),    // c: slightly slower blue channel → stays warm
    vec3(0.0,  0.10, 0.35)    // d
  );

  // Only gentle magnitude modulation — just enough to see poles (bright) and zeros (dark)
  float lm   = log2(max(mag, 1e-7));
  float rings = 0.82 + 0.18 * sin(PI * fract(lm));  // very subtle ripple
  return col * rings;
}

// 4. Contours: dark bg, amber conformal grid (magnitude circles + argument rays)
vec3 paletteContours(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);

  float lm = log2(max(mag, 1e-7));

  // Magnitude level sets: thin bright lines at each log2-magnitude level
  float mf       = fract(lm);
  float mag_line = 1.0 - smoothstep(0.0, 0.06, min(mf, 1.0 - mf));

  // Argument level sets: 8 evenly-spaced rays (arg = k*π/4)
  float af       = fract(arg / (2.0 * PI) * 8.0);
  float arg_line = 1.0 - smoothstep(0.0, 0.06, min(af, 1.0 - af));

  float line = max(mag_line, arg_line);

  // Two-tone: magnitude lines in warm amber, argument lines slightly cooler gold
  vec3 mag_col = vec3(1.00, 0.62, 0.12);  // warm amber
  vec3 arg_col = vec3(0.90, 0.85, 0.50);  // pale gold
  vec3 bg      = vec3(0.04, 0.02, 0.01);  // near-black

  vec3 col = bg;
  col = mix(col, mag_col, mag_line);
  col = mix(col, arg_col, arg_line * (1.0 - mag_line));  // argument on top where no mag line
  return col;
}

// ── main ──────────────────────────────────────────────────────────────────────

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
