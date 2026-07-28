import * as THREE from 'three';

export const defaultParams = {
    speed: 0.8,
    timeScale: 1.0,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    foldIntensity: 1.0,
    veinSpeed: 1.0,
    colorA: 0xff0055,
    colorB: 0x00ccff,
    edgeContrast: 0.5,
    paused: false,
    autoplay: true,
    autoplaySpeed: 0.6,
    controlMode: 'Rave',
    raveMode: true
};

export function randomizeParams(params) {
    params.speed = 0.2 + Math.random() * 2;
    params.foldIntensity = 0.5 + Math.random() * 2;
    params.edgeContrast = 0.1 + Math.random() * 0.25;
    params.veinSpeed = Math.random() * 3;
    params.bloomRadius = Math.random();
    params.autoplaySpeed = 0.5 + Math.random() * 3;
    params.timeScale = Math.random() * 3;
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
