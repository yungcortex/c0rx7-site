import { Color3 } from "@babylonjs/core";

const SKIN_PALETTE: [number, number, number][] = [
  // Warm warm-light → deep, then cool-light → deep. Interpreted as the
  // bean's body palette (Fall-Guys colour wheel) since beans aren't really
  // "skinned" — every entry is now a usable bean colour.
  [1.0, 0.78, 0.55], [0.95, 0.65, 0.45], [0.95, 0.5, 0.35],
  [0.85, 0.4, 0.32], [0.75, 0.3, 0.4], [0.6, 0.22, 0.38],
  [0.45, 0.18, 0.42], [0.3, 0.18, 0.42], [0.22, 0.22, 0.5], [0.18, 0.3, 0.6],
  [0.32, 0.62, 0.85], [0.35, 0.85, 0.75], [0.4, 0.95, 0.4],
  [0.7, 0.95, 0.32], [0.95, 0.85, 0.35], [0.95, 0.65, 0.18],
  [0.85, 0.35, 0.6], [0.65, 0.4, 0.95], [0.95, 0.45, 0.85], [0.95, 0.92, 0.85],
];

export function paletteIndexToColor(idx: number): Color3 {
  const c = SKIN_PALETTE[Math.max(0, Math.min(SKIN_PALETTE.length - 1, idx))]!;
  return new Color3(c[0], c[1], c[2]);
}

export function hsvToRgbColor(h: number, s: number, v: number): Color3 {
  const hh = (h / 255) * 360;
  const ss = s / 255;
  const vv = v / 255;
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60) { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return new Color3(r + m, g + m, b + m);
}
