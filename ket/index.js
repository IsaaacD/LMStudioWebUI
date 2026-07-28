
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import GUI from 'lil-gui';

// ─── 1. CONFIGURATION STATE ──────────────────────────────
const params = {
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
    raveMode: true,
    switchMode: () => {
        if (params.controlMode === 'Auto') {
            params.autoplay = false;
            params.raveMode = false;
            params.controlMode = 'Manual';
        } else if (params.controlMode === 'Manual') {
            params.autoplay = false;
            params.raveMode = true;
            params.controlMode = 'Rave';
            ravePickTargets();
            raveNextTime = rawTimeNow + 1 + Math.random() * 2;
        } else {
            params.autoplay = true;
            params.raveMode = false;
            params.controlMode = 'Auto';
        }
        modeCtrl.updateDisplay();
        const statusEl = document.getElementById('status');
        if (params.raveMode) {
            statusEl.innerText = "RAVE";
            statusEl.style.color = "#ff00ff";
        } else if (params.autoplay) {
            statusEl.innerText = "AUTOPILOT";
            statusEl.style.color = "#00ccff";
        } else {
            statusEl.innerText = "MANUAL";
            statusEl.style.color = "#2cfa98";
        }
    },
    togglePause: () => {
        params.paused = !params.paused;
        const statusEl = document.getElementById('status');
        if (params.paused) {
            statusEl.innerText = "PAUSED";
            statusEl.style.color = "#ff0055";
        } else if (params.raveMode) {
            statusEl.innerText = "RAVE";
            statusEl.style.color = "#ff00ff";
        } else if (params.autoplay) {
            statusEl.innerText = "AUTOPILOT";
            statusEl.style.color = "#00ccff";
        } else {
            statusEl.innerText = "MANUAL";
            statusEl.style.color = "#2cfa98";
        }
    },
    randomize: () => {
        params.speed = Math.random() * 2;
        params.foldIntensity = 0.5 + Math.random() * 2;
        params.edgeContrast = Math.random() * 0.45;
        params.veinSpeed = Math.random() * 3;
        params.bloomRadius = Math.random();
        params.autoplaySpeed = Math.random() * 3;
        params.timeScale = Math.random() * 3;
        // Random HSL colors converted to hex
        params.colorA = new THREE.Color(`hsl(${Math.random() * 360}, ${60 + Math.random() * 40}%, ${40 + Math.random() * 30}%)`).getHexString();
        params.colorB = new THREE.Color(`hsl(${Math.random() * 360}, ${60 + Math.random() * 40}%, ${40 + Math.random() * 30}%)`).getHexString();
        speedCtrl.updateDisplay();
        foldCtrl.updateDisplay();
        edgeCtrl.updateDisplay();
        veinCtrl.updateDisplay();
        radiusCtrl.updateDisplay();
        autoSpeedCtrl.updateDisplay();
        timeCtrl.updateDisplay();
        colorACtrl.updateDisplay();
        colorBCtrl.updateDisplay();
    }
};

// ─── 2. SETUP ────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050011, 0.02);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);

