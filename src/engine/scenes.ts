import { mulberry32, Palette, StyleId, VideoConfig } from './themes';
// Local copies to avoid circular dependency with render.ts
const RGB_CACHE = new Map<string, [number, number, number]>();
const RGBA_CACHE = new Map<string, string>();
function hexToRgb(hex: string): [number, number, number] {
  const cached = RGB_CACHE.get(hex);
  if (cached) return cached;
  const n = parseInt(hex.slice(1), 16);
  const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  if (RGB_CACHE.size < 128) RGB_CACHE.set(hex, rgb);
  return rgb;
}
const LUT_CACHE = new Map<string, Uint8ClampedArray>();
function getPlasmaLUT(colors: string[]): Uint8ClampedArray {
  const key = colors.join(',');
  let lut = LUT_CACHE.get(key);
  if (lut) return lut;
  const N = 256;
  lut = new Uint8ClampedArray(N * 4);
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
  if (LUT_CACHE.size < 20) LUT_CACHE.set(key, lut);
  return lut;
}

export type SceneDraw = (ctx: CanvasRenderingContext2D, t: number) => void;

function bgGradient(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette) {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, p.bg[0]);
  g.addColorStop(1, p.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function rgba(hex: string, a: number) {
  if (a >= 1) return hex;
  if (a <= 0) return 'rgba(0,0,0,0)';
  // Quantizing alpha to 2 decimals prevents thousands of one-off strings in
  // particle scenes while remaining visually indistinguishable.
  const alpha = Math.round(a * 100) / 100;
  const key = `${hex}:${alpha}`;
  const cached = RGBA_CACHE.get(key);
  if (cached) return cached;
  const [r, g, b] = hexToRgb(hex);
  const color = `rgba(${r},${g},${b},${alpha})`;
  if (RGBA_CACHE.size < 4096) RGBA_CACHE.set(key, color);
  return color;
}

// ============================================================
// NEBULA — drifting cosmic gradient blobs + star dust
// ============================================================
function nebulaScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const blobs = Array.from({ length: 7 }, (_, i) => ({
    color: p.colors[i % p.colors.length],
    r: (0.25 + rng() * 0.3) * Math.max(w, h),
    ax: rng() * w, ay: rng() * h,
    dx: (0.15 + rng() * 0.25) * w, dy: (0.1 + rng() * 0.2) * h,
    sx: 0.05 + rng() * 0.12, sy: 0.04 + rng() * 0.1,
    ph: rng() * Math.PI * 2,
  }));
  const stars = Array.from({ length: 180 }, () => ({
    x: rng() * w, y: rng() * h, r: 0.5 + rng() * 1.8, tw: rng() * Math.PI * 2, sp: 0.5 + rng() * 2,
  }));
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    blobs.forEach((b) => {
      const x = b.ax + Math.sin(t * b.sx * Math.PI * 2 + b.ph) * b.dx;
      const y = b.ay + Math.cos(t * b.sy * Math.PI * 2 + b.ph) * b.dy;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
      g.addColorStop(0, rgba(b.color, 0.5));
      g.addColorStop(0.5, rgba(b.color, 0.16));
      g.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
    });
    ctx.restore();
    stars.forEach((s) => {
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * s.sp + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  };
}

// ============================================================
// AURORA — glowing sine ribbons over a starry night
// ============================================================
function auroraScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const ribbons = Array.from({ length: 4 }, (_, i) => ({
    color: p.colors[i % p.colors.length],
    baseY: h * (0.25 + i * 0.13),
    amp: h * (0.05 + rng() * 0.08),
    freq: 1.2 + rng() * 1.6,
    speed: 0.3 + rng() * 0.5,
    thick: h * (0.10 + rng() * 0.12),
    ph: rng() * Math.PI * 2,
  }));
  const stars = Array.from({ length: 140 }, () => ({
    x: rng() * w, y: rng() * h * 0.85, r: 0.4 + rng() * 1.5, tw: rng() * 6, sp: 0.6 + rng() * 2,
  }));
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    stars.forEach((s) => {
      const a = 0.25 + 0.6 * Math.abs(Math.sin(t * s.sp + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ribbons.forEach((rb) => {
      const steps = 60;
      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * w;
          const y =
            rb.baseY +
            Math.sin((i / steps) * rb.freq * Math.PI * 2 + t * rb.speed * Math.PI * 2 + rb.ph) * rb.amp +
            Math.sin((i / steps) * rb.freq * 5 + t * rb.speed * 3.7 + rb.ph * 2) * rb.amp * 0.3 +
            layer * rb.thick * 0.28;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = rgba(rb.color, 0.20 - layer * 0.05);
        ctx.lineWidth = rb.thick * (1 - layer * 0.25);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    });
    ctx.restore();
    // ground silhouette
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * w;
      ctx.lineTo(x, h * 0.92 - Math.abs(Math.sin(i * 1.7 + 2)) * h * 0.05);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
}

// ============================================================
// OCEAN — layered rolling waves with glowing moon
// ============================================================
function oceanScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const layers = Array.from({ length: 5 }, (_, i) => ({
    color: p.colors[i % p.colors.length],
    baseY: h * (0.45 + i * 0.11),
    amp: h * (0.02 + rng() * 0.03) * (1 + i * 0.3),
    freq: 1.5 + rng() * 2,
    speed: (0.25 + rng() * 0.3) * (i % 2 === 0 ? 1 : -1),
    alpha: 0.25 + i * 0.14,
  }));
  const sparkles = Array.from({ length: 60 }, () => ({
    x: rng() * w, y: h * (0.5 + rng() * 0.45), sp: 1 + rng() * 3, ph: rng() * 6,
  }));
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    // moon
    const mx = w * 0.72, my = h * 0.2, mr = Math.min(w, h) * 0.07;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 5);
    mg.addColorStop(0, 'rgba(255,255,255,0.95)');
    mg.addColorStop(0.12, 'rgba(255,255,255,0.85)');
    mg.addColorStop(0.3, rgba(p.colors[0], 0.25));
    mg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    // waves
    layers.forEach((L) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        const y =
          L.baseY +
          Math.sin((i / steps) * L.freq * Math.PI * 2 + t * L.speed * Math.PI * 2) * L.amp +
          Math.sin((i / steps) * L.freq * 4.3 + t * L.speed * 5) * L.amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = rgba(L.color, L.alpha * 0.5);
      ctx.fill();
    });
    // sparkles on water
    sparkles.forEach((s) => {
      const a = Math.max(0, Math.sin(t * s.sp + s.ph)) * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(s.x, s.y, 3, 1.5);
    });
  };
}

