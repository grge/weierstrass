// ── Colour helpers ────────────────────────────────────────────────────────────
// Shared by tile and modular-tau shaders.
// Depends on: PI (from complex.glsl), cAbs (from complex.glsl).

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// Inigo Quilez cosine palette
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(2.0 * PI * (c * t + d));
}

// ── Palettes ──────────────────────────────────────────────────────────────────

// 1. Classic: Wegert-style — full rainbow hue, conformal rings from log₂|w|
vec3 paletteClassic(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);
  float hue = fract(arg / (2.0 * PI));
  float lm  = log2(max(mag, 1e-7));
  float v = 0.4 + 0.55 * (1.0 - fract(lm));
  return hsv2rgb(vec3(hue, 0.95, v));
}

// 2. Ember: argument → warm cosine palette, magnitude → brightness
vec3 paletteEmber(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);
  float t   = fract(arg / (2.0 * PI));

  vec3 col = cosPalette(t,
    vec3(0.65, 0.28, 0.04),
    vec3(0.35, 0.26, 0.04),
    vec3(1.0,  1.0,  1.0),
    vec3(0.0,  0.08, 0.30)
  );

  float v = 1.0 - 1.0 / (1.0 + 2.2 * pow(mag, 0.28));
  return col * (0.08 + 0.92 * v);
}

// 3. Dusk: pure phase portrait, minimal magnitude modulation
vec3 paletteDusk(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);
  float t   = fract(arg / (2.0 * PI));

  vec3 col = cosPalette(t,
    vec3(0.60, 0.42, 0.15),
    vec3(0.38, 0.28, 0.12),
    vec3(1.0,  1.0,  0.8),
    vec3(0.0,  0.10, 0.35)
  );

  float lm    = log2(max(mag, 1e-7));
  float rings = 0.82 + 0.18 * sin(PI * fract(lm));
  return col * rings;
}

// 4. Contours: dark bg, amber conformal grid (magnitude circles + argument rays)
vec3 paletteContours(vec2 w) {
  float arg = atan(w.y, w.x);
  float mag = cAbs(w);
  float lm  = log2(max(mag, 1e-7));

  float mf       = fract(lm);
  float mag_line = 1.0 - smoothstep(0.0, 0.06, min(mf, 1.0 - mf));

  float af       = fract(arg / (2.0 * PI) * 8.0);
  float arg_line = 1.0 - smoothstep(0.0, 0.06, min(af, 1.0 - af));

  vec3 mag_col = vec3(1.00, 0.62, 0.12);
  vec3 arg_col = vec3(0.90, 0.85, 0.50);
  vec3 bg      = vec3(0.04, 0.02, 0.01);

  vec3 col = bg;
  col = mix(col, mag_col, mag_line);
  col = mix(col, arg_col, arg_line * (1.0 - mag_line));
  return col;
}