async function loadShader(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.statusText}`);
    return await response.text();
}

// ─── 3. SHADER MATERIAL ──────────────────────────────────
const cityMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0xff0055) },
        uColor2: { value: new THREE.Color(0x00ccff) },
        uColor3: { value: new THREE.Color(0x110022) },
        uFoldIntensity: { value: 1.0 },
        uTileOffset: { value: new THREE.Vector3(0, 0, 0) },
        uCameraPos: { value: new THREE.Vector3(0, 0, 0) }
    },
    vertexShader: await loadShader('./shaders/city.vert'),
    fragmentShader: await loadShader('./shaders/city.frag'),
    wireframe: false,
    side: THREE.DoubleSide
});

// const gl = renderer.getContext();
// const cityProgram = cityMaterial.program;
// if (gl.getShaderParameter(cityProgram.vertexShader, gl.COMPILE_STATUS) === false) {
//     console.error('Vertex Shader Error:', gl.getShaderInfoLog(cityProgram.vertexShader));
// }

// ─── 3b. VERTICAL WALL SHADER MATERIAL ────────────────────
const wallMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0xff0055) },
        uColor2: { value: new THREE.Color(0x00ccff) },
        uColor3: { value: new THREE.Color(0x110022) },
        uFoldIntensity: { value: 1.0 },
        uTileOffset: { value: new THREE.Vector3(0, 0, 0) },
        uCameraPos: { value: new THREE.Vector3(0, 0, 0) }
    },
    vertexShader: await loadShader('./shaders/wall.vert'),
    fragmentShader: await loadShader('./shaders/wall.frag'),
    transparent: true,
    depthWrite: false,
    wireframe: false,
    side: THREE.DoubleSide
});

// ─── 3c. PRIMITIVE SHADER MATERIAL ────────────────────────
const primitiveMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0xff0055) },
        uColor2: { value: new THREE.Color(0x00ccff) },
        uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
        uAlpha: { value: 0.8 },
        uWaveAmp: { value: 0.4 }
    },
    vertexShader: await loadShader('./shaders/primitive.vert'),
    fragmentShader: await loadShader('./shaders/primitive.frag'),
    transparent: true,
    depthWrite: false,
    wireframe: false,
    side: THREE.DoubleSide
});

// ─── 4. INFINITE TILE SYSTEM ──────────────────────────────
const TILE_SIZE = 200;
const TILE_SEGMENTS = 128;
const RENDER_DIST = 140;
const RECYCLE_DIST = 200;
const GRID = Math.ceil(RENDER_DIST / TILE_SIZE) * 2 + 1;
const MAX_TILES = GRID * GRID;
const TILE_HEIGHT = 30;
const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, TILE_SEGMENTS, TILE_SEGMENTS);

function makePool(count, isCeiling) {
    const pool = [];
    for (let i = 0; i < count; i++) {
        const mat = cityMaterial.clone();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = isCeiling ? Math.PI / 2 : -Math.PI / 2;
        mesh.position.y = isCeiling ? TILE_HEIGHT : 0;
        mesh.visible = false;
        scene.add(mesh);
        pool.push(mesh);
    }
    return pool;
}

const floorTiles = makePool(MAX_TILES * 30, false);
const ceilTiles = makePool(MAX_TILES * 30, true);

// Vertical wall tile pools — infinite strips along one axis, chunk loaded on the other
const WALL_STRIP_LEN = RENDER_DIST * 2.5;
const wallGeo = new THREE.PlaneGeometry(WALL_STRIP_LEN, TILE_HEIGHT, Math.floor(TILE_SEGMENTS * 3), 8);
const WALLS_PER_POOL = 600;

function makeWallPool(count, rotY) {
    const pool = [];
    for (let i = 0; i < count; i++) {
        const mat = wallMaterial.clone();
        const mesh = new THREE.Mesh(wallGeo, mat);
        mesh.rotation.y = rotY;
        mesh.position.y = TILE_HEIGHT / 2;
        mesh.visible = false;
        scene.add(mesh);
        pool.push(mesh);
    }
    return pool;
}

const wallTilesX = makeWallPool(WALLS_PER_POOL, 0);
const wallTilesZ = makeWallPool(WALLS_PER_POOL, Math.PI / 2);

// Angled wall pools for diagonal depth
const wallAngX = makeWallPool(WALLS_PER_POOL, 0.3);
const wallAngZ = makeWallPool(WALLS_PER_POOL, Math.PI / 2 + 0.3);
const floorKeys = new Set();
const ceilKeys = new Set();
const wallKeysX = new Set();
const wallKeysZ = new Set();
const wallAngKeysX = new Set();
const wallAngKeysZ = new Set();

// ─── 4b. FLOATING PRIMITIVES ──────────────────────────────
const PRIMITIVE_COUNT = 1500;
const PRIMITIVES_PER_GRID_CELL = 0.7;
const primitiveGeos = [
    new THREE.BoxGeometry(2, 2, 2, 8, 8, 8),
    new THREE.SphereGeometry(1.5, 16, 16),
    new THREE.CylinderGeometry(1.2, 1.2, 3, 16, 8)
];
const primitivePool = [];
const primitiveKeys = new Set();

for (let i = 0; i < PRIMITIVE_COUNT; i++) {
    const geoIdx = Math.floor(Math.random() * primitiveGeos.length);
    const mat = primitiveMaterial.clone();
    const mesh = new THREE.Mesh(primitiveGeos[geoIdx], mat);
    mesh.visible = false;
    mesh.userData = {
        alphaBase: 0.3 + Math.random() * 0.6,
        alphaSpeed: 0.5 + Math.random() * 2,
        alphaPhase: Math.random() * Math.PI * 2,
        waveAmp: 0.2 + Math.random() * 0.5,
        rotSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ),
        scaleBase: 0.5 + Math.random() * 1.5,
        bobSpeed: 0.3 + Math.random() * 1,
        bobPhase: Math.random() * Math.PI * 2,
        bobAmp: 0.5 + Math.random() * 2
    };
    scene.add(mesh);
    primitivePool.push(mesh);
}

function key(ax, ay, az) { return `${ax},${ay},${az}`; }

function updateTiles(tiles, camX, camZ, poolKeys, yOffset, halfY) {
    const cx = Math.floor(camX / TILE_SIZE);
    const cz = Math.floor(camZ / TILE_SIZE);
    const cy = Math.floor(camera.position.y / TILE_HEIGHT);
    const half = Math.max(2, Math.ceil(RENDER_DIST / TILE_SIZE) + 1);
    const avail = [];

    for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (t.visible) {
            const dx = t.position.x - camX;
            const dz = t.position.z - camZ;
            const dy = t.position.y - camera.position.y;
            if (Math.abs(dx) > RECYCLE_DIST || Math.abs(dz) > RECYCLE_DIST || Math.abs(dy) > RECYCLE_DIST) {
                t.visible = false;
                poolKeys.delete(key(t._gx, t._gy, t._gz));
                avail.push(i);
            }
        } else {
            avail.push(i);
        }
    }

    for (let gy = cy - halfY; gy <= cy + halfY; gy++) {
        for (let gx = cx - half; gx <= cx + half; gx++) {
            for (let gz = cz - half; gz <= cz + half; gz++) {
                const k = key(gx, gy, gz);
                if (poolKeys.has(k)) continue;
                if (avail.length === 0) {
                    // Recycle the farthest visible tile
                    let farIdx = -1;
                    let farDist = 0;
                    for (let fi = 0; fi < tiles.length; fi++) {
                        const ft = tiles[fi];
                        if (!ft.visible) continue;
                        const fdx = ft.position.x - camX;
                        const fdz = ft.position.z - camZ;
                        const fdy = ft.position.y - camera.position.y;
                        const dist = fdx * fdx + fdz * fdz + fdy * fdy;
                        if (dist > farDist) {
                            farDist = dist;
                            farIdx = fi;
                        }
                    }
                    if (farIdx >= 0) {
                        const far = tiles[farIdx];
                        far.visible = false;
                        poolKeys.delete(key(far._gx, far._gy, far._gz));
                        avail.push(farIdx);
                    } else continue;
                }
                const t = tiles[avail.pop()];
                t.position.x = gx * TILE_SIZE;
                t.position.z = gz * TILE_SIZE;
                t.position.y = gy * TILE_HEIGHT + yOffset;
                t._gx = gx;
                t._gz = gz;
                t._gy = gy;
                t.visible = true;
                poolKeys.add(k);
            }
        }
    }
}

// ─── 5. POST-PROCESSING ──────────────────────────────────
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    1.5, 0.4, 0.85
);
composer.addPass(bloomPass);

// Edge Detection Shader
const sobelEdgeShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        "edgeStrength": { value: 0.5 }
    },
    vertexShader: await loadShader('./shaders/sorbel.vert'),
    fragmentShader: await loadShader('./shaders/sorbel.frag')
};


// const sobelProgram = sobelEdgeShader.program;
// if (gl.getShaderParameter(sobelProgram.vertexShader, gl.COMPILE_STATUS) === false) {
//     console.error('Vertex Shader Error:', gl.getShaderInfoLog(sobelProgram.vertexShader));
// }

const edgePass = new ShaderPass(sobelEdgeShader);
composer.addPass(edgePass);

// ─── 6. UI CONTROLS ──────────────────────────────────────
const gui = new GUI({ title: 'Trip Controls' });
gui.close();
// Tooltip system
const tooltipEl = document.createElement('div');
Object.assign(tooltipEl.style, {
    position: 'fixed', pointerEvents: 'none', background: 'rgba(10,10,20,0.92)',
    color: '#ddd', padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
    lineHeight: '1.4', maxWidth: '240px', zIndex: '99999', display: 'none',
    boxShadow: '0 2px 12px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)'
});
document.body.appendChild(tooltipEl);

function addInfoIcon(domEl, text) {
    const icon = document.createElement('span');
    icon.innerHTML = 'ⓘ&nbsp;';
    Object.assign(icon.style, {
        marginLeft: '6px', cursor: 'help', fontSize: '11px', opacity: '0.5',
        color: '#aaa', fontWeight: 'bold', userSelect: 'none'
    });
    icon.addEventListener('mouseenter', (e) => {
        tooltipEl.textContent = text;
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = e.clientX + 14 + 'px';
        tooltipEl.style.top = e.clientY + 14 + 'px';
    });
    icon.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none'; });
    icon.addEventListener('mousemove', (e) => {
        tooltipEl.style.left = e.clientX + 14 + 'px';
        tooltipEl.style.top = e.clientY + 14 + 'px';
    });
    domEl.prepend(icon);
}

// Movement Folder
const movFolder = gui.addFolder('Movement');
const modeCtrl = movFolder.add(params, 'controlMode').name('Mode').disable();
addInfoIcon(modeCtrl.domElement, 'Current control mode: Auto (autopilot) or Manual (WASD)');
const swCtrl = movFolder.add(params, 'switchMode').name('🔄 Switch Auto/Manual');
addInfoIcon(swCtrl.domElement, 'Toggle between automatic flight and manual WASD controls');
const speedCtrl = movFolder.add(params, 'speed', 0, 5).name('Flight Speed');
addInfoIcon(speedCtrl.domElement, 'Movement speed in manual mode (WASD keys)');
const autoSpeedCtrl = movFolder.add(params, 'autoplaySpeed', 0, 3).name('Auto Speed');
addInfoIcon(autoSpeedCtrl.domElement, 'Forward speed of the camera in autopilot mode');
const timeCtrl = movFolder.add(params, 'timeScale', 0, 3).name('Time Dilation');
addInfoIcon(timeCtrl.domElement, 'Global time multiplier — affects animation speed and shader effects');
const paCtrl = movFolder.add(params, 'togglePause').name('⏸ Pause / Resume');
addInfoIcon(paCtrl.domElement, 'Pause or resume the animation loop');
movFolder.close();

// Visuals Folder
const visFolder = gui.addFolder('Visuals');
const blCtrl = visFolder.add(params, 'bloomStrength', 0, 3).name('Bloom Glow');
addInfoIcon(blCtrl.domElement, 'Intensity of the bloom post-processing glow effect');
const radiusCtrl = visFolder.add(params, 'bloomRadius', 0, 1).name('Glow Radius');
addInfoIcon(radiusCtrl.domElement, 'Spread radius of the bloom glow');
const foldCtrl = visFolder.add(params, 'foldIntensity', 0, 3).name('Fold Intensity');
addInfoIcon(foldCtrl.domElement, 'Strength of the terrain folding and distortion in shaders');
const veinCtrl = visFolder.add(params, 'veinSpeed', 0, 3).name('Vein Flow');
addInfoIcon(veinCtrl.domElement, 'Speed of the organic vein patterns flowing across surfaces');
const colorACtrl = visFolder.addColor(params, 'colorA').name('Color A');
addInfoIcon(colorACtrl.domElement, 'Primary accent color for terrain and walls');
const colorBCtrl = visFolder.addColor(params, 'colorB').name('Color B');
addInfoIcon(colorBCtrl.domElement, 'Secondary accent color for terrain and walls');
const edgeCtrl = visFolder.add(params, 'edgeContrast', 0, 0.45).name('Outline Strength');
addInfoIcon(edgeCtrl.domElement, 'Intensity of the edge-detection outline effect');
visFolder.close();

// Actions Folder
const actFolder = gui.addFolder('Actions');
const raCtrl = actFolder.add(params, 'randomize').name('🎲 Randomize');
addInfoIcon(raCtrl.domElement, 'Randomize all visual and movement parameters for a new look');
actFolder.close();

// ─── 7. MULTI-TOUCH DUAL JOYSTICK CONTROLS ────────────────
const JOYSTICK_RADIUS = 60;
const JOYSTICK_DEADZONE = 0.15;
const JOYSTICK_MAX_DRAG = 50;

const joystickState = {
    left: {
        active: false,
        id: null,
        originX: 0,
        originY: 0,
        currentX: 0,
        currentY: 0,
        dx: 0,
        dy: 0
    },
    right: {
        active: false,
        id: null,
        originX: 0,
        originY: 0,
        currentX: 0,
        currentY: 0,
        dx: 0,
        dy: 0
    }
};

const joystickOverlay = document.createElement('div');
Object.assign(joystickOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9999'
});
document.body.appendChild(joystickOverlay);

function createJoystickVisual(baseX, baseY, dx, dy, isLeft) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'absolute',
        left: `${baseX - JOYSTICK_RADIUS}px`,
        top: `${baseY - JOYSTICK_RADIUS}px`,
        width: `${JOYSTICK_RADIUS * 2}px`,
        height: `${JOYSTICK_RADIUS * 2}px`,
        borderRadius: '50%',
        border: `2px solid rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.4)`,
        background: `radial-gradient(circle, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.1) 0%, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.05) 70%, transparent 100%)`,
        transition: 'opacity 0.3s ease'
    });

    const knob = document.createElement('div');
    const clampedDx = Math.max(-JOYSTICK_MAX_DRAG, Math.min(JOYSTICK_MAX_DRAG, dx));
    const clampedDy = Math.max(-JOYSTICK_MAX_DRAG, Math.min(JOYSTICK_MAX_DRAG, dy));
    Object.assign(knob.style, {
        position: 'absolute',
        left: `${JOYSTICK_RADIUS - 15 + clampedDx}px`,
        top: `${JOYSTICK_RADIUS - 15 + clampedDy}px`,
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.6) 0%, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.3) 100%)`,
        boxShadow: `0 0 10px rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.5)`
    });

    container.appendChild(knob);
    return { container, knob };
}

