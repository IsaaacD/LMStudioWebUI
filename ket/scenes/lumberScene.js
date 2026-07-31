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
        }
    };
}
