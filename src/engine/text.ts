import { FONTS, VideoConfig } from './themes';
import { rgba } from './render';
import { revealText } from './reveal';

/* ────── tiny easing helpers ────── */
const O3 = (x: number) => 1 - (1 - x) * (1 - x) * (1 - x);
const I3 = (x: number) => x * x * x;
const OBack = (x: number) => { const c = 2.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };

/* ────── user-adjustable text layout helpers ────── */
const textScaleOf = (cfg: VideoConfig) => cfg.textScale ?? 1;
const textOpacityOf = (cfg: VideoConfig) => cfg.textOpacity ?? 1;
const mainY = (cfg: VideoConfig, h: number) => h * (cfg.textY ?? 0.46);
const subY = (cfg: VideoConfig, h: number) => h * (cfg.subtitleY ?? 0.9);
const mainColor = (cfg: VideoConfig) => cfg.textColor && cfg.textColor !== 'auto' ? cfg.textColor : cfg.palette.text;

/* ────── font helper ────── */
function fontFor(cfg: VideoConfig, size: number, force?: string): string {
  const f = FONTS.find((f) => f.id === (force ?? cfg.fontId)) ?? FONTS[0];
  return f.family.replace('FSZ', String(Math.round(size)));
}

/* ────── text measurement ────── */
const _wrapCache = new Map<string, string[]>();
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const key = `${ctx.font}\x00${text}\x00${maxW.toFixed(0)}`;
  let r = _wrapCache.get(key);
  if (r) return r;
  const words = text.split(/\s+/).filter(Boolean);
  r = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { r.push(cur); cur = w; } else cur = test;
  }
  if (cur) r.push(cur);
  if (_wrapCache.size < 400) _wrapCache.set(key, r);
  return r;
}

const _fitCache = new Map<string, { size: number; lines: string[] }>();
function fitText(ctx: CanvasRenderingContext2D, cfg: VideoConfig, text: string, maxW: number, maxH: number, startSize: number, force?: string): { size: number; lines: string[] } {
  const key = `${force ?? cfg.fontId}\x00${text}\x00${maxW.toFixed(0)}\x00${maxH.toFixed(0)}\x00${startSize.toFixed(1)}\x00${textScaleOf(cfg).toFixed(2)}`;
  const cached = _fitCache.get(key);
  if (cached) return cached;
  let size = startSize * textScaleOf(cfg);
  for (; size > 14; size -= 4) {
    ctx.font = fontFor(cfg, size, force);
    const lines = wrapLines(ctx, text, maxW);
    if (lines.length * size * 1.25 <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW)) {
      const result = { size, lines };
      if (_fitCache.size < 500) _fitCache.set(key, result);
      return result;
    }
  }
  ctx.font = fontFor(cfg, size, force);
  const result = { size, lines: wrapLines(ctx, text, maxW) };
  if (_fitCache.size < 500) _fitCache.set(key, result);
  return result;
}

/* ────── text effect helpers (inline, no extra save/restore if not needed) ────── */
function setupTextFX(ctx: CanvasRenderingContext2D, cfg: VideoConfig, size: number, alpha: number) {
  const fx = cfg.textEffects ?? [];
  if (fx.includes('glow')) {
    ctx.shadowColor = rgba(cfg.palette.colors[0], 0.9 * alpha);
    ctx.shadowBlur = size * 0.6;
  } else {
    // Subtle drop shadow for high readability against any background
    ctx.shadowColor = `rgba(0, 0, 0, ${0.75 * alpha})`;
    ctx.shadowBlur = Math.max(4, size * 0.15);
  }
}

function fillFor(ctx: CanvasRenderingContext2D, cfg: VideoConfig, y: number, size: number, alpha: number, override?: string): string | CanvasGradient {
  const color = override ?? mainColor(cfg);
  if (!(cfg.textEffects ?? []).includes('gradient')) return rgba(color, alpha);
  const g = ctx.createLinearGradient(0, y - size, 0, y + size);
  g.addColorStop(0, rgba(cfg.palette.colors[0], alpha));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(cfg.palette.colors[2], alpha));
  return g;
}