function updateJoystickVisuals() {
    joystickOverlay.innerHTML = '';

    if (joystickState.left.active) {
        const leftVisual = createJoystickVisual(
            joystickState.left.originX,
            joystickState.left.originY,
            joystickState.left.dx,
            joystickState.left.dy,
            true
        );
        joystickOverlay.appendChild(leftVisual.container);
    }

    if (joystickState.right.active) {
        const rightVisual = createJoystickVisual(
            joystickState.right.originX,
            joystickState.right.originY,
            joystickState.right.dx,
            joystickState.right.dy,
            false
        );
        joystickOverlay.appendChild(rightVisual.container);
    }
}

function applyJoystickDeadzone(value) {
    if (Math.abs(value) < JOYSTICK_DEADZONE) return 0;
    return Math.max(-1, Math.min(1, value));
}

function isTouchOnGui(touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return false;
    return el.closest('.lil-gui, .gui, #gui, [class*="gui"]') !== null;
}

function handleTouchStart(e) {
    if (params.paused || params.autoplay) {
        if (!params.raveMode)
            return;
    }
    if (e.changedTouches.length > 0 && isTouchOnGui(e.changedTouches[0])) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
        if (!joystickState.left.active) {
            joystickState.left.active = true;
            joystickState.left.id = touch.identifier;
            joystickState.left.originX = touch.clientX;
            joystickState.left.originY = touch.clientY;
            joystickState.left.currentX = touch.clientX;
            joystickState.left.currentY = touch.clientY;
            joystickState.left.dx = 0;
            joystickState.left.dy = 0;
        } else if (!joystickState.right.active) {
            joystickState.right.active = true;
            joystickState.right.id = touch.identifier;
            joystickState.right.originX = touch.clientX;
            joystickState.right.originY = touch.clientY;
            joystickState.right.currentX = touch.clientX;
            joystickState.right.currentY = touch.clientY;
            joystickState.right.dx = 0;
            joystickState.right.dy = 0;
        }
    }
    updateJoystickVisuals();
}

