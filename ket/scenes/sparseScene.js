import * as THREE from 'three';
import { normalizeColor, hashNumber } from '../modules/utils.js';

const FLOATER_COUNT = 50;
const RECYCLE_DIST_SQ = 600 * 600;
const SUPERNOVA_PARTICLE_COUNT = 300;
const SUPERNOVA_RING_COUNT = 5;
const SUPERNOVA_EPOCH = 1751190000000;
const SUPERNOVA_SEED = 42;
const MIN_DURATION = 2;
const MAX_DURATION = 10;

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

    // Supernova on the horizon
    const supernovaGroup = new THREE.Group();
    const supernovaDist = 120;
    supernovaGroup.position.set(0, -5, -supernovaDist);
    threeScene.add(supernovaGroup);

    // Core - bright pulsing sphere
    const coreGeo = new THREE.SphereGeometry(3, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    supernovaGroup.add(core);

    // Inner glow layers
    const glowColors = [0xff4400, 0xff8800, 0xffcc00, 0xffffff];
    const glowLayers = [];
    glowColors.forEach((col, i) => {
        const r = 5 + i * 4;
        const g = new THREE.SphereGeometry(r, 16, 16);
        const m = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.15 - i * 0.02,
            side: THREE.BackSide,
        });
        const mesh = new THREE.Mesh(g, m);
        supernovaGroup.add(mesh);
        glowLayers.push(mesh);
    });

    // Shockwave rings
    const rings = [];
    for (let i = 0; i < SUPERNOVA_RING_COUNT; i++) {
        const ringGeo = new THREE.TorusGeometry(8 + i * 3, 0.15, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.userData = {
            phase: (i / SUPERNOVA_RING_COUNT) * Math.PI * 2,
            maxRadius: 25 + i * 5,
            baseRadius: 8 + i * 3,
        };
        supernovaGroup.add(ring);
        rings.push(ring);
    }

    // Ejection particles
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(SUPERNOVA_PARTICLE_COUNT * 3);
    const particleSizes = new Float32Array(SUPERNOVA_PARTICLE_COUNT);
    const particleData = [];
    for (let i = 0; i < SUPERNOVA_PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 0.5 + Math.random() * 2;
        particlePositions[i * 3] = 0;
        particlePositions[i * 3 + 1] = 0;
        particlePositions[i * 3 + 2] = 0;
        particleSizes[i] = 0.5 + Math.random() * 2;
        particleData.push({ theta, phi, speed, phase: Math.random() * Math.PI * 2 });
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const particleMat = new THREE.PointsMaterial({
        color: 0xff8844,
        size: 1.5,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    supernovaGroup.add(particles);

    // Supernova light
    const supernovaLight = new THREE.PointLight(0xff4400, 0, 300);
    supernovaLight.position.copy(supernovaGroup.position);
    threeScene.add(supernovaLight);

    return {
        id: 'sparse',
        name: 'Sparse Supernova',
        minDuration: MIN_DURATION,
        maxDuration: MAX_DURATION,
        threeScene,
        defaultDuration: 10,
        geometries,
        light1,
        light2,
        supernovaGroup,
        core,
        coreMat,
        glowLayers,
        rings,
        particles,
        particleData,
        supernovaLight,

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

            // Supernova animation — synced across all instances via wall clock + hash
            const t = (Date.now() - SUPERNOVA_EPOCH) / 1000;
            const h = (idx) => hashNumber(SUPERNOVA_SEED + idx);
            const pulse = Math.sin(t * 3 + h(1) * Math.PI * 2) * 0.5 + 0.5;
            const buildUp = Math.min(1, t * 0.05);
            const jitter = Math.sin(t * 47 + h(2) * Math.PI * 2) * Math.sin(t * 83 + h(3) * Math.PI * 2) * 0.1;
            const intensity = (pulse * 0.6 + 0.4 + jitter) * buildUp;

            core.scale.setScalar(0.8 + intensity * 0.8);
            coreMat.opacity = 0.7 + intensity * 0.3;
            coreMat.color.setHSL(0.06 + pulse * 0.04, 1, 0.5 + intensity * 0.5);

            glowLayers.forEach((layer, i) => {
                const s = 1 + Math.sin(t * (2 + i) + h(10 + i) * Math.PI * 2) * 0.3 * intensity;
                layer.scale.setScalar(s);
                layer.material.opacity = (0.1 + intensity * 0.15) * (1 - i * 0.15);
            });

            rings.forEach((ring, i) => {
                const p = (Math.sin(t * 1.5 + h(20 + i) * Math.PI * 2) * 0.5 + 0.5);
                ring.scale.setScalar(1 + p * 2);
                ring.material.opacity = (1 - p) * 0.6 * buildUp;
                ring.material.color.setHSL(0.08 - p * 0.05, 1, 0.5 + p * 0.3);
            });

            // Ejection particles
            const posArr = particles.geometry.attributes.position.array;
            for (let i = 0; i < SUPERNOVA_PARTICLE_COUNT; i++) {
                const pd = particleData[i];
                const cycle = (t * pd.speed * 0.3 + h(100 + i) * Math.PI * 2) % (Math.PI * 2);
                const dist = (cycle / (Math.PI * 2)) * 40 * buildUp;
                posArr[i * 3] = Math.sin(pd.phi) * Math.cos(pd.theta) * dist;
                posArr[i * 3 + 1] = Math.sin(pd.phi) * Math.sin(pd.theta) * dist;
                posArr[i * 3 + 2] = Math.cos(pd.phi) * dist;
            }
            particles.geometry.attributes.position.needsUpdate = true;
            particleMat.opacity = 0.5 * buildUp;
            particleMat.color.setHSL(0.07 + pulse * 0.03, 1, 0.4 + intensity * 0.4);

            // Supernova light
            supernovaLight.intensity = intensity * 15 * buildUp;
            supernovaLight.color.setHSL(0.06 + pulse * 0.04, 1, 0.5);
            supernovaGroup.position.x = camera.position.x;
            supernovaGroup.position.y = camera.position.y - 8;
            supernovaGroup.position.z = camera.position.z - supernovaDist;
            supernovaLight.position.copy(supernovaGroup.position);
        }
    };
}
