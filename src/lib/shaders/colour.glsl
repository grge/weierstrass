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

struct DomainFeatures {
  float arg;
  float mag;
  float logMag;
  float phase01;
  float ring01;
};

DomainFeatures domainFeatures(vec2 w) {
  DomainFeatures f;
  f.arg = atan(w.y, w.x);
  f.mag = cAbs(w);
  f.logMag = log2(max(f.mag, 1e-7));
  f.phase01 = fract(f.arg / (2.0 * PI));
  f.ring01 = fract(f.logMag);
  return f;
}

float bandPulse(float x, float width) {
  return 1.0 - smoothstep(0.0, width, min(x, 1.0 - x));
}

float ringMod(float ring01, float amp) {
  return (1.0 - amp) + amp * (0.5 + 0.5 * cos(2.0 * PI * ring01));
}

// ── Palettes ──────────────────────────────────────────────────────────────────

// 1. Classic: Wegert-style — full rainbow hue, conformal rings from log₂|w|
vec3 paletteClassic(vec2 w) {
  DomainFeatures f = domainFeatures(w);
  float v = 0.4 + 0.55 * (1.0 - f.ring01);
  return hsv2rgb(vec3(f.phase01, 0.95, v));
}

// 2. Ember: argument → warm cosine palette, magnitude → brightness
vec3 paletteEmber(vec2 w) {
  DomainFeatures f = domainFeatures(w);

  vec3 col = cosPalette(f.phase01,
    vec3(0.65, 0.28, 0.04),
    vec3(0.35, 0.26, 0.04),
    vec3(1.0,  1.0,  1.0),
    vec3(0.0,  0.08, 0.30)
  );

  float v = 1.0 - 1.0 / (1.0 + 2.2 * pow(f.mag, 0.28));
  return col * (0.08 + 0.92 * v);
}

// 3. Dusk: pure phase portrait, minimal magnitude modulation
vec3 paletteDusk(vec2 w) {
  DomainFeatures f = domainFeatures(w);

  vec3 col = cosPalette(f.phase01,
    vec3(0.60, 0.42, 0.15),
    vec3(0.38, 0.28, 0.12),
    vec3(1.0,  1.0,  0.8),
    vec3(0.0,  0.10, 0.35)
  );

  return col * ringMod(f.ring01, 0.18);
}

// 4. Contours: dark bg, amber conformal grid (magnitude circles + argument rays)
vec3 paletteContours(vec2 w) {
  DomainFeatures f = domainFeatures(w);

  float magLine = bandPulse(f.ring01, 0.06);
  float argLine = bandPulse(fract(f.phase01 * 8.0), 0.06);

  vec3 magCol = vec3(1.00, 0.62, 0.12);
  vec3 argCol = vec3(0.90, 0.85, 0.50);
  vec3 bg     = vec3(0.04, 0.02, 0.01);

  vec3 col = bg;
  col = mix(col, magCol, magLine);
  col = mix(col, argCol, argLine * (1.0 - magLine));
  return col;
}

// 5. Phase bands: discrete phase sectors only, with no modulus contouring
vec3 palettePhaseBands(vec2 w) {
  DomainFeatures f = domainFeatures(w);
  float n = 12.0;
  float phaseBand = floor(f.phase01 * n) / n;
  return cosPalette(phaseBand,
    vec3(0.58, 0.34, 0.10),
    vec3(0.28, 0.20, 0.10),
    vec3(1.0, 1.0, 1.0),
    vec3(0.00, 0.10, 0.32)
  );
}

// 6. Neon: warm arc-lamp variant rather than blue cyber-neon, so it belongs with the rest
vec3 paletteNeon(vec2 w) {
  DomainFeatures f = domainFeatures(w);
  vec3 base = cosPalette(f.phase01,
    vec3(0.16, 0.08, 0.04),
    vec3(0.55, 0.30, 0.12),
    vec3(1.0),
    vec3(0.00, 0.10, 0.28)
  );
  float glow = pow(0.5 + 0.5 * cos(2.0 * PI * f.ring01), 3.0);
  vec3 hot = vec3(1.00, 0.82, 0.58);
  vec3 col = base * (0.26 + 1.05 * glow);
  return mix(col, hot, 0.18 * glow);
}
