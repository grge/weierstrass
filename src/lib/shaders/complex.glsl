// ── Complex arithmetic ────────────────────────────────────────────────────────
// Shared by tile and modular-tau shaders.

const float PI = 3.141592653589793;

// Forward declarations for functions that call each other
vec2 cInv(vec2 a);
vec2 cMul(vec2 a, vec2 b);
vec2 cPowInt(vec2 z, int n);

// Implementations
vec2 cAdd(vec2 a, vec2 b) { return a + b; }
vec2 cSub(vec2 a, vec2 b) { return a - b; }
vec2 cMul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cDiv(vec2 a, vec2 b) { return cMul(a, cInv(b)); }
vec2 cScale(float s, vec2 a) { return vec2(s * a.x, s * a.y); }
float cAbs(vec2 a) { return sqrt(dot(a, a)); }
vec2 cInv(vec2 a) { float d = dot(a,a); return vec2(a.x, -a.y) / max(d, 1e-8); }
vec2 cInvSq(vec2 a) { vec2 inv = cInv(a); return cMul(inv, inv); }

/** Complex power with integer exponent (supports negative via inverse).
    Uses binary exponentiation for efficiency. No recursion. */
vec2 cPowInt(vec2 z, int n) {
  if (n == 0) return vec2(1.0, 0.0);

  // Handle negative exponents: compute positive power, then invert
  int absN = n < 0 ? -n : n;
  vec2 result = vec2(1.0, 0.0);
  vec2 base = z;
  int exp = absN;

  for (int i = 0; i < 32; i++) {
    if (exp == 0) break;
    if ((exp & 1) == 1) result = cMul(result, base);
    base = cMul(base, base);
    exp = exp >> 1;
  }

  // If original exponent was negative, invert the result
  if (n < 0) result = cInv(result);

  return result;
}