function handleTouchMove(e) {
    if (params.paused || params.autoplay && !params.raveMode) return;
    for (const touch of e.changedTouches) {
        if (isTouchOnGui(touch)) return;
    }
    e.preventDefault();

    for (const touch of e.changedTouches) {
        if (joystickState.left.active && touch.identifier === joystickState.left.id) {
            joystickState.left.currentX = touch.clientX;
            joystickState.left.currentY = touch.clientY;
            joystickState.left.dx = touch.clientX - joystickState.left.originX;
            joystickState.left.dy = touch.clientY - joystickState.left.originY;
        } else if (joystickState.right.active && touch.identifier === joystickState.right.id) {
            joystickState.right.currentX = touch.clientX;
            joystickState.right.currentY = touch.clientY;
            joystickState.right.dx = touch.clientX - joystickState.right.originX;
            joystickState.right.dy = touch.clientY - joystickState.right.originY;
        }
    }
    updateJoystickVisuals();
}

function handleTouchEnd(e) {
    for (const touch of e.changedTouches) {
        if (joystickState.left.active && touch.identifier === joystickState.left.id) {
            joystickState.left.active = false;
            joystickState.left.id = null;
            joystickState.left.dx = 0;
            joystickState.left.dy = 0;
        } else if (joystickState.right.active && touch.identifier === joystickState.right.id) {
            joystickState.right.active = false;
            joystickState.right.id = null;
            joystickState.right.dx = 0;
            joystickState.right.dy = 0;
        }
    }
    updateJoystickVisuals();
}

