import * as THREE from 'three';
import { normalizeColor, loadShader, hashNumber } from '../modules/utils.js';

const POOL_SIZE = 110;
const SPAWN_DISTANCE = 80;
const PASS_DISTANCE = 15;
const X_SPREAD = 35;
const Y_SPREAD = 22;
const BASE_SPEED = 4;
const SPEED_VARIANCE = 3;
const LUMBER_SEED = 777;
const EMBER_COUNT = 100;
const SAWDUST_COUNT = 200;
const WALL_PLANK_COUNT = 24;
const DEBRIS_COUNT = 60;

const MIN_DURATION = 2;
const MAX_DURATION = 6;
const WEIGHT = 1;
function hr(n) {
    return hashNumber(LUMBER_SEED + n);
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _tempColor = new THREE.Color();
const _shakeOffset = new THREE.Vector3();
const _origCamPos = new THREE.Vector3();
const _tempMatrix = new THREE.Matrix4();
const _tempQuat = new THREE.Quaternion();
const _tempVec3 = new THREE.Vector3();
const _tempScale = new THREE.Vector3();
const _tempEuler = new THREE.Euler();
const _bgColor = new THREE.Color(0x000000);
const _fogColorTemp = new THREE.Color();

export async function createLumberScene() {
    const vsSource = await loadShader('./shaders/wood-instanced.vert');
    const fsSource = await loadShader('./shaders/wood-instanced.frag');

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x000000);
    threeScene.fog = new THREE.FogExp2(0x000000, 0.012);

    // --- Per-instance data for lumber pieces ---
    const lumberData = [];
    for (let i = 0; i < POOL_SIZE; i++) {
        const length = 12 + hr(i * 16) * 14;
        const width = 1.5 + hr(i * 16 + 1) * 1.0;
        const depth = 2.0 + hr(i * 16 + 2) * 1.5;
        lumberData.push({
            active: false,
            xOffset: (hr(i * 16 + 7) - 0.5) * 2 * X_SPREAD,
            yOffset: (hr(i * 16 + 8) - 0.5) * 2 * Y_SPREAD,
            zOffset: SPAWN_DISTANCE,
            speed: BASE_SPEED + hr(i * 16 + 9) * SPEED_VARIANCE,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            rotSpeedX: (hr(i * 16 + 10) - 0.5) * 2,
            rotSpeedY: (hr(i * 16 + 11) - 0.5) * 2,
            rotSpeedZ: (hr(i * 16 + 12) - 0.5) * 2,
            scaleX: width,
            scaleY: depth,
            scaleZ: length,
            useCrack: hr(i * 16 + 20) > 0.4,
            crackGlow: 0.3 + hr(i * 16 + 21) * 0.7,
            recycleCount: 0,
        });
    }

    // Single geometry + material for all lumber instances
    const lumberGeo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 8);
    const lumberMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: vsSource,
        fragmentShader: fsSource,
    });

    const lumberMesh = new THREE.InstancedMesh(lumberGeo, lumberMat, POOL_SIZE);
    lumberMesh.frustumCulled = false;

    // Instanced attributes
    const lumberColorA = new Float32Array(POOL_SIZE * 3);
    const lumberColorB = new Float32Array(POOL_SIZE * 3);
    const lumberGrainIntensity = new Float32Array(POOL_SIZE);
    const lumberKnotIntensity = new Float32Array(POOL_SIZE);
    const lumberCrackGlow = new Float32Array(POOL_SIZE);
    const lumberUseCrack = new Float32Array(POOL_SIZE);

    for (let i = 0; i < POOL_SIZE; i++) {
        _tempColor.setHSL(hr(i * 16 + 3), 0.3, 0.2);
        lumberColorA[i * 3] = _tempColor.r;
        lumberColorA[i * 3 + 1] = _tempColor.g;
        lumberColorA[i * 3 + 2] = _tempColor.b;

        _tempColor.setHSL(hr(i * 16 + 4), 0.25, 0.12);
        lumberColorB[i * 3] = _tempColor.r;
        lumberColorB[i * 3 + 1] = _tempColor.g;
        lumberColorB[i * 3 + 2] = _tempColor.b;

        lumberGrainIntensity[i] = 0.8 + hr(i * 16 + 5) * 0.6;
        lumberKnotIntensity[i] = 0.3 + hr(i * 16 + 6) * 0.5;
        lumberCrackGlow[i] = lumberData[i].crackGlow;
        lumberUseCrack[i] = lumberData[i].useCrack ? 1.0 : 0.0;
    }

    lumberMesh.geometry.setAttribute('instColorA', new THREE.InstancedBufferAttribute(lumberColorA, 3));
    lumberMesh.geometry.setAttribute('instColorB', new THREE.InstancedBufferAttribute(lumberColorB, 3));
    lumberMesh.geometry.setAttribute('instGrainIntensity', new THREE.InstancedBufferAttribute(lumberGrainIntensity, 1));
    lumberMesh.geometry.setAttribute('instKnotIntensity', new THREE.InstancedBufferAttribute(lumberKnotIntensity, 1));
    lumberMesh.geometry.setAttribute('instCrackGlow', new THREE.InstancedBufferAttribute(lumberCrackGlow, 1));
    lumberMesh.geometry.setAttribute('instUseCrack', new THREE.InstancedBufferAttribute(lumberUseCrack, 1));

    threeScene.add(lumberMesh);

    // Ember particles — glowing sparks flying past
    const emberGeo = new THREE.BufferGeometry();
    const emberPositions = new Float32Array(EMBER_COUNT * 3);
    const emberColors = new Float32Array(EMBER_COUNT * 3);
    const emberData = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
        const warmHue = 0.02 + hr(EMBER_COUNT * 16 + i * 10) * 0.08;
        _tempColor.setHSL(warmHue, 1, 0.4 + hr(EMBER_COUNT * 16 + i * 10 + 1) * 0.4);
        emberPositions[i * 3] = 0;
        emberPositions[i * 3 + 1] = 0;
        emberPositions[i * 3 + 2] = 0;
        emberColors[i * 3] = _tempColor.r;
        emberColors[i * 3 + 1] = _tempColor.g;
        emberColors[i * 3 + 2] = _tempColor.b;
        emberData.push({
            xOffset: (hr(EMBER_COUNT * 16 + i * 10 + 2) - 0.5) * 2 * X_SPREAD * 1.8,
            yOffset: (hr(EMBER_COUNT * 16 + i * 10 + 3) - 0.5) * 2 * Y_SPREAD * 1.8,
            zOffset: PASS_DISTANCE + hr(EMBER_COUNT * 16 + i * 10 + 4) * (SPAWN_DISTANCE - PASS_DISTANCE),
            speed: 12 + hr(EMBER_COUNT * 16 + i * 10 + 5) * 30,
            drift: (hr(EMBER_COUNT * 16 + i * 10 + 6) - 0.5) * 2,
            driftSpeed: 0.5 + hr(EMBER_COUNT * 16 + i * 10 + 7) * 2,
            driftPhase: hr(EMBER_COUNT * 16 + i * 10 + 8) * Math.PI * 2,
            size: 0.2 + hr(EMBER_COUNT * 16 + i * 10 + 9) * 0.8,
            recycleCount: 0,
        });
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
    emberGeo.setAttribute('color', new THREE.BufferAttribute(emberColors, 3));
    const emberMat = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const embers = new THREE.Points(emberGeo, emberMat);
    threeScene.add(embers);

    // Sawdust trails behind lumber pieces
    const sawdustGeo = new THREE.BufferGeometry();
    const sawdustPositions = new Float32Array(SAWDUST_COUNT * 3);
    const sawdustColors = new Float32Array(SAWDUST_COUNT * 3);
    const sawdustData = [];
    for (let i = 0; i < SAWDUST_COUNT; i++) {
        const parentIdx = Math.floor(hr(SAWDUST_COUNT * 10 + i) * POOL_SIZE);
        sawdustPositions[i * 3] = 0;
        sawdustPositions[i * 3 + 1] = 0;
        sawdustPositions[i * 3 + 2] = 0;
        _tempColor.setHSL(0.06 + hr(SAWDUST_COUNT * 10 + i + 5) * 0.06, 0.6, 0.35);
        sawdustColors[i * 3] = _tempColor.r;
        sawdustColors[i * 3 + 1] = _tempColor.g;
        sawdustColors[i * 3 + 2] = _tempColor.b;
        sawdustData.push({
            parentIdx,
            trailOffset: hr(SAWDUST_COUNT * 10 + i + 1) * 8,
            life: 0,
            maxLife: 0.5 + hr(SAWDUST_COUNT * 10 + i + 2) * 1,
            active: false,
            spreadX: (hr(SAWDUST_COUNT * 10 + i + 3) - 0.5) * 2,
            spreadY: (hr(SAWDUST_COUNT * 10 + i + 4) - 0.5) * 2,
        });
    }
    sawdustGeo.setAttribute('position', new THREE.BufferAttribute(sawdustPositions, 3));
    sawdustGeo.setAttribute('color', new THREE.BufferAttribute(sawdustColors, 3));
    const sawdustMat = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const sawdust = new THREE.Points(sawdustGeo, sawdustMat);
    threeScene.add(sawdust);

    // --- Per-instance data for wall planks ---
    const wallPlankData = [];
    for (let i = 0; i < WALL_PLANK_COUNT; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const yLevel = Math.floor(i / 2) * 12 - 20;
        wallPlankData.push({
            zOffset: hr(WALL_PLANK_COUNT * 10 + 100) * SPAWN_DISTANCE,
            speed: BASE_SPEED * 0.8,
            side,
            yLevel,
            colorA: new THREE.Color().setHSL(hr(WALL_PLANK_COUNT * 10 + i * 5), 0.2, 0.15),
            colorB: new THREE.Color().setHSL(hr(WALL_PLANK_COUNT * 10 + i * 5 + 1), 0.15, 0.08),
            grainIntensity: 0.6 + hr(WALL_PLANK_COUNT * 10 + i * 5 + 2) * 0.5,
            knotIntensity: 0.2 + hr(WALL_PLANK_COUNT * 10 + i * 5 + 3) * 0.3,
            crackGlow: 0.1 + hr(WALL_PLANK_COUNT * 10 + i * 5 + 4) * 0.3,
        });
    }

    const plankGeo = new THREE.BoxGeometry(1.5, 12, 40, 1, 2, 4);
    const plankMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: vsSource,
        fragmentShader: fsSource,
    });

    const wallPlankMesh = new THREE.InstancedMesh(plankGeo, plankMat, WALL_PLANK_COUNT);

    const plankColorA = new Float32Array(WALL_PLANK_COUNT * 3);
    const plankColorB = new Float32Array(WALL_PLANK_COUNT * 3);
    const plankGrainIntensity = new Float32Array(WALL_PLANK_COUNT);
    const plankKnotIntensity = new Float32Array(WALL_PLANK_COUNT);
    const plankCrackGlow = new Float32Array(WALL_PLANK_COUNT);
    const plankUseCrack = new Float32Array(WALL_PLANK_COUNT);

    for (let i = 0; i < WALL_PLANK_COUNT; i++) {
        plankColorA[i * 3] = wallPlankData[i].colorA.r;
        plankColorA[i * 3 + 1] = wallPlankData[i].colorA.g;
        plankColorA[i * 3 + 2] = wallPlankData[i].colorA.b;
        plankColorB[i * 3] = wallPlankData[i].colorB.r;
        plankColorB[i * 3 + 1] = wallPlankData[i].colorB.g;
        plankColorB[i * 3 + 2] = wallPlankData[i].colorB.b;
        plankGrainIntensity[i] = wallPlankData[i].grainIntensity;
        plankKnotIntensity[i] = wallPlankData[i].knotIntensity;
        plankCrackGlow[i] = wallPlankData[i].crackGlow;
        plankUseCrack[i] = 1.0;
    }

    wallPlankMesh.geometry.setAttribute('instColorA', new THREE.InstancedBufferAttribute(plankColorA, 3));
    wallPlankMesh.geometry.setAttribute('instColorB', new THREE.InstancedBufferAttribute(plankColorB, 3));
    wallPlankMesh.geometry.setAttribute('instGrainIntensity', new THREE.InstancedBufferAttribute(plankGrainIntensity, 1));
    wallPlankMesh.geometry.setAttribute('instKnotIntensity', new THREE.InstancedBufferAttribute(plankKnotIntensity, 1));
    wallPlankMesh.geometry.setAttribute('instCrackGlow', new THREE.InstancedBufferAttribute(plankCrackGlow, 1));
    wallPlankMesh.geometry.setAttribute('instUseCrack', new THREE.InstancedBufferAttribute(plankUseCrack, 1));

    threeScene.add(wallPlankMesh);

    // Ground and ceiling debris
    const debrisPieces = [];
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        const size = 0.3 + hr(DEBRIS_COUNT * 10 + i * 8) * 1.2;
        const dGeo = new THREE.BoxGeometry(
            size * (0.5 + hr(DEBRIS_COUNT * 10 + i * 8 + 1)),
            size * 0.3,
            size * (0.5 + hr(DEBRIS_COUNT * 10 + i * 8 + 2))
        );
        const dMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.07 + hr(DEBRIS_COUNT * 10 + i * 8 + 3) * 0.05, 0.3, 0.12),
            transparent: true,
            opacity: 0.7,
        });
        const debris = new THREE.Mesh(dGeo, dMat);
        debris.visible = false;
        debris.userData = {
            active: false,
            xOffset: (hr(DEBRIS_COUNT * 10 + i * 8 + 4) - 0.5) * 2 * X_SPREAD * 1.5,
            yOffset: (hr(DEBRIS_COUNT * 10 + i * 8 + 5) > 0.5 ? 1 : -1) * (Y_SPREAD + 3 + hr(DEBRIS_COUNT * 10 + i * 8 + 5) * 5),
            zOffset: SPAWN_DISTANCE,
            speed: BASE_SPEED + hr(DEBRIS_COUNT * 10 + i * 8 + 6) * SPEED_VARIANCE * 0.8,
            rotSpeedX: (hr(DEBRIS_COUNT * 10 + i * 8 + 7) - 0.5) * 4,
            rotSpeedY: (hr(DEBRIS_COUNT * 10 + i * 8) - 0.5) * 4,
            rotSpeedZ: (hr(DEBRIS_COUNT * 10 + i * 8 + 1) - 0.5) * 4,
            recycleCount: 0,
        };
        threeScene.add(debris);
        debrisPieces.push(debris);
    }

    // Lighting
    const light1 = new THREE.PointLight(0xff6633, 1.5, 200);
    light1.position.set(0, 10, 0);
    threeScene.add(light1);

    const light2 = new THREE.PointLight(0x33ccff, 1.5, 200);
    light2.position.set(0, -10, 0);
    threeScene.add(light2);

    const ambientLight = new THREE.AmbientLight(0x222222);
    threeScene.add(ambientLight);

    // Camera shake state
    let shakeIntensity = 0;
    let shakeDuration = 0;
    let shakeElapsed = 0;

    // Cached activeParams to avoid redundant per-frame updates
    let lastFoldIntensity = NaN;
    let lastEdgeContrast = NaN;
    let lastColorA = null;
    let lastColorB = null;

    return {
        id: 'lumber',
        name: 'Lumber',
        minDuration: MIN_DURATION,
        maxDuration: MAX_DURATION,
        weight: WEIGHT,
        threeScene,
        defaultDuration: 45,
        light1,
        light2,
        embers,
        emberData,
        sawdust,
        sawdustData,

        onEnter() {
            for (let i = 0; i < POOL_SIZE; i++) {
                const ld = lumberData[i];
                ld.active = true;
                ld.xOffset = (hr(i * 16 + 7) - 0.5) * 2 * X_SPREAD;
                ld.yOffset = (hr(i * 16 + 8) - 0.5) * 2 * Y_SPREAD;
                ld.zOffset = 5 + hr(i * 16 + 9) * (SPAWN_DISTANCE - 5);
                ld.rotX = 0;
                ld.rotY = 0;
                ld.rotZ = 0;
                ld.recycleCount = 0;
            }

            for (let i = 0; i < DEBRIS_COUNT; i++) {
                const ud = debrisPieces[i].userData;
                ud.active = true;
                ud.zOffset = hr(DEBRIS_COUNT * 10 + 500 + i) * SPAWN_DISTANCE;
                debrisPieces[i].visible = true;
            }

            for (let i = 0; i < WALL_PLANK_COUNT; i++) {
                wallPlankData[i].zOffset = hr(WALL_PLANK_COUNT * 10 + 200) * SPAWN_DISTANCE;
            }

            for (let i = 0; i < EMBER_COUNT; i++) {
                const ed = emberData[i];
                ed.zOffset = PASS_DISTANCE + hr(EMBER_COUNT * 16 + i * 10 + 200) * (SPAWN_DISTANCE - PASS_DISTANCE);
            }

            for (let i = 0; i < SAWDUST_COUNT; i++) {
                sawdustData[i].active = false;
                sawdustData[i].life = 0;
            }
        },

        onExit() { },

        onUpdate(camera, effectiveTime, dt, activeParams) {
            threeScene.background = _bgColor;
            if (activeParams && activeParams.colorB) {
                _fogColorTemp.set(normalizeColor(activeParams.colorB));
                threeScene.fog.color.copy(_fogColorTemp);
            } else {
                threeScene.fog.color.set('#1a0a00');
            }

            const h1 = (effectiveTime * 0.08) % 1;
            const h2 = (effectiveTime * 0.08 + 0.4) % 1;
            light1.color.setHSL(h1, 0.4, 0.35);
            light2.color.setHSL(h2, 0.4, 0.35);

            light1.position.x = Math.sin(effectiveTime * 0.4) * 18;
            light1.position.z = Math.cos(effectiveTime * 0.4) * 18;
            light2.position.x = Math.cos(effectiveTime * 0.25) * 18;
            light2.position.z = Math.sin(effectiveTime * 0.25) * 18;

            camera.getWorldDirection(_forward);
            _right.crossVectors(_forward, _worldUp).normalize();
            _up.crossVectors(_right, _forward).normalize();

            // Dynamic fog based on nearby lumber density
            let nearbyCount = 0;
            for (let i = 0; i < POOL_SIZE; i++) {
                const ld = lumberData[i];
                if (!ld.active) continue;
                if (ld.zOffset > 0 && ld.zOffset < 30) {
                    nearbyCount++;
                }
            }
            const targetFogDensity = 0.008 + (nearbyCount / POOL_SIZE) * 0.015;
            threeScene.fog.density += (targetFogDensity - threeScene.fog.density) * 0.05;

            // Camera shake
            if (shakeDuration > 0) {
                shakeElapsed += dt;
                const shakeFade = 1 - shakeElapsed / shakeDuration;
                _shakeOffset.x = (Math.random() - 0.5) * shakeIntensity * shakeFade * 2;
                _shakeOffset.y = (Math.random() - 0.5) * shakeIntensity * shakeFade * 2;
                _shakeOffset.z = (Math.random() - 0.5) * shakeIntensity * shakeFade;
                _origCamPos.copy(camera.position);
                camera.position.add(_shakeOffset);
                if (shakeElapsed >= shakeDuration) {
                    shakeDuration = 0;
                    shakeIntensity = 0;
                    camera.position.copy(_origCamPos);
                }
            }

            // Update lumber instance uniforms
            lumberMat.uniforms.uTime.value = effectiveTime;

            // Update lumber instanced attributes only when activeParams actually changed
            const paramsChanged = activeParams && (
                activeParams.foldIntensity !== lastFoldIntensity ||
                activeParams.edgeContrast !== lastEdgeContrast ||
                (activeParams.colorA && activeParams.colorA !== lastColorA) ||
                (activeParams.colorB && activeParams.colorB !== lastColorB)
            );
            if (paramsChanged) {
                lastFoldIntensity = activeParams.foldIntensity;
                lastEdgeContrast = activeParams.edgeContrast;
                lastColorA = activeParams.colorA;
                lastColorB = activeParams.colorB;

                const colA = activeParams.colorA ? _tempColor.set(normalizeColor(activeParams.colorA)) : null;
                const colB = activeParams.colorB ? _tempColor.set(normalizeColor(activeParams.colorB)) : null;
                const gInt = 0.6 + activeParams.foldIntensity * 0.4;
                const kInt = 0.2 + activeParams.edgeContrast * 2.0;
                const needsColorA = !!colA;
                const needsColorB = !!colB;

                for (let i = 0; i < POOL_SIZE; i++) {
                    if (needsColorA) {
                        const off = i * 3;
                        lumberColorA[off] = colA.r;
                        lumberColorA[off + 1] = colA.g;
                        lumberColorA[off + 2] = colA.b;
                    }
                    if (needsColorB) {
                        const off = i * 3;
                        lumberColorB[off] = colB.r;
                        lumberColorB[off + 1] = colB.g;
                        lumberColorB[off + 2] = colB.b;
                    }
                    lumberGrainIntensity[i] = gInt;
                    lumberKnotIntensity[i] = kInt;
                }
                lumberMesh.geometry.attributes.instColorA.needsUpdate = true;
                lumberMesh.geometry.attributes.instColorB.needsUpdate = true;
                lumberMesh.geometry.attributes.instGrainIntensity.needsUpdate = true;
                lumberMesh.geometry.attributes.instKnotIntensity.needsUpdate = true;
            }

            let closestApproachSq = Infinity;

            const camX = camera.position.x;
            const camY = camera.position.y;
            const camZ = camera.position.z;

            for (let i = 0; i < POOL_SIZE; i++) {
                const ld = lumberData[i];
                if (!ld.active) continue;

                ld.zOffset -= ld.speed * dt;

                if (ld.zOffset < -PASS_DISTANCE) {
                    ld.zOffset = SPAWN_DISTANCE + hr(i * 16 + 200 + ld.recycleCount) * 15;
                    ld.xOffset = (hr(i * 16 + 201 + ld.recycleCount) - 0.5) * 2 * X_SPREAD;
                    ld.yOffset = (hr(i * 16 + 202 + ld.recycleCount) - 0.5) * 2 * Y_SPREAD;
                    ld.recycleCount++;
                }

                ld.rotX += ld.rotSpeedX * dt;
                ld.rotY += ld.rotSpeedY * dt;
                ld.rotZ += ld.rotSpeedZ * dt;

                _tempEuler.set(ld.rotX, ld.rotY, ld.rotZ);
                _tempQuat.setFromEuler(_tempEuler);
                _tempVec3.set(
                    camX + _right.x * ld.xOffset + _forward.x * ld.zOffset,
                    camY + _up.y * ld.yOffset + _forward.y * ld.zOffset,
                    camZ + _right.z * ld.xOffset + _forward.z * ld.zOffset
                );
                _tempScale.set(ld.scaleX, ld.scaleY, ld.scaleZ);
                _tempMatrix.compose(_tempVec3, _tempQuat, _tempScale);
                lumberMesh.setMatrixAt(i, _tempMatrix);

                // Track closest approach using squared distance (avoids sqrt)
                if (ld.zOffset > -5 && ld.zOffset < 15) {
                    const distSq = ld.xOffset * ld.xOffset + ld.yOffset * ld.yOffset;
                    if (distSq < closestApproachSq) {
                        closestApproachSq = distSq;
                    }
                }
            }
            lumberMesh.instanceMatrix.needsUpdate = true;

            // Camera shake on near miss (compare squared: 10*10=100)
            if (closestApproachSq < 100 && shakeDuration <= 0) {
                const closestApproach = Math.sqrt(closestApproachSq);
                shakeIntensity = Math.max(0, (10 - closestApproach) * 0.05);
                shakeDuration = 0.3 + shakeIntensity * 0.5;
                shakeElapsed = 0;
            }

            // Update ember particles
            const emberPosArr = embers.geometry.attributes.position.array;
            for (let i = 0; i < EMBER_COUNT; i++) {
                const ed = emberData[i];
                ed.zOffset -= ed.speed * dt;
                ed.xOffset += Math.sin(effectiveTime * ed.driftSpeed + ed.driftPhase) * ed.drift * dt;

                if (ed.zOffset < -PASS_DISTANCE) {
                    ed.zOffset = SPAWN_DISTANCE + hr(EMBER_COUNT * 16 + i * 10 + 300 + ed.recycleCount) * 10;
                    ed.xOffset = (hr(EMBER_COUNT * 16 + i * 10 + 301 + ed.recycleCount) - 0.5) * 2 * X_SPREAD * 1.8;
                    ed.yOffset = (hr(EMBER_COUNT * 16 + i * 10 + 302 + ed.recycleCount) - 0.5) * 2 * Y_SPREAD * 1.8;
                    ed.recycleCount++;
                }

                const off = i * 3;
                emberPosArr[off] = camX + _right.x * ed.xOffset + _forward.x * ed.zOffset;
                emberPosArr[off + 1] = camY + _up.y * ed.yOffset + _forward.y * ed.zOffset;
                emberPosArr[off + 2] = camZ + _right.z * ed.xOffset + _forward.z * ed.zOffset;
            }
            embers.geometry.attributes.position.needsUpdate = true;

            // Update sawdust trails
            const sdPosArr = sawdust.geometry.attributes.position.array;
            for (let i = 0; i < SAWDUST_COUNT; i++) {
                const sd = sawdustData[i];
                const parent = lumberData[sd.parentIdx];

                if (parent && parent.active && parent.zOffset < 20 && parent.zOffset > -5) {
                    if (!sd.active) {
                        sd.active = true;
                        sd.life = 0;
                    }
                    sd.life += dt;
                    if (sd.life < sd.maxLife) {
                        const trailZ = parent.zOffset - sd.trailOffset;
                        const fade = 1 - sd.life / sd.maxLife;
                        const off = i * 3;
                        const sx = sd.spreadX * sd.trailOffset * 0.1;
                        sdPosArr[off] = camX + _right.x * (parent.xOffset + sx) + _forward.x * trailZ;
                        sdPosArr[off + 1] = camY + _up.y * (parent.yOffset + sd.spreadY * sd.trailOffset * 0.1) + _forward.y * trailZ;
                        sdPosArr[off + 2] = camZ + _right.z * (parent.xOffset + sx) + _forward.z * trailZ;
                        _tempColor.setHSL(0.07, 0.5, 0.3 * fade);
                        sawdustColors[off] = _tempColor.r;
                        sawdustColors[off + 1] = _tempColor.g;
                        sawdustColors[off + 2] = _tempColor.b;
                    } else {
                        sd.active = false;
                        sdPosArr[i * 3] = 0;
                        sdPosArr[i * 3 + 1] = 0;
                        sdPosArr[i * 3 + 2] = -999;
                    }
                } else {
                    sd.active = false;
                    sdPosArr[i * 3] = 0;
                    sdPosArr[i * 3 + 1] = 0;
                    sdPosArr[i * 3 + 2] = -999;
                }
            }
            sawdust.geometry.attributes.position.needsUpdate = true;
            sawdust.geometry.attributes.color.needsUpdate = true;

            // Update tunnel wall planks
            plankMat.uniforms.uTime.value = effectiveTime;

            // Reuse paramsChanged flag from lumber update above
            if (paramsChanged && activeParams) {
                const colA = activeParams.colorA ? _tempColor.set(normalizeColor(activeParams.colorA)) : null;
                const colB = activeParams.colorB ? _tempColor.set(normalizeColor(activeParams.colorB)) : null;
                const needsPA = !!colA;
                const needsPB = !!colB;
                for (let i = 0; i < WALL_PLANK_COUNT; i++) {
                    const off = i * 3;
                    if (needsPA) {
                        plankColorA[off] = colA.r;
                        plankColorA[off + 1] = colA.g;
                        plankColorA[off + 2] = colA.b;
                    }
                    if (needsPB) {
                        plankColorB[off] = colB.r;
                        plankColorB[off + 1] = colB.g;
                        plankColorB[off + 2] = colB.b;
                    }
                }
                wallPlankMesh.geometry.attributes.instColorA.needsUpdate = true;
                wallPlankMesh.geometry.attributes.instColorB.needsUpdate = true;
            }

            const wallXOffset = X_SPREAD + 5;
            for (let i = 0; i < WALL_PLANK_COUNT; i++) {
                const wpd = wallPlankData[i];
                wpd.zOffset -= wpd.speed * dt;

                if (wpd.zOffset < -50) {
                    wpd.zOffset = SPAWN_DISTANCE + hr(WALL_PLANK_COUNT * 10 + 300) * 20;
                }

                const sx = wpd.side * wallXOffset;
                _tempMatrix.makeTranslation(
                    camX + _right.x * sx + _forward.x * wpd.zOffset,
                    camY + wpd.yLevel + _forward.y * wpd.zOffset * 0.1,
                    camZ + _right.z * sx + _forward.z * wpd.zOffset
                );
                wallPlankMesh.setMatrixAt(i, _tempMatrix);
            }
            wallPlankMesh.instanceMatrix.needsUpdate = true;

            // Update debris
            for (let i = 0; i < debrisPieces.length; i++) {
                const mesh = debrisPieces[i];
                const ud = mesh.userData;
                if (!ud.active) continue;

                ud.zOffset -= ud.speed * dt;

                if (ud.zOffset < -PASS_DISTANCE) {
                    ud.zOffset = SPAWN_DISTANCE + hr(DEBRIS_COUNT * 10 + 600 + ud.recycleCount) * 15;
                    ud.xOffset = (hr(DEBRIS_COUNT * 10 + 601 + ud.recycleCount) - 0.5) * 2 * X_SPREAD * 1.5;
                    ud.recycleCount++;
                }

                mesh.rotation.x += ud.rotSpeedX * dt;
                mesh.rotation.y += ud.rotSpeedY * dt;
                mesh.rotation.z += ud.rotSpeedZ * dt;

                mesh.position.x = camX + _right.x * ud.xOffset + _forward.x * ud.zOffset;
                mesh.position.y = camY + ud.yOffset + _forward.y * ud.zOffset;
                mesh.position.z = camZ + _right.z * ud.xOffset + _forward.z * ud.zOffset;
            }
        }
    };
}