// ============================================================
// STARFIELD — warp travel through 3D stars
// ============================================================
function starfieldScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const N = 420;
  const stars = Array.from({ length: N }, (_, i) => ({
    x: (rng() - 0.5) * 2, y: (rng() - 0.5) * 2, z: rng(),
    color: i % 7 === 0 ? p.colors[i % p.colors.length] : '#ffffff',
  }));
  const speed = 0.28;
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    const cx = w / 2, cy = h / 2;
    const f = Math.min(w, h);
    stars.forEach((s) => {
      let z = s.z - ((t * speed) % 1);
      z = ((z % 1) + 1) % 1;
      const zz = Math.max(z, 0.02);
      const px = cx + (s.x / zz) * f * 0.5;
      const py = cy + (s.y / zz) * f * 0.5;
      const pz = Math.max(z + 0.06, 0.03);
      const px2 = cx + (s.x / pz) * f * 0.5;
      const py2 = cy + (s.y / pz) * f * 0.5;
      if (px < -50 || px > w + 50 || py < -50 || py > h + 50) return;
      const a = (1 - z) * 0.9;
      ctx.strokeStyle = rgba(s.color === '#ffffff' ? '#ffffff' : s.color, a);
      ctx.lineWidth = (1 - z) * 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px2, py2);
      ctx.lineTo(px, py);
      ctx.stroke();
    });
    // center glow
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, f * 0.5);
    g.addColorStop(0, rgba(p.colors[0], 0.18));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
}