function strokeOutline(ctx: CanvasRenderingContext2D, cfg: VideoConfig, text: string, x: number, y: number, size: number, alpha: number) {
  if (!(cfg.textEffects ?? []).includes('outline')) return;
  const prevS = ctx.shadowColor, prevB = ctx.shadowBlur;
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeStyle = rgba(cfg.palette.bg[0], alpha);
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.shadowColor = prevS; ctx.shadowBlur = prevB;
}

/* ────── drawLinesCentered — the workhorse ────── */
function drawLinesCentered(ctx: CanvasRenderingContext2D, cfg: VideoConfig, lines: string[], size: number, cx: number, cy: number, alpha: number, offY = 0, scale = 1) {
  alpha *= textOpacityOf(cfg);
  if (alpha < 0.005) return;
  const lh = size * 1.25;
  const totalH = lines.length * lh;
  ctx.save();
  ctx.translate(cx, cy + offY);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = fontFor(cfg, size);
  setupTextFX(ctx, cfg, size, alpha);
  for (let i = 0; i < lines.length; i++) {
    const y = -totalH / 2 + lh * (i + 0.5);
    strokeOutline(ctx, cfg, lines[i], 0, y, size, alpha);
    ctx.fillStyle = fillFor(ctx, cfg, y, size, alpha);
    ctx.fillText(lines[i], 0, y);
  }
  ctx.restore();
}

/* ────── drawRawLines — flat text at absolute position, used by glitch overlay ────── */
function drawRawLines(ctx: CanvasRenderingContext2D, cfg: VideoConfig, lines: string[], size: number, cx: number, cy: number, alpha: number, color: string) {
  alpha *= textOpacityOf(cfg);
  if (alpha < 0.005) return;
  const lh = size * 1.25;
  const totalH = lines.length * lh;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = fontFor(cfg, size);
  ctx.fillStyle = rgba(color, alpha);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, cy - totalH / 2 + lh * (i + 0.5));
  }
  ctx.restore();
}

/* ────── subtitle ────── */
function drawSubtitle(ctx: CanvasRenderingContext2D, cfg: VideoConfig, alpha: number, override?: string) {
  if (!cfg.showSubtitle || !cfg.subtitle.trim()) return;
  alpha *= textOpacityOf(cfg);
  if (alpha < 0.005) return;
  const { width: w, height: h } = cfg;
  const size = Math.max(16, Math.min(w, h) * 0.028);
  ctx.save();
  ctx.font = fontFor(cfg, size).replace(/^(700|900)/, '400');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sy = subY(cfg, h);
  ctx.fillStyle = rgba(override ?? mainColor(cfg), alpha * 0.75);
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
  const lines = wrapLines(ctx, cfg.subtitle, w * 0.8);
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], w / 2, sy + i * size * 1.3);
  ctx.fillStyle = rgba(cfg.palette.colors[0], alpha * 0.9);
  ctx.fillRect(w / 2 - w * 0.04, sy - size * 1.2, w * 0.08, 3);
  ctx.restore();
}

/* ============================================================
   MODE: Kinetic — word-chunks then hold
   ============================================================ */
