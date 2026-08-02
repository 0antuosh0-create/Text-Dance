/**
 * Tiny shared helpers — the hot-path utilities every scene and text
 * renderer calls on every frame.  Kept minimal and allocation-free
 * where possible.
 */

/** Re-usable canvas-safe rgba() without extra string interpolation. */
const RGB_CACHE = new Map<string, string>();
export function rgba(hex: string, a: number): string {
  if (a >= 1) return hex;
  if (a <= 0) return 'rgba(0,0,0,0)';
  const key = hex + a.toFixed(2);
  let v = RGB_CACHE.get(key);
  if (v !== undefined) return v;
  // inline hex→rgb once per unique value
  const n = parseInt(hex.slice(1), 16);
  v = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  if (RGB_CACHE.size < 8000) RGB_CACHE.set(key, v);
  return v;
}

/** Fast hex→[r,g,b] without per-call parseInt. */
const _RGB = new Map<string, [number, number, number]>();
export function hexToRgb(hex: string): [number, number, number] {
  let v = _RGB.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    if (_RGB.size < 200) _RGB.set(hex, v);
  }
  return v;
}

/** Pre-compute lerp tables for plasma — renders into a 256-entry LUT. */
export function buildPlasmaLUT(palette: { colors: string[]; bg: [string, string] }): Uint8ClampedArray {
  const colors = palette.colors;
  const N = 256;
  const lut = new Uint8ClampedArray(N * 4);
  const last = colors.length - 1;
  for (let i = 0; i < N; i++) {
    const f = (i / (N - 1)) * last;
    const idx = Math.min(last, Math.floor(f));
    const next = Math.min(last, idx + 1);
    const t = f - idx;
    const [r1, g1, b1] = hexToRgb(colors[idx]);
    const [r2, g2, b2] = hexToRgb(colors[next]);
    const o = i * 4;
    lut[o] = r1 + (r2 - r1) * t;
    lut[o + 1] = g1 + (g2 - g1) * t;
    lut[o + 2] = b1 + (b2 - b1) * t;
    lut[o + 3] = 255;
  }
  return lut;
}

/** A lazily-composited offscreen frame that can be drawn at half-size then upscaled. */
export function ensureOffscreen(w: number, h: number): HTMLCanvasElement {
  // kept in a simple module-level single-instance cache
  const c = _off;
  if (c && c.width === w && c.height === h) return c;
  c && (c.width = 0, c.height = 0); // release memory
  const n = document.createElement('canvas');
  n.width = w;
  n.height = h;
  _off = n;
  return n;
}
let _off: HTMLCanvasElement | null = null;
