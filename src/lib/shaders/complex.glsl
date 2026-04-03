// ── Complex arithmetic ────────────────────────────────────────────────────────
// Shared by tile and modular-tau shaders.

const float PI = 3.141592653589793;

vec2 cSub(vec2 a, vec2 b) { return a - b; }
vec2 cMul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
float cAbs(vec2 a) { return sqrt(dot(a, a)); }
vec2 cInv(vec2 a) { float d = dot(a,a); return vec2(a.x, -a.y) / max(d, 1e-8); }
vec2 cInvSq(vec2 a) { vec2 inv = cInv(a); return cMul(inv, inv); }
