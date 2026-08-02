// ---------- Seeded RNG ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RNG = () => number;

// ---------- Palettes ----------
export interface Palette {
  id: string;
  name: string;
  colors: string[];
  bg: [string, string];
  text: string;
}

export const PALETTES: Palette[] = [
  { id: 'violet', name: 'Violet Dream', colors: ['#a78bfa', '#7c3aed', '#ec4899', '#6366f1', '#c4b5fd'], bg: ['#0d0620', '#1e0b3e'], text: '#f5f3ff' },
  { id: 'ocean', name: 'Deep Ocean', colors: ['#38bdf8', '#0ea5e9', '#22d3ee', '#2563eb', '#67e8f9'], bg: ['#020817', '#082f49'], text: '#f0f9ff' },
  { id: 'sunset', name: 'Sunset Blaze', colors: ['#fb923c', '#f97316', '#f43f5e', '#fbbf24', '#e11d48'], bg: ['#1c0a02', '#3b0d21'], text: '#fff7ed' },
  { id: 'emerald', name: 'Emerald Forest', colors: ['#34d399', '#10b981', '#a3e635', '#14b8a6', '#4ade80'], bg: ['#02120c', '#043524'], text: '#ecfdf5' },
  { id: 'cyber', name: 'Cyber Neon', colors: ['#22d3ee', '#e879f9', '#a3e635', '#f472b6', '#38bdf8'], bg: ['#04040c', '#12082b'], text: '#fdf4ff' },
  { id: 'crimson', name: 'Crimson Fire', colors: ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#fca5a5'], bg: ['#140303', '#3a0a0a'], text: '#fef2f2' },
  { id: 'mono', name: 'Silver Mono', colors: ['#e2e8f0', '#94a3b8', '#cbd5e1', '#64748b', '#f8fafc'], bg: ['#05070c', '#151b27'], text: '#f8fafc' },
  { id: 'gold', name: 'Royal Gold', colors: ['#fbbf24', '#f59e0b', '#fde68a', '#d97706', '#fef3c7'], bg: ['#0e0902', '#2b1c05'], text: '#fffbeb' },
  { id: 'darksouls', name: 'Dark Fantasy', colors: ['#c9a84c', '#a87733', '#7a2a1f', '#e8e0d0', '#6b4a2b'], bg: ['#0a0807', '#1a1210'], text: '#e8e0d0' },
];

// ---------- Styles ----------
export type StyleId =
  | 'nebula'
  | 'ocean'
  | 'starfield'
  | 'embers'
  | 'matrix'
  | 'aurora'
  | 'geometric'
  | 'network'
  | 'synthwave'
  | 'plasma'
  | 'snow'
  | 'bubbles'
  | 'darksouls';

export interface StyleDef {
  id: StyleId;
  name: string;
  emoji: string;
  desc: string;
  accent?: string;
}

export const STYLES: StyleDef[] = [
  { id: 'nebula', name: 'Nebula', emoji: '🌌', desc: 'Drifting cosmic clouds' },
  { id: 'aurora', name: 'Aurora', emoji: '🌠', desc: 'Northern lights ribbons' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', desc: 'Layered rolling waves' },
  { id: 'starfield', name: 'Starfield', emoji: '🚀', desc: 'Warp-speed star travel' },
  { id: 'embers', name: 'Embers', emoji: '🔥', desc: 'Rising fire particles' },
  { id: 'matrix', name: 'Matrix', emoji: '💻', desc: 'Digital rain code' },
  { id: 'geometric', name: 'Geometric', emoji: '🔷', desc: 'Rotating sacred shapes' },
  { id: 'network', name: 'Network', emoji: '🕸️', desc: 'Connected particle web' },
  { id: 'synthwave', name: 'Synthwave', emoji: '🌆', desc: 'Retro grid + neon sun' },
  { id: 'plasma', name: 'Plasma', emoji: '🟣', desc: 'Morphing plasma field' },
  { id: 'snow', name: 'Snowfall', emoji: '❄️', desc: 'Gentle falling snow' },
  { id: 'bubbles', name: 'Bubbles', emoji: '🫧', desc: 'Rising light bubbles' },
  { id: 'darksouls', name: 'Gothic Flame', emoji: '🏰', desc: 'Dramatic fire & fog', accent: '#c9a84c' },
];

const KEYWORDS: Record<StyleId, string[]> = {
  ocean: ['ocean', 'sea', 'water', 'wave', 'beach', 'surf', 'lake', 'river', 'dive', 'marine'],
  starfield: ['space', 'star', 'galaxy', 'cosmos', 'rocket', 'planet', 'universe', 'travel', 'speed', 'warp', 'void'],
  embers: ['fire', 'flame', 'ember', 'lava', 'burn', 'hot', 'volcano', 'spark', 'phoenix', 'energy'],
  matrix: ['code', 'hacker', 'matrix', 'cyber', 'tech', 'digital', 'software', 'ai', 'program', 'data', 'glitch'],
  aurora: ['aurora', 'northern', 'sky', 'light', 'nature', 'calm', 'dream', 'night', 'peace', 'winter'],
  geometric: ['geometry', 'shape', 'abstract', 'design', 'art', 'modern', 'minimal', 'logo', 'brand'],
  network: ['network', 'connect', 'web', 'social', 'link', 'community', 'internet', 'graph', 'neural'],
  nebula: ['nebula', 'cloud', 'magic', 'fantasy', 'mystery', 'deep', 'cosmic', 'galactic'],
  synthwave: ['retro', 'synth', '80s', 'neon', 'vapor', 'miami', 'cyberpunk', 'drift', 'outrun', 'arcade'],
  plasma: ['plasma', 'liquid', 'morph', 'lava lamp', 'psychedelic', 'trippy'],
  snow: ['snow', 'snowfall', 'frost', 'cold', 'arctic', 'blizzard', 'ice', 'winter wonderland'],
  bubbles: ['bubble', 'underwater', 'float', 'soap', 'fizzy', 'soda', 'champagne'],
  darksouls: ['gothic', 'flame', 'bonfire', 'castle', 'fog', 'dramatic', 'medieval', 'dark fantasy'],
};

export function detectStyle(prompt: string): StyleId {
  const lower = prompt.toLowerCase();
  let best: StyleId = 'nebula';
  let bestScore = 0;
  (Object.keys(KEYWORDS) as StyleId[]).forEach((style) => {
    const score = KEYWORDS[style].reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = style;
    }
  });
  return best;
}

/** Related scenes to cycle through in a multi-scene timeline. */
export const STYLE_RELATIVES: Record<StyleId, StyleId[]> = {
  nebula: ['aurora', 'starfield'],
  aurora: ['nebula', 'snow'],
  ocean: ['bubbles', 'snow'],
  starfield: ['nebula', 'network'],
  embers: ['plasma', 'synthwave', 'darksouls'],
  matrix: ['network', 'synthwave'],
  geometric: ['synthwave', 'plasma'],
  network: ['matrix', 'starfield'],
  synthwave: ['matrix', 'geometric'],
  plasma: ['bubbles', 'embers'],
  snow: ['aurora', 'ocean'],
  bubbles: ['plasma', 'ocean'],
  darksouls: ['embers', 'snow', 'nebula'],
};

// ---------- Resolutions ----------
export interface Resolution {
  id: string;
  name: string;
  w: number;
  h: number;
  label: string;
}

export const RESOLUTIONS: Resolution[] = [
  { id: '720p', name: 'HD 720p', w: 1280, h: 720, label: '16:9' },
  { id: '1080p', name: 'Full HD 1080p', w: 1920, h: 1080, label: '16:9' },
  { id: 'square', name: 'Square 1080', w: 1080, h: 1080, label: '1:1' },
  { id: 'vertical', name: 'Vertical 1080', w: 1080, h: 1920, label: '9:16' },
];

export const QUALITIES = [
  { id: 'standard', name: 'Standard', bitrate: 8_000_000, hint: '8 Mbps' },
  { id: 'high', name: 'High', bitrate: 16_000_000, hint: '16 Mbps' },
  { id: 'ultra', name: 'Ultra', bitrate: 28_000_000, hint: '28 Mbps' },
];

export const FONTS = [
  { id: 'sans', name: 'Modern Sans', family: '700 FSZpx "Segoe UI", system-ui, Arial, sans-serif' },
  { id: 'serif', name: 'Elegant Serif', family: '700 FSZpx Georgia, "Times New Roman", serif' },
  { id: 'mono', name: 'Tech Mono', family: '700 FSZpx "Courier New", monospace' },
  { id: 'impact', name: 'Bold Impact', family: '900 FSZpx Impact, "Arial Black", sans-serif' },
  { id: 'cinzel', name: 'Gothic Display', family: '700 FSZpx "Cinzel", Georgia, serif', tracking: 0.15 },
];

export const TEXT_MODES: { id: string; name: string; desc: string }[] = [
  { id: 'kinetic', name: 'Kinetic', desc: 'Word-by-word reveal' },
  { id: 'title', name: 'Cinematic Title', desc: 'Slow zoom title card' },
  { id: 'typewriter', name: 'Typewriter', desc: 'Typewriter effect' },
  { id: 'reveal', name: 'Progressive Reveal', desc: 'Custom unit · delay · separator' },
  { id: 'cascade', name: 'Cascade', desc: 'Letters fade from below' },
  { id: 'wave', name: 'Wave', desc: 'Floating sine wave' },
  { id: 'slam', name: 'Slam Impact', desc: 'Elastic zoom-in drop' },
  { id: 'glitch', name: 'Glitch', desc: 'Cyber RGB split' },
  { id: 'blur', name: 'Blur Focus', desc: 'Sharpens into focus' },
  { id: 'neon', name: 'Neon Flicker', desc: 'Flickering sign glow' },
  { id: 'souls', name: 'Gold Display', desc: 'Wide tracked gold title' },
  { id: 'none', name: 'None', desc: 'Visuals only' },
];

/** Options exposed for the "Progressive Reveal" text mode. */
export const REVEAL_UNITS: { id: 'char' | 'word' | 'sentence' | 'paragraph' | 'all'; name: string }[] = [
  { id: 'char', name: 'Character' },
  { id: 'word', name: 'Word' },
  { id: 'sentence', name: 'Sentence' },
  { id: 'paragraph', name: 'Paragraph' },
  { id: 'all', name: 'All at once' },
];

export const REVEAL_SEPARATOR_PRESETS: { id: string; name: string; value: string }[] = [
  { id: 'space', name: 'Space', value: ' ' },
  { id: 'none', name: 'Nothing', value: '' },
  { id: 'newline', name: 'New line', value: '\n' },
  { id: 'dash', name: 'Dash', value: ' — ' },
  { id: 'bullet', name: 'Bullet', value: ' • ' },
  { id: 'slash', name: 'Slash', value: ' / ' },
];

export const TEXT_EFFECTS = [
  { id: 'glow', name: 'Soft glow' },
  { id: 'gradient', name: 'Gradient fill' },
  { id: 'outline', name: 'Text outline' },
];

export interface VideoConfig {
  prompt: string;
  subtitle: string;
  style: StyleId;
  palette: Palette;
  width: number;
  height: number;
  fps: number;
  duration: number;
  textMode: string;
  fontId: string;
  seed: number;
  grain: boolean;
  vignette: boolean;
  textEffects: string[];
  timelineMode: 'single' | 'multi';
  textScale: number;
  textY: number;
  subtitleY: number;
  textOpacity: number;
  textColor: string;
  showSubtitle: boolean;
  /** Progressive-reveal options — used by the 'reveal' text mode. */
  revealUnit: 'char' | 'word' | 'sentence' | 'paragraph' | 'all';
  revealDelayMs: number;
  revealSeparator: string;
}

// ---------- Presets ----------
export interface Preset {
  name: string;
  emoji: string;
  prompt: string;
  subtitle: string;
  style?: StyleId;
  palette?: string;
  textMode?: string;
}

export const PRESETS: Preset[] = [
  { name: 'Cosmic Voyage', emoji: '🌌', prompt: 'Journey through the neon galaxy', subtitle: 'Exploring distant star systems', style: 'nebula', palette: 'violet', textMode: 'title' },
  { name: 'Travel Vlog', emoji: '✈️', prompt: 'Chasing horizons across the world', subtitle: 'A story of places and moments', style: 'aurora', palette: 'ocean', textMode: 'kinetic' },
  { name: 'Gaming Clip', emoji: '🎮', prompt: 'Unstoppable Victory', subtitle: 'Clutch play incoming', style: 'synthwave', palette: 'cyber', textMode: 'slam' },
  { name: 'Product Launch', emoji: '✨', prompt: 'Introducing Something New', subtitle: 'Crafted for perfection', style: 'geometric', palette: 'gold', textMode: 'title' },
  { name: 'Podcast Opener', emoji: '🎙️', prompt: 'Welcome to the Future', subtitle: 'Episode 42 · Live now', style: 'network', palette: 'mono', textMode: 'cascade' },
  { name: 'Cyber Hacking', emoji: '💻', prompt: 'Mainframe Override Initiated', subtitle: 'System security bypassed', style: 'matrix', palette: 'emerald', textMode: 'glitch' },
  { name: 'Nature Drone', emoji: '🌿', prompt: 'Breathe in the Wilderness', subtitle: 'Where nature speaks', style: 'aurora', palette: 'emerald', textMode: 'blur' },
  { name: 'Retro 80s', emoji: '📼', prompt: 'Neon Dreams Forever', subtitle: 'Outrun the sunset', style: 'synthwave', palette: 'sunset', textMode: 'neon' },
  { name: 'Deep Ocean', emoji: '🐠', prompt: 'Into the Deep Blue Void', subtitle: 'Where light dances underwater', style: 'bubbles', palette: 'ocean', textMode: 'wave' },
  { name: 'Winter Tale', emoji: '❄️', prompt: 'A Silent Winter Solstice', subtitle: 'Snow falling softly at night', style: 'snow', palette: 'mono', textMode: 'typewriter' },
  { name: 'Gothic Legend', emoji: '🏰', prompt: 'Fire and Shadows Rise', subtitle: 'An ancient kingdom reborn', style: 'darksouls', palette: 'darksouls', textMode: 'souls' },
  { name: 'Motivation', emoji: '🔥', prompt: 'Rise and Conquer Today', subtitle: 'Your story begins now', style: 'embers', palette: 'sunset', textMode: 'slam' },
];

// ---------- Surprise me ----------
export function surpriseMe(): Partial<{ prompt: string; subtitle: string; style: StyleId; palette: string; textMode: string; seed: number }> {
  const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  const style = STYLES[Math.floor(Math.random() * STYLES.length)].id;
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)].id;
  const modes = TEXT_MODES.filter((m) => m.id !== 'none');
  const textMode = modes[Math.floor(Math.random() * modes.length)].id;
  return {
    prompt: preset.prompt,
    subtitle: preset.subtitle,
    style,
    palette,
    textMode,
    seed: Math.floor(Math.random() * 100000),
  };
}
