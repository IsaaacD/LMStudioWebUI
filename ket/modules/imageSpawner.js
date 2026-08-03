import * as THREE from 'three';
import { hashNumber, hashRange, minMaxRange } from './utils.js';

const IMAGE_POOL_SIZE = 15;
const MIN_LIFETIME = 3;
const RECYCLE_DIST_SQ = 500 * 500;
const SPAWN_INTERVAL_MIN = 2;
const SPAWN_INTERVAL_MAX = 6;
const SPAWN_RADIUS_MIN = 8;
const SPAWN_RADIUS_MAX = 30;
const HEIGHT_SPREAD = 15;

export class ImageSpawner {
    constructor(scene, imagePath) {
        this.scene = scene;
        this.imagePath = imagePath;
        this.pool = [];
        this.nextFree = 0;
        this.nextSpawnTime = minMaxRange(2, 4);
        this.spawnInterval = minMaxRange(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
        this.spawnCounter = 0;
        this.loaded = false;

        const loader = new THREE.TextureLoader();
        loader.load(imagePath, (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            this._initPool(texture);
            this.loaded = true;
        });
    }

    _initPool(texture) {
        const aspect = texture.image ? texture.image.width / texture.image.height : 1;
        const baseHeight = 4;
        const baseWidth = baseHeight * aspect;

        const geometry = new THREE.PlaneGeometry(baseWidth, baseHeight);

        for (let i = 0; i < IMAGE_POOL_SIZE; i++) {
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                color: new THREE.Color(0.5, 0.5, 0.5),
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            mesh.userData = {
                rotSpeed: new THREE.Vector3(
                    (hashNumber(i * 3 + 2) - 0.5) * 1.5,
                    (hashNumber(i * 3 + 3) - 0.5) * 1.5,
                    (hashNumber(i * 3 + 4) - 0.5) * 1.5
                ),
                initialRotation: new THREE.Euler(
                    hashNumber(i * 6 + 5) * Math.PI * 2,
                    hashNumber(i * 6 + 6) * Math.PI * 2,
                    hashNumber(i * 6 + 7) * Math.PI * 2
                ),
                baseY: 0,
                spawnTime: 0
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

    setScene(newScene) {
        for (const mesh of this.pool) {
            this.scene.remove(mesh);
            newScene.add(mesh);
        }
        this.scene = newScene;
    }

    reset() {
        for (const mesh of this.pool) {
            mesh.visible = false;
        }
        this.nextFree = 0;
        this.nextSpawnTime = minMaxRange(2, 4);
        this.spawnCounter = 0;
    }

    update(camera, effectiveTime, dt) {
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
                const angle = hashNumber(seed * 3 + 10) * Math.PI * 2;
                const radius = hashRange(seed * 3 + 11, SPAWN_RADIUS_MIN, SPAWN_RADIUS_MAX);
                const heightOffset = (hashNumber(seed * 3 + 12) - 0.5) * HEIGHT_SPREAD;

                m.position.x = camX + Math.cos(angle) * radius;
                m.position.y = camY + heightOffset;
                m.position.z = camZ + Math.sin(angle) * radius;
                m.userData.baseY = m.position.y;
                m.userData.spawnTime = effectiveTime;

                m.rotation.copy(m.userData.initialRotation);
                m.visible = true;

                this.spawnCounter++;
            }

            this.nextSpawnTime = this.spawnInterval;
            this.spawnInterval = hashRange(this.spawnCounter + 100, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
        }

        for (const m of this.pool) {
            if (!m.visible) continue;

            const clampedDt = Math.min(dt, 0.1);
            const rs = m.userData.rotSpeed;

            m.rotation.x += rs.x * clampedDt;
            m.rotation.y += rs.y * clampedDt;
            m.rotation.z += rs.z * clampedDt;

            m.rotation.x = Math.max(-Math.PI, Math.min(Math.PI, m.rotation.x));
            m.rotation.y = Math.max(-Math.PI, Math.min(Math.PI, m.rotation.y));
            m.rotation.z = Math.max(-Math.PI, Math.min(Math.PI, m.rotation.z));
        }
    }
}
