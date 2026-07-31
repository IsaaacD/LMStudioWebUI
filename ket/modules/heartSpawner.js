import * as THREE from 'three';
import { loadShader, normalizeColor, hashNumber, hashRange, minMaxRange } from './utils.js';

const HEART_POOL_SIZE = 25;
const MIN_LIFETIME = 3;
const RECYCLE_DIST_SQ = 500 * 500;
const SPAWN_INTERVAL_MIN = 2;
const SPAWN_INTERVAL_MAX = 6;
const SPAWN_RADIUS_MIN = 8;
const SPAWN_RADIUS_MAX = 30;
const HEIGHT_SPREAD = 15;
const CIRCLE_RADIUS = 2.0;
const CIRCLE_SEGMENTS = 48;

const _tempColor = new THREE.Color();

export async function createHeartMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(1.0, 1.0) },
            uColor: { value: new THREE.Color(1.0, 0.2, 0.4) },
            uAlpha: { value: 1.0 }
        },
        color: new THREE.Color(0.65, 0.65, 0.65),
        vertexShader: await loadShader('./shaders/heart.vert'),
        fragmentShader: await loadShader('./shaders/heart.frag'),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
}

export class HeartSpawner {
    constructor(scene, heartMaterial) {
        this.scene = scene;
        this.heartMaterial = heartMaterial;
        this.pool = [];
        this.nextFree = 0;
        this.nextSpawnTime = minMaxRange(1, 3);
        this.spawnInterval = minMaxRange(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
        this.spawnCounter = 0;
        this.loaded = true;

        const geometry = new THREE.CircleGeometry(CIRCLE_RADIUS, CIRCLE_SEGMENTS);
        this._initPool(geometry);
    }

    _initPool(geometry) {
        for (let i = 0; i < HEART_POOL_SIZE; i++) {
            const mesh = new THREE.Mesh(geometry, this.heartMaterial);
            mesh.visible = false;
            mesh.userData = {
                baseY: 0,
                spawnTime: 0,
                alphaBase: 0.4 + hashNumber(i * 2 + 20) * 0.5,
                colorPhase: hashNumber(i * 2 + 21) * Math.PI * 2
            };

            this.scene.add(mesh);
            this.pool.push(mesh);
        }
    }

    _findFree() {
        const len = this.pool.length;
        for (let attempts = 0; attempts < len; attempts++) {
            if (!this.pool[this.nextFree].visible) {
                const free = this.pool[this.nextFree];
                this.nextFree = (this.nextFree + 1) % len;
                return free;
            }
            this.nextFree = (this.nextFree + 1) % len;
        }
        return null;
    }

    update(camera, effectiveTime, dt, colorA, colorB) {
        if (!this.loaded) return;

        const camX = camera.position.x;
        const camY = camera.position.y;
        const camZ = camera.position.z;

        for (let i = 0; i < this.pool.length; i++) {
            const m = this.pool[i];
            if (!m.visible) continue;

            const age = effectiveTime - m.userData.spawnTime;
            if (age < MIN_LIFETIME) continue;

            const dx = m.position.x - camX;
            const dy = m.position.y - camY;
            const dz = m.position.z - camZ;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq > RECYCLE_DIST_SQ) {
                m.visible = false;
            }
        }

        this.nextSpawnTime -= dt;
        if (this.nextSpawnTime <= 0) {
            const m = this._findFree();
            if (m) {
                const seed = this.spawnCounter;
                const angle = hashNumber(seed * 3 + 30) * Math.PI * 2;
                const radius = hashRange(seed * 3 + 31, SPAWN_RADIUS_MIN, SPAWN_RADIUS_MAX);
                const heightOffset = (hashNumber(seed * 3 + 32) - 0.5) * HEIGHT_SPREAD;

                m.position.x = camX + Math.cos(angle) * radius;
                m.position.y = camY + heightOffset;
                m.position.z = camZ + Math.sin(angle) * radius;
                m.userData.baseY = m.position.y;
                m.userData.spawnTime = effectiveTime;

                m.visible = true;

                this.spawnCounter++;
            }

            this.nextSpawnTime = this.spawnInterval;
            this.spawnInterval = hashRange(this.spawnCounter + 200, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
        }

        let maxAlpha = 0;
        let dominantPhase = 0;
        for (const m of this.pool) {
            if (!m.visible) continue;

            const ud = m.userData;

            m.lookAt(camera.position);

            const pulse = 1.0 + 0.15 * Math.sin(effectiveTime * 2.0 + ud.colorPhase);
            m.scale.setScalar(pulse);

            const alpha = ud.alphaBase * (0.5 + 0.5 * Math.sin(effectiveTime * 0.8 + ud.colorPhase));
            if (alpha > maxAlpha) {
                maxAlpha = alpha;
                dominantPhase = ud.colorPhase;
            }
        }

        if (maxAlpha > 0) {
            this.heartMaterial.uniforms.uTime.value = effectiveTime;
            this.heartMaterial.uniforms.uAlpha.value = maxAlpha;

            const t = 0.5 + 0.5 * Math.sin(effectiveTime * 0.3 + dominantPhase);
            _tempColor.lerpColors(
                new THREE.Color(normalizeColor(colorA, 'heartSpawner:147')),
                new THREE.Color(normalizeColor(colorB, 'heartSpawner:148')),
                t
            );
            this.heartMaterial.uniforms.uColor.value.copy(_tempColor);
            this.heartMaterial.needsUpdate = true;
        }
    }
}