document.addEventListener('touchstart', handleTouchStart, { passive: false });
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: false });
document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

// ─── 7b. RAVE MODE ────────────────────────────────────────
const raveTemp = new THREE.Color();
const raveCurrent = {
    bloomStrength: params.bloomStrength,
    bloomRadius: params.bloomRadius,
    foldIntensity: params.foldIntensity,
    veinSpeed: params.veinSpeed,
    edgeContrast: params.edgeContrast,
    timeScale: params.timeScale,
    autoplaySpeed: params.autoplaySpeed,
    colorA: params.colorA,
    colorB: params.colorB
};
const raveTarget = { ...raveCurrent };
let raveNextTime = 0;
let rawTimeNow = 0;

function ravePickTargets() {
    raveTarget.bloomStrength = 0.5 + Math.random() * 2.5;
    raveTarget.bloomRadius = 0.1 + Math.random() * 0.9;
    raveTarget.foldIntensity = 0.5 + Math.random() * 2.5;
    raveTarget.veinSpeed = 0.5 + Math.random() * 3;
    raveTarget.edgeContrast = Math.random() * 0.45;
    raveTarget.timeScale = 0.5 + Math.random() * 3;
    raveTarget.autoplaySpeed = 0.5 + Math.random() * 3;
    raveTarget.colorA = Math.floor(Math.random() * 0xffffff);
    raveTarget.colorB = Math.floor(Math.random() * 0xffffff);
}

