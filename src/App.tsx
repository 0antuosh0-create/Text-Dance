import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  detectStyle,
  FONTS,
  PALETTES,
  Preset,
  PRESETS,
  QUALITIES,
  RESOLUTIONS,
  STYLES,
  TEXT_EFFECTS,
  TEXT_MODES,
  VideoConfig,
  StyleId,
  surpriseMe,
  STYLE_RELATIVES,
  REVEAL_UNITS,
} from './engine/themes';
import { revealDurationMs, RevealUnit } from './engine/reveal';
import { AudioEngine } from './engine/audio';
import {
  buildFrameRenderer,
  formatBytes,
  formatDuration,
  pickMimeType,
  recordVideo,
  RecordResult,
} from './engine/recorder';
import {
  Badge,
  Button,
  Card,
  Divider,
  Field,
  Label,
  RowItem,
  Segmented,
  Select,
  Tile,
  Toggle,
} from './ui/SimpleUi';

type Phase = 'idle' | 'recording' | 'done';
type TabId = 'style' | 'text' | 'audio' | 'export';

interface AccentTheme {
  id: string;
  name: string;
  swatch: string;
}

const ACCENTS: AccentTheme[] = [
  { id: 'pine', name: 'Pine (default)', swatch: '#2f6a4d' },
  { id: 'violet', name: 'Violet', swatch: '#8b5cf6' },
  { id: 'azure', name: 'Azure', swatch: '#3b82f6' },
  { id: 'rose', name: 'Rose', swatch: '#f43f5e' },
  { id: 'amber', name: 'Amber', swatch: '#f59e0b' },
  { id: 'slate', name: 'Slate', swatch: '#64748b' },
];

interface HistoryItem {
  id: string;
  name: string;
  prompt: string;
  subtitle: string;
  url: string;
  ext: string;
  size: number;
  timestamp: number;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'style', label: '1. Visual Style', icon: '🎨' },
  { id: 'text', label: '2. Text & Typography', icon: '✍️' },
  { id: 'audio', label: '3. Audio Track', icon: '🎵' },
  { id: 'export', label: '4. Video Export', icon: '⚙️' },
];

