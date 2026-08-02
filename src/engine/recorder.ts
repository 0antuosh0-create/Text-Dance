import { STYLE_RELATIVES, StyleId, VideoConfig } from './themes';
import { createScene, drawGrain, drawVignette, SceneDraw } from './scenes';
import { drawTextOverlay } from './text';

/**
 * Build the full compositor for one frame at time t (seconds).
 * Supports timeline mode 'single' (one scene) and 'multi' (primary + related scene crossfade).
 */
export function buildFrameRenderer(cfg: VideoConfig): (ctx: CanvasRenderingContext2D, t: number) => void {
  const scenes: { draw: SceneDraw; cfg: VideoConfig }[] = [];
  if (cfg.timelineMode === 'multi' && cfg.duration >= 6) {
    // Split duration into segments: primary → related → primary
    const relatives = STYLE_RELATIVES[cfg.style] ?? [cfg.style];
    const segments: { style: StyleId; start: number; end: number }[] = [];
    const rel = relatives[Math.floor(cfg.duration * 7) % relatives.length];
    const t1 = cfg.duration * 0.38;
    const t2 = cfg.duration * 0.72;
    segments.push({ style: cfg.style, start: 0, end: t1 });
    segments.push({ style: rel, start: t1, end: t2 });
    segments.push({ style: cfg.style, start: t2, end: cfg.duration });

    segments.forEach((seg, i) => {
      const segCfg: VideoConfig = {
        ...cfg,
        style: seg.style,
        // Keep palette consistent, but use a different seed per segment for visual variety
        seed: cfg.seed + i * 1337,
      };
      scenes.push({ draw: createScene(segCfg), cfg: segCfg });
    });
    const crossfade = 1.2;
    return (ctx, t) => {
      const seg =
        t < segments[0].end
          ? 0
          : t < segments[1].end
          ? 1
          : 2;
      // base
      scenes[seg].draw(ctx, t);
      // crossfade: if we're near a segment boundary, draw previous on top with alpha
      if (seg > 0 && t < segments[seg - 1].end + crossfade) {
        const blend = (t - (segments[seg - 1].end - crossfade / 2)) / crossfade;
        const a = 1 - Math.max(0, Math.min(1, blend));
        if (a > 0.02) {
          ctx.save();
          ctx.globalAlpha = a;
          scenes[seg - 1].draw(ctx, t);
          ctx.restore();
        }
      }
      commonPost(ctx, cfg, t);
    };
  }

  // single scene
  const scene = createScene(cfg);
  return (ctx, t) => {
    scene(ctx, t);
    commonPost(ctx, cfg, t);
  };
}

function commonPost(ctx: CanvasRenderingContext2D, cfg: VideoConfig, t: number) {
  drawTextOverlay(ctx, cfg, t);
  if (cfg.vignette) drawVignette(ctx, cfg.width, cfg.height);
  if (cfg.grain) drawGrain(ctx, cfg.width, cfg.height, t, cfg.seed);
  // intro/outro fade to black
  const fade = Math.min(t / 0.6, (cfg.duration - t) / 0.6, 1);
  if (fade < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`;
    ctx.fillRect(0, 0, cfg.width, cfg.height);
  }
}

export function pickMimeType(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ['video/mp4;codecs=avc1,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
    ['video/mp4', 'mp4'],
  ];
  for (const [mime, ext] of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return { mime, ext };
    }
  }
  return { mime: '', ext: 'webm' };
}

export interface RecordResult {
  blob: Blob;
  url: string;
  ext: string;
  mime: string;
}

export function recordVideo(
  canvas: HTMLCanvasElement,
  cfg: VideoConfig,
  bitrate: number,
  onProgress: (frac: number, etaMs: number) => void,
  shouldCancel: () => boolean,
  audioStream?: MediaStream
): Promise<RecordResult | null> {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
    const render = buildFrameRenderer(cfg);

    const { mime, ext } = pickMimeType();

    // Combine video + optional audio into one stream
    const videoStream = canvas.captureStream(cfg.fps);
    const combined = new MediaStream();
    videoStream.getVideoTracks().forEach((tr) => combined.addTrack(tr));
    if (audioStream && audioStream.getAudioTracks().length > 0) {
      audioStream.getAudioTracks().forEach((tr) => combined.addTrack(tr));
    }

    const recorder = new MediaRecorder(combined, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: bitrate,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let cancelled = false;
    recorder.onstop = () => {
      videoStream.getTracks().forEach((tr) => tr.stop());
      if (cancelled) return resolve(null);
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      resolve({ blob, url: URL.createObjectURL(blob), ext, mime: mime || 'video/webm' });
    };
    recorder.onerror = () => reject(new Error('Recording failed'));

    // Render first frame so the video never opens blank
    render(ctx, 0);
    recorder.start(250);

    const durMs = cfg.duration * 1000;
    const start = performance.now();
    const frameInterval = 1000 / Math.max(1, cfg.fps);
    let lastRenderedAt = start;
    const tick = (now: number) => {
      if (shouldCancel()) {
        cancelled = true;
        recorder.stop();
        return;
      }
      const elapsed = now - start;
      const t = Math.min(elapsed / 1000, cfg.duration);
      // A 24/30 fps export previously drew at the monitor's 60/120 Hz refresh
      // rate. Drawing only the requested frames cuts rendering work sharply.
      if (now - lastRenderedAt >= frameInterval && elapsed < durMs) {
        render(ctx, t);
        lastRenderedAt = now - ((now - lastRenderedAt) % frameInterval);
      }
      const frac = Math.min(1, elapsed / durMs);
      const eta = frac > 0.02 ? (elapsed / frac) - elapsed : 0;
      onProgress(frac, eta);
      if (elapsed < durMs) {
        requestAnimationFrame(tick);
      } else {
        render(ctx, cfg.duration);
        onProgress(1, 0);
        setTimeout(() => recorder.stop(), 220);
      }
    };
    requestAnimationFrame(tick);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

export function formatDuration(sec: number): string {
  if (sec < 60) return Math.round(sec) + 's';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}
