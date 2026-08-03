import * as THREE from 'three';
import {
    GUI_SPEED_MIN, GUI_SPEED_MAX,
    GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX,
    GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX,
    GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX,
    GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX,
    GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX,
    normalizeColor,
    GUI_BLOOM_STRENGTH_MIN,
    GUI_BLOOM_STRENGTH_MAX,
    hashRange,
    todayAnchor
} from './utils.js';

function dailyValue(offset, min, max) {
    return hashRange(todayAnchor() + offset, min, max);
}

export const defaultParams = {
    speed: dailyValue(1, GUI_SPEED_MIN, GUI_SPEED_MAX),
    timeScale: dailyValue(2, GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX),
    bloomStrength: dailyValue(3, GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX),
    bloomRadius: dailyValue(4, GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX),
    foldIntensity: dailyValue(5, GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX),
    veinSpeed: dailyValue(6, GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX),
    colorA: dailyColor(1),
    colorB: dailyColor(2),
    edgeContrast: dailyValue(7, GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX),
    paused: false,
    autoplay: true,
    controlMode: 'Auto',
    raveMode: false,
    forceNextScene: false,
    forceNextOrdered: false,
    //particles: false
};

function dailyColor(offset) {
    const base = todayAnchor();
    const hue = hashRange(base + offset, 0, 360);
    const sat = hashRange(base + offset + 1000, 60, 100);
    const lit = hashRange(base + offset + 2000, 40, 70);
    return '#' + new THREE.Color(`hsl(${hue}, ${sat}%, ${lit}%)`).getHexString();
}

export function randomizeParams(params) {
    const s = Math.floor(Math.random() * 2 ** 31);
    params.speed = hashRange(s + 1, GUI_SPEED_MIN, GUI_SPEED_MAX);
    params.foldIntensity = hashRange(s + 2, GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX);
    params.edgeContrast = hashRange(s + 3, GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX);
    params.veinSpeed = hashRange(s + 4, GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX);
    params.bloomStrength = hashRange(s + 5, GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX);
    params.bloomRadius = hashRange(s + 6, GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX);
    params.timeScale = hashRange(s + 8, GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX);
    const hueA = hashRange(s + 9, 0, 360);
    const satA = hashRange(s + 10, 60, 100);
    const litA = hashRange(s + 11, 40, 70);
    params.colorA = '#' + new THREE.Color(`hsl(${hueA}, ${satA}%, ${litA}%)`).getHexString();
    const hueB = hashRange(s + 12, 0, 360);
    const satB = hashRange(s + 13, 60, 100);
    const litB = hashRange(s + 14, 40, 70);
    params.colorB = '#' + new THREE.Color(`hsl(${hueB}, ${satB}%, ${litB}%)`).getHexString();

    return params;
}

export function updateStatusText(paused, raveMode, autoplay) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    if (paused) {
        statusEl.innerText = "PAUSED";
        statusEl.style.color = "#ff0055";
    } else if (raveMode && autoplay) {
        statusEl.innerText = "RAVE + AUTOPILOT";
        statusEl.style.color = "#ff00ff";
    } else if (raveMode) {
        statusEl.innerText = "RAVE + MANUAL";
        statusEl.style.color = "#ff00ff";
    } else if (autoplay) {
        statusEl.innerText = "AUTOPILOT";
        statusEl.style.color = "#00ccff";
    } else {
        statusEl.innerText = "MANUAL";
        statusEl.style.color = "#2cfa98";
    }
}