function drawKinetic(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const cx = w / 2, cy = mainY(cfg, h);
  const maxW = w * 0.82, maxH = h * 0.5;
  const base = Math.min(w, h) * 0.11;
  const tail = Math.min(1, (duration - t) / 0.8);

  const words = prompt.split(/\s+/).filter(Boolean);
  const cs = words.length > 14 ? 4 : words.length > 6 ? 3 : 2;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += cs) chunks.push(words.slice(i, i + cs).join(' '));
  const hold = Math.min(duration * 0.4, Math.max(2, duration * 0.3));
  const per = Math.max(0.7, (duration - hold) / Math.max(chunks.length, 1));

  if (t < chunks.length * per) {
    const idx = Math.min(chunks.length - 1, Math.floor(t / per));
    const local = (t - idx * per) / per;
    const inE = O3(Math.min(1, local / 0.3));
    const outE = local > 0.82 ? 1 - I3((local - 0.82) / 0.18) : 1;
    const { size, lines } = fitText(ctx, cfg, chunks[idx], maxW, maxH, base * 1.35);
    drawLinesCentered(ctx, cfg, lines, size, cx, cy, inE * outE * tail, 0, 0.8 + 0.25 * inE + local * 0.06);
  } else {
    const local = Math.min(1, (t - chunks.length * per) / 1.0);
    const e = O3(local);
    const { size, lines } = fitText(ctx, cfg, prompt, maxW, maxH, base * 0.85);
    drawLinesCentered(ctx, cfg, lines, size, cx, cy, e * tail, (1 - e) * 30, 0.96 + e * 0.04);
    drawSubtitle(ctx, cfg, e * tail);
  }
}

/* ============================================================
   MODE: Title — slow zoom
   ============================================================ */
function drawTitle(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const maxW = w * 0.82, maxH = h * 0.5;
  const tail = Math.min(1, (duration - t) / 0.8);
  const { size, lines } = fitText(ctx, cfg, prompt, maxW, maxH, Math.min(w, h) * 0.11);
  const inT = Math.min(1, 0.2 + (t / 1.2) * 0.8);
  const e = O3(inT);
  drawLinesCentered(ctx, cfg, lines, size, w / 2, mainY(cfg, h), e * tail, (1 - e) * 30, 0.94 + 0.06 * e + t * 0.004);
  drawSubtitle(ctx, cfg, Math.min(1, Math.max(0, 0.25 + (t / 0.8) * 0.75)) * tail);
}

/* ============================================================
   MODE: Typewriter
   ============================================================ */
function drawTypewriter(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const maxW = w * 0.82, maxH = h * 0.5;
  const tail = Math.min(1, (duration - t) / 0.8);
  const typeDur = Math.min(duration * 0.55, Math.max(1.5, prompt.length * 0.055));
  const chars = Math.floor(Math.min(1, t / typeDur) * prompt.length);
  const shown = prompt.slice(0, chars) + (Math.floor(t * 2.4) % 2 === 0 && t < typeDur + 1 ? '▌' : '');
  const { size } = fitText(ctx, cfg, prompt, maxW, maxH, Math.min(w, h) * 0.11);
  ctx.font = fontFor(cfg, size);
  const lines = wrapLines(ctx, shown, maxW);
  drawLinesCentered(ctx, cfg, lines, size, w / 2, mainY(cfg, h), tail, 0, 1);
  drawSubtitle(ctx, cfg, Math.min(1, Math.max(0, (t - 0.6) / 0.8)) * tail);
}

/* ============================================================
   MODE: Cascade — letters rise from below
   ============================================================ */
function drawCascade(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const cx = w / 2, cy = mainY(cfg, h);
  const tail = Math.min(1, (duration - t) / 0.8);
  const { size, lines } = fitText(ctx, cfg, prompt, w * 0.82, h * 0.5, Math.min(w, h) * 0.1);
  ctx.font = fontFor(cfg, size);
  const lh = size * 1.25;
  const totalH = lines.length * lh;

  const revealDur = Math.min(duration * 0.45, Math.max(1.5, prompt.length * 0.028));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontFor(cfg, size);

  let counter = 0;
  for (let li = 0; li < lines.length; li++) {
    const lw = ctx.measureText(lines[li]).width;
    let x = cx - lw / 2;
    const y = cy - totalH / 2 + lh * (li + 0.5);
    for (let ci = 0; ci < lines[li].length; ci++) {
      const ch = lines[li][ci];
      const cw = ctx.measureText(ch).width;
      const start = (counter / prompt.length) * revealDur;
      const local = Math.max(0, Math.min(1, (t - start) / 0.35));
      const alpha = O3(local) * tail * textOpacityOf(cfg);
      if (alpha > 0.01) {
        const offy = (1 - O3(local)) * size * 0.6;
        setupTextFX(ctx, cfg, size, alpha);
        strokeOutline(ctx, cfg, ch, x + cw / 2, y + offy, size, alpha);
        ctx.fillStyle = fillFor(ctx, cfg, y + offy, size, alpha);
        ctx.fillText(ch, x + cw / 2, y + offy);
      }
      x += cw;
      counter++;
    }
  }
  drawSubtitle(ctx, cfg, Math.min(1, Math.max(0, (t - revealDur) / 0.6)) * tail);
}

