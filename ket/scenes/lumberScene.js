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
const EMBER_COUNT = 400;
const SAWDUST_COUNT = 800;
const WALL_PLANK_COUNT = 24;
const DEBRIS_COUNT = 60;
const SPARK_BURST_MAX = 30;
const MIN_DURATION = 2;
const MAX_DURATION = 6;

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

export async function createLumberScene() {
    const vsSource = await loadShader('./shaders/wood.vert');
    const fsSource = await loadShader('./shaders/wood.frag');
    const crackFsSource = await loadShader('./shaders/wood-crack.frag');

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x000000);
    threeScene.fog = new THREE.FogExp2(0x000000, 0.012);

    // Lumber pieces with crack glow shader
    const lumberPieces = [];

    for (let i = 0; i < POOL_SIZE; i++) {
        const length = 12 + hr(i * 16) * 14;
        const width = 1.5 + hr(i * 16 + 1) * 1.0;
        const depth = 2.0 + hr(i * 16 + 2) * 1.5;

        const geo = new THREE.BoxGeometry(width, depth, length, 2, 2, 8);

        const useCrack = hr(i * 16 + 20) > 0.4;
        const uniforms = {
            uTime: { value: 0 },
            uColorA: { value: new THREE.Color().setHSL(hr(i * 16 + 3), 0.3, 0.2) },
            uColorB: { value: new THREE.Color().setHSL(hr(i * 16 + 4), 0.25, 0.12) },
            uGrainIntensity: { value: 0.8 + hr(i * 16 + 5) * 0.6 },
            uKnotIntensity: { value: 0.3 + hr(i * 16 + 6) * 0.5 },
            uCrackGlow: { value: 0.3 + hr(i * 16 + 21) * 0.7 },
        };

        const mat = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: vsSource,
            fragmentShader: useCrack ? crackFsSource : fsSource,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;

        mesh.userData = {
            active: false,
            xOffset: (hr(i * 16 + 7) - 0.5) * 2 * X_SPREAD,
            yOffset: (hr(i * 16 + 8) - 0.5) * 2 * Y_SPREAD,
            zOffset: SPAWN_DISTANCE,
            speed: BASE_SPEED + hr(i * 16 + 9) * SPEED_VARIANCE,
            rotSpeed: new THREE.Vector3(
                (hr(i * 16 + 10) - 0.5) * 2,
                (hr(i * 16 + 11) - 0.5) * 2,
                (hr(i * 16 + 12) - 0.5) * 2
            ),
            bobSpeed: 0.3 + hr(i * 16 + 13) * 0.8,
            bobPhase: hr(i * 16 + 14) * Math.PI * 2,
            bobAmp: 0.5 + hr(i * 16 + 15) * 1.5,
            uniforms,
            recycleCount: 0,
            sawdustSources: [],
        };

        threeScene.add(mesh);
        lumberPieces.push(mesh);
    }

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

    // Tunnel wall planks
    const wallPlanks = [];
    const plankGeo = new THREE.BoxGeometry(1.5, 12, 40, 1, 2, 4);
    for (let i = 0; i < WALL_PLANK_COUNT; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const yLevel = Math.floor(i / 2) * 12 - 20;
        const uniforms = {
            uTime: { value: 0 },
            uColorA: { value: new THREE.Color().setHSL(hr(WALL_PLANK_COUNT * 10 + i * 5), 0.2, 0.15) },
            uColorB: { value: new THREE.Color().setHSL(hr(WALL_PLANK_COUNT * 10 + i * 5 + 1), 0.15, 0.08) },
            uGrainIntensity: { value: 0.6 + hr(WALL_PLANK_COUNT * 10 + i * 5 + 2) * 0.5 },
            uKnotIntensity: { value: 0.2 + hr(WALL_PLANK_COUNT * 10 + i * 5 + 3) * 0.3 },
            uCrackGlow: { value: 0.1 + hr(WALL_PLANK_COUNT * 10 + i * 5 + 4) * 0.3 },
        };
        const plankMat = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: vsSource,
            fragmentShader: crackFsSource,
        });
        const plank = new THREE.Mesh(plankGeo, plankMat);
        plank.position.set(side * (X_SPREAD + 5), yLevel, 0);
        plank.userData = {
            zOffset: hr(WALL_PLANK_COUNT * 10 + 100) * SPAWN_DISTANCE,
            speed: BASE_SPEED * 0.8,
            uniforms,
            side,
            yLevel,
        };
        threeScene.add(plank);
        wallPlanks.push(plank);
    }

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
            rotSpeed: new THREE.Vector3(
                (hr(DEBRIS_COUNT * 10 + i * 8 + 7) - 0.5) * 4,
                (hr(DEBRIS_COUNT * 10 + i * 8) - 0.5) * 4,
                (hr(DEBRIS_COUNT * 10 + i * 8 + 1) - 0.5) * 4
            ),
            recycleCount: 0,
        };
        threeScene.add(debris);
        debrisPieces.push(debris);
    }

    // Spark burst pool for near-miss effects
    const sparkBurstGeo = new THREE.BufferGeometry();
    const sparkBurstPositions = new Float32Array(SPARK_BURST_MAX * 3);
    const sparkBurstColors = new Float32Array(SPARK_BURST_MAX * 3);
    sparkBurstGeo.setAttribute('position', new THREE.BufferAttribute(sparkBurstPositions, 3));
    sparkBurstGeo.setAttribute('color', new THREE.BufferAttribute(sparkBurstColors, 3));
    sparkBurstGeo.setDrawRange(0, 0);
    const sparkBurstMat = new THREE.PointsMaterial({
        size: 0.4,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
    });
    const sparkBurst = new THREE.Points(sparkBurstGeo, sparkBurstMat);
    threeScene.add(sparkBurst);
    const sparkBurstData = [];

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

    let spawnIndex = 0;

    return {
        id: 'lumber',
        name: 'Lumber',
        minDuration: MIN_DURATION,
        maxDuration: MAX_DURATION,
        threeScene,
        defaultDuration: 45,
        geometries: lumberPieces,
        light1,
        light2,
        embers,
        emberData,
        sawdust,
        sawdustData,
        wallPlanks,
        debrisPieces,
        sparkBurst,
        sparkBurstData,

        onEnter() {
            spawnIndex = 0;
            lumberPieces.forEach((mesh, i) => {
                const ud = mesh.userData;
                ud.active = true;
                ud.xOffset = (hr(i * 16 + 7) - 0.5) * 2 * X_SPREAD;
                ud.yOffset = (hr(i * 16 + 8) - 0.5) * 2 * Y_SPREAD;
                ud.zOffset = 5 + hr(i * 16 + 9) * (SPAWN_DISTANCE - 5);
                ud.recycleCount = 0;
                mesh.visible = true;
            });
            spawnIndex = POOL_SIZE;

            debrisPieces.forEach((mesh, i) => {
                const ud = mesh.userData;
                ud.active = true;
                ud.zOffset = hr(DEBRIS_COUNT * 10 + 500 + i) * SPAWN_DISTANCE;
                mesh.visible = true;
            });

            wallPlanks.forEach((plank) => {
                plank.userData.zOffset = hr(WALL_PLANK_COUNT * 10 + 200) * SPAWN_DISTANCE;
            });

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
            threeScene.background = new THREE.Color(0x000000);
            const fogColor = activeParams && activeParams.colorB ? normalizeColor(activeParams.colorB) : '#1a0a00';
            threeScene.fog.color.set(fogColor);

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
            for (const mesh of lumberPieces) {
                if (!mesh.userData.active) continue;
                if (mesh.userData.zOffset > 0 && mesh.userData.zOffset < 30) {
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

            // Near-miss tracking for camera shake and spark bursts
            let closestApproach = Infinity;

            for (let i = 0; i < lumberPieces.length; i++) {
                const mesh = lumberPieces[i];
                const ud = mesh.userData;

                if (!ud.active) {
                    if (spawnIndex < POOL_SIZE) {
                        ud.active = true;
                        ud.zOffset = SPAWN_DISTANCE + hr(i * 16 + 100 + ud.recycleCount) * 20;
                        ud.recycleCount++;
                        mesh.visible = true;
                        spawnIndex++;
                    } else {
                        continue;
                    }
                }

                ud.uniforms.uTime.value = effectiveTime;

                if (activeParams && activeParams.colorA) {
                    ud.uniforms.uColorA.value.set(normalizeColor(activeParams.colorA));
                }
                if (activeParams && activeParams.colorB) {
                    ud.uniforms.uColorB.value.set(normalizeColor(activeParams.colorB));
                }
                if (activeParams) {
                    ud.uniforms.uGrainIntensity.value = 0.6 + activeParams.foldIntensity * 0.4;
                    ud.uniforms.uKnotIntensity.value = 0.2 + activeParams.edgeContrast * 2.0;
                }

                ud.zOffset -= ud.speed * dt;

                if (ud.zOffset < -PASS_DISTANCE) {
                    ud.zOffset = SPAWN_DISTANCE + hr(i * 16 + 200 + ud.recycleCount) * 15;
                    ud.xOffset = (hr(i * 16 + 201 + ud.recycleCount) - 0.5) * 2 * X_SPREAD;
                    ud.yOffset = (hr(i * 16 + 202 + ud.recycleCount) - 0.5) * 2 * Y_SPREAD;
                    ud.recycleCount++;
                }

                mesh.rotation.x += ud.rotSpeed.x * dt;
                mesh.rotation.y += ud.rotSpeed.y * dt;
                mesh.rotation.z += ud.rotSpeed.z * dt;

                mesh.position.x = camera.position.x + _right.x * ud.xOffset + _forward.x * ud.zOffset;
                mesh.position.y = camera.position.y + _up.y * ud.yOffset + _forward.y * ud.zOffset;
                mesh.position.z = camera.position.z + _right.z * ud.xOffset + _forward.z * ud.zOffset;

                mesh.lookAt(
                    mesh.position.x + _forward.x,
                    mesh.position.y + _forward.y,
                    mesh.position.z + _forward.z
                );

                // Track closest approach for near-miss effects
                if (ud.zOffset > -5 && ud.zOffset < 15) {
                    const lateralDist = Math.sqrt(ud.xOffset * ud.xOffset + ud.yOffset * ud.yOffset);
                    if (lateralDist < closestApproach) {
                        closestApproach = lateralDist;
                    }
                }
            }

            // Camera shake on near miss
            if (closestApproach < 10 && shakeDuration <= 0) {
                shakeIntensity = Math.max(0, (10 - closestApproach) * 0.05);
                shakeDuration = 0.3 + shakeIntensity * 0.5;
                shakeElapsed = 0;

                // Spark burst on near miss
                if (closestApproach < 8 && sparkBurstData.length < 2) {
                    const burstCount = 15 + Math.floor(hr(Math.floor(effectiveTime * 10)) * 15);
                    for (let s = 0; s < Math.min(burstCount, SPARK_BURST_MAX); s++) {
                        sparkBurstData.push({
                            x: camera.position.x + (Math.random() - 0.5) * 4,
                            y: camera.position.y + (Math.random() - 0.5) * 4,
                            z: camera.position.z + _forward.z * 8 + (Math.random() - 0.5) * 2,
                            vx: (Math.random() - 0.5) * 15,
                            vy: (Math.random() - 0.5) * 15,
                            vz: (Math.random() - 0.5) * 10 + 5,
                            life: 0,
                            maxLife: 0.3 + Math.random() * 0.5,
                        });
                    }
                }
            }

            // Update spark burst particles
            for (let s = sparkBurstData.length - 1; s >= 0; s--) {
                const sp = sparkBurstData[s];
                sp.life += dt;
                if (sp.life >= sp.maxLife) {
                    sparkBurstData.splice(s, 1);
                    continue;
                }
                sp.x += sp.vx * dt;
                sp.y += sp.vy * dt;
                sp.z += sp.vz * dt;
                sp.vx *= 0.95;
                sp.vy *= 0.95;
                const idx = s * 3;
                sparkBurstPositions[idx] = sp.x;
                sparkBurstPositions[idx + 1] = sp.y;
                sparkBurstPositions[idx + 2] = sp.z;
                const fade = 1 - sp.life / sp.maxLife;
                _tempColor.setHSL(0.06, 1, 0.5 + fade * 0.5);
                sparkBurstColors[idx] = _tempColor.r;
                sparkBurstColors[idx + 1] = _tempColor.g;
                sparkBurstColors[idx + 2] = _tempColor.b;
            }
            sparkBurstGeo.setDrawRange(0, sparkBurstData.length * 2);
            sparkBurstGeo.attributes.position.needsUpdate = true;
            sparkBurstGeo.attributes.color.needsUpdate = true;

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

                emberPosArr[i * 3] = camera.position.x + _right.x * ed.xOffset + _forward.x * ed.zOffset;
                emberPosArr[i * 3 + 1] = camera.position.y + _up.y * ed.yOffset + _forward.y * ed.zOffset;
                emberPosArr[i * 3 + 2] = camera.position.z + _right.z * ed.xOffset + _forward.z * ed.zOffset;
            }
            embers.geometry.attributes.position.needsUpdate = true;

            // Update sawdust trails
            const sdPosArr = sawdust.geometry.attributes.position.array;
            let sdActiveCount = 0;
            for (let i = 0; i < SAWDUST_COUNT; i++) {
                const sd = sawdustData[i];
                const parent = lumberPieces[sd.parentIdx];

                if (parent && parent.userData.active && parent.userData.zOffset < 20 && parent.userData.zOffset > -5) {
                    if (!sd.active) {
                        sd.active = true;
                        sd.life = 0;
                    }
                    sd.life += dt;
                    if (sd.life < sd.maxLife) {
                        const trailZ = parent.userData.zOffset - sd.trailOffset;
                        const fade = 1 - sd.life / sd.maxLife;
                        sdPosArr[i * 3] = parent.position.x + _right.x * sd.spreadX * sd.trailOffset * 0.1 + _forward.x * trailZ;
                        sdPosArr[i * 3 + 1] = parent.position.y + _up.y * sd.spreadY * sd.trailOffset * 0.1 + _forward.y * trailZ;
                        sdPosArr[i * 3 + 2] = parent.position.z + _right.z * sd.spreadX * sd.trailOffset * 0.1 + _forward.z * trailZ;
                        _tempColor.setHSL(0.07, 0.5, 0.3 * fade);
                        sawdustColors[i * 3] = _tempColor.r;
                        sawdustColors[i * 3 + 1] = _tempColor.g;
                        sawdustColors[i * 3 + 2] = _tempColor.b;
                        sdActiveCount++;
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
            for (const plank of wallPlanks) {
                const pud = plank.userData;
                pud.uniforms.uTime.value = effectiveTime;
                pud.zOffset -= pud.speed * dt;

                if (pud.zOffset < -50) {
                    pud.zOffset = SPAWN_DISTANCE + hr(WALL_PLANK_COUNT * 10 + 300) * 20;
                }

                plank.position.x = camera.position.x + _right.x * (pud.side * (X_SPREAD + 5)) + _forward.x * pud.zOffset;
                plank.position.y = camera.position.y + pud.yLevel + _forward.y * pud.zOffset * 0.1;
                plank.position.z = camera.position.z + _right.z * (pud.side * (X_SPREAD + 5)) + _forward.z * pud.zOffset;

                if (activeParams) {
                    plank.userData.uniforms.uColorA.value.set(normalizeColor(activeParams.colorA));
                    plank.userData.uniforms.uColorB.value.set(normalizeColor(activeParams.colorB));
                }
            }

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

                mesh.rotation.x += ud.rotSpeed.x * dt;
                mesh.rotation.y += ud.rotSpeed.y * dt;
                mesh.rotation.z += ud.rotSpeed.z * dt;

                mesh.position.x = camera.position.x + _right.x * ud.xOffset + _forward.x * ud.zOffset;
                mesh.position.y = camera.position.y + ud.yOffset + _forward.y * ud.zOffset;
                mesh.position.z = camera.position.z + _right.z * ud.xOffset + _forward.z * ud.zOffset;
            }
        }
    };
}
