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
const PARTICLE_COUNT = 600;
const PARTICLE_SPAWN_Z = 90;
const PARTICLE_PASS_Z = 12;
const useParticles = false;

function hr(n) {
    return hashNumber(LUMBER_SEED + n);
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

export async function createLumberScene() {
    const vsSource = await loadShader('./shaders/wood.vert');
    const fsSource = await loadShader('./shaders/wood.frag');

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x000000);
    threeScene.fog = new THREE.FogExp2(0x000000, 0.012);

    const lumberPieces = [];

    for (let i = 0; i < POOL_SIZE; i++) {
        const length = 12 + hr(i * 16) * 14;
        const width = 1.5 + hr(i * 16 + 1) * 1.0;
        const depth = 2.0 + hr(i * 16 + 2) * 1.5;

        const geo = new THREE.BoxGeometry(width, depth, length, 2, 2, 8);

        const uniforms = {
            uTime: { value: 0 },
            uColorA: { value: new THREE.Color().setHSL(hr(i * 16 + 3), 0.3, 0.2) },
            uColorB: { value: new THREE.Color().setHSL(hr(i * 16 + 4), 0.25, 0.12) },
            uGrainIntensity: { value: 0.8 + hr(i * 16 + 5) * 0.6 },
            uKnotIntensity: { value: 0.3 + hr(i * 16 + 6) * 0.5 },
        };

        const mat = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: vsSource,
            fragmentShader: fsSource,
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
        };

        threeScene.add(mesh);
        lumberPieces.push(mesh);
    }
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);
    const particleSizes = new Float32Array(PARTICLE_COUNT);
    const particleData = [];
    if (useParticles) {
        // Flying particles


        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const gray = 0.3 + hr(PARTICLE_COUNT * 16 + i * 8) * 0.5;
            particlePositions[i * 3] = 0;
            particlePositions[i * 3 + 1] = 0;
            particlePositions[i * 3 + 2] = 0;
            particleColors[i * 3] = gray;
            particleColors[i * 3 + 1] = gray;
            particleColors[i * 3 + 2] = gray;
            particleSizes[i] = 0.3 + hr(PARTICLE_COUNT * 16 + i * 8 + 4) * 1.2;
            particleData.push({
                xOffset: (hr(PARTICLE_COUNT * 16 + i * 8 + 1) - 0.5) * 2 * X_SPREAD * 1.5,
                yOffset: (hr(PARTICLE_COUNT * 16 + i * 8 + 2) - 0.5) * 2 * Y_SPREAD * 1.5,
                zOffset: PARTICLE_PASS_Z + (i / PARTICLE_COUNT) * (PARTICLE_SPAWN_Z - PARTICLE_PASS_Z),
                speed: 15 + hr(PARTICLE_COUNT * 16 + i * 8 + 5) * 35,
                elongated: hr(PARTICLE_COUNT * 16 + i * 8 + 6) > 0.6,
                elongationFactor: 2 + hr(PARTICLE_COUNT * 16 + i * 8 + 7) * 5,
                baseSize: 0.3 + hr(PARTICLE_COUNT * 16 + i * 8 + 4) * 1.2,
                recycleCount: 0,
            });
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

        const particleMat = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            depthWrite: false,
        });

        const particles = new THREE.Points(particleGeo, particleMat);
        particles.visible = false;
        threeScene.add(particles);
    }


    const light1 = new THREE.PointLight(0xff6633, 1.5, 200);
    light1.position.set(0, 10, 0);
    threeScene.add(light1);

    const light2 = new THREE.PointLight(0x33ccff, 1.5, 200);
    light2.position.set(0, -10, 0);
    threeScene.add(light2);

    const ambientLight = new THREE.AmbientLight(0x222222);
    threeScene.add(ambientLight);

    let spawnIndex = 0;

    return {
        id: 'lumber',
        name: 'Lumber',
        threeScene,
        defaultDuration: 45,
        geometries: lumberPieces,
        //particles: particles || null,
        //particleData: particleData || null,
        light1,
        light2,

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
            if (useParticles) {
                for (let i = 0; i < PARTICLE_COUNT; i++) {
                    const pd = particleData[i];
                    pd.xOffset = (hr(PARTICLE_COUNT * 16 + i * 8 + 1) - 0.5) * 2 * X_SPREAD * 1.5;
                    pd.yOffset = (hr(PARTICLE_COUNT * 16 + i * 8 + 2) - 0.5) * 2 * Y_SPREAD * 1.5;
                    pd.zOffset = PARTICLE_PASS_Z + (i / PARTICLE_COUNT) * (PARTICLE_SPAWN_Z - PARTICLE_PASS_Z);
                    pd.recycleCount = 0;
                }
            }

        },

        onExit() { },

        onUpdate(camera, effectiveTime, dt, activeParams) {
            //const bgColor = activeParams && activeParams.colorA ? normalizeColor(activeParams.colorA) : '#1a0a00';
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

                //const bobY = Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;

                mesh.position.x = camera.position.x + _right.x * ud.xOffset + _forward.x * ud.zOffset;
                mesh.position.y = camera.position.y + _up.y * ud.yOffset + _forward.y * ud.zOffset; //+ bobY;
                mesh.position.z = camera.position.z + _right.z * ud.xOffset + _forward.z * ud.zOffset;

                mesh.lookAt(
                    mesh.position.x + _forward.x,
                    mesh.position.y + _forward.y,
                    mesh.position.z + _forward.z
                );
            }

            // Update particles
            if (useParticles) {
                const posArr = particles.geometry.attributes.position.array;
                const sizeArr = particles.geometry.attributes.size.array;
                for (let i = 0; i < PARTICLE_COUNT; i++) {
                    const pd = particleData[i];
                    const idx3 = i * 3;

                    pd.zOffset += pd.speed * dt;

                    if (pd.zOffset > PARTICLE_SPAWN_Z) {
                        pd.zOffset = PARTICLE_PASS_Z + hr(PARTICLE_COUNT * 16 + i * 8 + 50 + pd.recycleCount) * 3;
                        pd.xOffset = (hr(PARTICLE_COUNT * 16 + i * 8 + 51 + pd.recycleCount) - 0.5) * 2 * X_SPREAD * 1.5;
                        pd.yOffset = (hr(PARTICLE_COUNT * 16 + i * 8 + 52 + pd.recycleCount) - 0.5) * 2 * Y_SPREAD * 1.5;
                        pd.recycleCount++;
                    }

                    posArr[idx3] = camera.position.x + _right.x * pd.xOffset + _forward.x * pd.zOffset;
                    posArr[idx3 + 1] = camera.position.y + _up.y * pd.yOffset + _forward.y * pd.zOffset;
                    posArr[idx3 + 2] = camera.position.z + _right.z * pd.xOffset + _forward.z * pd.zOffset;

                    if (pd.elongated) {
                        sizeArr[i] = pd.baseSize * pd.elongationFactor;
                    } else {
                        sizeArr[i] = pd.baseSize;
                    }
                }
                particles.geometry.attributes.position.needsUpdate = true;
                particles.geometry.attributes.size.needsUpdate = true;
                particles.visible = true;
            }

        }
    };
}