/* ============================================================
   MODE: Wave — sine bob
   ============================================================ */
function drawWave(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const { size, lines } = fitText(ctx, cfg, prompt, w * 0.82, h * 0.5, Math.min(w, h) * 0.1);
  ctx.font = fontFor(cfg, size);
  const lh = size * 1.25, totalH = lines.length * lh, cx = w / 2, cy = mainY(cfg, h);
  const tail = Math.min(1, (duration - t) / 0.8) * Math.min(1, t / 0.8);
  const amp = size * 0.28;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontFor(cfg, size);
  let counter = 0;
  for (let li = 0; li < lines.length; li++) {
    const lw = ctx.measureText(lines[li]).width;
    let x = cx - lw / 2;
    const y = cy - totalH / 2 + lh * (li + 0.5);
    for (let ci = 0; ci < lines[li].length; ci++) {
      const ch = lines[li][ci];
      const cw = ctx.measureText(ch).width;
      const offY = Math.sin(t * 2.5 + counter * 0.35) * amp;
      const alpha = tail * textOpacityOf(cfg);
      setupTextFX(ctx, cfg, size, alpha);
      strokeOutline(ctx, cfg, ch, x + cw / 2, y + offY, size, alpha);
      ctx.fillStyle = fillFor(ctx, cfg, y + offY, size, alpha);
      ctx.fillText(ch, x + cw / 2, y + offY);
      x += cw;
      counter++;
    }
  }
  drawSubtitle(ctx, cfg, tail);
}

/* ============================================================
   MODE: Slam — elastic word drop + screen shake
   ============================================================ */
