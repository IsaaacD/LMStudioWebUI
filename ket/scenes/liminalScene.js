import * as THREE from 'three';
import { hashNumber, normalizeColor } from '../modules/utils.js';

const SEGMENT_COUNT = 150;
const SEGMENT_DEPTH = 5;
const CORRIDOR_WIDTH = 3.5;
const CEILING_HEIGHT = 2.8;
const FOG_DENSITY = 0.035;
const LIGHT_INTERVAL = 2;
const CAMERA_HEIGHT = 1.6;
const BASE_FOV = 68;
const FOV_SWING = 6;
const FOV_CYCLE = 35;
const LIGHT_ACTIVE_RADIUS = 35;
const LIGHT_ACTIVE_RADIUS_SQ = LIGHT_ACTIVE_RADIUS * LIGHT_ACTIVE_RADIUS;
const EXIT_ACTIVE_RADIUS_SQ = (LIGHT_ACTIVE_RADIUS * 1.5) * (LIGHT_ACTIVE_RADIUS * 1.5);
const LIGHT_POOL_SIZE = 6;
const OPACITY_EPSILON = 0.03;
const MIN_DURATION = 2;
const MAX_DURATION = 20;
const WEIGHT = 2;

const _tempColor = new THREE.Color();
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _scl = new THREE.Vector3();
const _p3 = new THREE.Vector3();
const _forwardDir = new THREE.Vector3(0, 0, -1);

function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function createWallTexture(baseHue, stainIntensity) {
    const rng = mulberry32(baseHue * 7919 + 104729);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d');
    const baseH = baseHue || (25 + rng() * 20);
    const baseS = 8 + rng() * 12;
    const baseL = 62 + rng() * 12;
    ctx.fillStyle = `hsl(${baseH}, ${baseS}%, ${baseL}%)`;
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 40; i++) {
        const x = rng() * 256;
        const h = 30 + rng() * 150;
        const stainL = 35 + rng() * 25;
        ctx.fillStyle = `hsla(${baseH - 5}, 15%, ${stainL}%, ${(0.04 + rng() * 0.08) * stainIntensity})`;
        ctx.fillRect(x, rng() * 512, 2 + rng() * 3, h);
    }
    for (let i = 0; i < 1200; i++) {
        const n = rng() * 40 - 20;
        ctx.fillStyle = `rgba(${128 + n | 0},${128 + n | 0},${128 + n | 0},${rng() * 0.06})`;
        ctx.fillRect(rng() * 256, rng() * 512, 1 + rng() * 2, 1 + rng() * 2);
    }
    ctx.strokeStyle = `hsla(${baseH}, 6%, 55%, 0.25)`;
    ctx.lineWidth = 1.5;
    for (let y = 0; y <= 512; y += 128) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    for (let x = 0; x <= 256; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createFloorTexture() {
    const rng = mulberry32(42);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5a5548';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
        const v = 60 + rng() * 60 | 0;
        ctx.fillStyle = `rgba(${v},${v - 3},${v - 10},${0.04 + rng() * 0.08})`;
        ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 4, 1);
    }
    for (let i = 0; i < 50; i++) {
        ctx.strokeStyle = `rgba(40,35,28,${0.04 + rng() * 0.06})`;
        ctx.lineWidth = 0.5 + rng();
        ctx.beginPath();
        const sx = rng() * 256, sy = rng() * 256;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rng() - 0.5) * 30, sy + (rng() - 0.5) * 30);
        ctx.stroke();
    }
    const tileS = 64;
    ctx.strokeStyle = 'rgba(80,75,65,0.35)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 256; x += tileS) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += tileS) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 8);
    return tex;
}

function createCeilingTexture() {
    const rng = mulberry32(137);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b0aca4';
    ctx.fillRect(0, 0, 256, 256);
    const tileSize = 64;
    for (let x = 0; x <= 256; x += tileSize) {
        for (let y = 0; y <= 256; y += tileSize) {
            const v = 160 + rng() * 20 - 10 | 0;
            ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
            ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
        }
    }
    ctx.strokeStyle = 'rgba(100,95,88,0.6)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += tileSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += tileSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 8);
    return tex;
}

function createFluorescentLightTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 16;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(255,245,230,0)');
    grad.addColorStop(0.08, 'rgba(255,245,230,0.6)');
    grad.addColorStop(0.5, 'rgba(255,252,240,1)');
    grad.addColorStop(0.92, 'rgba(255,245,230,0.6)');
    grad.addColorStop(1, 'rgba(255,245,230,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 16);
    return new THREE.CanvasTexture(c);
}

function createExitSignTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0000';
    ctx.fillRect(0, 0, 128, 48);
    ctx.fillStyle = '#ff1500';
    ctx.shadowColor = '#ff3300';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 64, 24);
    return new THREE.CanvasTexture(c);
}

function buildCurve() {
    const points = [];
    let x = 0, z = 0, angle = 0;
    for (let i = 0; i <= SEGMENT_COUNT; i++) {
        points.push(new THREE.Vector3(x, 0, z));
        const longCurve = Math.sin(i * 0.02) * 0.5;
        const shortWobble = Math.sin(i * 0.13) * 0.2;
        angle += (longCurve + shortWobble) * 0.06;
        x += Math.sin(angle) * SEGMENT_DEPTH;
        z -= Math.cos(angle) * SEGMENT_DEPTH;
    }
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
}

function buildCurveCache(curve) {
    const cache = new Array(SEGMENT_COUNT + 1);
    for (let i = 0; i <= SEGMENT_COUNT; i++) {
        const t = i / SEGMENT_COUNT;
        cache[i] = {
            pos: curve.getPointAt(t),
            tangent: curve.getTangentAt(t),
        };
    }
    return cache;
}

function sampleCurveCache(cache, t) {
    const f = t * SEGMENT_COUNT;
    const i = Math.floor(f);
    const frac = f - i;
    const a = cache[Math.min(i, SEGMENT_COUNT)];
    const b = cache[Math.min(i + 1, SEGMENT_COUNT)];
    const pos = _p3.clone();
    pos.x = a.pos.x + (b.pos.x - a.pos.x) * frac;
    pos.y = a.pos.y + (b.pos.y - a.pos.y) * frac;
    pos.z = a.pos.z + (b.pos.z - a.pos.z) * frac;
    const tangent = pos.clone().sub(a.pos).normalize();
    if (tangent.lengthSq() < 0.0001) {
        tangent.copy(a.tangent);
    }
    return { pos, tangent };
}

function setInstanceMatrix(instancedMesh, index, position, quaternion, offset, scale) {
    _p3.set(position.x + offset.x, position.y + offset.y, position.z + offset.z);
    _scl.set(scale.x, scale.y, scale.z);
    _mat4.compose(_p3, quaternion, _scl);
    const arr = instancedMesh.instanceMatrix.array;
    const base = index * 16;
    for (let k = 0; k < 16; k++) arr[base + k] = _mat4.elements[k];
    instancedMesh.instanceMatrix.needsUpdate = true;
}

