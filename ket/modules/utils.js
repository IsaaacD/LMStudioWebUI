/* ── Tooltip / Overlay UI ── */
export const TOOLTIP_Z_INDEX = '9999';
export const TOOLTIP_MAX_WIDTH = '240px';
export const TOOLTIP_BACKGROUND = 'rgba(10,10,20,0.92)';
export const TOOLTIP_TEXT_COLOR = '#ddd';
export const TOOLTIP_PADDING = '6px 10px';
export const TOOLTIP_BORDER_RADIUS = '6px';
export const TOOLTIP_FONT_SIZE = '12px';
export const TOOLTIP_LINE_HEIGHT = '1.4';
export const TOOLTIP_BOX_SHADOW = '0 2px 12px rgba(0,0,0,0.6)';
export const TOOLTIP_BORDER = '1px solid rgba(255,255,255,0.08)';
export const TOOLTIP_OFFSET_PX = 14;

/* ── Info Icon ── */
export const INFO_ICON_MARGIN_LEFT = '6px';
export const INFO_ICON_FONT_SIZE = '11px';
export const INFO_ICON_OPACITY = '0.5';
export const INFO_ICON_COLOR = '#aaa';

/* ── Audio Button ── */
export const AUDIO_BUTTON_FONT_SIZE = '16px';
export const AUDIO_BUTTON_MARGIN_LEFT = '8px';
export const AUDIO_BUTTON_PADDING = '2px 6px';
export const AUDIO_BUTTON_BORDER_RADIUS = '4px';
export const AUDIO_BUTTON_POSITION_OFFSET = '10px';
export const AUDIO_INITIAL_VOLUME = 0.5;
export const SPLASH_EXIT_DELAY_MS = 2000;

/* ── GUI Slider Ranges ── */
export const GUI_SPEED_MIN = 0.5;
export const GUI_SPEED_MAX = 1.2;
export const GUI_TIMESCALE_MIN = 0.1;
export const GUI_TIMESCALE_MAX = 3;
export const GUI_BLOOM_STRENGTH_MIN = 0.05;
export const GUI_BLOOM_STRENGTH_MAX = 0.5;
export const GUI_BLOOM_RADIUS_MIN = 0.1;
export const GUI_BLOOM_RADIUS_MAX = 1;
export const GUI_FOLD_INTENSITY_MIN = 0.5;
export const GUI_FOLD_INTENSITY_MAX = 3;
export const GUI_VEIN_SPEED_MIN = 0.5;
export const GUI_VEIN_SPEED_MAX = 3;
export const GUI_EDGE_CONTRAST_MIN = 0.1;
export const GUI_EDGE_CONTRAST_MAX = 0.25;

/* ── Color Normalization ── */
export function normalizeColor(val, _locationStr) {
    if (typeof val === 'string') {
        if (val.startsWith('#')) return val;
        if (val.startsWith('0x')) return '#' + val.slice(2);
        return '#' + val;
    }
    if (typeof val === 'number') return '#' + val.toString(16).padStart(6, '0');
    return val;
}

/* ── Feature Flags ── */
export const FEATURES = {
    webrtc: true,
    onlineMode: new URLSearchParams(window.location.search).has('online')
};

/* ── Deterministic hash PRNG (MurmurHash3 finalizer + IMUL mix) ── */
/* prefer this to Math.random() for deterministic behavior across sessions */
export function hashNumber(n, seed = _seed) {
    let h = (n + 0x9e3779b9) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0;
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) | 0;
    h = Math.imul(h ^ (h >>> (seed & 0x1f)), 0x45d9f3b) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function todayAnchor() {
    const d = new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function deriveDuration(n, minDur, maxDur, seed = _seed) {
    return hashRange(n, minDur, maxDur, seed);
}

export function minMaxRange(min, max, seed = _seed) {
    return deriveDuration(todayAnchor(), min, max, seed);
}

export function hashRange(n, min, max, seed = _seed) {
    return min + hashNumber(n, seed) * (max - min);
}

/* ── Seeded PRNG (mulberry32) ── */
let _seed = 42;

export function setGlobalSeed(value) {
    _seed = value | 0;
}

export function getGlobalSeed() {
    return _seed;
}

function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const _seededRandom = mulberry32(_seed);

export function seededRandom() {
    return _seededRandom();
}

// Monkey-patch Math.random with our seeded PRNG
const _originalRandom = Math.random;
Math.random = _seededRandom;

export function restoreOriginalRandom() {
    Math.random = _originalRandom;
}

const _shaderCache = new Map();

export function preloadShader(path, content) {
    _shaderCache.set(path, content);
}

export async function loadShader(path) {
    if (_shaderCache.has(path)) return _shaderCache.get(path);
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.statusText}`);
    return await response.text();
}
