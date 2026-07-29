import * as THREE from 'three';
import { loadShader } from './utils.js';

const HEART_POOL_SIZE = 40;
const MIN_LIFETIME = 3;
const RECYCLE_DIST_SQ = 500 * 500;
const SPAWN_INTERVAL_MIN = 2;
const SPAWN_INTERVAL_MAX = 6;
const SPAWN_RADIUS_MIN = 8;
const SPAWN_RADIUS_MAX = 30;
const HEIGHT_SPREAD = 15;
const CIRCLE_RADIUS = 2.0;
const CIRCLE_SEGMENTS = 48;

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
        this.nextSpawnTime = 0;
        this.spawnInterval = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
        this.loaded = true;

        const geometry = new THREE.CircleGeometry(CIRCLE_RADIUS, CIRCLE_SEGMENTS);
        this._initPool(geometry);
    }

    _initPool(geometry) {
        for (let i = 0; i < HEART_POOL_SIZE; i++) {
            const material = this.heartMaterial.clone();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            mesh.userData = {
                baseY: 0,
                spawnTime: 0,
                alphaBase: 0.4 + Math.random() * 0.5,
                colorPhase: Math.random() * Math.PI * 2
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
                const angle = Math.random() * Math.PI * 2;
                const radius = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
                const heightOffset = (Math.random() - 0.5) * HEIGHT_SPREAD;

                m.position.x = camX + Math.cos(angle) * radius;
                m.position.y = camY + heightOffset;
                m.position.z = camZ + Math.sin(angle) * radius;
                m.userData.baseY = m.position.y;
                m.userData.spawnTime = effectiveTime;

                m.visible = true;
            }

            this.nextSpawnTime = this.spawnInterval;
            this.spawnInterval = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
        }

        for (const m of this.pool) {
            if (!m.visible) continue;

            const ud = m.userData;

            m.material.uniforms.uTime.value = effectiveTime;
            m.material.uniforms.uAlpha.value = ud.alphaBase * (0.5 + 0.5 * Math.sin(effectiveTime * 0.8 + ud.colorPhase));

            const t = 0.5 + 0.5 * Math.sin(effectiveTime * 0.3 + ud.colorPhase);
            const mixedColor = new THREE.Color().lerpColors(
                new THREE.Color(colorA),
                new THREE.Color(colorB),
                t
            );
            m.material.uniforms.uColor.value.copy(mixedColor);
            m.material.needsUpdate = true;

            m.lookAt(camera.position);

            const pulse = 1.0 + 0.15 * Math.sin(effectiveTime * 2.0 + ud.colorPhase);
            m.scale.setScalar(pulse);
        }
    }
}
