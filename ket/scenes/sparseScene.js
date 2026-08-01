import * as THREE from 'three';
import { normalizeColor, hashNumber, loadShader, minMaxRange } from '../modules/utils.js';

const FLOATER_COUNT = 50;
const RECYCLE_DIST_SQ = 600 * 600;
const SUPERNOVA_PARTICLE_COUNT = 300;
const SUPERNOVA_RING_COUNT = 5;
const SUPERNOVA_EPOCH = 1751190000000;
const SUPERNOVA_SEED = 42;
const MIN_DURATION = 2;
const MAX_DURATION = 45;
const SYNAPSE_MAX_DIST = 30;
const RAIN_COUNT = 500;
const AURORA_COUNT = 4;
const TRAIL_COUNT_PER_FLOATER = 3;
const FLOATING_RING_COUNT = 8;
const GRID_SIZE = 300;
const STAR_COUNT = 2000;
const STAR_FIELD_RADIUS = 400;
const WEIGHT = 1;
const _tempColor = new THREE.Color();
const _vec3 = new THREE.Vector3();

export async function createSparseScreen() {
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x020208);
    threeScene.fog = new THREE.FogExp2(0x020208, 0.004);

    // Starfield — distant particles on a sphere shell
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);
    const starData = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = STAR_FIELD_RADIUS + Math.random() * 100;
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);
        const brightness = 0.3 + Math.random() * 0.7;
        const tint = Math.random();
        if (tint < 0.15) {
            _tempColor.setHSL(0.6, 0.5, brightness);
        } else if (tint < 0.3) {
            _tempColor.setHSL(0.08, 0.6, brightness);
        } else {
            _tempColor.setHSL(0, 0, brightness);
        }
        starColors[i * 3] = _tempColor.r;
        starColors[i * 3 + 1] = _tempColor.g;
        starColors[i * 3 + 2] = _tempColor.b;
        starSizes[i] = 0.3 + Math.random() * 1.5;
        starData.push({
            twinkleSpeed: 0.5 + Math.random() * 3,
            twinklePhase: Math.random() * Math.PI * 2,
            baseSize: starSizes[i],
        });
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    const starMat = new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    threeScene.add(starfield);

    // Distant sun-like point light
    const sunLight = new THREE.DirectionalLight(0xaaccff, 0.6);
    sunLight.position.set(100, 80, -200);
    threeScene.add(sunLight);

    // Generate a radial glow texture for the sun sprite
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 128;
    sunCanvas.height = 128;
    const sunCtx = sunCanvas.getContext('2d');
    const sunGrad = sunCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    sunGrad.addColorStop(0, 'rgba(255,255,255,1)');
    sunGrad.addColorStop(0.1, 'rgba(200,220,255,0.8)');
    sunGrad.addColorStop(0.4, 'rgba(100,150,255,0.3)');
    sunGrad.addColorStop(1, 'rgba(0,0,50,0)');
    sunCtx.fillStyle = sunGrad;
    sunCtx.fillRect(0, 0, 128, 128);
    const sunTexture = new THREE.CanvasTexture(sunCanvas);

    // Sun lens flare proxy — bright sprite
    const sunSpriteMat = new THREE.SpriteMaterial({
        map: sunTexture,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const sunSprite = new THREE.Sprite(sunSpriteMat);
    sunSprite.position.copy(sunLight.position);
    sunSprite.scale.set(80, 80, 1);
    threeScene.add(sunSprite);

    // Small bright core sphere for the sun
    const sunCoreGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunCoreMat = new THREE.MeshBasicMaterial({
        color: 0xeeeeff,
    });
    const sunCore = new THREE.Mesh(sunCoreGeo, sunCoreMat);
    sunCore.position.copy(sunLight.position);
    threeScene.add(sunCore);

    // Secondary dim light from opposite side
    const dimLight = new THREE.DirectionalLight(0x331144, 0.2);
    dimLight.position.set(-80, -60, 150);
    threeScene.add(dimLight);

    // Dim nebula glow sprite for the secondary light
    const dimCanvas = document.createElement('canvas');
    dimCanvas.width = 128;
    dimCanvas.height = 128;
    const dimCtx = dimCanvas.getContext('2d');
    const dimGrad = dimCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    dimGrad.addColorStop(0, 'rgba(100,30,80,0.6)');
    dimGrad.addColorStop(0.5, 'rgba(50,10,60,0.2)');
    dimGrad.addColorStop(1, 'rgba(0,0,0,0)');
    dimCtx.fillStyle = dimGrad;
    dimCtx.fillRect(0, 0, 128, 128);
    const dimTexture = new THREE.CanvasTexture(dimCanvas);

    const dimSpriteMat = new THREE.SpriteMaterial({
        map: dimTexture,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const dimSprite = new THREE.Sprite(dimSpriteMat);
    dimSprite.position.copy(dimLight.position);
    dimSprite.scale.set(60, 60, 1);
    threeScene.add(dimSprite);

    // Load shader sources
    const floatVert = await loadShader('./shaders/sparse-float.vert');
    const floatFrag = await loadShader('./shaders/sparse-float.frag');
    const gridVert = await loadShader('./shaders/sparse-grid.vert');
    const gridFrag = await loadShader('./shaders/sparse-grid.frag');
    const auroraVert = await loadShader('./shaders/sparse-aurora.vert');
    const auroraFrag = await loadShader('./shaders/sparse-aurora.frag');

    // Shared shader material for floaters with vertex displacement
    const floaterMaterial = new THREE.ShaderMaterial({
        vertexShader: floatVert,
        fragmentShader: floatFrag,
        uniforms: {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color(0xff0055) },
            uColor2: { value: new THREE.Color(0x00ccff) },
            uMorph: { value: 0.4 },
            uPulse: { value: 0 },
        },
        transparent: true,
    });

    // Geometries with shader-based morphing
    const geometries = [];
    for (let i = 0; i < FLOATER_COUNT; i++) {
        const geo = new THREE.IcosahedronGeometry(
            0.5 + Math.random() * 2,
            2
        );
        const mat = floaterMaterial.clone();
        mat.uniforms.uColor1.value = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
        mat.uniforms.uColor2.value = new THREE.Color().setHSL(Math.random(), 0.9, 0.5);
        mat.uniforms.uMorph.value = 0.2 + Math.random() * 0.5;
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
            shockwaveOffset: 0,
            shockwaveColor: 0,
        };
        threeScene.add(mesh);
        geometries.push(mesh);
    }

    // Ghost trails for each floater
    const ghostTrails = [];
    for (let i = 0; i < FLOATER_COUNT; i++) {
        const trails = [];
        for (let j = 0; j < TRAIL_COUNT_PER_FLOATER; j++) {
            const geo = new THREE.IcosahedronGeometry(
                geometries[i].geometry.parameters.radius * (1 - (j + 1) * 0.2),
                1
            );
            const mat = new THREE.MeshBasicMaterial({
                color: geometries[i].material.uniforms.uColor1.value.clone(),
                transparent: true,
                opacity: 0,
                wireframe: true,
            });
            const ghost = new THREE.Mesh(geo, mat);
            ghost.visible = false;
            ghost.userData = {
                parentIdx: i,
                trailIdx: j,
                history: [],
            };
            threeScene.add(ghost);
            trails.push(ghost);
        }
        ghostTrails.push(trails);
    }

    // Synapse network lines
    const synapseMaxLines = FLOATER_COUNT * 3;
    const synapsePositions = new Float32Array(synapseMaxLines * 6);
    const synapseColors = new Float32Array(synapseMaxLines * 6);
    const synapseGeo = new THREE.BufferGeometry();
    synapseGeo.setAttribute('position', new THREE.BufferAttribute(synapsePositions, 3));
    synapseGeo.setAttribute('color', new THREE.BufferAttribute(synapseColors, 3));
    synapseGeo.setDrawRange(0, 0);
    const synapseMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const synapseLines = new THREE.LineSegments(synapseGeo, synapseMat);
    threeScene.add(synapseLines);

    // Aurora curtains
    const auroraGroup = new THREE.Group();
    const auroraPlanes = [];
    for (let i = 0; i < AURORA_COUNT; i++) {
        const auroraMat = new THREE.ShaderMaterial({
            vertexShader: auroraVert,
            fragmentShader: auroraFrag,
            uniforms: {
                uTime: { value: 0 },
                uColor1: { value: new THREE.Color().setHSL(0.5 + i * 0.1, 0.9, 0.5) },
                uColor2: { value: new THREE.Color().setHSL(0.7 + i * 0.1, 0.9, 0.5) },
                uWaveAmp: { value: 3 + Math.random() * 5 },
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const width = 60 + Math.random() * 40;
        const height = 15 + Math.random() * 10;
        const planeGeo = new THREE.PlaneGeometry(width, height, 32, 16);
        const plane = new THREE.Mesh(planeGeo, auroraMat);
        plane.position.set(
            (Math.random() - 0.5) * 80,
            20 + Math.random() * 20,
            -40 - Math.random() * 40
        );
        plane.rotation.y = (Math.random() - 0.5) * 1.5;
        plane.rotation.x = -0.2 - Math.random() * 0.3;
        plane.userData = {
            baseY: plane.position.y,
            swaySpeed: 0.1 + Math.random() * 0.2,
            swayPhase: Math.random() * Math.PI * 2,
            swayAmp: 2 + Math.random() * 3,
        };
        auroraGroup.add(plane);
        auroraPlanes.push(plane);
    }
    threeScene.add(auroraGroup);

    // Warp grid floor
    const gridMat = new THREE.ShaderMaterial({
        vertexShader: gridVert,
        fragmentShader: gridFrag,
        uniforms: {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color(0xff0055) },
            uColor2: { value: new THREE.Color(0x00ccff) },
            uWaveAmp: { value: 2 },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const gridGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, 80, 80);
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = -25;
    threeScene.add(gridMesh);

    // Particle rain
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(RAIN_COUNT * 3);
    const rainVelocities = new Float32Array(RAIN_COUNT);
    const rainPhases = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * 200;
        rainPositions[i * 3 + 1] = Math.random() * 80;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        rainVelocities[i] = 0.5 + Math.random() * 1.5;
        rainPhases[i] = Math.random() * Math.PI * 2;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
        color: 0x8888ff,
        size: 0.3,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
    });
    const rainParticles = new THREE.Points(rainGeo, rainMat);
    threeScene.add(rainParticles);

    // Floating rings
    const floatingRings = [];
    for (let i = 0; i < FLOATING_RING_COUNT; i++) {
        const ringGeo = new THREE.TorusGeometry(
            2 + Math.random() * 4,
            0.05 + Math.random() * 0.15,
            8,
            48
        );
        const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6),
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 80
        );
        ring.userData = {
            rotSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ),
            orbitRadius: 20 + Math.random() * 30,
            orbitAngle: Math.random() * Math.PI * 2,
            orbitSpeed: (0.1 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1),
            orbitYOffset: ring.position.y,
            bobSpeed: 0.2 + Math.random() * 0.8,
            bobPhase: Math.random() * Math.PI * 2,
            bobAmp: 1 + Math.random() * 2,
            pulsePhase: Math.random() * Math.PI * 2,
        };
        threeScene.add(ring);
        floatingRings.push(ring);
    }

    // Lighting
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

    const coreGeo = new THREE.SphereGeometry(3, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    supernovaGroup.add(core);

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

    const supernovaLight = new THREE.PointLight(0xff4400, 0, 300);
    supernovaLight.position.copy(supernovaGroup.position);
    threeScene.add(supernovaLight);

    // Ghost trail position history buffer
    const trailHistoryWindow = 6;

    return {
        id: 'sparse',
        name: 'Sparse Supernova',
        minDuration: MIN_DURATION,
        maxDuration: MAX_DURATION,
        weight: WEIGHT,
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
        starfield,
        starData,
        starMat,
        sunLight,
        sunSprite,
        sunSpriteMat,
        sunCore,
        dimLight,
        dimSprite,
        dimSpriteMat,
        floaterMaterial,
        ghostTrails,
        synapseLines,
        synapseGeo,
        auroraGroup,
        auroraPlanes,
        gridMesh,
        gridMat,
        rainParticles,
        rainVelocities,
        rainPhases,
        floatingRings,

        onEnter() { },

        onExit() { },

        onUpdate(camera, effectiveTime, dt, activeParams) {
            // Darkened space background — tinted subtly by colorA
            const baseBg = new THREE.Color(0x020208);
            if (activeParams && activeParams.colorA) {
                _tempColor.set(normalizeColor(activeParams.colorA));
                baseBg.lerp(_tempColor, 0.08);
            }
            threeScene.background = baseBg;
            const fogColor = activeParams && activeParams.colorB ? normalizeColor(activeParams.colorB) : '#020208';
            threeScene.fog.color.set(fogColor);
            threeScene.fog.near = 200;

            // Starfield twinkle
            const starSizeArr = starGeo.attributes.size.array;
            for (let i = 0; i < STAR_COUNT; i++) {
                const sd = starData[i];
                const twinkle = Math.sin(effectiveTime * sd.twinkleSpeed + sd.twinklePhase) * 0.5 + 0.5;
                starSizeArr[i] = sd.baseSize * (0.5 + twinkle * 0.5);
            }
            starGeo.attributes.size.needsUpdate = true;
            starfield.position.copy(camera.position);

            // Sun follows camera at fixed offset
            sunLight.position.set(
                camera.position.x + 100,
                camera.position.y + 80,
                camera.position.z - 200
            );
            sunSprite.position.copy(sunLight.position);
            sunCore.position.copy(sunLight.position);
            const sunPulse = Math.sin(effectiveTime * 0.4) * 0.5 + 0.5;
            sunSpriteMat.opacity = 0.4 + sunPulse * 0.3;
            sunSprite.scale.setScalar(70 + sunPulse * 20);
            sunCore.scale.setScalar(0.8 + sunPulse * 0.4);
            dimLight.position.set(
                camera.position.x - 80,
                camera.position.y - 60,
                camera.position.z + 150
            );
            dimSprite.position.copy(dimLight.position);

            const h1 = (effectiveTime * 0.1) % 1;
            const h2 = (effectiveTime * 0.1 + 0.5) % 1;
            light1.color.setHSL(h1, 0.9, 0.5);
            light2.color.setHSL(h2, 0.9, 0.5);

            light1.position.x = Math.sin(effectiveTime * 0.5) * 20;
            light1.position.z = Math.cos(effectiveTime * 0.5) * 20;
            light2.position.x = Math.cos(effectiveTime * 0.3) * 20;
            light2.position.z = Math.sin(effectiveTime * 0.3) * 20;

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

            supernovaLight.intensity = intensity * 15 * buildUp;
            supernovaLight.color.setHSL(0.06 + pulse * 0.04, 1, 0.5);
            supernovaGroup.position.x = camera.position.x;
            supernovaGroup.position.y = camera.position.y - 8;
            supernovaGroup.position.z = camera.position.z - supernovaDist;
            supernovaLight.position.copy(supernovaGroup.position);

            // Shockwave ripple value for floaters
            const shockwavePulse = Math.max(0, Math.sin(t * 1.2) * intensity);

            // Update floaters with shader uniforms
            for (const mesh of geometries) {
                const ud = mesh.userData;

                mesh.rotation.x += ud.rotSpeed.x * dt;
                mesh.rotation.y += ud.rotSpeed.y * dt;
                mesh.rotation.z += ud.rotSpeed.z * dt;

                ud.orbitAngle += ud.orbitSpeed * dt;

                mesh.position.x = camera.position.x + Math.cos(ud.orbitAngle) * ud.orbitRadius;
                mesh.position.z = camera.position.z + Math.sin(ud.orbitAngle) * ud.orbitRadius;
                mesh.position.y = camera.position.y + ud.orbitYOffset + Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;

                // Shockwave ripple effect on floaters
                ud.shockwaveOffset *= 0.95;
                if (shockwavePulse > 0.3) {
                    const distToSupernova = mesh.position.distanceTo(supernovaGroup.position);
                    const waveDelay = distToSupernova * 0.02;
                    const waveHit = Math.max(0, Math.sin(t * 1.2 - waveDelay));
                    ud.shockwaveOffset = waveHit * shockwavePulse * 2;
                    ud.shockwaveColor = waveHit * shockwavePulse;
                }
                mesh.position.y += ud.shockwaveOffset;

                // Update shader uniforms
                mesh.material.uniforms.uTime.value = effectiveTime;
                mesh.material.uniforms.uPulse.value = ud.shockwaveColor;

                // Shift colors during shockwave
                if (ud.shockwaveColor > 0.1) {
                    _tempColor.setHSL(0.06 + pulse * 0.04, 1, 0.5 + ud.shockwaveColor * 0.5);
                    mesh.material.uniforms.uColor1.value.lerp(_tempColor, 0.1);
                }
            }

            // Ghost trails
            for (let i = 0; i < FLOATER_COUNT; i++) {
                const parent = geometries[i];
                if (!parent.userData._posHistory) parent.userData._posHistory = [];

                parent.userData._posHistory.unshift(parent.position.clone());
                if (parent.userData._posHistory.length > trailHistoryWindow) {
                    parent.userData._posHistory.pop();
                }

                for (let j = 0; j < TRAIL_COUNT_PER_FLOATER; j++) {
                    const ghost = ghostTrails[i][j];
                    const historyIdx = (j + 1) * 2;
                    if (historyIdx < parent.userData._posHistory.length) {
                        ghost.position.copy(parent.userData._posHistory[historyIdx]);
                        ghost.visible = true;
                        ghost.material.opacity = 0.15 * (1 - j / TRAIL_COUNT_PER_FLOATER);
                        ghost.rotation.copy(parent.rotation);
                        const scaleFade = 1 - (j + 1) * 0.2;
                        ghost.scale.setScalar(scaleFade);
                    } else {
                        ghost.visible = false;
                    }
                }
            }

            // Synapse network lines
            let lineCount = 0;
            const synapsePulse = Math.sin(effectiveTime * 2) * 0.5 + 0.5;
            for (let i = 0; i < geometries.length && lineCount < synapseMaxLines; i++) {
                for (let j = i + 1; j < geometries.length && lineCount < synapseMaxLines; j++) {
                    const dx = geometries[i].position.x - geometries[j].position.x;
                    const dy = geometries[i].position.y - geometries[j].position.y;
                    const dz = geometries[i].position.z - geometries[j].position.z;
                    const distSq = dx * dx + dy * dy + dz * dz;
                    if (distSq < SYNAPSE_MAX_DIST * SYNAPSE_MAX_DIST) {
                        const idx = lineCount * 6;
                        synapsePositions[idx] = geometries[i].position.x;
                        synapsePositions[idx + 1] = geometries[i].position.y;
                        synapsePositions[idx + 2] = geometries[i].position.z;
                        synapsePositions[idx + 3] = geometries[j].position.x;
                        synapsePositions[idx + 4] = geometries[j].position.y;
                        synapsePositions[idx + 5] = geometries[j].position.z;

                        const fade = 1 - Math.sqrt(distSq) / SYNAPSE_MAX_DIST;
                        const firePulse = Math.sin(effectiveTime * 5 + i * 0.5 + j * 0.3) * 0.5 + 0.5;
                        const brightness = fade * (0.3 + firePulse * 0.7);

                        _tempColor.setHSL(h1, 0.9, brightness);
                        synapseColors[idx] = _tempColor.r;
                        synapseColors[idx + 1] = _tempColor.g;
                        synapseColors[idx + 2] = _tempColor.b;
                        _tempColor.setHSL(h2, 0.9, brightness);
                        synapseColors[idx + 3] = _tempColor.r;
                        synapseColors[idx + 4] = _tempColor.g;
                        synapseColors[idx + 5] = _tempColor.b;

                        lineCount++;
                    }
                }
            }
            synapseGeo.setDrawRange(0, lineCount * 2);
            synapseGeo.attributes.position.needsUpdate = true;
            synapseGeo.attributes.color.needsUpdate = true;
            synapseMat.opacity = 0.3 + synapsePulse * 0.4;

            // Aurora curtains
            auroraPlanes.forEach((plane, i) => {
                plane.material.uniforms.uTime.value = effectiveTime;
                plane.position.y = plane.userData.baseY + Math.sin(effectiveTime * plane.userData.swaySpeed + plane.userData.swayPhase) * plane.userData.swayAmp;
                plane.rotation.z = Math.sin(effectiveTime * 0.15 + i) * 0.1;
            });
            auroraGroup.position.x = camera.position.x;
            auroraGroup.position.z = camera.position.z;

            // Warp grid floor
            gridMat.uniforms.uTime.value = effectiveTime;
            _tempColor.set(normalizeColor(activeParams && activeParams.colorA ? activeParams.colorA : '#ff0055'));
            gridMat.uniforms.uColor1.value.copy(_tempColor);
            _tempColor.set(normalizeColor(activeParams && activeParams.colorB ? activeParams.colorB : '#00ccff'));
            gridMat.uniforms.uColor2.value.copy(_tempColor);
            gridMat.needsUpdate = true;
            gridMesh.position.x = camera.position.x;
            gridMesh.position.y = camera.position.y - 25;
            gridMesh.position.z = camera.position.z;

            // Particle rain
            const rainPosArr = rainParticles.geometry.attributes.position.array;
            for (let i = 0; i < RAIN_COUNT; i++) {
                rainPosArr[i * 3 + 1] -= rainVelocities[i] * dt * 10;
                rainPosArr[i * 3] += Math.sin(effectiveTime + rainPhases[i]) * dt * 0.5;

                if (rainPosArr[i * 3 + 1] < -30) {
                    rainPosArr[i * 3 + 1] = 50 + Math.random() * 30;
                    rainPosArr[i * 3] = camera.position.x + (Math.random() - 0.5) * 200;
                    rainPosArr[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * 200;
                }
            }
            rainParticles.geometry.attributes.position.needsUpdate = true;
            rainMat.color.setHSL(h1 + 0.3, 0.6, 0.5 + synapsePulse * 0.2);

            // Floating rings
            floatingRings.forEach((ring) => {
                const ud = ring.userData;
                ring.rotation.x += ud.rotSpeed.x * dt;
                ring.rotation.y += ud.rotSpeed.y * dt;
                ring.rotation.z += ud.rotSpeed.z * dt;

                ud.orbitAngle += ud.orbitSpeed * dt;
                ring.position.x = camera.position.x + Math.cos(ud.orbitAngle) * ud.orbitRadius;
                ring.position.z = camera.position.z + Math.sin(ud.orbitAngle) * ud.orbitRadius;
                ring.position.y = camera.position.y + ud.orbitYOffset + Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;

                const ringPulse = Math.sin(effectiveTime * 1.5 + ud.pulsePhase) * 0.5 + 0.5;
                ring.material.opacity = 0.2 + ringPulse * 0.5;
                ring.material.color.setHSL(
                    (h1 + ringPulse * 0.2) % 1,
                    0.9,
                    0.4 + ringPulse * 0.3
                );
                ring.scale.setScalar(0.8 + ringPulse * 0.4);
            });
        }
    };
}