function raveLerp(dt) {
    const l = 1 - Math.pow(0.001, dt);
    raveCurrent.bloomStrength += (raveTarget.bloomStrength - raveCurrent.bloomStrength) * l;
    raveCurrent.bloomRadius += (raveTarget.bloomRadius - raveCurrent.bloomRadius) * l;
    raveCurrent.foldIntensity += (raveTarget.foldIntensity - raveCurrent.foldIntensity) * l;
    raveCurrent.veinSpeed += (raveTarget.veinSpeed - raveCurrent.veinSpeed) * l;
    raveCurrent.edgeContrast += (raveTarget.edgeContrast - raveCurrent.edgeContrast) * l;
    raveCurrent.timeScale += (raveTarget.timeScale - raveCurrent.timeScale) * l;
    raveCurrent.autoplaySpeed += (raveTarget.autoplaySpeed - raveCurrent.autoplaySpeed) * l;

    raveTemp.set(raveCurrent.colorA);
    raveTemp.lerp(new THREE.Color(raveTarget.colorA), l);
    raveCurrent.colorA = raveTemp.getHex();

    raveTemp.set(raveCurrent.colorB);
    raveTemp.lerp(new THREE.Color(raveTarget.colorB), l);
    raveCurrent.colorB = raveTemp.getHex();
}

// ─── 8. ANIMATION LOOP ───────────────────────────────────
const clock = new THREE.Clock();
let mouseX = 0;
let mouseY = 0;
const keys = { w: false, a: false, s: false, d: false, q: false, e: false };
let autoAngle = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - innerWidth / 2) * 0.001;
    mouseY = (e.clientY - innerHeight / 2) * 0.001;
});

document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
});

document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
});