function drawSlam(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const cx = w / 2, cy = mainY(cfg, h);
  const maxW = w * 0.82, maxH = h * 0.5;
  const base = Math.min(w, h) * 0.1;
  const tail = Math.min(1, (duration - t) / 0.8);

  const words = prompt.split(/\s+/).filter(Boolean);
  const perWord = Math.min(0.6, Math.max(0.25, (duration * 0.4) / Math.max(1, words.length)));
  const finalStart = perWord * words.length;

  if (t < finalStart + 0.5) {
    const size = base * 1.2 * textScaleOf(cfg);
    ctx.font = fontFor(cfg, size);
    const lines = wrapLines(ctx, prompt, maxW);
    const totalH = lines.length * size * 1.25;
    // layout words into positions
    const wp: { w: string; x: number; y: number; i: number }[] = [];
    let wi = 0;
    for (let li = 0; li < lines.length; li++) {
      const lw = ctx.measureText(lines[li]).width;
      let x = cx - lw / 2;
      const y = cy - totalH / 2 + size * 1.25 * (li + 0.5);
      for (const wd of lines[li].split(/\s+/)) {
        const ww = ctx.measureText(wd).width;
        wp.push({ w: wd, x: x + ww / 2, y, i: wi++ });
        x += ww + ctx.measureText(' ').width;
      }
    }
    // compute cumulative shake
    let sx = 0, sy = 0;
    for (const e of wp) {
      const local = (t - e.i * perWord) / 0.3;
      if (local > 0 && local < 1) {
        const impact = 1 - local;
        sx += Math.sin(local * 30) * impact * 4;
        sy += Math.cos(local * 25) * impact * 4;
      }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontFor(cfg, size);
    for (const e of wp) {
      const local = (t - e.i * perWord) / 0.3;
      if (local < 0) continue;
      const s = 3 - 2 * OBack(Math.min(1, local));
      const a = Math.min(1, local * 3) * tail * textOpacityOf(cfg);
      if (a < 0.005) continue;
      ctx.save();
      ctx.translate(e.x + sx, e.y + sy);
      if (s !== 1) ctx.scale(s, s);
      setupTextFX(ctx, cfg, size, a);
      strokeOutline(ctx, cfg, e.w, 0, 0, size, a);
      ctx.fillStyle = fillFor(ctx, cfg, 0, size, a);
      ctx.fillText(e.w, 0, 0);
      ctx.restore();
    }
  } else {
    const { size, lines } = fitText(ctx, cfg, prompt, maxW, maxH, base);
    const e = Math.min(1, (t - finalStart - 0.2) / 0.4);
    drawLinesCentered(ctx, cfg, lines, size, cx, cy, e * tail, 0, 1);
    drawSubtitle(ctx, cfg, e * tail);
  }
}

/* ============================================================
   MODE: Glitch — chromatic split + slice displacement
   ============================================================ */
// local seeded RNG for deterministic glitch per-frame
function _rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawGlitch(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const cx = w / 2, cy = mainY(cfg, h);
  const tail = Math.min(1, (duration - t) / 0.8);
  const { size, lines } = fitText(ctx, cfg, prompt, w * 0.82, h * 0.5, Math.min(w, h) * 0.11);
  const intensity = Math.max(0, 1 - t / 2.5);
  const alpha = Math.min(1, t / 0.4) * tail;
  if (alpha < 0.005) return;

  // base text
  drawLinesCentered(ctx, cfg, lines, size, cx, cy, alpha, 0, 1);

  if (intensity > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    drawRawLines(ctx, cfg, lines, size, cx - intensity * 14, cy, alpha * 0.7, '#22d3ee');
    drawRawLines(ctx, cfg, lines, size, cx + intensity * 14, cy, alpha * 0.7, '#ef4444');
    ctx.restore();
    // slice displacement
    const rng = _rng(Math.floor(t * 12));
    const sliceH = size * 0.35;
    for (let i = 0; i < 4; i++) {
      const yStart = cy - size * 1.2 + rng() * size * 2.4;
      const dx = (rng() - 0.5) * 30 * intensity;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, yStart, w, sliceH);
      ctx.clip();
      const bg = ctx.createLinearGradient(0, yStart, 0, yStart + sliceH);
      bg.addColorStop(0, cfg.palette.bg[0]);
      bg.addColorStop(1, cfg.palette.bg[1]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, yStart, w, sliceH);
      drawLinesCentered(ctx, cfg, lines, size, cx + dx, cy, alpha, 0, 1);
      ctx.restore();
    }
  }
  drawSubtitle(ctx, cfg, alpha);
}

/* ============================================================
   MODE: Blur Reveal
   ============================================================ */
function drawBlur(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const maxW = w * 0.82, maxH = h * 0.5;
  const { size, lines } = fitText(ctx, cfg, prompt, maxW, maxH, Math.min(w, h) * 0.11);
  const tail = Math.min(1, (duration - t) / 0.8);
  const blurPx = (1 - O3(Math.min(1, t / 1.6))) * 24;
  const alpha = Math.min(1, t / 0.5) * tail;
  ctx.save();
  if (typeof ctx.filter !== 'undefined') ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
  drawLinesCentered(ctx, cfg, lines, size, w / 2, mainY(cfg, h), alpha, 0, 1);
  ctx.restore();
  drawSubtitle(ctx, cfg, Math.min(1, t / 1.6) * tail);
}

/* ============================================================
   MODE: Neon Flicker
   ============================================================ */
