import * as THREE from 'three';
import { normalizeColor, loadShader } from '../modules/utils.js';

const POOL_SIZE = 160;
const SPAWN_DISTANCE = 80;
const PASS_DISTANCE = 15;
const X_SPREAD = 35;
const Y_SPREAD = 22;
const BASE_SPEED = 4;
const SPEED_VARIANCE = 3;

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
        const length = 12 + Math.random() * 14;
        const width = 1.5 + Math.random() * 1.0;
        const depth = 2.0 + Math.random() * 1.5;

        const geo = new THREE.BoxGeometry(width, depth, length, 2, 2, 8);

        const uniforms = {
            uTime: { value: 0 },
            uColorA: { value: new THREE.Color().setHSL(Math.random(), 0.7, 0.35) },
            uColorB: { value: new THREE.Color().setHSL(Math.random(), 0.6, 0.2) },
            uGrainIntensity: { value: 0.8 + Math.random() * 0.6 },
            uKnotIntensity: { value: 0.3 + Math.random() * 0.5 },
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
            xOffset: (Math.random() - 0.5) * 2 * X_SPREAD,
            yOffset: (Math.random() - 0.5) * 2 * Y_SPREAD,
            zOffset: SPAWN_DISTANCE,
            speed: BASE_SPEED + Math.random() * SPEED_VARIANCE,
            rotSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ),
            bobSpeed: 0.3 + Math.random() * 0.8,
            bobPhase: Math.random() * Math.PI * 2,
            bobAmp: 0.5 + Math.random() * 1.5,
            uniforms,
        };

        threeScene.add(mesh);
        lumberPieces.push(mesh);
    }

    const light1 = new THREE.PointLight(0xff6633, 4, 200);
    light1.position.set(0, 10, 0);
    threeScene.add(light1);

    const light2 = new THREE.PointLight(0x33ccff, 4, 200);
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
            for (const mesh of lumberPieces) {
                const ud = mesh.userData;
                ud.active = true;
                ud.xOffset = (Math.random() - 0.5) * 2 * X_SPREAD;
                ud.yOffset = (Math.random() - 0.5) * 2 * Y_SPREAD;
                ud.zOffset = 5 + Math.random() * (SPAWN_DISTANCE - 5);
                mesh.visible = true;
            }
            spawnIndex = POOL_SIZE;
        },

        onExit() { },

        onUpdate(camera, effectiveTime, dt, activeParams) {
            const bgColor = activeParams && activeParams.colorA ? normalizeColor(activeParams.colorA) : '#1a0a00';
            threeScene.background = new THREE.Color(bgColor);
            const fogColor = activeParams && activeParams.colorB ? normalizeColor(activeParams.colorB) : '#1a0a00';
            threeScene.fog.color.set(fogColor);

            const h1 = (effectiveTime * 0.08) % 1;
            const h2 = (effectiveTime * 0.08 + 0.4) % 1;
            light1.color.setHSL(h1, 0.85, 0.5);
            light2.color.setHSL(h2, 0.85, 0.5);

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
                        ud.zOffset = SPAWN_DISTANCE + Math.random() * 20;
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
                    ud.zOffset = SPAWN_DISTANCE + Math.random() * 15;
                    ud.xOffset = (Math.random() - 0.5) * 2 * X_SPREAD;
                    ud.yOffset = (Math.random() - 0.5) * 2 * Y_SPREAD;
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
