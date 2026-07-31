import * as THREE from 'three';
import {
    GUI_SPEED_MIN, GUI_SPEED_MAX,
    GUI_AUTOPLAY_SPEED_MIN, GUI_AUTOPLAY_SPEED_MAX,
    GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX,
    GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX,
    GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX,
    GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX,
    GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX,
    normalizeColor,
    GUI_BLOOM_STRENGTH_MIN,
    GUI_BLOOM_STRENGTH_MAX,
    hashRange
} from './utils.js';

export const defaultParams = {
    speed: 1.5,
    timeScale: 0.5,
    bloomStrength: 0.09,
    bloomRadius: 0.4,
    foldIntensity: 1.0,
    veinSpeed: 1.0,
    colorA: '#ff0055',
    colorB: '#00ccff',
    edgeContrast: GUI_EDGE_CONTRAST_MAX / 2,
    paused: false,
    autoplay: true,
    autoplaySpeed: 3.0,
    controlMode: 'Rave',
    raveMode: true,
    sceneDurationCity: 45,
    sceneDurationTest: 10,
    forceNextScene: false,
    //particles: false
};

function _seed() {
    return Math.floor(Date.now() / 2400);
}

export function randomizeParams(params) {
    const s = _seed();
    params.speed = hashRange(s + 1, GUI_SPEED_MIN, GUI_SPEED_MAX);
    params.foldIntensity = hashRange(s + 2, GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX);
    params.edgeContrast = hashRange(s + 3, GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX);
    params.veinSpeed = hashRange(s + 4, GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX);
    params.bloomStrength = hashRange(s + 5, GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX);
    params.bloomRadius = hashRange(s + 6, GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX);
    params.autoplaySpeed = hashRange(s + 7, GUI_AUTOPLAY_SPEED_MIN, GUI_AUTOPLAY_SPEED_MAX);
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
    } else if (raveMode) {
        statusEl.innerText = "RAVE";
        statusEl.style.color = "#ff00ff";
    } else if (autoplay) {
        statusEl.innerText = "AUTOPILOT";
        statusEl.style.color = "#00ccff";
    } else {
        statusEl.innerText = "MANUAL";
        statusEl.style.color = "#2cfa98";
    }
}
