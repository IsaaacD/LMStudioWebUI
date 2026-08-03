import * as THREE from 'three';
import { normalizeColor, hashNumber, loadShader } from '../modules/utils.js';

const FLOATER_COUNT = 50;
const SUPERNOVA_PARTICLE_COUNT = 300;
const SUPERNOVA_RING_COUNT = 5;
const SUPERNOVA_EPOCH = 1751190000000;
const SUPERNOVA_SEED = 42;
const MIN_DURATION = 2;
const MAX_DURATION = 30;
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
const _tempColor2 = new THREE.Color();
const _dummy = new THREE.Object3D();

export async function createSparseScreen() {
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x020208);
    threeScene.fog = new THREE.FogExp2(0x020208, 0.002);

    // Starfield
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
        starSizes[i] = 0.5 + Math.random() * 2.5;
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
        size: 2.0,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    threeScene.add(starfield);

    // Sun
    const sunLight = new THREE.DirectionalLight(0xaaccff, 0.6);
    sunLight.position.set(100, 80, -200);
    threeScene.add(sunLight);

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

    const sunCoreGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunCoreMat = new THREE.MeshBasicMaterial({
        color: 0xeeeeff,
    });
    const sunCore = new THREE.Mesh(sunCoreGeo, sunCoreMat);
    sunCore.position.copy(sunLight.position);
    threeScene.add(sunCore);

    // Dim light
    const dimLight = new THREE.DirectionalLight(0x331144, 0.2);
    dimLight.position.set(-80, -60, 150);
    threeScene.add(dimLight);

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

    // Load shaders
    const floatVert = await loadShader('./shaders/sparse-float.vert');
    const floatFrag = await loadShader('./shaders/sparse-float.frag');
    const gridVert = await loadShader('./shaders/sparse-grid.vert');
    const gridFrag = await loadShader('./shaders/sparse-grid.frag');
    const auroraVert = await loadShader('./shaders/sparse-aurora.vert');
    const auroraFrag = await loadShader('./shaders/sparse-aurora.frag');

    // Shared material for ALL floaters — glowing glass spheres
    const floaterMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    // Instanced floaters — 1 draw call instead of 50
    const floaterGeometry = new THREE.IcosahedronGeometry(1, 2);
    const instancedFloaters = new THREE.InstancedMesh(floaterGeometry, floaterMaterial, FLOATER_COUNT);
    const floaterData = [];

    for (let i = 0; i < FLOATER_COUNT; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 60;
        const z = (Math.random() - 0.5) * 100;
        _dummy.position.set(x, y, z);
        const scale = 0.5 + Math.random() * 2;
        _dummy.scale.setScalar(scale);
        _dummy.updateMatrix();
        instancedFloaters.setMatrixAt(i, _dummy.matrix);
        instancedFloaters.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.8, 0.5));

        floaterData.push({
            rx: 0, ry: 0, rz: 0,
            rxs: (Math.random() - 0.5) * 2,
            rys: (Math.random() - 0.5) * 2,
            rzs: (Math.random() - 0.5) * 2,
            scale,
            colorT: Math.random(),
            bobSpeed: 0.3 + Math.random() * 1.5,
            bobPhase: Math.random() * Math.PI * 2,
            bobAmp: 1 + Math.random() * 3,
            orbitRadius: 15 + Math.random() * 35,
            orbitAngle: Math.atan2(z, x),
            orbitSpeed: (0.2 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1),
            orbitYOffset: y,
            shockwaveOffset: 0,
            shockwaveColor: 0,
            history: [],
        });
    }
    instancedFloaters.instanceMatrix.needsUpdate = true;
    instancedFloaters.instanceColor.needsUpdate = true;
    instancedFloaters.frustumCulled = false;
    threeScene.add(instancedFloaters);

    // Ghost trails — single Points system instead of 150 Mesh objects
    const totalTrails = FLOATER_COUNT * TRAIL_COUNT_PER_FLOATER;
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(totalTrails * 3);
    const trailSizes = new Float32Array(totalTrails);
    const trailOpacities = new Float32Array(totalTrails);
    for (let i = 0; i < totalTrails; i++) {
        trailSizes[i] = 1.5;
        trailOpacities[i] = 0;
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
    trailGeo.setAttribute('aOpacity', new THREE.BufferAttribute(trailOpacities, 1));

    const trailVert = `
        attribute float aOpacity;
        attribute float size;
        varying float vOpacity;
        void main() {
            vOpacity = aOpacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `;
    const trailFrag = `
        varying float vOpacity;
        void main() {
            if (vOpacity < 0.01) discard;
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float alpha = smoothstep(0.5, 0.1, d) * vOpacity;
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
    `;
    const trailMat = new THREE.ShaderMaterial({
        vertexShader: trailVert,
        fragmentShader: trailFrag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const trailPoints = new THREE.Points(trailGeo, trailMat);
    threeScene.add(trailPoints);

    // Synapse network — Points scattered along line segments for thick soft glow
    const synapseMaxLines = FLOATER_COUNT * 3;
    const synapsePointsPerLine = 10;
    const synapseMaxPoints = synapseMaxLines * synapsePointsPerLine;
    const synapsePositions = new Float32Array(synapseMaxPoints * 3);
    const synapseColors = new Float32Array(synapseMaxPoints * 3);
    const synapseGeo = new THREE.BufferGeometry();
    synapseGeo.setAttribute('position', new THREE.BufferAttribute(synapsePositions, 3));
    synapseGeo.setAttribute('color', new THREE.BufferAttribute(synapseColors, 3));
    synapseGeo.setDrawRange(0, 0);
    const synapseMat = new THREE.ShaderMaterial({
        vertexShader: `
            attribute vec3 color;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = 1.5 * (200.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                if (d > 0.5) discard;
                gl_FragColor = vec4(vColor, 0.2);
            }
        `,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
    });
    const synapseLines = new THREE.Points(synapseGeo, synapseMat);
    synapseLines.frustumCulled = false;
    synapseLines.renderOrder = -1;
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

    // Warp grid floor — reduced from 80x80 to 40x40 (6400 -> 1600 tris)
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
    const gridGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, 40, 40);
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
            rx: 0, ry: 0, rz: 0,
            rxs: (Math.random() - 0.5) * 2,
            rys: (Math.random() - 0.5) * 2,
            rzs: (Math.random() - 0.5) * 2,
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

    // Supernova
    const supernovaGroup = new THREE.Group();
    const supernovaDist = 120;
    supernovaGroup.position.set(0, -5, -supernovaDist);
    threeScene.add(supernovaGroup);

    const coreGeo = new THREE.SphereGeometry(5, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        fog: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    supernovaGroup.add(core);

    const glowColors = [0xff4400, 0xff8800, 0xffcc00, 0xffffff];
    const glowLayers = [];
    glowColors.forEach((col, i) => {
        const r = 8 + i * 5;
        const g = new THREE.SphereGeometry(r, 16, 16);
        const m = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.25 - i * 0.03,
            side: THREE.BackSide,
            fog: false,
        });
        const mesh = new THREE.Mesh(g, m);
        supernovaGroup.add(mesh);
        glowLayers.push(mesh);
    });

    const rings = [];
    for (let i = 0; i < SUPERNOVA_RING_COUNT; i++) {
        const ringGeo = new THREE.TorusGeometry(8 + i * 3, 0.2, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0,
            fog: false,
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
        size: 3,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    supernovaGroup.add(particles);

    const supernovaLight = new THREE.PointLight(0xff4400, 0, 300);
    supernovaLight.position.copy(supernovaGroup.position);
    threeScene.add(supernovaLight);

    // Reusable temp objects to avoid GC
    const _fpos = new THREE.Vector3();
    const _frot = new THREE.Quaternion();
    const _trailBaseColor = new THREE.Color();

    // Closure-scoped state for onUpdate (can't reference the method by name)
    const floaterAnchor = new THREE.Vector3();
    let lastColorA = '';
    let lastColorB = '';

    return {
        id: 'sparse',
        name: 'Supernova',
        minDuration: MIN_DURATION,
        maxDuration: MAX_DURATION,
        weight: WEIGHT,
        threeScene,
        defaultDuration: 10,
        instancedFloaters,
        floaterData,
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
        trailPoints,
        trailGeo,
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
            // Background tint
            _tempColor2.set(0x020208);
            if (activeParams && activeParams.colorA) {
                _tempColor.set(normalizeColor(activeParams.colorA));
                _tempColor2.lerp(_tempColor, 0.08);
            }
            threeScene.background = _tempColor2;
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

            // Sun follows camera
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

            // Supernova animation
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
                layer.material.opacity = (0.2 + intensity * 0.25) * (1 - i * 0.15);
            });

            rings.forEach((ring, i) => {
                const p = (Math.sin(t * 1.5 + h(20 + i) * Math.PI * 2) * 0.5 + 0.5);
                ring.scale.setScalar(1 + p * 2);
                ring.material.opacity = (1 - p) * 0.9 * buildUp;
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
            particleMat.opacity = 0.7 * buildUp;
            particleMat.color.setHSL(0.07 + pulse * 0.03, 1, 0.5 + intensity * 0.5);

            supernovaLight.intensity = intensity * 15 * buildUp;
            supernovaLight.color.setHSL(0.06 + pulse * 0.04, 1, 0.5);
            supernovaGroup.position.x = camera.position.x;
            supernovaGroup.position.y = camera.position.y - 8;
            supernovaGroup.position.z = camera.position.z - supernovaDist;
            supernovaLight.position.copy(supernovaGroup.position);

            const shockwavePulse = Math.max(0, Math.sin(t * 1.2) * intensity);

            // --- Update floaters (InstancedMesh, no GC allocations) ---
            if (floaterAnchor.lengthSq() === 0) floaterAnchor.copy(camera.position);
            floaterAnchor.lerp(camera.position, Math.min(1, dt * 2.5));
            const cx = floaterAnchor.x;
            const cy = floaterAnchor.y;
            const cz = floaterAnchor.z;
            const snx = supernovaGroup.position.x;
            const sny = supernovaGroup.position.y;
            const snz = supernovaGroup.position.z;

            const cA = activeParams && activeParams.colorA ? normalizeColor(activeParams.colorA) : '#ff0055';
            const cB = activeParams && activeParams.colorB ? normalizeColor(activeParams.colorB) : '#00ccff';
            _trailBaseColor.set(cB);

            for (let i = 0; i < FLOATER_COUNT; i++) {
                const ud = floaterData[i];

                ud.rx += ud.rxs * dt;
                ud.ry += ud.rys * dt;
                ud.rz += ud.rzs * dt;

                ud.orbitAngle += ud.orbitSpeed * dt;

                _fpos.x = cx + Math.cos(ud.orbitAngle) * ud.orbitRadius;
                _fpos.z = cz + Math.sin(ud.orbitAngle) * ud.orbitRadius;
                _fpos.y = cy + ud.orbitYOffset + Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;

                // Shockwave without distanceTo() allocation
                ud.shockwaveOffset *= 0.95;
                if (shockwavePulse > 0.3) {
                    const sx = _fpos.x - snx;
                    const sy = _fpos.y - sny;
                    const sz = _fpos.z - snz;
                    const distToSupernova = Math.sqrt(sx * sx + sy * sy + sz * sz);
                    const waveDelay = distToSupernova * 0.02;
                    const waveHit = Math.max(0, Math.sin(t * 1.2 - waveDelay));
                    ud.shockwaveOffset = waveHit * shockwavePulse * 2;
                    ud.shockwaveColor = waveHit * shockwavePulse;
                }
                _fpos.y += ud.shockwaveOffset;

                _dummy.position.copy(_fpos);
                _dummy.rotation.set(ud.rx, ud.ry, ud.rz);
                _dummy.scale.setScalar(ud.scale);
                _dummy.updateMatrix();
                instancedFloaters.setMatrixAt(i, _dummy.matrix);

                // Blend colorA -> colorB per instance
                _tempColor.set(cA);
                _tempColor.lerp(_trailBaseColor, ud.colorT);
                instancedFloaters.setColorAt(i, _tempColor);

                // Position history — plain objects, no Vector3.clone()
                if (!ud.history) ud.history = [];
                ud.history.unshift({ x: _fpos.x, y: _fpos.y, z: _fpos.z });
                if (ud.history.length > 6) ud.history.pop();
            }
            instancedFloaters.instanceMatrix.needsUpdate = true;
            instancedFloaters.instanceColor.needsUpdate = true;

            // Update material emissive to blend colorA + colorB
            _tempColor2.set(cA);
            _tempColor2.lerp(_trailBaseColor, 0.5);
            floaterMaterial.emissive.copy(_tempColor2);

            // --- Ghost trails via Points (1 draw call, no GC) ---
            const tPosArr = trailGeo.attributes.position.array;
            const tOpArr = trailGeo.attributes.aOpacity.array;
            for (let i = 0; i < FLOATER_COUNT; i++) {
                const ud = floaterData[i];
                for (let j = 0; j < TRAIL_COUNT_PER_FLOATER; j++) {
                    const ti = i * TRAIL_COUNT_PER_FLOATER + j;
                    const historyIdx = (j + 1) * 2;
                    if (ud.history && historyIdx < ud.history.length) {
                        const hp = ud.history[historyIdx];
                        tPosArr[ti * 3] = hp.x;
                        tPosArr[ti * 3 + 1] = hp.y;
                        tPosArr[ti * 3 + 2] = hp.z;
                        tOpArr[ti] = 0.15 * (1 - j / TRAIL_COUNT_PER_FLOATER);
                    } else {
                        tOpArr[ti] = 0;
                    }
                }
            }
            trailGeo.attributes.position.needsUpdate = true;
            trailGeo.attributes.aOpacity.needsUpdate = true;

            // --- Synapse network ---
            let lineCount = 0;
            let pointCount = 0;
            const maxDistSq = SYNAPSE_MAX_DIST * SYNAPSE_MAX_DIST;

            for (let i = 0; i < FLOATER_COUNT && lineCount < synapseMaxLines; i++) {
                const udi = floaterData[i];
                if (!udi.history) continue;
                const px = udi.history[0]?.x;
                const py = udi.history[0]?.y;
                const pz = udi.history[0]?.z;
                if (px == null) continue;

                for (let j = i + 1; j < FLOATER_COUNT && lineCount < synapseMaxLines; j++) {
                    const udj = floaterData[j];
                    if (!udj.history) continue;
                    const jx = udj.history[0].x;
                    const jy = udj.history[0].y;
                    const jz = udj.history[0].z;

                    const dx = px - jx, dy = py - jy, dz = pz - jz;
                    if (dx * dx + dy * dy + dz * dz < maxDistSq) {
                        for (let k = 0; k < synapsePointsPerLine; k++) {
                            const t = k / (synapsePointsPerLine - 1);
                            const pidx = pointCount * 3;
                            synapsePositions[pidx] = px + (jx - px) * t;
                            synapsePositions[pidx + 1] = py + (jy - py) * t;
                            synapsePositions[pidx + 2] = pz + (jz - pz) * t;
                            synapseColors[pidx] = 1;
                            synapseColors[pidx + 1] = 1;
                            synapseColors[pidx + 2] = 1;
                            pointCount++;
                        }
                        lineCount++;
                    }
                }
            }
            synapseGeo.setDrawRange(0, pointCount);
            synapseGeo.attributes.position.needsUpdate = true;
            synapseGeo.attributes.color.needsUpdate = true;
            const synapsePulse = Math.sin(effectiveTime * 2) * 0.5 + 0.5;

            // Aurora curtains
            auroraPlanes.forEach((plane, i) => {
                plane.material.uniforms.uTime.value = effectiveTime;
                plane.position.y = plane.userData.baseY + Math.sin(effectiveTime * plane.userData.swaySpeed + plane.userData.swayPhase) * plane.userData.swayAmp;
                plane.rotation.z = Math.sin(effectiveTime * 0.15 + i) * 0.1;
            });
            auroraGroup.position.x = camera.position.x;
            auroraGroup.position.z = camera.position.z;

            // Warp grid floor — cached color normalization
            gridMat.uniforms.uTime.value = effectiveTime;
            const ca = activeParams && activeParams.colorA ? activeParams.colorA : '#ff0055';
            const cb = activeParams && activeParams.colorB ? activeParams.colorB : '#00ccff';
            if (lastColorA !== ca) {
                _tempColor.set(normalizeColor(ca));
                gridMat.uniforms.uColor1.value.copy(_tempColor);
                lastColorA = ca;
            }
            if (lastColorB !== cb) {
                _tempColor.set(normalizeColor(cb));
                gridMat.uniforms.uColor2.value.copy(_tempColor);
                lastColorB = cb;
            }
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
                    rainPosArr[i * 3] = cx + (Math.random() - 0.5) * 200;
                    rainPosArr[i * 3 + 2] = cz + (Math.random() - 0.5) * 200;
                }
            }
            rainParticles.geometry.attributes.position.needsUpdate = true;
            rainMat.color.setHSL(h1 + 0.3, 0.6, 0.5 + synapsePulse * 0.02);

            // Floating rings
            floatingRings.forEach((ring) => {
                const ud = ring.userData;
                ud.rx += ud.rxs * dt;
                ud.ry += ud.rys * dt;
                ud.rz += ud.rzs * dt;

                ud.orbitAngle += ud.orbitSpeed * dt;
                ring.position.x = cx + Math.cos(ud.orbitAngle) * ud.orbitRadius;
                ring.position.z = cz + Math.sin(ud.orbitAngle) * ud.orbitRadius;
                ring.position.y = cy + ud.orbitYOffset + Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;

                ring.rotation.x = ud.rx;
                ring.rotation.y = ud.ry;
                ring.rotation.z = ud.rz;

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