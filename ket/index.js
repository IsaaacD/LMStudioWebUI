
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
    hueShift: 0.0,
    edgeContrast: 0.5,
    paused: false,
    autoplay: true,
    autoplaySpeed: 0.6,
    controlMode: 'Auto',
    switchMode: () => {
        params.autoplay = !params.autoplay;
        params.controlMode = params.autoplay ? 'Auto' : 'Manual (WASD)';
        document.getElementById('status').innerText = params.autoplay ? "AUTOPILOT" : "MANUAL";
        document.getElementById('status').style.color = params.autoplay ? "#00ccff" : "#2cfa98";
    },
    togglePause: () => {
        params.paused = !params.paused;
        document.getElementById('status').innerText = params.paused ? "PAUSED" : (params.autoplay ? "AUTOPILOT" : "MANUAL");
        document.getElementById('status').style.color = params.paused ? "#ff0055" : (params.autoplay ? "#00ccff" : "#2cfa98");
    },
    randomize: () => {
        params.speed = Math.random() * 2;
        params.foldIntensity = 0.5 + Math.random() * 2;
        params.hueShift = Math.random();
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
        uHueShift: { value: 0.0 },
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
        uHueShift: { value: 0.0 },
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

// const wallProgram = wallMaterial.program;
// if (gl.getShaderParameter(wallProgram.vertexShader, gl.COMPILE_STATUS) === false) {
//     console.error('Vertex Shader Error:', gl.getShaderInfoLog(wallProgram.vertexShader));
// }
// ─── 4. INFINITE TILE SYSTEM ──────────────────────────────
const TILE_SIZE = 200;
const TILE_SEGMENTS = 128;
const RENDER_DIST = 140;
const RECYCLE_DIST = 180;
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

const floorTiles = makePool(MAX_TILES * 6, false);
const ceilTiles = makePool(MAX_TILES * 6, true);

// Vertical wall tile pools — two orientations for cross-intersection
const wallGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SEGMENTS, Math.floor(TILE_SEGMENTS * TILE_HEIGHT / TILE_SIZE));
const MAX_WALLS = MAX_TILES * 3;

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

const wallTilesX = makeWallPool(MAX_WALLS, 0);
const wallTilesZ = makeWallPool(MAX_WALLS, Math.PI / 2);

// Angled wall pools for diagonal depth
const wallAngX = makeWallPool(MAX_WALLS, 0.3);
const wallAngZ = makeWallPool(MAX_WALLS, Math.PI / 2 + 0.3);
const floorKeys = new Set();
const ceilKeys = new Set();
const wallKeysX = new Set();
const wallKeysZ = new Set();
const wallAngKeysX = new Set();
const wallAngKeysZ = new Set();

function key(ax, ay, az) { return `${ax},${ay},${az}`; }