export async function createLiminalScene() {
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x080808);
    threeScene.fog = new THREE.FogExp2(0x1a1816, FOG_DENSITY);

    const curve = buildCurve();
    const curveCache = buildCurveCache(curve);

    const floorTex = createFloorTexture();
    const ceilingTex = createCeilingTexture();
    const flLightTex = createFluorescentLightTexture();
    const exitSignTex = createExitSignTexture();

    const wallTextures = [];
    const wallRng = mulberry32(999);
    for (let i = 0; i < 6; i++) {
        wallTextures.push(createWallTexture(20 + i * 8, 0.6 + wallRng() * 0.8));
    }

    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex, roughness: 0.7, metalness: 0.02,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
        map: ceilingTex, roughness: 0.9, metalness: 0.0,
    });
    const wallMats = wallTextures.map(tex => new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.85, metalness: 0.0,
    }));
    const solidWallMat = new THREE.MeshStandardMaterial({
        color: 0x9a9590, roughness: 0.95, metalness: 0.0,
    });

    const corridorGroup = new THREE.Group();
    threeScene.add(corridorGroup);

    const wallThickness = 0.4;
    const ceilThickness = 0.3;
    const floorThickness = 0.3;

    const wallGeoLeft = new THREE.BoxGeometry(wallThickness, CEILING_HEIGHT, SEGMENT_DEPTH + 0.1);
    const wallGeoRight = new THREE.BoxGeometry(wallThickness, CEILING_HEIGHT, SEGMENT_DEPTH + 0.1);
    const ceilingGeo = new THREE.BoxGeometry(CORRIDOR_WIDTH + wallThickness * 2, ceilThickness, SEGMENT_DEPTH + 0.1);
    const floorGeo = new THREE.BoxGeometry(CORRIDOR_WIDTH + wallThickness * 2, floorThickness, SEGMENT_DEPTH + 0.1);
    const endWallGeo = new THREE.BoxGeometry(CORRIDOR_WIDTH + wallThickness * 2, CEILING_HEIGHT + ceilThickness, wallThickness);

    const numWallMats = wallMats.length;
    const allWallMats = [...wallMats, solidWallMat];
    const totalMatGroups = numWallMats + 1;

    const wallLeftCounts = new Array(totalMatGroups).fill(0);
    const wallRightCounts = new Array(totalMatGroups).fill(0);
    const endWallCounts = new Array(totalMatGroups).fill(0);

    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const h = hashNumber(i * 7 + 3);
        const mi = h > 0.93 ? numWallMats : Math.floor(hashNumber(i * 31 + 11) * numWallMats);
        wallLeftCounts[mi]++;
        wallRightCounts[mi]++;
        if (i > 0 && i < SEGMENT_COUNT - 1) endWallCounts[mi]++;
    }

    const wallInstLeft = [];
    const wallInstRight = [];
    const endWallInst = [];

    for (let mi = 0; mi < totalMatGroups; mi++) {
        if (wallLeftCounts[mi] > 0) {
            wallInstLeft.push(new THREE.InstancedMesh(wallGeoLeft, allWallMats[mi], wallLeftCounts[mi]));
            wallInstRight.push(new THREE.InstancedMesh(wallGeoRight, allWallMats[mi], wallRightCounts[mi]));
            corridorGroup.add(wallInstLeft[mi], wallInstRight[mi]);
        } else {
            wallInstLeft.push(null);
            wallInstRight.push(null);
        }
        if (endWallCounts[mi] > 0) {
            endWallInst.push(new THREE.InstancedMesh(endWallGeo, allWallMats[mi], endWallCounts[mi]));
            corridorGroup.add(endWallInst[mi]);
        } else {
            endWallInst.push(null);
        }
    }

    const ceilInstanced = new THREE.InstancedMesh(ceilingGeo, ceilingMat, SEGMENT_COUNT);
    const floorInstanced = new THREE.InstancedMesh(floorGeo, floorMat, SEGMENT_COUNT);
    corridorGroup.add(ceilInstanced, floorInstanced);

    const wlCursor = new Array(totalMatGroups).fill(0);
    const wrCursor = new Array(totalMatGroups).fill(0);
    const ewCursor = new Array(totalMatGroups).fill(0);

    const lightData = [];
    const exitData = [];

    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const cached = curveCache[i];
        const pos = cached.pos;
        const tangent = cached.tangent;
        _quat.setFromUnitVectors(_forwardDir, tangent);

        const h = hashNumber(i * 7 + 3);
        const widthMod = 1.0 - h * 0.1;
        const heightMod = 1.0 - hashNumber(i * 13 + 7) * 0.08;
        const effectiveHalfW = (CORRIDOR_WIDTH / 2) * widthMod;
        const effectiveH = CEILING_HEIGHT * heightMod;

        const mi = h > 0.93 ? numWallMats : Math.floor(hashNumber(i * 31 + 11) * numWallMats);
        const hScale = effectiveH / CEILING_HEIGHT;

        const leftOff = { x: -effectiveHalfW, y: effectiveH / 2, z: 0 };
        const rightOff = { x: effectiveHalfW, y: effectiveH / 2, z: 0 };
        const scl = { x: 1, y: hScale, z: 1 };

        if (wallInstLeft[mi]) setInstanceMatrix(wallInstLeft[mi], wlCursor[mi]++, pos, _quat, leftOff, scl);
        if (wallInstRight[mi]) setInstanceMatrix(wallInstRight[mi], wrCursor[mi]++, pos, _quat, rightOff, scl);

        setInstanceMatrix(ceilInstanced, i, pos, _quat, { x: 0, y: effectiveH + ceilThickness / 2, z: 0 }, { x: 1, y: 1, z: 1 });
        setInstanceMatrix(floorInstanced, i, pos, _quat, { x: 0, y: -floorThickness / 2, z: 0 }, { x: 1, y: 1, z: 1 });

        if (i > 0 && i < SEGMENT_COUNT - 1 && endWallInst[mi]) {
            setInstanceMatrix(endWallInst[mi], ewCursor[mi]++, pos, _quat, { x: 0, y: effectiveH / 2, z: SEGMENT_DEPTH / 2 }, scl);
        }

        if (i % LIGHT_INTERVAL === 0) {
            const fixtureMat = new THREE.MeshBasicMaterial({
                map: flLightTex, transparent: true, opacity: 0,
            });
            const fixture = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.3), fixtureMat);
            fixture.position.set(pos.x, pos.y + effectiveH - 0.1, pos.z);
            fixture.rotation.x = Math.PI / 2;
            threeScene.add(fixture);

            lightData.push({
                fixtureMat, segIdx: i,
                wx: pos.x, wy: pos.y, wz: pos.z,
                lightY: pos.y + effectiveH - 0.5,
                freq: 2.3 + hashNumber(i * 17 + 1) * 4,
                phase: hashNumber(i * 19 + 3) * Math.PI * 2,
                flickerChance: hashNumber(i * 23 + 5),
                _prevOpacity: 0,
            });
        }

        if (i > 0 && i % 15 === 0 && i < SEGMENT_COUNT - 5) {
            const side = hashNumber(i * 31 + 9) > 0.5 ? 1 : -1;
            const signMat = new THREE.MeshBasicMaterial({
                map: exitSignTex, transparent: true, opacity: 0,
            });
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), signMat);
            sign.position.set(
                pos.x + side * (effectiveHalfW - 0.25),
                pos.y + effectiveH * 0.75,
                pos.z
            );
            sign.rotation.y = side * Math.PI / 2;
            threeScene.add(sign);

            const signLight = new THREE.PointLight(0xff2000, 0, 8, 2.0);
            signLight.position.copy(sign.position);
            threeScene.add(signLight);

            exitData.push({
                signMat, signLight, segIdx: i,
                wx: pos.x, wy: pos.y, wz: pos.z,
                _prevOpacity: 0,
                _prevIntensity: 0,
            });
        }
    }

    const dimAmbient = new THREE.AmbientLight(0x1a1816, 0.4);
    threeScene.add(dimAmbient);

    const cameraLight = new THREE.PointLight(0xffeedd, 3, 20, 1.5);
    threeScene.add(cameraLight);

    const cameraFillLight = new THREE.PointLight(0x445566, 0.6, 15, 2.0);
    threeScene.add(cameraFillLight);

    const lightPool = [];
    for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
        const pl = new THREE.PointLight(0xffe8c8, 0, 30, 1.5);
        threeScene.add(pl);
        lightPool.push(pl);
    }

    const cameraProgress = { t: 0 };

    return {
        id: 'liminal',
        name: 'Corridor',
        minDuration: MIN_DURATION,
        maxDuration: MAX_DURATION,
        weight: WEIGHT,
        threeScene,
        defaultDuration: 45,
        curve,
        lightData,
        exitData,
        corridorGroup,
        cameraLight,
        cameraFillLight,
        lightPool,
        cameraProgress,

        onEnter() {
        },

        onExit() {
            for (const pl of this.lightPool) pl.intensity = 0;
            for (const ed of this.exitData) ed.signLight.intensity = 0;
        },

        onUpdate(camera, effectiveTime, dt, activeParams) {
            const speed = (activeParams && activeParams.speed !== undefined ? activeParams.speed : 1.5) * 0.0015;
            cameraProgress.t += speed * dt;
            if (cameraProgress.t > 1) cameraProgress.t -= 1;

            const t = cameraProgress.t;
            const sampled = sampleCurveCache(curveCache, t);
            const lookSampled = sampleCurveCache(curveCache, (t + 0.015) % 1);

            camera.position.copy(sampled.pos);
            camera.position.y = CAMERA_HEIGHT;

            const swayX = Math.sin(effectiveTime * 0.7) * 0.2;
            const swayY = Math.sin(effectiveTime * 0.5) * 0.1;
            const swayZ = Math.sin(effectiveTime * 0.3) * 0.08;

            camera.lookAt(
                lookSampled.pos.x + swayX,
                lookSampled.pos.y + CAMERA_HEIGHT * 0.7 + swayY,
                lookSampled.pos.z + swayZ
            );

            const fovOsc = Math.sin(effectiveTime / FOV_CYCLE * Math.PI * 2) * FOV_SWING;
            camera.fov = BASE_FOV + fovOsc;
            camera.updateProjectionMatrix();

            cameraLight.position.x = camera.position.x;
            cameraLight.position.y = camera.position.y + 0.5;
            cameraLight.position.z = camera.position.z;
            cameraFillLight.position.x = camera.position.x;
            cameraFillLight.position.y = camera.position.y - 0.5;
            cameraFillLight.position.z = camera.position.z - 3;

            if (activeParams && activeParams.colorA) {
                cameraLight.color.lerp(_tempColor.set(normalizeColor(activeParams.colorA)), 0.02);
            }
            if (activeParams && activeParams.colorB) {
                cameraFillLight.color.lerp(_tempColor.set(normalizeColor(activeParams.colorB)), 0.02);
            }

            const cx = camera.position.x;
            const cy = camera.position.y;
            const cz = camera.position.z;

            const activeIndices = new Array(LIGHT_POOL_SIZE).fill(-1);
            const activeDistSq = new Array(LIGHT_POOL_SIZE).fill(Infinity);

            for (let i = 0; i < lightData.length; i++) {
                const ld = lightData[i];
                const dx = ld.wx - cx;
                const dy = ld.wy - cy;
                const dz = ld.wz - cz;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < LIGHT_ACTIVE_RADIUS_SQ) {
                    const dist = Math.sqrt(distSq);
                    const proximity = 1.0 - (dist / LIGHT_ACTIVE_RADIUS);
                    const baseIntensity = 6 * proximity;
                    const flickerFast = Math.sin(effectiveTime * ld.freq + ld.phase) * 0.2;
                    const flickerSlow = Math.sin(effectiveTime * 0.37 + ld.phase * 2.3) * 0.15;
                    const randomDrop = ld.flickerChance > 0.8
                        ? (Math.sin(effectiveTime * 11.3 + ld.segIdx * 7) > 0.92 ? -0.5 : 0)
                        : 0;
                    const intensity = Math.max(0.2, baseIntensity + flickerFast + flickerSlow + randomDrop);
                    const targetOpacity = Math.min(1, 0.4 + intensity / 6 * 0.7);

                    if (Math.abs(targetOpacity - ld._prevOpacity) > OPACITY_EPSILON) {
                        ld.fixtureMat.opacity = targetOpacity;
                        ld._prevOpacity = targetOpacity;
                    }

                    let bestPoolSlot = -1;
                    let bestPoolDist = Infinity;
                    for (let p = 0; p < LIGHT_POOL_SIZE; p++) {
                        if (activeDistSq[p] > distSq) {
                            bestPoolSlot = p;
                            bestPoolDist = distSq;
                        }
                    }
                    if (bestPoolSlot >= 0) {
                        activeIndices[bestPoolSlot] = i;
                        activeDistSq[bestPoolSlot] = distSq;
                    }
                } else {
                    if (Math.abs(ld._prevOpacity) > OPACITY_EPSILON) {
                        ld.fixtureMat.opacity = 0;
                        ld._prevOpacity = 0;
                    }
                }
            }

            for (let p = 0; p < LIGHT_POOL_SIZE; p++) {
                const pl = lightPool[p];
                if (activeIndices[p] >= 0) {
                    const ld = lightData[activeIndices[p]];
                    const dx = ld.wx - cx;
                    const dy = ld.wy - cy;
                    const dz = ld.wz - cz;
                    const distSq = dx * dx + dy * dy + dz * dz;
                    const dist = Math.sqrt(distSq);
                    const proximity = 1.0 - (dist / LIGHT_ACTIVE_RADIUS);
                    const baseIntensity = 6 * proximity;
                    const flickerFast = Math.sin(effectiveTime * ld.freq + ld.phase) * 0.2;
                    const flickerSlow = Math.sin(effectiveTime * 0.37 + ld.phase * 2.3) * 0.15;
                    const randomDrop = ld.flickerChance > 0.8
                        ? (Math.sin(effectiveTime * 11.3 + ld.segIdx * 7) > 0.92 ? -0.5 : 0)
                        : 0;
                    pl.intensity = Math.max(0.2, baseIntensity + flickerFast + flickerSlow + randomDrop);
                    pl.position.set(ld.wx, ld.lightY, ld.wz);
                    if (activeParams && activeParams.colorA && activeParams.colorB) {
                        const blend = (Math.sin(effectiveTime * 0.15 + ld.segIdx * 0.5) * 0.5 + 0.5);
                        pl.color.lerpColors(_tempColor.set(normalizeColor(activeParams.colorA)), _tempColor.set(normalizeColor(activeParams.colorB)), blend);
                    }
                } else {
                    pl.intensity = 0;
                }
            }

            for (let i = 0; i < exitData.length; i++) {
                const ed = exitData[i];
                const dx = ed.wx - cx;
                const dy = ed.wy - cy;
                const dz = ed.wz - cz;
                if (dx * dx + dy * dy + dz * dz < EXIT_ACTIVE_RADIUS_SQ) {
                    const pulse = Math.sin(effectiveTime * 1.2 + ed.segIdx) * 0.15 + 0.85;
                    const targetOpacity = pulse;
                    const targetIntensity = 1.5 * pulse;
                    if (Math.abs(targetOpacity - ed._prevOpacity) > OPACITY_EPSILON) {
                        ed.signMat.opacity = targetOpacity;
                        ed._prevOpacity = targetOpacity;
                    }
                    if (Math.abs(targetIntensity - ed._prevIntensity) > OPACITY_EPSILON) {
                        ed.signLight.intensity = targetIntensity;
                        ed._prevIntensity = targetIntensity;
                    }
                } else {
                    if (Math.abs(ed._prevOpacity) > OPACITY_EPSILON) {
                        ed.signMat.opacity = 0;
                        ed._prevOpacity = 0;
                    }
                    if (ed._prevIntensity > OPACITY_EPSILON) {
                        ed.signLight.intensity = 0;
                        ed._prevIntensity = 0;
                    }
                }
            }

            const fogWarm = Math.sin(effectiveTime * 0.04) * 0.5 + 0.5;
            if (fogWarm > 0.55) {
                threeScene.fog.color.lerp(_tempColor.set(0x1e1a16), 0.008);
            } else {
                threeScene.fog.color.lerp(_tempColor.set(0x141618), 0.008);
            }
            threeScene.background.copy(threeScene.fog.color);
        }
    };
}