// ============================================================
// EMBERS — rising fire particles with bottom glow
// ============================================================
function embersScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed, duration } = cfg;
  const rng = mulberry32(seed);
  const N = 160;
  const parts = Array.from({ length: N }, (_, i) => ({
    x0: rng() * w,
    speed: h * (0.08 + rng() * 0.2),
    r: 1.5 + rng() * 4,
    sway: 20 + rng() * 60,
    swaySp: 0.5 + rng() * 2,
    ph: rng() * Math.PI * 2,
    off: rng() * (duration + 5),
    color: p.colors[i % p.colors.length],
    life: 4 + rng() * 5,
  }));
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    // bottom furnace glow
    const g = ctx.createLinearGradient(0, h, 0, h * 0.45);
    g.addColorStop(0, rgba(p.colors[0], 0.4 + 0.08 * Math.sin(t * 3)));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    parts.forEach((pt) => {
      const local = ((t + pt.off) % pt.life) / pt.life;
      const y = h + 30 - local * (h + 120) * (pt.speed / (h * 0.14));
      if (y < -30 || y > h + 40) return;
      const x = pt.x0 + Math.sin(t * pt.swaySp + pt.ph) * pt.sway;
      const a = Math.sin(local * Math.PI) * 0.9;
      const rr = pt.r * (1 - local * 0.4);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rr * 4);
      rg.addColorStop(0, rgba(pt.color, a));
      rg.addColorStop(0.4, rgba(pt.color, a * 0.35));
      rg.addColorStop(1, rgba(pt.color, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(x - rr * 4, y - rr * 4, rr * 8, rr * 8);
      ctx.fillStyle = `rgba(255,240,220,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, rr * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };
}

// ============================================================
// MATRIX — digital rain
// ============================================================
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFXYZ<>+*/=#$'.split('');
function matrixScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const fs = Math.max(14, Math.round(Math.min(w, h) / 46));
  const cols = Math.ceil(w / fs);
  const streams = Array.from({ length: cols }, (_, i) => ({
    x: i * fs,
    speed: (4 + rng() * 9) * fs, // px per second
    off: rng() * h * 3,
    len: 10 + Math.floor(rng() * 18),
    glyphSeed: Math.floor(rng() * 9999),
  }));
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    ctx.font = `${fs}px "Courier New", monospace`;
    ctx.textBaseline = 'top';
    const c0 = p.colors[0];
    streams.forEach((st) => {
      const headY = ((st.off + t * st.speed) % (h + st.len * fs * 2)) - st.len * fs;
      const grng = mulberry32(st.glyphSeed + Math.floor((st.off + t * st.speed) / (h + st.len * fs * 2)));
      for (let k = 0; k < st.len; k++) {
        const y = headY - k * fs;
        if (y < -fs || y > h) continue;
        const gi = Math.floor(
          (Math.sin(st.glyphSeed + k * 13.7 + Math.floor(t * 9) * (k % 3 === 0 ? 1 : 0.0)) * 0.5 + 0.5) * GLYPHS.length
        ) % GLYPHS.length;
        const glyph = GLYPHS[(gi + Math.floor(grng() * GLYPHS.length)) % GLYPHS.length];
        if (k === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
        } else {
          ctx.fillStyle = rgba(c0, Math.max(0, 0.85 - k * (0.85 / st.len)));
        }
        ctx.fillText(glyph, st.x, y);
      }
    });
  };
}

// ============================================================
// GEOMETRIC — rotating concentric polygons + orbit dots
// ============================================================
function geometricScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const rings = Array.from({ length: 6 }, (_, i) => ({
    sides: 3 + Math.floor(rng() * 5),
    r: Math.min(w, h) * (0.12 + i * 0.085),
    speed: (0.04 + rng() * 0.08) * (i % 2 === 0 ? 1 : -1),
    color: p.colors[i % p.colors.length],
    lw: 1.5 + rng() * 2.5,
    ph: rng() * Math.PI * 2,
  }));
  const dots = Array.from({ length: 40 }, () => ({
    r: Math.min(w, h) * (0.1 + rng() * 0.52),
    speed: (0.05 + rng() * 0.15) * (rng() > 0.5 ? 1 : -1),
    ph: rng() * Math.PI * 2,
    size: 2 + rng() * 4,
  }));
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    const cx = w / 2, cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.7);
    g.addColorStop(0, rgba(p.colors[1], 0.14));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    rings.forEach((ring) => {
      const rot = t * ring.speed * Math.PI * 2 + ring.ph;
      ctx.beginPath();
      for (let i = 0; i <= ring.sides; i++) {
        const a = rot + (i / ring.sides) * Math.PI * 2;
        const x = cx + Math.cos(a) * ring.r;
        const y = cy + Math.sin(a) * ring.r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(ring.color, 0.6);
      ctx.lineWidth = ring.lw;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 18;
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
    dots.forEach((d, i) => {
      const a = t * d.speed * Math.PI * 2 + d.ph;
      const x = cx + Math.cos(a) * d.r;
      const y = cy + Math.sin(a) * d.r;
      ctx.fillStyle = rgba(p.colors[i % p.colors.length], 0.8);
      ctx.beginPath();
      ctx.arc(x, y, d.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };
}

// ============================================================
// NETWORK — drifting particle web with connecting lines
// ============================================================
function networkScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const N = Math.round((w * h) / 26000);
  const nodes = Array.from({ length: N }, (_, i) => ({
    ax: rng() * w, ay: rng() * h,
    dx: 40 + rng() * (w * 0.09), dy: 40 + rng() * (h * 0.09),
    sx: 0.05 + rng() * 0.12, sy: 0.05 + rng() * 0.12,
    ph: rng() * Math.PI * 2, ph2: rng() * Math.PI * 2,
    r: 2 + rng() * 3.5,
    color: p.colors[i % p.colors.length],
  }));
  const linkDist = Math.min(w, h) * 0.22;
  const linkDist2 = linkDist * linkDist;
  return (ctx, t) => {
    bgGradient(ctx, w, h, p);
    const pos = nodes.map((n) => ({
      x: n.ax + Math.sin(t * n.sx * Math.PI * 2 + n.ph) * n.dx,
      y: n.ay + Math.cos(t * n.sy * Math.PI * 2 + n.ph2) * n.dy,
    }));
    ctx.lineWidth = 1.2;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < linkDist2) {
          const d = Math.sqrt(d2);
          const a = (1 - d / linkDist) * 0.5;
          ctx.strokeStyle = rgba(nodes[i].color, a);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(pos[i].x, pos[i].y);
          ctx.lineTo(pos[j].x, pos[j].y);
          ctx.stroke();
        }
      }
    }
    nodes.forEach((n, i) => {
      const pulse = 1 + 0.3 * Math.sin(t * 2 + n.ph);
      const g = ctx.createRadialGradient(pos[i].x, pos[i].y, 0, pos[i].x, pos[i].y, n.r * 4);
      g.addColorStop(0, rgba(n.color, 0.9));
      g.addColorStop(0.4, rgba(n.color, 0.3));
      g.addColorStop(1, rgba(n.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(pos[i].x - n.r * 4, pos[i].y - n.r * 4, n.r * 8, n.r * 8);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos[i].x, pos[i].y, n.r * 0.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
    });
  };
}

// ============================================================
// SYNTHWAVE — retro grid + neon sun + scanlines
// ============================================================
function synthwaveScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const stars = Array.from({ length: 90 }, () => ({
    x: rng() * w, y: rng() * h * 0.45, r: 0.5 + rng() * 1.4, tw: rng() * 6,
  }));
  return (ctx, t) => {
    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    sky.addColorStop(0, '#0a0320');
    sky.addColorStop(0.6, rgba(p.colors[1], 0.5));
    sky.addColorStop(1, rgba(p.colors[2], 0.7));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.5);
    // stars
    stars.forEach((s) => {
      const a = 0.3 + 0.6 * Math.abs(Math.sin(t * 2 + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });
    // neon sun with stripes
    const sx = w / 2, sy = h * 0.42, sr = Math.min(w, h) * 0.18;
    const sg = ctx.createLinearGradient(sx, sy - sr, sx, sy + sr);
    sg.addColorStop(0, p.colors[2]);
    sg.addColorStop(0.5, p.colors[0]);
    sg.addColorStop(1, p.colors[1]);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    // sun stripes
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0a0320';
    for (let i = 0; i < 6; i++) {
      const y = sy + sr * 0.25 + i * sr * 0.14 + Math.sin(t * 0.5) * 4;
      ctx.fillRect(sx - sr, y, sr * 2, sr * 0.04 + i * 1.5);
    }
    ctx.restore();
    // ground
    const gg = ctx.createLinearGradient(0, h * 0.5, 0, h);
    gg.addColorStop(0, '#120529');
    gg.addColorStop(1, '#050112');
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    // perspective grid
    ctx.strokeStyle = rgba(p.colors[0], 0.55);
    ctx.lineWidth = 1.2;
    const horizY = h * 0.5;
    // vertical lines
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * (w / 10), h);
      ctx.lineTo(w / 2 + i * (w / 60), horizY);
      ctx.stroke();
    }
    // horizontal moving lines
    const rows = 14;
    for (let i = 0; i < rows; i++) {
      const phase = ((t * 0.5 + i / rows) % 1);
      const yy = horizY + (h - horizY) * (phase * phase);
      const a = phase;
      ctx.strokeStyle = rgba(p.colors[2], 0.25 + 0.55 * a);
      ctx.lineWidth = 0.8 + a * 2;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  };
}

// ============================================================
// PLASMA — morphing sinusoidal plasma field
// ============================================================
function plasmaScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed } = cfg;
  const rng = mulberry32(seed);
  const phase = rng() * Math.PI * 2;
  // Pre-compute LUT for palette
  const lut = getPlasmaLUT(p.colors);
  // Pre-allocated ImageData buffer — only created once
  let imgData: ImageData | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;
  let offCanvas: HTMLCanvasElement | null = null;
  return (ctx, t) => {
    const cellSize = Math.max(8, Math.round(Math.min(w, h) / 150));
    const cw = Math.ceil(w / cellSize);
    const ch = Math.ceil(h / cellSize);
    // Create or reuse offscreen canvas at low-res size
    if (!offCanvas || offCanvas.width !== cw || offCanvas.height !== ch) {
      offCanvas = document.createElement('canvas');
      offCanvas.width = cw;
      offCanvas.height = ch;
      offCtx = offCanvas.getContext('2d')!;
      imgData = offCtx.createImageData(cw, ch);
    }
    const data = imgData!.data;
    const t1 = t * 1.2 + phase;
    const t2 = t * 0.9 + phase * 2;
    const t3 = t * 1.4;
    const t4 = t * 1.8;
    // Fill ImageData with plasma field — pure integer math, no allocations
    let off = 0;
    for (let y = 0; y < ch; y++) {
      const v = y / ch;
      const v8 = v * 8;
      const vh = (v - 0.5);
      for (let x = 0; x < cw; x++) {
        const u = x / cw;
        const uh = (u - 0.5);
        const val =
          Math.sin(u * 10 + t1) +
          Math.sin(v8 + t2) +
          Math.sin((u + v) * 12 + t3) +
          Math.sin(Math.sqrt(uh * uh + vh * vh) * 14 - t4);
        const idx = Math.round(((val / 4 + 1) / 2) * 255) & 255;
        data[off++] = lut[idx * 4];
        data[off++] = lut[idx * 4 + 1];
        data[off++] = lut[idx * 4 + 2];
        data[off++] = 255;
      }
    }
    offCtx!.putImageData(imgData!, 0, 0);
    // Draw scaled up — one drawImage call replaces hundreds of fillRect calls
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offCanvas!, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    // dark vignette
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);
  };
}

// ============================================================
// SNOW — falling snowflakes over a moonlit landscape
// ============================================================
function snowScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed, duration } = cfg;
  const rng = mulberry32(seed);
  const N = 260;
  const flakes = Array.from({ length: N }, () => ({
    x: rng() * w, y: rng() * h,
    r: 1 + rng() * 3.5,
    speed: 20 + rng() * 70,
    sway: 10 + rng() * 40,
    swaySp: 0.3 + rng() * 1.2,
    ph: rng() * Math.PI * 2,
    off: rng() * (duration + 5),
  }));
  return (ctx, t) => {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1426');
    g.addColorStop(0.6, '#1a2a44');
    g.addColorStop(1, rgba(p.colors[1], 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // moon
    const mx = w * 0.78, my = h * 0.2, mr = Math.min(w, h) * 0.055;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 6);
    mg.addColorStop(0, 'rgba(255,255,255,0.95)');
    mg.addColorStop(0.08, 'rgba(255,255,255,0.8)');
    mg.addColorStop(0.3, rgba(p.colors[0], 0.2));
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
    // distant mountains
    ctx.fillStyle = 'rgba(20,30,50,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.75);
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * w;
      ctx.lineTo(x, h * 0.7 - Math.abs(Math.sin(i * 1.3 + 2)) * h * 0.08);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    // snow ground
    const sg = ctx.createLinearGradient(0, h * 0.82, 0, h);
    sg.addColorStop(0, rgba(p.colors[0], 0.5));
    sg.addColorStop(1, '#ffffff');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * w;
      ctx.lineTo(x, h * 0.84 + Math.sin(i * 0.8) * h * 0.015);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // snowflakes
    flakes.forEach((f) => {
      const local = ((t + f.off) % (duration + 2));
      const y = -10 + local * f.speed;
      if (y < -10 || y > h + 10) return;
      const x = f.x + Math.sin(t * f.swaySp + f.ph) * f.sway;
      const a = Math.min(1, 0.5 + f.r / 5);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, f.r, 0, Math.PI * 2);
      ctx.fill();
      if (f.r > 2.5) {
        const gg = ctx.createRadialGradient(x, y, 0, x, y, f.r * 3);
        gg.addColorStop(0, `rgba(255,255,255,${a * 0.3})`);
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(x - f.r * 3, y - f.r * 3, f.r * 6, f.r * 6);
      }
    });
  };
}

// ============================================================
// BUBBLES — rising bubbles with caustic light
// ============================================================
function bubblesScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed, duration } = cfg;
  const rng = mulberry32(seed);
  const N = 70;
  const bubbles = Array.from({ length: N }, () => ({
    x: rng() * w,
    r: 6 + rng() * 34,
    speed: 25 + rng() * 80,
    sway: 20 + rng() * 60,
    swaySp: 0.3 + rng() * 1.1,
    ph: rng() * Math.PI * 2,
    off: rng() * (duration + 8),
    color: p.colors[Math.floor(rng() * p.colors.length)],
  }));
  const causticRays = Array.from({ length: 8 }, (_, i) => ({
    x: rng() * w,
    speed: 0.2 + rng() * 0.3,
    ph: rng() * Math.PI * 2,
    width: 60 + rng() * 140,
    i,
  }));
  return (ctx, t) => {
    // underwater gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(p.colors[2], 0.55));
    g.addColorStop(0.4, rgba(p.colors[1], 0.75));
    g.addColorStop(1, p.bg[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // caustic light rays
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    causticRays.forEach((ray) => {
      const x = ray.x + Math.sin(t * ray.speed + ray.ph) * 120;
      const grad = ctx.createLinearGradient(x, 0, x + ray.width * 0.6, h);
      grad.addColorStop(0, rgba(p.colors[2], 0.25));
      grad.addColorStop(0.6, rgba(p.colors[0], 0.1));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - ray.width / 2, 0);
      ctx.lineTo(x + ray.width / 2, 0);
      ctx.lineTo(x + ray.width * 1.5, h);
      ctx.lineTo(x + ray.width, h);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
    // bubbles
    bubbles.forEach((b) => {
      const local = ((t + b.off) % (duration + 3));
      const y = h + 40 - local * b.speed;
      if (y < -40 || y > h + 40) return;
      const x = b.x + Math.sin(t * b.swaySp + b.ph) * b.sway;
      const pulse = 1 + 0.08 * Math.sin(t * 2 + b.ph);
      const rr = b.r * pulse;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      // outer glow
      const gg = ctx.createRadialGradient(x, y, rr * 0.3, x, y, rr * 1.6);
      gg.addColorStop(0, rgba(b.color, 0.35));
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - rr * 2, y - rr * 2, rr * 4, rr * 4);
      ctx.restore();
      // bubble body
      ctx.strokeStyle = rgba(b.color, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(x - rr * 0.3, y - rr * 0.35, rr * 0.18, 0, Math.PI * 2);
      ctx.fill();
    });
  };
}

// ============================================================
// ============================================================
// DARK SOULS — bonfire, rising embers, fog, gothic silhouette
// ============================================================
function darksoulsScene(cfg: VideoConfig): SceneDraw {
  const { width: w, height: h, palette: p, seed, duration } = cfg;
  const rng = mulberry32(seed);
  const N = 200;
  const embers = Array.from({ length: N }, () => ({
    x: w * 0.5 + (rng() - 0.5) * w * 0.25,
    speed: 40 + rng() * 90,
    r: 0.8 + rng() * 2.5,
    sway: 20 + rng() * 60,
    swaySp: 0.4 + rng() * 1.4,
    ph: rng() * Math.PI * 2,
    off: rng() * (duration + 5),
    color: p.colors[Math.floor(rng() * 3)], // ember tones only
    life: 3 + rng() * 4,
  }));
  // spires — a deterministic silhouette
  const spires: { x: number; h: number; w: number }[] = [];
  let xCursor = 0;
  while (xCursor < w) {
    const spW = 30 + rng() * 120;
    const spH = h * (0.15 + rng() * 0.35);
    spires.push({ x: xCursor, h: spH, w: spW });
    xCursor += spW * (0.6 + rng() * 0.6);
  }
  return (ctx, t) => {
    // dark smoky sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#07050a');
    sky.addColorStop(0.5, '#1a0f0c');
    sky.addColorStop(0.85, '#3a1d0e');
    sky.addColorStop(1, '#5a2a14');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // distant fog layer (slow drift)
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const fy = h * (0.45 + i * 0.08);
      const fg = ctx.createLinearGradient(0, fy - h * 0.1, 0, fy + h * 0.1);
      fg.addColorStop(0, 'rgba(140,90,50,0)');
      fg.addColorStop(0.5, `rgba(140,90,50,${0.06 + i * 0.02})`);
      fg.addColorStop(1, 'rgba(140,90,50,0)');
      ctx.fillStyle = fg;
      const offset = Math.sin(t * 0.15 + i) * w * 0.03;
      ctx.fillRect(offset, fy - h * 0.1, w, h * 0.2);
    }
    ctx.restore();

    // distant gothic spires silhouette (very dark)
    ctx.fillStyle = '#050304';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    spires.forEach((s) => {
      const baseY = h * 0.78 - s.h;
      // pointed top
      ctx.lineTo(s.x + s.w * 0.3, baseY + s.h * 0.3);
      ctx.lineTo(s.x + s.w * 0.5, baseY);
      ctx.lineTo(s.x + s.w * 0.7, baseY + s.h * 0.3);
      ctx.lineTo(s.x + s.w, h * 0.78);
    });
    ctx.lineTo(w, h * 0.78);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // ground / bonfire platform
    const gg = ctx.createLinearGradient(0, h * 0.78, 0, h);
    gg.addColorStop(0, '#120a06');
    gg.addColorStop(1, '#05030a');
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);

    // bonfire glow (pulsing)
    const bx = w / 2;
    const by = h * 0.82;
    const pulse = 1 + 0.12 * Math.sin(t * 6) + 0.08 * Math.sin(t * 11);
    const br = Math.min(w, h) * 0.32 * pulse;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0, rgba(p.colors[0], 0.55 * pulse));
    bg.addColorStop(0.3, rgba(p.colors[1], 0.25));
    bg.addColorStop(0.7, rgba(p.colors[2], 0.08));
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);

    // bonfire flame core (small dancing flames)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i++) {
      const fx = bx + Math.sin(t * 3 + i) * 10;
      const fy = by - 12 - i * 5 - Math.sin(t * 4 + i * 1.3) * 6;
      const fr = 6 + i * 0.8;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 3);
      fg.addColorStop(0, 'rgba(255,220,150,0.9)');
      fg.addColorStop(0.3, rgba(p.colors[0], 0.7));
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(fx - fr * 3, fy - fr * 3, fr * 6, fr * 6);
    }
    ctx.restore();

    // bonfire base (sword in coiled ash — simplified as a dark sword silhouette)
    ctx.fillStyle = '#1a1008';
    ctx.beginPath();
    ctx.moveTo(bx - 2, by - 20);
    ctx.lineTo(bx + 2, by - 20);
    ctx.lineTo(bx + 4, by + 20);
    ctx.lineTo(bx - 4, by + 20);
    ctx.closePath();
    ctx.fill();
    // crossguard
    ctx.fillRect(bx - 14, by - 16, 28, 3);
    // coiled ash around base
    ctx.fillStyle = '#0a0605';
    ctx.beginPath();
    ctx.ellipse(bx, by + 22, 40, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // rising embers
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    embers.forEach((e) => {
      const local = ((t + e.off) % e.life) / e.life;
      const y = by - local * (h * 0.8) * (e.speed / 60);
      if (y < -20 || y > by + 20) return;
      const x = e.x + Math.sin(t * e.swaySp + e.ph) * e.sway * (1 - local * 0.5);
      const a = Math.sin(local * Math.PI) * 0.9;
      const rr = e.r * (1 - local * 0.3);
      // glow
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rr * 5);
      rg.addColorStop(0, rgba(e.color, a * 0.8));
      rg.addColorStop(0.4, rgba(e.color, a * 0.25));
      rg.addColorStop(1, rgba(e.color, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(x - rr * 5, y - rr * 5, rr * 10, rr * 10);
      // core
      ctx.fillStyle = `rgba(255,220,150,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, rr * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // top heavy vignette (the world feels oppressive)
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  };
}

// ============================================================
const FACTORIES: Record<StyleId, (cfg: VideoConfig) => SceneDraw> = {
  nebula: nebulaScene,
  aurora: auroraScene,
  ocean: oceanScene,
  starfield: starfieldScene,
  embers: embersScene,
  matrix: matrixScene,
  geometric: geometricScene,
  network: networkScene,
  synthwave: synthwaveScene,
  plasma: plasmaScene,
  snow: snowScene,
  bubbles: bubblesScene,
  darksouls: darksoulsScene,
};

export function createScene(cfg: VideoConfig): SceneDraw {
  return FACTORIES[cfg.style](cfg);
}

// ---------- post effects ----------
const VIGNETTE_CACHE = new WeakMap<CanvasRenderingContext2D, { w: number; h: number; gradient: CanvasGradient }>();
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let cached = VIGNETTE_CACHE.get(ctx);
  if (!cached || cached.w !== w || cached.h !== h) {
    const gradient = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    cached = { w, h, gradient };
    VIGNETTE_CACHE.set(ctx, cached);
  }
  ctx.fillStyle = cached.gradient;
  ctx.fillRect(0, 0, w, h);
}

export function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, seed: number) {
  const rng = mulberry32(seed + Math.floor(t * 24));
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#ffffff';
  const n = Math.round((w * h) / 3800);
  for (let i = 0; i < n; i++) {
    ctx.fillRect(rng() * w, rng() * h, 1.6, 1.6);
  }
  ctx.restore();
}
