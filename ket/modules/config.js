import * as THREE from 'three';
import {
    GUI_SPEED_MIN, GUI_SPEED_MAX,
    GUI_AUTOPLAY_SPEED_MIN, GUI_AUTOPLAY_SPEED_MAX,
    GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX,
    GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX,
    GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX,
    GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX,
    GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX,
} from './utils.js';

export const defaultParams = {
    speed: 3.0,
    timeScale: 0.5,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    foldIntensity: 1.0,
    veinSpeed: 1.0,
    colorA: '0xff0055',
    colorB: '0x00ccff',
    edgeContrast: GUI_EDGE_CONTRAST_MAX / 2,
    paused: false,
    autoplay: true,
    autoplaySpeed: 3.0,
    controlMode: 'Rave',
    raveMode: true,
    sceneDurationCity: 45,
    sceneDurationTest: 10,
    forceNextScene: false
};

export function randomizeParams(params) {
    params.speed = GUI_SPEED_MIN + Math.random() * (GUI_SPEED_MAX - GUI_SPEED_MIN);
    params.foldIntensity = GUI_FOLD_INTENSITY_MIN + Math.random() * (GUI_FOLD_INTENSITY_MAX - GUI_FOLD_INTENSITY_MIN);
    params.edgeContrast = GUI_EDGE_CONTRAST_MIN + Math.random() * (GUI_EDGE_CONTRAST_MAX - GUI_EDGE_CONTRAST_MIN);
    params.veinSpeed = GUI_VEIN_SPEED_MIN + Math.random() * (GUI_VEIN_SPEED_MAX - GUI_VEIN_SPEED_MIN);
    params.bloomRadius = GUI_BLOOM_RADIUS_MIN + Math.random() * (GUI_BLOOM_RADIUS_MAX - GUI_BLOOM_RADIUS_MIN);
    params.autoplaySpeed = GUI_AUTOPLAY_SPEED_MIN + Math.random() * (GUI_AUTOPLAY_SPEED_MAX - GUI_AUTOPLAY_SPEED_MIN);
    params.timeScale = GUI_TIMESCALE_MIN + Math.random() * (GUI_TIMESCALE_MAX - GUI_TIMESCALE_MIN);
    params.colorA = new THREE.Color(`hsl(${Math.random() * 360}, ${60 + Math.random() * 40}%, ${40 + Math.random() * 30}%)`).getHexString();
    params.colorB = new THREE.Color(`hsl(${Math.random() * 360}, ${60 + Math.random() * 40}%, ${40 + Math.random() * 30}%)`).getHexString();
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
