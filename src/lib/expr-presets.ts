export const EXPR_PRESETS: { label: string; value: string }[] = [
  { label: "Weierstrass ℘",          value: "wp" },
  { label: "Derivative ℘′",          value: "wpp" },
  { label: "℘′² − 4℘³ + g₂℘ + g₃",  value: "wpp^2 - 4*wp^3 + g2*wp + g3" },
  { label: "℘² − 1/12",              value: "wp^2 - 1/12" },
  { label: "℘′ / (℘ − 1)",           value: "wpp/(wp - 1)" },
  { label: "℘²",                     value: "wp^2" },
  { label: "℘³",                     value: "wp^3" },
];
