import * as THREE from 'three';
import { normalizeColor } from '../modules/utils.js';

const FLOATER_COUNT = 50;
const RECYCLE_DIST_SQ = 600 * 600;

export async function createSparseScreen() {
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x000000);
    threeScene.fog = new THREE.FogExp2(0x000000, 0.02);

    const geometries = [];
    for (let i = 0; i < FLOATER_COUNT; i++) {
        const geo = new THREE.IcosahedronGeometry(
            0.5 + Math.random() * 2,
            1
        );
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
            roughness: 0.3,
            metalness: 0.6,
            emissive: new THREE.Color().setHSL(Math.random(), 0.9, 0.15),
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * 100
        );
        const orbitRadius = 15 + Math.random() * 35;
        mesh.userData = {
            rotSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ),
            bobSpeed: 0.3 + Math.random() * 1.5,
            bobPhase: Math.random() * Math.PI * 2,
            bobAmp: 1 + Math.random() * 3,
            baseY: mesh.position.y,
            orbitRadius,
            orbitAngle: Math.atan2(mesh.position.z, mesh.position.x),
            orbitSpeed: (0.2 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1),
            orbitYOffset: mesh.position.y,
        };
        threeScene.add(mesh);
        geometries.push(mesh);
    }

    const light1 = new THREE.PointLight(0xff0055, 3, 200);
    light1.position.set(0, 10, 0);
    threeScene.add(light1);

    const light2 = new THREE.PointLight(0x00ccff, 3, 200);
    light2.position.set(0, -10, 0);
    threeScene.add(light2);

    const ambientLight = new THREE.AmbientLight(0x222222);
    threeScene.add(ambientLight);

    return {
        id: 'test',
        name: 'Test',
        threeScene,
        defaultDuration: 10,
        geometries,
        light1,
        light2,

        onEnter() { },

        onExit() { },

        onUpdate(camera, effectiveTime, dt, activeParams) {
            const bgColor = activeParams && activeParams.colorA ? normalizeColor(activeParams.colorA) : '#000000';
            threeScene.background = new THREE.Color(bgColor);
            const fogColor = activeParams && activeParams.colorB ? normalizeColor(activeParams.colorB) : '#000000';
            threeScene.fog.color.set(fogColor);

            const h1 = (effectiveTime * 0.1) % 1;
            const h2 = (effectiveTime * 0.1 + 0.5) % 1;
            light1.color.setHSL(h1, 0.9, 0.5);
            light2.color.setHSL(h2, 0.9, 0.5);

            light1.position.x = Math.sin(effectiveTime * 0.5) * 20;
            light1.position.z = Math.cos(effectiveTime * 0.5) * 20;
            light2.position.x = Math.cos(effectiveTime * 0.3) * 20;
            light2.position.z = Math.sin(effectiveTime * 0.3) * 20;

            for (const mesh of geometries) {
                const ud = mesh.userData;

                mesh.rotation.x += ud.rotSpeed.x * dt;
                mesh.rotation.y += ud.rotSpeed.y * dt;
                mesh.rotation.z += ud.rotSpeed.z * dt;

                ud.orbitAngle += ud.orbitSpeed * dt;

                mesh.position.x = camera.position.x + Math.cos(ud.orbitAngle) * ud.orbitRadius;
                mesh.position.z = camera.position.z + Math.sin(ud.orbitAngle) * ud.orbitRadius;
                mesh.position.y = camera.position.y + ud.orbitYOffset + Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;
            }
        }
    };
}