function drawNeon(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const { size, lines } = fitText(ctx, cfg, prompt, w * 0.82, h * 0.5, Math.min(w, h) * 0.11);
  const tail = Math.min(1, (duration - t) / 0.8);
  const rng = _rng(Math.floor(t * 18));
  const on = t < 1.6 ? (rng() > 0.35 ? 1 : 0.05) : 0.85 + Math.sin(t * 3) * 0.12 + (rng() > 0.95 ? -0.5 : 0);
  const alpha = Math.min(1, on) * tail;
  if (alpha < 0.04) return;
  // force glow for neon
  const orig = cfg.textEffects ?? [];
  if (!orig.includes('glow')) {
    (cfg as any)._fx = cfg.textEffects;
    cfg.textEffects = [...orig, 'glow'];
  }
  drawLinesCentered(ctx, cfg, lines, size, w / 2, mainY(cfg, h), alpha, 0, 1);
  ctx.save(); ctx.globalAlpha = alpha * 0.6;
  drawLinesCentered(ctx, cfg, lines, size, w / 2, mainY(cfg, h), 1, 0, 1);
  ctx.restore();
  cfg.textEffects = (cfg as any)._fx ?? orig;
  drawSubtitle(ctx, cfg, Math.min(1, Math.max(0, (t - 1.6) / 0.6)) * tail);
}

/* ============================================================
   MODE: Souls — ornate ember-gold gothic title
   ============================================================ */
