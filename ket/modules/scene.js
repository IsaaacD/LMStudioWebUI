import * as THREE from 'three';

let camera = null;
let renderer = null;
let clock = null;

export function initScene() {
    camera = new THREE.PerspectiveCamera(120, innerWidth / innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    window.addEventListener('resize', onResize);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onResize);
    }
}

function getViewportSize() {
    if (window.visualViewport) {
        return { w: window.visualViewport.width, h: window.visualViewport.height };
    }
    return { w: innerWidth, h: innerHeight };
}

export function onResize() {
    const { w, h } = getViewportSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getClock() { return clock; }
