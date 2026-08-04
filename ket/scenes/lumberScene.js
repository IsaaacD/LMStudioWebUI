import * as THREE from 'three';
import { normalizeColor, loadShader, hashNumber } from '../modules/utils.js';

const POOL_SIZE = 90;
const SPAWN_DISTANCE = 22;
const PASS_DISTANCE = 15;
const X_SPREAD = 35;
const Y_SPREAD = 22;
const BASE_SPEED = 4;
const SPEED_VARIANCE = 3;
const LUMBER_SEED = 777;
const EMBER_COUNT = 100;
const SAWDUST_COUNT = 200;
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
const _bgColor = new THREE.Color(0x000000);
const _fogColorTemp = new THREE.Color();
const _camQuat = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);

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
            quat: new THREE.Quaternion(),
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

    // Ember particles
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

    // Sawdust trails
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

    // --- Debris as InstancedMesh (single draw call, batched matrix updates) ---
    const debrisData = [];
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        const size = 0.3 + hr(DEBRIS_COUNT * 10 + i * 8) * 1.2;
        debrisData.push({
            active: false,
            xOffset: (hr(DEBRIS_COUNT * 10 + i * 8 + 4) - 0.5) * 2 * X_SPREAD * 1.5,
            yOffset: (hr(DEBRIS_COUNT * 10 + i * 8 + 5) > 0.5 ? 1 : -1) * (Y_SPREAD + 3 + hr(DEBRIS_COUNT * 10 + i * 8 + 5) * 5),
            zOffset: SPAWN_DISTANCE,
            speed: BASE_SPEED + hr(DEBRIS_COUNT * 10 + i * 8 + 6) * SPEED_VARIANCE * 0.8,
            quat: new THREE.Quaternion(),
            rotSpeedX: (hr(DEBRIS_COUNT * 10 + i * 8 + 7) - 0.5) * 4,
            rotSpeedY: (hr(DEBRIS_COUNT * 10 + i * 8) - 0.5) * 4,
            rotSpeedZ: (hr(DEBRIS_COUNT * 10 + i * 8 + 1) - 0.5) * 4,
            scaleX: size * (0.5 + hr(DEBRIS_COUNT * 10 + i * 8 + 1)),
            scaleY: size * 0.3,
            scaleZ: size * (0.5 + hr(DEBRIS_COUNT * 10 + i * 8 + 2)),
            recycleCount: 0,
        });
    }

    const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
    const debrisMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.7,
    });
    const debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, DEBRIS_COUNT);
    debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        _tempColor.setHSL(0.07 + hr(DEBRIS_COUNT * 10 + i * 8 + 3) * 0.05, 0.3, 0.12);
        debrisMesh.setColorAt(i, _tempColor);
    }
    debrisMesh.instanceColor.needsUpdate = true;
    threeScene.add(debrisMesh);

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

    // Cached camera basis vectors to avoid recomputing when camera hasn't rotated
    let cachedRightX = 0, cachedRightY = 0, cachedRightZ = 0;
    let cachedUpX = 0, cachedUpY = 0, cachedUpZ = 0;
    let cachedForwardX = 0, cachedForwardY = 0, cachedForwardZ = 0;
    let camQuatW = 0, camQuatX = 0, camQuatY = 0, camQuatZ = 0;

    // Running nearby count for fog density
    let nearbyCount = 0;

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
            // Stagger pieces from frontEdge to backEdge so first lumber
            // reaches camera after ~2 seconds at average speed (~5.5 u/s).
            // frontEdge = 10 + 2*5.5 = 21.
            const frontEdge = 21;
            const backEdge = SPAWN_DISTANCE + 40;
            const depthRange = backEdge - frontEdge;

            for (let i = 0; i < POOL_SIZE; i++) {
                const ld = lumberData[i];
                ld.active = true;
                ld.xOffset = (hr(i * 16 + 7) - 0.5) * 2 * X_SPREAD;
                ld.yOffset = (hr(i * 16 + 8) - 0.5) * 2 * Y_SPREAD;
                ld.zOffset = frontEdge + (i / POOL_SIZE) * depthRange + (hr(i * 16 + 9) - 0.5) * 2;
                // Pre-rotate as if piece had been tumbling for a random duration,
                // so initial orientations are as varied as pieces that have cycled through onUpdate
                const preTime = hr(i * 16 + 30) * 20;
                ld.quat.setFromEuler(0, 0, 0);
                {
                    _tempQuat.setFromAxisAngle(_axisX, ld.rotSpeedX * preTime);
                    ld.quat.premultiply(_tempQuat);
                    _tempQuat.setFromAxisAngle(_axisY, ld.rotSpeedY * preTime);
                    ld.quat.premultiply(_tempQuat);
                    _tempQuat.setFromAxisAngle(_axisZ, ld.rotSpeedZ * preTime);
                    ld.quat.premultiply(_tempQuat);
                }
                ld.recycleCount = 0;
            }

            for (let i = 0; i < DEBRIS_COUNT; i++) {
                const ud = debrisData[i];
                ud.active = true;
                ud.zOffset = frontEdge + (i / DEBRIS_COUNT) * depthRange + (hr(DEBRIS_COUNT * 10 + 500 + i) - 0.5) * 2;
                const dPreTime = hr(DEBRIS_COUNT * 10 + 700 + i) * 20;
                ud.quat.setFromEuler(0, 0, 0);
                {
                    _tempQuat.setFromAxisAngle(_axisX, ud.rotSpeedX * dPreTime);
                    ud.quat.premultiply(_tempQuat);
                    _tempQuat.setFromAxisAngle(_axisY, ud.rotSpeedY * dPreTime);
                    ud.quat.premultiply(_tempQuat);
                    _tempQuat.setFromAxisAngle(_axisZ, ud.rotSpeedZ * dPreTime);
                    ud.quat.premultiply(_tempQuat);
                }
            }

            for (let i = 0; i < EMBER_COUNT; i++) {
                const ed = emberData[i];
                ed.zOffset = frontEdge + (i / EMBER_COUNT) * depthRange + (hr(EMBER_COUNT * 16 + i * 10 + 200) - 0.5) * 2;
            }

            for (let i = 0; i < SAWDUST_COUNT; i++) {
                sawdustData[i].active = false;
                sawdustData[i].life = 0;
            }

            nearbyCount = 0;
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

            // Cache camera basis vectors, skip recomputation if quaternion unchanged
            const cqW = camera.quaternion.w;
            const cqX = camera.quaternion.x;
            const cqY = camera.quaternion.y;
            const cqZ = camera.quaternion.z;
            if (cqW !== camQuatW || cqX !== camQuatX || cqY !== camQuatY || cqZ !== camQuatZ) {
                camQuatW = cqW; camQuatX = cqX; camQuatY = cqY; camQuatZ = cqZ;
                _camQuat.copy(camera.quaternion);
                _forward.set(0, 0, -1).applyQuaternion(_camQuat);
                _right.crossVectors(_forward, _worldUp).normalize();
                _up.crossVectors(_right, _forward).normalize();
                cachedForwardX = _forward.x; cachedForwardY = _forward.y; cachedForwardZ = _forward.z;
                cachedRightX = _right.x; cachedRightY = _right.y; cachedRightZ = _right.z;
                cachedUpX = _up.x; cachedUpY = _up.y; cachedUpZ = _up.z;
            }

            // Update running nearby count
            for (let i = 0; i < POOL_SIZE; i++) {
                const ld = lumberData[i];
                if (!ld.active) continue;
                const wasNearby = ld.zOffset > 0 && ld.zOffset < 30;
                ld.zOffset -= ld.speed * dt;
                const isNearby = ld.zOffset > 0 && ld.zOffset < 30;
                if (wasNearby && !isNearby) nearbyCount--;
                else if (!wasNearby && isNearby) nearbyCount++;

                if (ld.zOffset < -PASS_DISTANCE) {
                    ld.zOffset = SPAWN_DISTANCE + hr(i * 16 + 200 + ld.recycleCount) * 15;
                    ld.xOffset = (hr(i * 16 + 201 + ld.recycleCount) - 0.5) * 2 * X_SPREAD;
                    ld.yOffset = (hr(i * 16 + 202 + ld.recycleCount) - 0.5) * 2 * Y_SPREAD;
                    ld.recycleCount++;
                    if (ld.zOffset > 0 && ld.zOffset < 30) nearbyCount++;
                }
            }
            nearbyCount = Math.max(0, Math.min(POOL_SIZE, nearbyCount));
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

            // Use cached basis vector components
            const rX = cachedRightX, rY = cachedRightY, rZ = cachedRightZ;
            const uX = cachedUpX, uY = cachedUpY, uZ = cachedUpZ;
            const fX = cachedForwardX, fY = cachedForwardY, fZ = cachedForwardZ;

            for (let i = 0; i < POOL_SIZE; i++) {
                const ld = lumberData[i];
                if (!ld.active) continue;

                // Incremental quaternion rotation (skip Euler conversion)
                {
                    _tempQuat.setFromAxisAngle(_axisX, ld.rotSpeedX * dt);
                    ld.quat.premultiply(_tempQuat);
                    _tempQuat.setFromAxisAngle(_axisY, ld.rotSpeedY * dt);
                    ld.quat.premultiply(_tempQuat);
                    _tempQuat.setFromAxisAngle(_axisZ, ld.rotSpeedZ * dt);
                    ld.quat.premultiply(_tempQuat);
                }

                _tempVec3.set(
                    camX + rX * ld.xOffset + fX * ld.zOffset,
                    camY + uY * ld.yOffset + fY * ld.zOffset,
                    camZ + rZ * ld.xOffset + fZ * ld.zOffset
                );
                _tempScale.set(ld.scaleX, ld.scaleY, ld.scaleZ);
                _tempMatrix.compose(_tempVec3, ld.quat, _tempScale);
                lumberMesh.setMatrixAt(i, _tempMatrix);

                if (ld.zOffset > -5 && ld.zOffset < 15) {
                    const distSq = ld.xOffset * ld.xOffset + ld.yOffset * ld.yOffset;
                    if (distSq < closestApproachSq) {
                        closestApproachSq = distSq;
                    }
                }
            }
            lumberMesh.instanceMatrix.needsUpdate = true;

            // Camera shake on near miss
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
                emberPosArr[off] = camX + rX * ed.xOffset + fX * ed.zOffset;
                emberPosArr[off + 1] = camY + uY * ed.yOffset + fY * ed.zOffset;
                emberPosArr[off + 2] = camZ + rZ * ed.xOffset + fZ * ed.zOffset;
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
                        sdPosArr[off] = camX + rX * (parent.xOffset + sx) + fX * trailZ;
                        sdPosArr[off + 1] = camY + uY * (parent.yOffset + sd.spreadY * sd.trailOffset * 0.1) + fY * trailZ;
                        sdPosArr[off + 2] = camZ + rZ * (parent.xOffset + sx) + fZ * trailZ;
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

            // Update debris instanced mesh
            for (let i = 0; i < DEBRIS_COUNT; i++) {
                const ud = debrisData[i];
                if (!ud.active) continue;

                ud.zOffset -= ud.speed * dt;

                if (ud.zOffset < -PASS_DISTANCE) {
                    ud.zOffset = SPAWN_DISTANCE + hr(DEBRIS_COUNT * 10 + 600 + ud.recycleCount) * 15;
                    ud.xOffset = (hr(DEBRIS_COUNT * 10 + 601 + ud.recycleCount) - 0.5) * 2 * X_SPREAD * 1.5;
                    ud.recycleCount++;
                }

                // Incremental quaternion rotation
                _tempQuat.setFromAxisAngle(_axisX, ud.rotSpeedX * dt);
                ud.quat.premultiply(_tempQuat);
                _tempQuat.setFromAxisAngle(_axisY, ud.rotSpeedY * dt);
                ud.quat.premultiply(_tempQuat);
                _tempQuat.setFromAxisAngle(_axisZ, ud.rotSpeedZ * dt);
                ud.quat.premultiply(_tempQuat);

                _tempVec3.set(
                    camX + rX * ud.xOffset + fX * ud.zOffset,
                    camY + ud.yOffset + fY * ud.zOffset,
                    camZ + rZ * ud.xOffset + fZ * ud.zOffset
                );
                _tempScale.set(ud.scaleX, ud.scaleY, ud.scaleZ);
                _tempMatrix.compose(_tempVec3, ud.quat, _tempScale);
                debrisMesh.setMatrixAt(i, _tempMatrix);
            }
            debrisMesh.instanceMatrix.needsUpdate = true;
        }
    };
}