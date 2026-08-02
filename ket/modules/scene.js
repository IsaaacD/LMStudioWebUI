import * as THREE from 'three';

let camera = null;
let renderer = null;
let clock = null;

const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export function setPixelRatio(fidelity) {
    if (!renderer) return;
    switch (fidelity) {
        case 'low':
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            break;
        case 'medium':
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            break;
        case 'high':
            renderer.setPixelRatio(window.devicePixelRatio);
            break;
    }
}

export function initScene() {
    camera = new THREE.PerspectiveCamera(120, innerWidth / innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(innerWidth, innerHeight);
    setPixelRatio(localStorage.getItem('fidelity') || (isMobile ? 'low' : 'high'));
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    window.addEventListener('resize', onResize);
    try {
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onResize);
        }
    } catch {
        // visualViewport not supported (e.g. Firefox iOS)
    }
    // Force resize when keyboard dismisses on mobile
    document.addEventListener('focusout', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
            setTimeout(onResize, 100);
            setTimeout(onResize, 400);
        }
    }, true);
}

function getViewportSize() {
    try {
        if (window.visualViewport) {
            return { w: window.visualViewport.width, h: window.visualViewport.height };
        }
    } catch { }
    return { w: innerWidth, h: innerHeight };
}

export { getViewportSize };

export function onResize() {
    const { w, h } = getViewportSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getClock() { return clock; }