function drawSouls(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt, seed } = cfg;
  const cx = w / 2, cy = mainY(cfg, h);
  const tail = Math.min(1, (duration - t) / 1.2);
  const displayText = prompt.toUpperCase();
  const { size, lines } = fitText(ctx, cfg, displayText, w * 0.88, h * 0.5, Math.min(w, h) * 0.1, 'cinzel');
  ctx.font = fontFor(cfg, size, 'cinzel');
  const reveal = Math.min(1, t / 2.2);
  const alpha = O3(reveal) * tail * textOpacityOf(cfg);
  if (alpha < 0.005) return;

  const emberGold = cfg.textColor && cfg.textColor !== 'auto' ? cfg.textColor : '#d9b25c';
  const ashGrey = '#8a7a5a';
  const lh = size * 1.4, totalH = lines.length * lh, tracking = size * 0.12;

  // ornament rules
  const topY = cy - totalH / 2 - size * 0.6;
  const botY = cy + totalH / 2 + size * 0.6;
  const ruleW = Math.min(w * 0.35, 400);
  ctx.strokeStyle = rgba(emberGold, alpha * 0.5);
  ctx.lineWidth = 2;
  // top rule
  ctx.beginPath();
  ctx.moveTo(cx - ruleW, topY); ctx.lineTo(cx - 14, topY);
  ctx.moveTo(cx + 14, topY); ctx.lineTo(cx + ruleW, topY);
  ctx.stroke();
  ctx.fillStyle = rgba(emberGold, alpha * 0.7);
  ctx.save(); ctx.translate(cx, topY); ctx.rotate(0.7854); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
  // bottom rule
  ctx.beginPath();
  ctx.moveTo(cx - ruleW, botY); ctx.lineTo(cx - 14, botY);
  ctx.moveTo(cx + 14, botY); ctx.lineTo(cx + ruleW, botY);
  ctx.stroke();
  ctx.save(); ctx.translate(cx, botY); ctx.rotate(0.7854); ctx.fillRect(-5, -5, 10, 10); ctx.restore();

  // draw text character-by-character
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = fontFor(cfg, size, 'cinzel');
  ctx.shadowColor = rgba(emberGold, 0.7 * alpha); ctx.shadowBlur = size * 0.6;
  const flicker = 1 + 0.06 * Math.sin(t * 7) + 0.03 * Math.sin(t * 13);
  for (let li = 0; li < lines.length; li++) {
    const y = cy - totalH / 2 + lh * (li + 0.5);
    let totalW = 0;
    for (let ci = 0; ci < lines[li].length; ci++) totalW += ctx.measureText(lines[li][ci]).width + tracking;
    totalW -= tracking;
    let x = cx - totalW / 2;
    for (let ci = 0; ci < lines[li].length; ci++) {
      const ch = lines[li][ci];
      const cw = ctx.measureText(ch).width;
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.strokeStyle = rgba('#1a0f06', alpha * 0.6);
      ctx.strokeText(ch, x, y);
      ctx.fillStyle = rgba(emberGold, alpha * flicker);
      ctx.fillText(ch, x, y);
      x += cw + tracking;
    }
  }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

  // embers around text
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const rng = _rng(seed);
  for (let i = 0; i < 24; i++) {
    const bx = cx + (rng() - 0.5) * ruleW * 1.6;
    const baseY = botY + rng() * size * 0.6;
    const life = 2 + rng() * 3;
    const local = ((t + rng() * life) % life) / life;
    const ey = baseY - local * size * 2;
    const a = Math.sin(local * Math.PI) * 0.8 * alpha;
    if (a < 0.01) continue;
    const rr = 1 + rng() * 2;
    const g = ctx.createRadialGradient(bx, ey, 0, bx, ey, rr * 4);
    g.addColorStop(0, rgba(emberGold, a)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - rr * 4, ey - rr * 4, rr * 8, rr * 8);
  }
  ctx.restore();

  // subtitle
  if (cfg.subtitle.trim()) {
    const subSize = Math.max(14, size * 0.32);
    ctx.save();
    ctx.font = `italic 400 ${subSize}px "Cinzel","Trajan Pro",Georgia,serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(ashGrey, alpha * 0.9);
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.fillText(cfg.subtitle.toUpperCase(), cx, botY + subSize * 1.4);
    ctx.restore();
  }
}

/* ============================================================
   Public entry point — called once per frame
   ============================================================ */
export function drawTextOverlay(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number): void {
  if (cfg.textMode === 'none' || !cfg.prompt.trim()) return;
  switch (cfg.textMode) {
    case 'kinetic':   return drawKinetic(ctx, cfg, t);
    case 'title':     return drawTitle(ctx, cfg, t);
    case 'typewriter':return drawTypewriter(ctx, cfg, t);
    case 'reveal':    return drawReveal(ctx, cfg, t);
    case 'cascade':   return drawCascade(ctx, cfg, t);
    case 'wave':      return drawWave(ctx, cfg, t);
    case 'slam':      return drawSlam(ctx, cfg, t);
    case 'glitch':    return drawGlitch(ctx, cfg, t);
    case 'blur':      return drawBlur(ctx, cfg, t);
    case 'neon':      return drawNeon(ctx, cfg, t);
    case 'souls':     return drawSouls(ctx, cfg, t);
    default:          return drawKinetic(ctx, cfg, t);
  }
}

/* ============================================================
   MODE: Progressive Reveal
   Uses the shared revealText() utility so the visual output is
   fully controlled by three parameters exposed in the UI:
     • unit       — char | word | sentence | paragraph | all
     • delayMs    — milliseconds between units
     • separator  — glue between revealed units
   ============================================================ */
function drawReveal(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  const { width: w, height: h, duration, prompt } = cfg;
  const cx = w / 2, cy = mainY(cfg, h);
  const maxW = w * 0.86, maxH = h * 0.55;
  const tail = Math.min(1, (duration - t) / 0.8);
  const state = revealText({
    text: prompt,
    elapsedMs: Math.max(0, t * 1000),
    unit: cfg.revealUnit ?? 'word',
    delayMs: cfg.revealDelayMs ?? 90,
    separator: cfg.revealSeparator ?? ' ',
  });
  const shown = state.output || ' ';
  const { size, lines } = fitText(ctx, cfg, shown, maxW, maxH, Math.min(w, h) * 0.09);
  drawLinesCentered(ctx, cfg, lines, size, cx, cy, tail, 0, 1);
  drawSubtitle(ctx, cfg, Math.min(1, Math.max(0, (t - 0.6) / 0.8)) * tail);
}