/** Decorative ink ribbons behind the page */
function Ribbons() {
  return (
    <svg className="backdrop-ribbons" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path d="M-80 320 C 240 140, 520 520, 860 330 S 1400 240, 1560 420" />
      <path d="M-60 560 C 300 420, 620 760, 1000 600 S 1420 520, 1520 660" />
    </svg>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState('Journey through the neon galaxy');
  const [subtitle, setSubtitle] = useState('Exploring distant star systems');
  const [styleSel, setStyleSel] = useState<'auto' | StyleId>('auto');
  const [paletteId, setPaletteId] = useState('violet');
  const [resId, setResId] = useState('1080p');
  const [duration, setDuration] = useState(8);
  const [fps, setFps] = useState(30);
  const [qualityId, setQualityId] = useState('high');
  const [textMode, setTextMode] = useState('title');
  const [fontId, setFontId] = useState('sans');
  const [seed, setSeed] = useState(42);
  const [grain, setGrain] = useState(true);
  const [vignette, setVignette] = useState(true);
  const [textEffects, setTextEffects] = useState<string[]>(['glow']);
  const [timelineMode, setTimelineMode] = useState<'single' | 'multi'>('single');
  const [textScale, setTextScale] = useState(1);
  const [textY, setTextY] = useState(0.46);
  const [subtitleY, setSubtitleY] = useState(0.9);
  const [textOpacity, setTextOpacity] = useState(1);
  const [textColor, setTextColor] = useState('auto');
  const [showSubtitle, setShowSubtitle] = useState(true);
  const [revealUnit, setRevealUnit] = useState<RevealUnit>('word');
  const [revealDelayMs, setRevealDelayMs] = useState(90);
  const [revealSeparator, setRevealSeparator] = useState(' ');

  const [ambientOn, setAmbientOn] = useState(true);
  const [ambientVol, setAmbientVol] = useState(0.35);
  const [userFile, setUserFile] = useState<File | null>(null);
  const [userDuration, setUserDuration] = useState(0);
  const [userVol, setUserVol] = useState(0.6);
  const [monitorAudio, setMonitorAudio] = useState(false);
  const audioEngineRef = useRef<AudioEngine | null>(null);

  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('pm-dark');
      // Default to dark mode if never set
      return stored === null ? true : stored === '1';
    } catch { return true; }
  });
  const [accent, setAccent] = useState(() => {
    try { return localStorage.getItem('pm-accent') || 'pine'; } catch { return 'pine'; }
  });
  const [accentOpen, setAccentOpen] = useState(false);
  const accentPopoverRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('style');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyRef = useRef<HistoryItem[]>([]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState(0);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRaf = useRef(0);
  const previewVisibleRef = useRef(true);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('pm-dark', dark ? '1' : '0'); } catch {}
  }, [dark]);

  useEffect(() => {
    if (accent === 'pine') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', accent);
    }
    try { localStorage.setItem('pm-accent', accent); } catch {}
  }, [accent]);

  useEffect(() => {
    if (!accentOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accentPopoverRef.current && !accentPopoverRef.current.contains(e.target as Node)) {
        setAccentOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [accentOpen]);

  const resolvedStyle: StyleId = styleSel === 'auto' ? detectStyle(prompt) : styleSel;
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const res = RESOLUTIONS.find((r) => r.id === resId) ?? RESOLUTIONS[1];
  const quality = QUALITIES.find((q) => q.id === qualityId) ?? QUALITIES[1];

  const config: VideoConfig = useMemo(
    () => ({
      prompt, subtitle, style: resolvedStyle, palette,
      width: res.w, height: res.h, fps, duration,
      textMode, fontId, seed, grain, vignette, textEffects, timelineMode,
      textScale, textY, subtitleY, textOpacity, textColor, showSubtitle,
      revealUnit, revealDelayMs, revealSeparator,
    }),
    [prompt, subtitle, resolvedStyle, palette, res, fps, duration, textMode, fontId, seed, grain, vignette, textEffects, timelineMode, textScale, textY, subtitleY, textOpacity, textColor, showSubtitle, revealUnit, revealDelayMs, revealSeparator]
  );
  // Keep form controls responsive while scene reconstruction happens at a
  // lower-priority React update.
  const previewConfig = useDeferredValue(config);

  const activeTextMode = useMemo(() => TEXT_MODES.find((m) => m.id === textMode), [textMode]);
  const hasAudio = ambientOn || !!userFile;
  const estBytes = (quality.bitrate / 8) * duration;
  const resolvedStyleDef = STYLES.find((s) => s.id === resolvedStyle);
  const nextRelDef = STYLES.find((s) => s.id === (STYLE_RELATIVES[resolvedStyle]?.[0] ?? resolvedStyle));

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  const applyPreset = (p: Preset) => {
    setPrompt(p.prompt);
    setSubtitle(p.subtitle);
    if (p.style) setStyleSel(p.style);
    if (p.palette) setPaletteId(p.palette);
    if (p.textMode) setTextMode(p.textMode);
    showToast(`Applied “${p.name}”`);
  };

  const applySurprise = () => {
    const s = surpriseMe();
    if (s.prompt) setPrompt(s.prompt);
    if (s.subtitle) setSubtitle(s.subtitle);
    if (s.style) setStyleSel(s.style);
    if (s.palette) setPaletteId(s.palette);
    if (s.textMode) setTextMode(s.textMode);
    if (s.seed !== undefined) setSeed(s.seed);
    showToast('Surprise mix ready');
  };

  const ensureAudioEngine = () => {
    if (!audioEngineRef.current || audioEngineRef.current.ctx.state === 'closed') {
      audioEngineRef.current = new AudioEngine();
    }
    return audioEngineRef.current;
  };

  const onUserFile = async (file: File) => {
    setError(null);
    try {
      const engine = ensureAudioEngine();
      const dur = await engine.loadUserFile(file);
      setUserFile(file);
      setUserDuration(dur);
      showToast('Audio loaded');
    } catch {
      setError('Could not read that audio file. Try MP3 or WAV.');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => { previewVisibleRef.current = entry.isIntersecting; },
      { rootMargin: '120px' }
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase === 'recording') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Keep live preview crisp but substantially cheaper than the final export.
    // 420k pixels is enough for the on-page stage and avoids pushing a full
    // 960x540 frame on slower laptops for every animation tick.
    const maxPreviewPixels = 420_000;
    const scale = Math.min(0.5, Math.sqrt(maxPreviewPixels / (previewConfig.width * previewConfig.height)));
    const pw = Math.round(previewConfig.width * scale);
    const ph = Math.round(previewConfig.height * scale);
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Film grain is intentionally export-only; it is expensive and is not
    // useful at preview resolution.
    const previewFps = Math.min(30, previewConfig.fps);
    const render = buildFrameRenderer({ ...previewConfig, width: pw, height: ph, fps: previewFps, grain: false });
    const start = performance.now();
    const frameInterval = 1000 / previewFps;
    let lastFrame = -frameInterval;
    let running = true;
    const loop = (now: number) => {
      if (!running) return;
      if (!document.hidden && previewVisibleRef.current && now - lastFrame >= frameInterval) {
        const t = ((now - start) / 1000) % previewConfig.duration;
        render(ctx, t);
        lastFrame = now - ((now - lastFrame) % frameInterval);
      }
      previewRaf.current = requestAnimationFrame(loop);
    };
    previewRaf.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(previewRaf.current);
    };
  }, [previewConfig, phase]);

  useEffect(() => {
    const url = result?.url;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => () => {
    historyRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  useEffect(() => {
    if (phase !== 'idle' || !monitorAudio) return;
    if (!ambientOn && !userFile) return;
    const engine = ensureAudioEngine();
    engine.resume();
    engine.setMonitor(true);
    engine.setAmbientVolume(ambientOn ? ambientVol : 0);
    engine.setUserVolume(userFile ? userVol : 0);
    if (ambientOn) engine.startAmbient(resolvedStyle, duration);
    if (userFile) engine.startUser(duration);
    return () => {
      engine.stopAmbient();
      engine.stopUser();
      engine.setMonitor(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ambientOn, userFile, resolvedStyle, duration, monitorAudio]);

  // Volume changes update gain nodes directly; they must not rebuild all
  // oscillators and decoded audio sources on every slider input event.
  useEffect(() => {
    audioEngineRef.current?.setAmbientVolume(ambientOn ? ambientVol : 0);
  }, [ambientVol, ambientOn]);
  useEffect(() => {
    audioEngineRef.current?.setUserVolume(userFile ? userVol : 0);
  }, [userVol, userFile]);

  const liveRef = useRef({
    prompt, subtitle, styleSel, paletteId, resId, duration, fps, qualityId,
    textMode, fontId, seed, grain, vignette, textEffects, timelineMode,
    textScale, textY, subtitleY, textOpacity, textColor, showSubtitle,
    revealUnit, revealDelayMs, revealSeparator,
    ambientOn, ambientVol, userFile, userVol, monitorAudio, resolvedStyle,
  });
  useEffect(() => {
    liveRef.current = {
      prompt, subtitle, styleSel, paletteId, resId, duration, fps, qualityId,
      textMode, fontId, seed, grain, vignette, textEffects, timelineMode,
      textScale, textY, subtitleY, textOpacity, textColor, showSubtitle,
      revealUnit, revealDelayMs, revealSeparator,
      ambientOn, ambientVol, userFile, userVol, monitorAudio, resolvedStyle,
    };
  });

  const generate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || phase === 'recording') return;
    const s = liveRef.current;
    const rStyle = s.styleSel === 'auto' ? detectStyle(s.prompt) : s.styleSel;
    const pal = PALETTES.find((p) => p.id === s.paletteId) ?? PALETTES[0];
    const rr = RESOLUTIONS.find((r) => r.id === s.resId) ?? RESOLUTIONS[1];
    const q = QUALITIES.find((x) => x.id === s.qualityId) ?? QUALITIES[1];
    const cfg: VideoConfig = {
      prompt: s.prompt, subtitle: s.subtitle, style: rStyle, palette: pal,
      width: rr.w, height: rr.h, fps: s.fps, duration: s.duration,
      textMode: s.textMode, fontId: s.fontId, seed: s.seed,
      grain: s.grain, vignette: s.vignette, textEffects: s.textEffects, timelineMode: s.timelineMode,
      textScale: s.textScale,
      textY: s.textY,
      subtitleY: s.subtitleY,
      textOpacity: s.textOpacity,
      textColor: s.textColor,
      showSubtitle: s.showSubtitle,
      revealUnit: s.revealUnit,
      revealDelayMs: s.revealDelayMs,
      revealSeparator: s.revealSeparator,
    };
    const hasA = s.ambientOn || !!s.userFile;

    setError(null);
    cancelAnimationFrame(previewRaf.current);
    setResult((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    setPhase('recording');
    setProgress(0);
    setEta(0);
    cancelRef.current = false;
    canvas.width = cfg.width;
    canvas.height = cfg.height;

    let audioStream: MediaStream | undefined;
    let engine: AudioEngine | undefined;
    if (hasA) {
      engine = ensureAudioEngine();
      engine.resume();
      engine.stopAmbient();
      engine.stopUser();
      engine.setMonitor(s.monitorAudio);
      engine.setAmbientVolume(s.ambientOn ? s.ambientVol : 0);
      engine.setUserVolume(s.userFile ? s.userVol : 0);
      if (s.ambientOn) engine.startAmbient(rStyle, cfg.duration);
      if (s.userFile) engine.startUser(cfg.duration);
      audioStream = engine.dest.stream;
    }

    let lastProgressPaint = 0;
    try {
      const out = await recordVideo(
        canvas, cfg, q.bitrate,
        (p, e) => {
          const now = performance.now();
          if (p >= 1 || now - lastProgressPaint >= 100) {
            setProgress(p);
            setEta(e);
            lastProgressPaint = now;
          }
        },
        () => cancelRef.current,
        audioStream
      );
      if (out) {
        setResult(out);
        setPhase('done');
        // record into recent history (most recent first, capped at 8)
        const historyUrl = URL.createObjectURL(out.blob);
        setHistory((prev) => {
          const next = [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: safeName,
              prompt: cfg.prompt,
              subtitle: cfg.subtitle,
              url: historyUrl,
              ext: out.ext,
              size: out.blob.size,
              timestamp: Date.now(),
            },
            ...prev,
          ];
          next.slice(8).forEach((item) => URL.revokeObjectURL(item.url));
          return next.slice(0, 8);
        });
        showToast('Video ready');
      } else setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Render failed. Try a shorter duration.');
      setPhase('idle');
    } finally {
      if (engine) { engine.stopAmbient(); engine.stopUser(); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const cancel = () => { cancelRef.current = true; };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'idle') generate();
      } else if (e.key === 'Escape' && phase === 'recording') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, generate]);

  const mimeInfo = useMemo(() => pickMimeType(), []);
  const safeName =
    (prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video') +
    '.' + (result?.ext ?? mimeInfo.ext);

  const toggleTextEffect = (id: string) =>
    setTextEffects((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      {/* Backdrop */}
      <div className="backdrop" aria-hidden>
        <div className="backdrop-painting" />
        <div className="backdrop-painting-wash" />
        <div className="backdrop-ambient" />
        <div className="backdrop-grain" />
        <Ribbons />
        <div className="backdrop-vignette" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b" style={{ borderColor: 'var(--line-strong)', background: 'var(--surface-1)', boxShadow: 'var(--shadow-sm), inset 0 -1px 0 var(--line)' }}>
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <div className="logo-mark">
              <span className="logo-orbit" />
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#f7f4ea" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l2.2 5.3L20 8.6l-4 3.9.9 5.7L12 15.6l-4.9 2.6.9-5.7-4-3.9 5.8-.3z" fill="rgba(247,244,234,0.35)" />
              </svg>
            </div>
            <div className="leading-tight">
              <h1 className="text-[16px] font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
                PromptMotion <span className="text-[11px] font-semibold" style={{ color: 'var(--gold)' }}>studio</span>
              </h1>
              <p className="text-[11px]" style={{ color: 'var(--faint)' }}>Prompt → video · fully offline</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={applySurprise}
              className="btnx btn-secondary btn-sm hidden sm:inline-flex"
              title="Randomize everything"
            >
              🎲 Surprise
            </button>
            <button
              onClick={() => setDark((d) => !d)}
              className="btnx btn-secondary btn-sm"
              title="Toggle light / dark"
              style={{ minWidth: 38 }}
            >
              {dark ? '☀️' : '🌙'}
            </button>

            <div className="relative" ref={accentPopoverRef}>
              <button
                onClick={() => setAccentOpen((v) => !v)}
                className="btnx btn-secondary btn-sm"
                title="Change UI accent color"
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full"
                  style={{ background: ACCENTS.find((a) => a.id === accent)?.swatch, boxShadow: '0 0 0 1px var(--line-strong)' }}
                />
                <span className="hidden md:inline">Theme</span>
              </button>
              {accentOpen && (
                <div className="accent-popover">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      className="accent-swatch"
                      data-active={accent === a.id}
                      style={{ background: a.swatch, color: a.swatch }}
                      title={a.name}
                      onClick={() => { setAccent(a.id); setAccentOpen(false); showToast(`UI color set to ${a.name}`); }}
                    />
                  ))}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <Badge variant="gold" className="hidden lg:inline-flex">🎬 {history.length}</Badge>
            )}
            <Badge variant="pine" className="hidden sm:inline-flex">100% offline</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-7">
        {/* Hero — the notebook page */}
        <section className="reveal mb-7">
          <div className="panel rounded-[24px]">
            <div className="grid items-start gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--pine)' }}>✎ Your idea</span>
                    <span className="eq" aria-hidden><span /><span /><span /></span>
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--faint)' }}>{prompt.length} / 220</span>
                </div>

                {/* Lined writing page */}
                <div className="writing-page">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={220}
                    rows={2}
                    placeholder="Write the scene you imagine… a night flight over a neon city, waves under moonlight…"
                  />
                </div>

                <div className="mt-3">
                  <Field
                    value={subtitle}
                    onChange={setSubtitle}
                    maxLength={100}
                    placeholder="Subtitle — a small line under the title (optional)"
                  />
                </div>

              </div>

              <div className="solid-box solid-box-strong flex flex-col gap-3 p-4">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--mute)' }}>Ready to render</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xl">{resolvedStyleDef?.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold" style={{ color: 'var(--ink)' }}>{resolvedStyleDef?.name}</div>
                      <div className="truncate text-[11px]" style={{ color: 'var(--faint)' }}>{res.name} · {fps} fps · {duration}s</div>
                    </div>
                    {styleSel === 'auto' && <Badge variant="pine">auto</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="gold">{activeTextMode?.name ?? 'Motion'}</Badge>
                  <Badge variant={hasAudio ? 'pine' : 'default'}>{hasAudio ? 'audio' : 'silent'}</Badge>
                  <Badge>≈ {formatBytes(estBytes)}</Badge>
                </div>
                {phase === 'recording' ? (
                  <Button variant="danger" size="lg" onClick={cancel} className="w-full">✕ Cancel render</Button>
                ) : (
                  <Button
                    variant="generate"
                    size="lg"
                    onClick={generate}
                    disabled={!prompt.trim() && textMode !== 'none'}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5.14v14l11-7-11-7z" />
                    </svg>
                    Generate video
                  </Button>
                )}
                <p className="text-center text-[10.5px]" style={{ color: 'var(--faint)' }}>⌘ + Enter · no upload required</p>
              </div>
            </div>

            {/* Useful quick controls fill the former empty hero space. */}
            <div className="grid gap-2 px-5 pb-1 sm:grid-cols-2 lg:grid-cols-4">
              <button
                className="hero-quick-box"
                onClick={() => { setActiveTab('style'); document.getElementById('studio-controls')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <span className="hero-quick-icon">🎨</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="hero-quick-label">Scene style</span>
                  <span className="hero-quick-value">{resolvedStyleDef?.name}</span>
                </span>
                <span className="hero-quick-arrow">›</span>
              </button>
              <button
                className="hero-quick-box"
                onClick={() => { setActiveTab('text'); document.getElementById('studio-controls')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <span className="hero-quick-icon">✍️</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="hero-quick-label">Text</span>
                  <span className="hero-quick-value">{activeTextMode?.name} · {Math.round(textScale * 100)}%</span>
                </span>
                <span className="hero-quick-arrow">›</span>
              </button>
              <button
                className="hero-quick-box"
                onClick={() => { setActiveTab('audio'); document.getElementById('studio-controls')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <span className="hero-quick-icon">🎵</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="hero-quick-label">Audio</span>
                  <span className="hero-quick-value">{hasAudio ? 'Enabled' : 'Silent'}</span>
                </span>
                <span className="hero-quick-arrow">›</span>
              </button>
              <button
                className="hero-quick-box"
                onClick={() => { setActiveTab('export'); document.getElementById('studio-controls')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <span className="hero-quick-icon">⚙️</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="hero-quick-label">Export</span>
                  <span className="hero-quick-value">{res.label} · {quality.name}</span>
                </span>
                <span className="hero-quick-arrow">›</span>
              </button>
            </div>

            <Divider label="presets" />
            <div className="marquee pb-2">
              <div className="marquee-track gap-2">
                {[...PRESETS, ...PRESETS].map((p, i) => (
                  <button
                    key={`${p.name}-${i}`}
                    onClick={() => applyPreset(p)}
                    className="btnx btn-secondary btn-sm"
                    title={`${p.prompt} — ${p.subtitle}`}
                  >
                    <span>{p.emoji}</span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Studio */}
        <div id="studio-controls" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          {/* Controls */}
          <div className="order-2 space-y-5 xl:order-1">
            <div className="sticky top-[68px] z-30 pb-1" style={{ background: 'transparent' }}>
              <div className="nav-dock">
                {TABS.map((tab) => (
                  <button key={tab.id} data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'style' && (
              <div className="reveal space-y-5">
                <Card
                  title="Scene style"
                  subtitle="Pick a look, or let Auto divine it from your words"
                  icon="🎨"
                  lift
                  action={
                    <Button variant="secondary" size="sm" onClick={applySurprise} title="Randomize style & palette">
                      🎲 Random look
                    </Button>
                  }
                >
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    <Tile active={styleSel === 'auto'} onClick={() => setStyleSel('auto')} emoji="✨" label="Auto" desc="From prompt" />
                    {STYLES.map((s) => (
                      <Tile key={s.id} active={styleSel === s.id} onClick={() => setStyleSel(s.id)} emoji={s.emoji} label={s.name} desc={s.desc} />
                    ))}
                  </div>
                  <div className="solid-box mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Timeline mode</div>
                      <div className="text-[11px]" style={{ color: 'var(--faint)' }}>
                        {timelineMode === 'multi' && nextRelDef ? `${resolvedStyleDef?.name} → ${nextRelDef.name}` : 'One scene, or blend related scenes'}
                      </div>
                    </div>
                    <Segmented
                      value={timelineMode}
                      onChange={setTimelineMode}
                      options={[
                        { id: 'single', label: 'Single' },
                        { id: 'multi', label: 'Multi' },
                      ]}
                    />
                  </div>
                </Card>

                <Card title="Color palette" subtitle="Accent colors for light, shapes and typography" icon="🌈" lift>
                  <div className="grid grid-cols-3 gap-2.5">
                    {PALETTES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPaletteId(p.id)}
                        data-active={paletteId === p.id}
                        className="tile"
                        style={{ padding: '10px' }}
                      >
                        <span className="flex h-7 overflow-hidden rounded-lg" style={{ border: '1px solid rgba(0,0,0,0.12)' }}>
                          {p.colors.slice(0, 5).map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
                        </span>
                        <span className="tile-name" style={{ fontSize: 10 }}>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="reveal space-y-5">
                <Card title="Text layer" subtitle="Edit the title and caption that appear in the video" icon="📝" lift>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-3">
                      <div>
                        <Label hint={`${prompt.length}/220`}>Main title</Label>
                        <Field
                          value={prompt}
                          onChange={setPrompt}
                          maxLength={220}
                          multiline
                          rows={2}
                          placeholder="Main title shown in the video"
                        />
                      </div>
                      <div>
                        <Label hint={`${subtitle.length}/100`}>Caption</Label>
                        <Field
                          value={subtitle}
                          onChange={setSubtitle}
                          maxLength={100}
                          placeholder="Optional subtitle under the title"
                        />
                      </div>
                    </div>
                    <div className="text-preview-card">
                      <div className="text-preview-canvas min-h-[180px]">
                        <div className="min-w-0">
                          <div
                            className="text-preview-title"
                            style={{
                              transform: `scale(${textScale})`,
                              opacity: textOpacity,
                              color: textColor === 'auto' ? undefined : textColor,
                            }}
                          >
                            {prompt.trim() || 'Your title appears here'}
                          </div>
                          {showSubtitle && subtitle.trim() && <div className="text-preview-subtitle">{subtitle}</div>}
                        </div>
                      </div>
                      <div className="text-chip-row">
                        <Badge variant="gold">Preview</Badge>
                        <Badge>{activeTextMode?.name ?? 'Motion'}</Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="Text adjustments" subtitle="Size, position, color and visibility" icon="🎚️" lift>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label>Title size</Label>
                          <span className="badge badge-pine">{Math.round(textScale * 100)}%</span>
                        </div>
                        <input type="range" min={0.65} max={1.55} step={0.05} value={textScale} onChange={(e) => setTextScale(Number(e.target.value))} />
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label>Title vertical position</Label>
                          <span className="badge">{Math.round(textY * 100)}%</span>
                        </div>
                        <input type="range" min={0.24} max={0.68} step={0.01} value={textY} onChange={(e) => setTextY(Number(e.target.value))} />
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label>Text opacity</Label>
                          <span className="badge">{Math.round(textOpacity * 100)}%</span>
                        </div>
                        <input type="range" min={0.25} max={1} step={0.05} value={textOpacity} onChange={(e) => setTextOpacity(Number(e.target.value))} />
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label>Caption vertical position</Label>
                          <span className="badge">{Math.round(subtitleY * 100)}%</span>
                        </div>
                        <input type="range" min={0.7} max={0.96} step={0.01} value={subtitleY} onChange={(e) => setSubtitleY(Number(e.target.value))} disabled={!showSubtitle} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Toggle checked={showSubtitle} onChange={setShowSubtitle} label="Show caption" desc="Hide or show subtitle layer" />
                      <div>
                        <Label>Text color</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'auto', name: 'Auto', color: palette.text },
                            { id: '#ffffff', name: 'White', color: '#ffffff' },
                            { id: '#111111', name: 'Ink', color: '#111111' },
                            { id: '#d4af37', name: 'Gold', color: '#d4af37' },
                            { id: '#2f6a4d', name: 'Pine', color: '#2f6a4d' },
                            { id: '#a78bfa', name: 'Violet', color: '#a78bfa' },
                          ].map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setTextColor(c.id)}
                              data-active={textColor === c.id}
                              className="tile px-2 py-2"
                              title={c.name}
                            >
                              <span className="mx-auto block h-5 w-5 rounded-full border" style={{ background: c.color, borderColor: 'var(--line-strong)' }} />
                              <span className="tile-name" style={{ fontSize: 9 }}>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        className="btnx btn-secondary btn-sm w-full"
                        onClick={() => {
                          setTextScale(1);
                          setTextY(0.46);
                          setSubtitleY(0.9);
                          setTextOpacity(1);
                          setTextColor('auto');
                          setShowSubtitle(true);
                        }}
                      >
                        Reset text layout
                      </button>
                    </div>
                  </div>
                </Card>

                <Card title="Text animation" subtitle="How your words appear on screen" icon="✍️" lift>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TEXT_MODES.map((m) => (
                      <RowItem key={m.id} active={textMode === m.id} onClick={() => setTextMode(m.id)} title={m.name} desc={m.desc} />
                    ))}
                  </div>
                </Card>

                {textMode === 'reveal' && (
                  <div className="solid-box p-4" style={{ borderColor: 'var(--pine)', background: 'var(--pine-soft)' }}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--pine)' }}>⏱️ Progressive Settings</span>
                      <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
                        {revealUnit === 'all' || revealDelayMs === 0
                          ? 'Shown instantly'
                          : `Full reveal: ${(revealDurationMs(prompt, revealUnit, revealDelayMs) / 1000).toFixed(1)}s`}
                      </span>
                    </div>

                    <div className="grid gap-5 md:grid-cols-[1fr_1fr_120px]">
                      <div>
                        <Label>Display unit</Label>
                        <Select
                          value={revealUnit}
                          onChange={(v) => setRevealUnit(v as any)}
                          options={REVEAL_UNITS.map((u) => ({ value: u.id, label: u.name }))}
                        />
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label>Speed</Label>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--pine)' }}>{revealDelayMs}ms delay</span>
                        </div>
                        <input
                          type="range" min={0} max={800} step={10}
                          value={revealDelayMs}
                          onChange={(e) => setRevealDelayMs(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Separator</Label>
                        <Field
                          value={revealSeparator}
                          onChange={setRevealSeparator}
                          placeholder="e.g. space"
                          maxLength={12}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Card title="Typography & polish" icon="🔤" lift>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Font</Label>
                      <Select value={fontId} onChange={setFontId} options={FONTS.map((f) => ({ value: f.id, label: f.name }))} />
                    </div>
                    <div>
                      <Label>Effects</Label>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {TEXT_EFFECTS.map((fx) => {
                          const on = textEffects.includes(fx.id);
                          return (
                            <button key={fx.id} onClick={() => toggleTextEffect(fx.id)} className={`btnx btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}>
                              {fx.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Toggle checked={vignette} onChange={setVignette} label="Vignette" desc="Darken the edges" />
                    <Toggle checked={grain} onChange={setGrain} label="Film grain" desc="Subtle texture" />
                  </div>
                  <div className="solid-box mt-4 flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Scene seed</div>
                      <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{seed}</div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setSeed(Math.floor(Math.random() * 100000))}>Shuffle</Button>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="reveal space-y-5">
                <Card title="Ambient soundtrack" subtitle="Synthesized in your browser, matched to the scene" icon="🎹" lift>
                  <div className="space-y-4">
                    <Toggle checked={ambientOn} onChange={setAmbientOn} label="Enable ambient bed" desc="Drone, wind and tone matched to the style" />
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12px]" style={{ color: 'var(--mute)' }}>Volume</span>
                        <span className="flex items-center gap-2">
                          {ambientOn && <span className="eq" aria-hidden><span /><span /><span /></span>}
                          <span className="text-[12px] font-bold" style={{ color: 'var(--pine)' }}>{Math.round(ambientVol * 100)}%</span>
                        </span>
                      </div>
                      <input type="range" min={0} max={1} step={0.05} value={ambientVol} onChange={(e) => setAmbientVol(Number(e.target.value))} disabled={!ambientOn} />
                    </div>
                  </div>
                </Card>

                <Card title="Your audio" subtitle="Optional MP3 / WAV mixed into the export" icon="🎵" lift>
                  <div className="space-y-4">
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onUserFile(f); }}
                      className="block w-full text-xs" style={{ color: 'var(--faint)' }}
                    />
                    {userFile && (
                      <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--line-pine)', background: 'var(--pine-soft)' }}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-bold" style={{ color: 'var(--pine)' }}>{userFile.name}</div>
                            {userDuration > 0 && <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{formatDuration(userDuration)}</div>}
                          </div>
                          <button
                            onClick={() => {
                              setUserFile(null);
                              audioEngineRef.current?.clearUserFile();
                              if (audioInputRef.current) audioInputRef.current.value = '';
                            }}
                            className="btnx btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px]" style={{ color: 'var(--mute)' }}>Vol</span>
                          <input type="range" min={0} max={1} step={0.05} value={userVol} onChange={(e) => setUserVol(Number(e.target.value))} className="flex-1" />
                          <span className="w-9 text-right text-[11px] font-bold" style={{ color: 'var(--pine)' }}>{Math.round(userVol * 100)}%</span>
                        </div>
                      </div>
                    )}
                    <Toggle checked={monitorAudio} onChange={setMonitorAudio} label="Preview audio live" desc="Hear the mix while you tweak" />
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="reveal space-y-5">
                <Card title="Format" subtitle="Resolution and cadence for the final file" icon="📺" lift>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Resolution</Label>
                      <Select value={resId} onChange={setResId} options={RESOLUTIONS.map((r) => ({ value: r.id, label: `${r.name} · ${r.label}` }))} />
                    </div>
                    <div>
                      <Label>Frame rate</Label>
                      <Select value={fps} onChange={(v) => setFps(Number(v))} options={[
                        { value: 24, label: '24 fps · Cinematic' },
                        { value: 30, label: '30 fps · Standard' },
                        { value: 60, label: '60 fps · Smooth' },
                      ]} />
                    </div>
                  </div>
                </Card>

                <Card title="Quick presets" subtitle="One-tap output targets" icon="⚡" lift>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="solid-box p-3 text-left"
                      onClick={() => { setResId('1080p'); setFps(30); setDuration(duration); }}
                    >
                      <div className="text-xl">🎬</div>
                      <div className="mt-1 text-[12px] font-bold" style={{ color: 'var(--ink)' }}>YouTube</div>
                      <div className="text-[10px]" style={{ color: 'var(--faint)' }}>Full HD · 30fps</div>
                    </button>
                    <button
                      className="solid-box p-3 text-left"
                      onClick={() => { setResId('vertical'); setFps(30); setDuration(duration); }}
                    >
                      <div className="text-xl">📱</div>
                      <div className="mt-1 text-[12px] font-bold" style={{ color: 'var(--ink)' }}>Reels</div>
                      <div className="text-[10px]" style={{ color: 'var(--faint)' }}>9:16 Vertical</div>
                    </button>
                    <button
                      className="solid-box p-3 text-left"
                      onClick={() => { setResId('square'); setFps(24); setDuration(duration); }}
                    >
                      <div className="text-xl">🟩</div>
                      <div className="mt-1 text-[12px] font-bold" style={{ color: 'var(--ink)' }}>Square</div>
                      <div className="text-[10px]" style={{ color: 'var(--faint)' }}>1:1 · 24fps</div>
                    </button>
                  </div>
                </Card>

                <Card title="Length & quality" icon="⏱️" lift>
                  <div className="space-y-5">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label>Duration</Label>
                        <span className="badge badge-pine">{duration}s</span>
                      </div>
                      <input type="range" min={3} max={30} step={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                      <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--faint)' }}><span>3s</span><span>30s</span></div>
                    </div>
                    <div>
                      <Label hint={`≈ ${formatBytes(estBytes)}`}>Bitrate</Label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {QUALITIES.map((q) => (
                          <button key={q.id} onClick={() => setQualityId(q.id)} data-active={qualityId === q.id} className="tile" style={{ padding: '12px 6px' }}>
                            <span className="tile-name">{q.name}</span>
                            <span className="tile-desc">{q.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Preview column */}
          <div className="order-1 space-y-5 xl:order-2 xl:sticky xl:top-[76px] xl:self-start">
            <Card
              title={phase === 'recording' ? 'Rendering…' : 'Preview'}
              subtitle={`${res.w}×${res.h} · ${res.label} · seed ${seed}`}
              icon="▶"
              action={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('text')}
                    className="badge badge-gold cursor-pointer transition hover:opacity-85"
                    title="Click to customize text & animation"
                  >
                    ✍️ {activeTextMode?.name ?? 'Text'}
                  </button>
                  <Badge variant="pine">{resolvedStyleDef?.emoji} {resolvedStyleDef?.name}</Badge>
                </div>
              }
            >
              <div className="art-frame">
                <div className="art-canvas" style={{ aspectRatio: `${res.w}/${res.h}` }}>
                  <span className="stage-accent" />
                  <canvas ref={canvasRef} className="h-full w-full object-contain" />

                  {phase === 'recording' && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-4 pt-10">
                      <div className="mb-2 flex items-center justify-between text-[12px]">
                        <span className="font-medium text-zinc-300">Keep this tab visible</span>
                        <span className="font-mono font-bold" style={{ color: '#e7d9a8' }}>{Math.round(progress * 100)}%</span>
                      </div>
                      <div className="progress-track progress-shimmer">
                        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        {eta > 0 ? `${formatDuration(eta)} remaining` : 'Finishing encode…'}
                        {hasAudio ? ' · mixing audio' : ' · silent'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--faint)' }}>
                <span>Live preview at half resolution</span>
                <span>·</span>
                <span>Export renders full quality</span>
                {monitorAudio && <><span>·</span><span className="t-pine">audio preview on</span></>}
              </div>

              {error && (
                <div className="mt-3 rounded-2xl border px-4 py-3 text-[12px]" style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                  {error}
                </div>
              )}
            </Card>

            {result && phase === 'done' && (
              <Card title="Your video is ready" subtitle="Download it, or re-render with tweaks" icon="✓" className="reveal">
                <div className="art-frame">
                  <div className="art-canvas" style={{ aspectRatio: `${res.w}/${res.h}` }}>
                    <span className="stage-accent" />
                    <video src={result.url} controls autoPlay loop playsInline className="h-full w-full object-contain bg-black" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="pine">{formatBytes(result.blob.size)}</Badge>
                  <Badge variant="gold">{result.ext.toUpperCase()}</Badge>
                  <Badge>{duration}s</Badge>
                  <Badge>{res.name}</Badge>
                  {hasAudio && <Badge variant="pine">audio</Badge>}
                </div>
                <div className="mt-4 flex gap-2">
                  <a href={result.url} download={safeName} className="btnx btn-success btn-md flex-1">
                    ⬇ Download {safeName}
                  </a>
                  <Button variant="secondary" onClick={generate}>Re-render</Button>
                </div>
              </Card>
            )}

            {history.length > 0 && phase !== 'recording' && (
              <Card title="Recent videos" subtitle="Rendered on this device, this session" icon="🗂️">
                <div className="no-scrollbar -mx-2 flex gap-3 overflow-x-auto px-2 pb-1">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="solid-box min-w-[180px] flex-1 basis-44 shrink-0 p-3"
                    >
                      <div className="truncate text-[12px] font-bold" style={{ color: 'var(--ink)' }}>
                        {h.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px]" style={{ color: 'var(--faint)' }}>
                        {h.prompt || 'Untitled'}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="gold">{formatBytes(h.size)}</Badge>
                        <Badge>{h.ext.toUpperCase()}</Badge>
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        <a href={h.url} download={h.name} className="btnx btn-secondary btn-sm flex-1">⬇ Save</a>
                        <button
                          className="btnx btn-secondary btn-sm"
                          onClick={() => {
                            setPrompt(h.prompt);
                            setSubtitle(h.subtitle);
                            showToast('Loaded from history — press generate');
                          }}
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {history.length > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
                      URLs live for this session
                    </span>
                    <button
                      className="btnx btn-ghost btn-sm"
                      onClick={() => {
                        history.forEach((item) => URL.revokeObjectURL(item.url));
                        setHistory([]);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </Card>
            )}

            <Card title="How it works" subtitle="Nothing leaves your device" icon="i">
              <ol className="space-y-2.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--mute)' }}>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: 'var(--pine)', color: 'var(--on-pine)' }}>1</span>
                  <span>Your words shape the typography and pick the scene.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: 'var(--pine)', color: 'var(--on-pine)' }}>2</span>
                  <span>Canvas paints each frame; Web Audio draws the sound.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: 'var(--pine)', color: 'var(--on-pine)' }}>3</span>
                  <span>Your browser records and encodes the video file.</span>
                </li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['13 scenes', '11 text modes', '12 presets', 'ambient audio', 'no servers'].map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t py-5 text-center text-[11px]" style={{ borderColor: 'var(--line)', color: 'var(--faint)' }}>
        PromptMotion studio · rendered entirely in your browser
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
