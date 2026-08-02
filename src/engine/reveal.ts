/**
 * Progressive text reveal utility.
 *
 * Splits a source string into "units" (characters, words, sentences, or
 * paragraphs), then reveals them one at a time on a caller-controlled delay.
 * The rendered output is the units joined by a custom separator.
 *
 * The implementation is intentionally allocation-light — the input is split
 * once per configuration and cached so per-frame animation stays cheap even
 * for long prompts.
 *
 * Usage:
 *   const state = revealText({
 *     text: 'Hello world',
 *     unit: 'char',
 *     delayMs: 60,
 *     separator: '',
 *     elapsedMs: performance.now() - start,
 *   });
 *   ctx.fillText(state.output, 20, 20);
 */
export type RevealUnit = 'char' | 'word' | 'sentence' | 'paragraph' | 'all';

/** Options accepted by revealText(). */
export interface RevealOptions {
  /** Source text to reveal. */
  text: string;
  /** Time elapsed since the reveal started, in milliseconds. */
  elapsedMs: number;
  /** Which unit to reveal at a time. Defaults to 'word'. */
  unit?: RevealUnit;
  /** Delay between units, in milliseconds. Defaults to 90ms. */
  delayMs?: number;
  /**
   * String placed between units when reconstructing the output.
   * Defaults to the natural separator for the unit (e.g. ' ' for words).
   * Pass an empty string to concatenate directly.
   */
  separator?: string;
  /**
   * If true, appends a blinking terminal cursor to the output while still
   * revealing. Handy for typewriter-style effects.
   */
  cursor?: boolean;
}

/** Snapshot returned by revealText(). */
export interface RevealState {
  /** Text visible at the current elapsed time. */
  output: string;
  /** Number of units currently revealed. */
  revealed: number;
  /** Total number of units. */
  total: number;
  /** True once every unit is on screen. */
  complete: boolean;
  /** 0..1 progress ratio (revealed / total). */
  progress: number;
}

/**
 * Split source text into units.  We normalise line endings once so the
 * behaviour is stable across platforms and OS-supplied clipboards.
 */
function splitUnits(text: string, unit: RevealUnit): string[] {
  const src = text.replace(/\r\n?/g, '\n');
  switch (unit) {
    case 'char':
      // Use the spread operator so surrogate pairs (emoji) and combining
      // marks each count as a single visible unit rather than two code units.
      return Array.from(src);
    case 'word':
      // Preserve empty strings from a leading/trailing whitespace so the
      // caller can join them back with a custom separator without gaps.
      return src.split(/\s+/).filter(Boolean);
    case 'sentence':
      // Sentence-terminal punctuation (.!?…) optionally followed by close
      // quotes/brackets, then whitespace.  Falls back to one big sentence if
      // no punctuation is present.
      return src
        .match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g)
        ?.map((s) => s.trim())
        .filter(Boolean) ?? (src.trim() ? [src.trim()] : []);
    case 'paragraph':
      return src.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    case 'all':
    default:
      return src ? [src] : [];
  }
}

/** Sensible default separator per unit. */
function defaultSeparator(unit: RevealUnit): string {
  switch (unit) {
    case 'char': return '';
    case 'word': return ' ';
    case 'sentence': return ' ';
    case 'paragraph': return '\n\n';
    case 'all':
    default: return '';
  }
}

interface CacheEntry {
  units: string[];
  key: string;
}
const UNIT_CACHE = new Map<string, CacheEntry>();
function getUnits(text: string, unit: RevealUnit): string[] {
  const key = `${unit}\x00${text}`;
  const cached = UNIT_CACHE.get(key);
  if (cached) return cached.units;
  const units = splitUnits(text, unit);
  if (UNIT_CACHE.size > 128) {
    // Simple FIFO eviction to prevent unbounded growth in long sessions.
    const first = UNIT_CACHE.keys().next().value;
    if (first) UNIT_CACHE.delete(first);
  }
  UNIT_CACHE.set(key, { units, key });
  return units;
}

/**
 * Compute the reveal state for a given elapsed time.  Pure and deterministic
 * so the same time always produces the same frame — required for reliable
 * video recording.
 */
export function revealText(opts: RevealOptions): RevealState {
  const unit: RevealUnit = opts.unit ?? 'word';
  const delayMs = Math.max(0, opts.delayMs ?? 90);
  const separator = opts.separator ?? defaultSeparator(unit);
  const units = getUnits(opts.text ?? '', unit);
  const total = units.length;

  if (total === 0) {
    return { output: '', revealed: 0, total: 0, complete: true, progress: 1 };
  }

  // Instant reveal shortcut: delay 0 or unit "all" simply shows everything.
  if (delayMs === 0 || unit === 'all') {
    return {
      output: units.join(separator),
      revealed: total,
      total,
      complete: true,
      progress: 1,
    };
  }

  const revealed = Math.min(total, Math.max(0, Math.floor(opts.elapsedMs / delayMs) + 1));
  const complete = revealed >= total;
  const output = units.slice(0, revealed).join(separator) + (opts.cursor && !complete ? '▌' : '');

  return {
    output,
    revealed,
    total,
    complete,
    progress: revealed / total,
  };
}

/** Utility: how many milliseconds are needed to fully reveal the text. */
export function revealDurationMs(text: string, unit: RevealUnit, delayMs: number): number {
  if (unit === 'all' || delayMs === 0) return 0;
  return getUnits(text, unit).length * Math.max(0, delayMs);
}