function animate() {
    requestAnimationFrame(animate);

    if (params.paused) {
        composer.render();
        return;
    }

    const rawTime = clock.getElapsedTime();
    rawTimeNow = rawTime;
    const dt = clock.getDelta() || 0.016;

    // Rave mode: lerp params toward targets, pick new targets on schedule
    if (params.raveMode) {
        if (rawTime >= raveNextTime) {
            ravePickTargets();
            raveNextTime = rawTime + 1 + Math.random() * 2;
        }
        raveLerp(dt);
    }

    const activeTS = params.raveMode ? raveCurrent.timeScale : params.timeScale;
    const effectiveTime = rawTime * activeTS;

    // Update all visible tile uniforms
    for (const t of floorTiles.concat(ceilTiles)) {
        if (!t.visible) continue;
        t.material.uniforms.uTime.value = effectiveTime;
        t.material.uniforms.uFoldIntensity.value = params.raveMode ? raveCurrent.foldIntensity : params.foldIntensity;
        t.material.uniforms.uColor1.value.set(params.raveMode ? raveCurrent.colorA : params.colorA);
        t.material.uniforms.uColor2.value.set(params.raveMode ? raveCurrent.colorB : params.colorB);
        t.material.uniforms.uTileOffset.value.set(t._gx * TILE_SIZE, t._gz * TILE_SIZE, t._gy * TILE_HEIGHT);
        t.material.uniforms.uCameraPos.value.copy(camera.position);
    }
    for (const t of wallTilesX.concat(wallTilesZ).concat(wallAngX).concat(wallAngZ)) {
        if (!t.visible) continue;
        t.material.uniforms.uTime.value = effectiveTime;
        t.material.uniforms.uFoldIntensity.value = params.raveMode ? raveCurrent.foldIntensity : params.foldIntensity;
        t.material.uniforms.uColor1.value.set(params.raveMode ? raveCurrent.colorA : params.colorA);
        t.material.uniforms.uColor2.value.set(params.raveMode ? raveCurrent.colorB : params.colorB);
        t.material.uniforms.uTileOffset.value.set(t._gx * TILE_SIZE, t._gz * TILE_SIZE, t._gy * TILE_HEIGHT);
        t.material.uniforms.uCameraPos.value.copy(camera.position);
    }

    bloomPass.strength = params.raveMode ? raveCurrent.bloomStrength : params.bloomStrength;
    bloomPass.radius = params.raveMode ? raveCurrent.bloomRadius : params.bloomRadius;
    edgePass.uniforms['edgeStrength'].value = params.raveMode ? raveCurrent.edgeContrast : params.edgeContrast;

    const leftJoystickActive = joystickState.left.active && (Math.abs(joystickState.left.dx) > JOYSTICK_DEADZONE * JOYSTICK_RADIUS || Math.abs(joystickState.left.dy) > JOYSTICK_DEADZONE * JOYSTICK_RADIUS);
    const rightJoystickActive = joystickState.right.active && (Math.abs(joystickState.right.dx) > JOYSTICK_DEADZONE * JOYSTICK_RADIUS || Math.abs(joystickState.right.dy) > JOYSTICK_DEADZONE * JOYSTICK_RADIUS);
    const isMoving = keys.w || keys.s || keys.a || keys.d || keys.q || keys.e || leftJoystickActive || rightJoystickActive;
    const useManual = !params.autoplay && !params.raveMode || (params.raveMode && isMoving);

    if (useManual) {
        const moveSpeed = params.speed * 0.5;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();

        let forwardInput = 0;
        let strafeInput = 0;
        let verticalInput = 0;
        let yawInput = 0;
        let pitchInput = 0;

        if (keys.w) forwardInput += 1;
        if (keys.s) forwardInput -= 1;
        if (keys.a) strafeInput -= 1;
        if (keys.d) strafeInput += 1;
        if (keys.e) verticalInput += 1;
        if (keys.q) verticalInput -= 1;

        if (leftJoystickActive) {
            const leftDx = joystickState.left.dx / JOYSTICK_RADIUS;
            const leftDy = joystickState.left.dy / JOYSTICK_RADIUS;
            forwardInput += applyJoystickDeadzone(-leftDy);
            strafeInput += applyJoystickDeadzone(leftDx);
        }

        if (rightJoystickActive) {
            const rightDx = joystickState.right.dx / JOYSTICK_RADIUS;
            const rightDy = joystickState.right.dy / JOYSTICK_RADIUS;
            verticalInput += applyJoystickDeadzone(-rightDy);
            yawInput += applyJoystickDeadzone(rightDx) * 0.03;
            pitchInput += applyJoystickDeadzone(rightDy) * 0.02;
        }

        camera.position.addScaledVector(dir, forwardInput * moveSpeed);
        camera.position.addScaledVector(right, strafeInput * moveSpeed);
        camera.position.y += verticalInput * moveSpeed;

        if (yawInput !== 0 || pitchInput !== 0) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= yawInput;
            euler.x -= pitchInput;
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
            camera.quaternion.setFromEuler(euler);
        }

        camera.lookAt(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z);
    } else {
        autoAngle += 0.005 * activeTS;
        const autoR = 8 + Math.sin(autoAngle * 0.7) * 5;
        const targetX = Math.sin(autoAngle) * autoR;
        const targetY = Math.cos(autoAngle * 0.5) * 3 + 2;
        const activeSpeed = params.raveMode ? raveCurrent.autoplaySpeed : params.autoplaySpeed;
        const targetZ = camera.position.z - activeSpeed;

        camera.position.x += (targetX - camera.position.x) * 0.02;
        camera.position.y += (targetY - camera.position.y) * 0.02;
        camera.position.z += (targetZ - camera.position.z) * 0.05;

        camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 10);
    }

    // Lazy-load floor and ceiling tiles
    updateTiles(floorTiles, camera.position.x, camera.position.z, floorKeys, 0, 4);
    updateTiles(ceilTiles, camera.position.x, camera.position.z, ceilKeys, TILE_HEIGHT, 4);

    // Wall strips: infinite length along one axis, chunk loaded along perpendicular + vertical
    const cy = Math.floor(camera.position.y / TILE_HEIGHT);
    const wallHalfY = 10;
    const cx = Math.floor(camera.position.x / TILE_SIZE);
    const cz = Math.floor(camera.position.z / TILE_SIZE);
    const halfXZ = Math.max(2, Math.ceil(RENDER_DIST / TILE_SIZE) + 1);
    for (const wConfig of [
        { pool: wallTilesX, keys: wallKeysX, type: 'x' },
        { pool: wallTilesZ, keys: wallKeysZ, type: 'z' },
        { pool: wallAngX, keys: wallAngKeysX, type: 'x' },
        { pool: wallAngZ, keys: wallAngKeysZ, type: 'z' }
    ]) {
        const { pool, keys, type } = wConfig;

        // Recycle walls too far on perpendicular or vertical axis
        const avail = [];
        for (let i = 0; i < pool.length; i++) {
            const t = pool[i];
            if (t.visible) {
                const perpDist = type === 'x'
                    ? Math.abs(t.position.z - camera.position.z)
                    : Math.abs(t.position.x - camera.position.x);
                const dy = Math.abs(t.position.y - camera.position.y);
                if (perpDist > RECYCLE_DIST || dy > RECYCLE_DIST) {
                    t.visible = false;
                    keys.delete(key(t._gx, t._gy, t._gz));
                    avail.push(i);
                }
            } else {
                avail.push(i);
            }
        }

        // Place wall strips centered on camera along strip axis, spaced on perpendicular axis
        for (let gy = cy - wallHalfY; gy <= cy + wallHalfY; gy++) {
            for (let gi = -halfXZ; gi <= halfXZ; gi++) {
                const wHash = gi * 374761393 + gy * 668265263;
                if ((wHash & 0xff) > 200) continue;
                // Key uses the perpendicular grid coord + Y, plus camera's grid on strip axis
                const stripGx = type === 'x' ? cx : (cx + gi);
                const stripGz = type === 'z' ? cz : (cz + gi);
                const k = key(stripGx, gy, stripGz);
                if (keys.has(k)) continue;
                if (avail.length === 0) {
                    // Recycle farthest wall
                    let farIdx = -1, farDist = 0;
                    for (let fi = 0; fi < pool.length; fi++) {
                        const ft = pool[fi];
                        if (!ft.visible) continue;
                        const pd = type === 'x' ? Math.abs(ft.position.z - camera.position.z) : Math.abs(ft.position.x - camera.position.x);
                        const vd = Math.abs(ft.position.y - camera.position.y);
                        const d = pd * pd + vd * vd;
                        if (d > farDist) { farDist = d; farIdx = fi; }
                    }
                    if (farIdx >= 0) {
                        const ft = pool[farIdx];
                        ft.visible = false;
                        keys.delete(key(ft._gx, ft._gy, ft._gz));
                        avail.push(farIdx);
                    } else continue;
                }
                const t = pool[avail.pop()];
                if (type === 'x') {
                    t.position.x = camera.position.x;
                    t.position.z = cz * TILE_SIZE + gi * TILE_SIZE;
                    t._gx = cx;
                    t._gz = cz + gi;
                } else {
                    t.position.x = cx * TILE_SIZE + gi * TILE_SIZE;
                    t.position.z = camera.position.z;
                    t._gx = cx + gi;
                    t._gz = cz;
                }
                t.position.y = gy * TILE_HEIGHT + TILE_HEIGHT / 2;
                t._gy = gy;
                t.visible = true;
                keys.add(k);
            }
        }
    }

    // ─── Update floating primitives ────────────────────────
    const pCx = Math.floor(camera.position.x / TILE_SIZE);
    const pCz = Math.floor(camera.position.z / TILE_SIZE);
    const pCy = Math.floor(camera.position.y / TILE_HEIGHT);
    const pHalf = Math.ceil(RENDER_DIST / TILE_SIZE);

    for (let i = 0; i < primitivePool.length; i++) {
        const p = primitivePool[i];
        if (p.visible) {
            const dx = Math.abs(p.position.x - camera.position.x);
            const dz = Math.abs(p.position.z - camera.position.z);
            const dy = Math.abs(p.position.y - camera.position.y);
            if (dx > RECYCLE_DIST || dz > RECYCLE_DIST || dy > RECYCLE_DIST) {
                p.visible = false;
                primitiveKeys.delete(key(p._gx, p._gy, p._gz));
            }
        }
    }

    function cellHash(x, y, z) {
        let h = x * 374761393 + y * 668265263 + z * 1274126177;
        h = (h ^ (h >> 13)) * 1103515245;
        return (h ^ (h >> 16)) & 0x7fffffff;
    }

    for (let gy = pCy - 2; gy <= pCy + 2; gy++) {
        for (let gx = pCx - pHalf; gx <= pCx + pHalf; gx++) {
            for (let gz = pCz - pHalf; gz <= pCz + pHalf; gz++) {
                const hash = cellHash(gx, gy, gz);
                if ((hash % 100) / 100 > PRIMITIVES_PER_GRID_CELL) continue;
                const k = key(gx, gy, gz);
                if (primitiveKeys.has(k)) continue;
                const availIdx = primitivePool.findIndex(p => !p.visible);
                if (availIdx === -1) continue;
                const p = primitivePool[availIdx];
                const offsetX = ((hash >> 8) % 1000) / 1000;
                const offsetZ = ((hash >> 16) % 1000) / 1000;
                const offsetY = ((hash >> 24) % 1000) / 1000;
                p.position.x = gx * TILE_SIZE + (offsetX - 0.5) * TILE_SIZE * 0.6;
                p.position.z = gz * TILE_SIZE + (offsetZ - 0.5) * TILE_SIZE * 0.6;
                p.position.y = gy * TILE_HEIGHT + TILE_HEIGHT * 0.3 + offsetY * TILE_HEIGHT * 0.4;
                p._gx = gx;
                p._gz = gz;
                p._gy = gy;
                p.visible = true;
                p.scale.setScalar(p.userData.scaleBase);
                primitiveKeys.add(k);
            }
        }
    }

    for (const p of primitivePool) {
        if (!p.visible) continue;
        const ud = p.userData;
        const alpha = ud.alphaBase * (0.5 + 0.5 * Math.sin(effectiveTime * ud.alphaSpeed + ud.alphaPhase));
        p.material.uniforms.uTime.value = effectiveTime;
        p.material.uniforms.uAlpha.value = alpha;
        p.material.uniforms.uWaveAmp.value = ud.waveAmp;
        p.material.uniforms.uColor1.value.set(params.raveMode ? raveCurrent.colorA : params.colorA);
        p.material.uniforms.uColor2.value.set(params.raveMode ? raveCurrent.colorB : params.colorB);
        p.material.uniforms.uCameraPos.value.copy(camera.position);

        p.rotation.x += ud.rotSpeed.x * dt * 0.5;
        p.rotation.y += ud.rotSpeed.y * dt * 0.5;
        p.rotation.z += ud.rotSpeed.z * dt * 0.5;

        const bobOffset = Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;
        p.position.y = p._gy * TILE_HEIGHT + TILE_HEIGHT * 0.3 + bobOffset;
    }

    composer.render();
}

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    edgePass.uniforms['resolution'].value.set(innerWidth, innerHeight);
});

animate();