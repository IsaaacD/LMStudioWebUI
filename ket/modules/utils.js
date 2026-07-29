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
export const GUI_SPEED_MIN = 1;
export const GUI_SPEED_MAX = 5;
export const GUI_AUTOPLAY_SPEED_MIN = 2;
export const GUI_AUTOPLAY_SPEED_MAX = 5;
export const GUI_TIMESCALE_MIN = 0.1;
export const GUI_TIMESCALE_MAX = 3;
export const GUI_BLOOM_STRENGTH_MIN = 0.5;
export const GUI_BLOOM_STRENGTH_MAX = 3;
export const GUI_BLOOM_RADIUS_MIN = 0.1;
export const GUI_BLOOM_RADIUS_MAX = 1;
export const GUI_FOLD_INTENSITY_MIN = 0.5;
export const GUI_FOLD_INTENSITY_MAX = 3;
export const GUI_VEIN_SPEED_MIN = 0.5;
export const GUI_VEIN_SPEED_MAX = 3;
export const GUI_EDGE_CONTRAST_MIN = 0.1;
export const GUI_EDGE_CONTRAST_MAX = 0.25;

/* ── Feature Flags ── */
export const FEATURES = {
    webrtc: false
};

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