function updateTiles(tiles, camX, camZ, poolKeys, yOffset, halfY) {
    const cx = Math.floor(camX / TILE_SIZE);
    const cz = Math.floor(camZ / TILE_SIZE);
    const cy = Math.floor(camera.position.y / TILE_HEIGHT);
    const half = Math.ceil(RENDER_DIST / TILE_SIZE);
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
                    const far = tiles.find(t => t.visible && (Math.abs(t.position.x - camX) > RECYCLE_DIST - 20 || Math.abs(t.position.z - camZ) > RECYCLE_DIST - 20 || Math.abs(t.position.y - camera.position.y) > RECYCLE_DIST - 20));
                    if (far) {
                        far.visible = false;
                        poolKeys.delete(key(far._gx, far._gy, far._gz));
                        avail.push(tiles.indexOf(far));
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

// Movement Folder
const movFolder = gui.addFolder('Movement');
movFolder.add(params, 'controlMode').name('Mode').disable();
movFolder.add(params, 'switchMode').name('🔄 Switch Auto/Manual');
movFolder.add(params, 'speed', 0, 5).name('Flight Speed');
movFolder.add(params, 'autoplaySpeed', 0, 3).name('Auto Speed');
movFolder.add(params, 'timeScale', 0, 3).name('Time Dilation');
movFolder.add(params, 'togglePause').name('⏸ Pause / Resume');

// Visuals Folder
const visFolder = gui.addFolder('Visuals');
visFolder.add(params, 'bloomStrength', 0, 3).name('Bloom Glow');
visFolder.add(params, 'bloomRadius', 0, 1).name('Glow Radius');
visFolder.add(params, 'foldIntensity', 0, 3).name('Fold Intensity');
visFolder.add(params, 'veinSpeed', 0, 3).name('Vein Flow');
visFolder.add(params, 'hueShift', 0, 1).name('Color Shift');
visFolder.add(params, 'edgeContrast', 0, 1).name('Outline Strength');

// Actions Folder
const actFolder = gui.addFolder('Actions');
actFolder.add(params, 'randomize').name('🎲 Randomize');

// ─── 7. ANIMATION LOOP ───────────────────────────────────
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
    const effectiveTime = rawTime * params.timeScale;

    // Update all visible tile uniforms
    for (const t of floorTiles.concat(ceilTiles)) {
        if (!t.visible) continue;
        t.material.uniforms.uTime.value = effectiveTime;
        t.material.uniforms.uFoldIntensity.value = params.foldIntensity;
        t.material.uniforms.uHueShift.value = params.hueShift;
        t.material.uniforms.uTileOffset.value.set(t._gx * TILE_SIZE, t._gz * TILE_SIZE, t._gy * TILE_HEIGHT);
        t.material.uniforms.uCameraPos.value.copy(camera.position);
    }
    for (const t of wallTilesX.concat(wallTilesZ).concat(wallAngX).concat(wallAngZ)) {
        if (!t.visible) continue;
        t.material.uniforms.uTime.value = effectiveTime;
        t.material.uniforms.uFoldIntensity.value = params.foldIntensity;
        t.material.uniforms.uHueShift.value = params.hueShift;
        t.material.uniforms.uTileOffset.value.set(t._gx * TILE_SIZE, t._gz * TILE_SIZE, t._gy * TILE_HEIGHT);
        t.material.uniforms.uCameraPos.value.copy(camera.position);
    }

    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;
    edgePass.uniforms['edgeStrength'].value = params.edgeContrast;

    if (params.autoplay) {
        autoAngle += 0.005 * params.timeScale;
        const autoR = 8 + Math.sin(autoAngle * 0.7) * 5;
        const targetX = Math.sin(autoAngle) * autoR;
        const targetY = Math.cos(autoAngle * 0.5) * 3 + 2;
        const targetZ = camera.position.z - params.autoplaySpeed;

        camera.position.x += (targetX - camera.position.x) * 0.02;
        camera.position.y += (targetY - camera.position.y) * 0.02;
        camera.position.z += (targetZ - camera.position.z) * 0.05;

        camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 10);
    } else {
        const moveSpeed = params.speed * 0.5;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();

        if (keys.w) camera.position.addScaledVector(dir, moveSpeed);
        if (keys.s) camera.position.addScaledVector(dir, -moveSpeed);
        if (keys.a) camera.position.addScaledVector(right, -moveSpeed);
        if (keys.d) camera.position.addScaledVector(right, moveSpeed);
        if (keys.q) camera.position.y -= moveSpeed;
        if (keys.e) camera.position.y += moveSpeed;

        camera.lookAt(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z);
    }

    // Lazy-load floor and ceiling tiles
    updateTiles(floorTiles, camera.position.x, camera.position.z, floorKeys, 0, 2);
    updateTiles(ceilTiles, camera.position.x, camera.position.z, ceilKeys, TILE_HEIGHT, 2);

    // Wall tiling: recycle far tiles, then place in 3D grid
    const cy = Math.floor(camera.position.y / TILE_HEIGHT);
    const wallHalfY = 1;
    const cx = Math.floor(camera.position.x / TILE_SIZE);
    const cz = Math.floor(camera.position.z / TILE_SIZE);
    const halfXZ = Math.ceil(RENDER_DIST / TILE_SIZE);
    for (const wallPool of [wallTilesX, wallTilesZ, wallAngX, wallAngZ]) {
        let wallPoolKeys;
        if (wallPool === wallTilesX) wallPoolKeys = wallKeysX;
        else if (wallPool === wallTilesZ) wallPoolKeys = wallKeysZ;
        else if (wallPool === wallAngX) wallPoolKeys = wallAngKeysX;
        else wallPoolKeys = wallAngKeysZ;

        // Recycle tiles that are too far
        for (let i = 0; i < wallPool.length; i++) {
            const t = wallPool[i];
            if (t.visible) {
                const dy = Math.abs(t.position.y - camera.position.y);
                const dx = Math.abs(t.position.x - camera.position.x);
                const dz = Math.abs(t.position.z - camera.position.z);
                if (dy > RECYCLE_DIST || dx > RECYCLE_DIST || dz > RECYCLE_DIST) {
                    t.visible = false;
                    wallPoolKeys.delete(key(t._gx, t._gy, t._gz));
                }
            }
        }

        // Place walls in 3D grid
        for (let gy = cy - wallHalfY; gy <= cy + wallHalfY; gy++) {
            for (let gx = cx - halfXZ; gx <= cx + halfXZ; gx++) {
                for (let gz = cz - halfXZ; gz <= cz + halfXZ; gz++) {
                    const k = key(gx, gy, gz);
                    if (wallPoolKeys.has(k)) continue;
                    const availIdx = wallPool.findIndex(t => !t.visible);
                    if (availIdx === -1) continue;
                    const t = wallPool[availIdx];
                    t.position.x = gx * TILE_SIZE;
                    t.position.z = gz * TILE_SIZE;
                    t.position.y = gy * TILE_HEIGHT + TILE_HEIGHT / 2;
                    t._gx = gx;
                    t._gz = gz;
                    t._gy = gy;
                    t.visible = true;
                    wallPoolKeys.add(k);
                }
            }
        }
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