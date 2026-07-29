import * as THREE from 'three';

const PRIMITIVE_COUNT = 200;
const PRIMITIVES_PER_GRID_CELL = 0.35;
const SUBDIVISIONS = 2;
const RETENTION_DIST_SQ = 400 * 400;
const RECYCLE_DIST_SQ = 500 * 500;
const MIN_LIFETIME = 2;
const WARMUP_FRAMES = 30;

function key(ax, ay, az) { return `${ax},${ay},${az}`; }

function cellHash(x, y, z) {
    let h = x * 374761393 + y * 668265263 + z * 1274126177;
    h = (h ^ (h >> 13)) * 1103515245;
    return (h ^ (h >> 16)) & 0x7fffffff;
}

export class PrimitiveManager {
    constructor(scene, primitiveMaterial, TILE_SIZE, TILE_HEIGHT, RECYCLE_DIST, RENDER_DIST) {
        this.TILE_SIZE = TILE_SIZE;
        this.TILE_HEIGHT = TILE_HEIGHT;
        this.primitiveKeys = new Set();
        this.subSizeX = TILE_SIZE / SUBDIVISIONS;
        this.subSizeY = TILE_HEIGHT / SUBDIVISIONS;
        this.spawnRadiusCells = Math.max(4, Math.ceil(RENDER_DIST / (TILE_SIZE / SUBDIVISIONS)));

        const primitiveGeos = [
            new THREE.BoxGeometry(2, 2, 2, 8, 8, 8),
            new THREE.SphereGeometry(1.5, 16, 16),
            new THREE.CylinderGeometry(1.2, 1.2, 3, 16, 8)
        ];

        this.primitivePool = [];
        this.nextFree = 0;
        this.warmupFrame = 0;
        for (let i = 0; i < PRIMITIVE_COUNT; i++) {
            const geoIdx = Math.floor(Math.random() * primitiveGeos.length);
            const mat = primitiveMaterial.clone();
            const mesh = new THREE.Mesh(primitiveGeos[geoIdx], mat);
            mesh.visible = false;
            mesh.userData = {
                alphaBase: 0.3 + Math.random() * 0.6,
                alphaSpeed: 0.5 + Math.random() * 2,
                alphaPhase: Math.random() * Math.PI * 2,
                waveAmp: 0.2 + Math.random() * 0.5,
                rotSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ),
                scaleBase: 0.5 + Math.random() * 1.5,
                bobSpeed: 0.3 + Math.random() * 1,
                bobPhase: Math.random() * Math.PI * 2,
                bobAmp: 0.5 + Math.random() * 2
            };
            scene.add(mesh);
            this.primitivePool.push(mesh);
        }
    }

    _findFree() {
        const pool = this.primitivePool;
        const len = pool.length;
        for (let attempts = 0; attempts < len; attempts++) {
            if (!pool[this.nextFree].visible) {
                const free = pool[this.nextFree];
                this.nextFree = (this.nextFree + 1) % len;
                return free;
            }
            this.nextFree = (this.nextFree + 1) % len;
        }
        return null;
    }

    update(camera, effectiveTime, dt, colorA, colorB) {
        const camX = camera.position.x;
        const camY = camera.position.y;
        const camZ = camera.position.z;
        const pCx = Math.floor(camX / this.subSizeX);
        const pCz = Math.floor(camZ / this.subSizeX);
        const pCy = Math.floor(camY / this.subSizeY);
        const pHalf = this.spawnRadiusCells;

        this.warmupFrame++;
        const warmup = Math.min(1, this.warmupFrame / WARMUP_FRAMES);

        for (let i = 0; i < this.primitivePool.length; i++) {
            const p = this.primitivePool[i];
            if (p.visible) {
                const age = effectiveTime - (p.userData.spawnTime || 0);
                if (age < MIN_LIFETIME) continue;
                const dx = p.position.x - camX;
                const dy = p.position.y - camY;
                const dz = p.position.z - camZ;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > RECYCLE_DIST_SQ) {
                    p.visible = false;
                    this.primitiveKeys.delete(key(p._gx, p._gy, p._gz));
                } else if (distSq < RETENTION_DIST_SQ) {
                    p.userData.lastSeenTime = effectiveTime;
                }
            }
        }

        const maxSpawnDistSq = RECYCLE_DIST_SQ * warmup * warmup;
        const candidates = [];
        for (let gy = pCy - pHalf; gy <= pCy + pHalf; gy++) {
            for (let gx = pCx - pHalf; gx <= pCx + pHalf; gx++) {
                for (let gz = pCz - pHalf; gz <= pCz + pHalf; gz++) {
                    const wx = gx * this.subSizeX;
                    const wy = gy * this.subSizeY;
                    const wz = gz * this.subSizeX;
                    const dx = wx - camX;
                    const dy = wy - camY;
                    const dz = wz - camZ;
                    const distSq = dx * dx + dy * dy + dz * dz;
                    if (distSq <= maxSpawnDistSq) {
                        candidates.push({ gx, gy, gz, distSq });
                    }
                }
            }
        }
        candidates.sort((a, b) => a.distSq - b.distSq);

        for (const c of candidates) {
            const hash = cellHash(c.gx, c.gy, c.gz);
            if ((hash % 100) / 100 > PRIMITIVES_PER_GRID_CELL) continue;
            const k = key(c.gx, c.gy, c.gz);
            if (this.primitiveKeys.has(k)) continue;
            const p = this._findFree();
            if (!p) break;
            const offsetX = ((hash >> 8) % 1000) / 1000;
            const offsetZ = ((hash >> 16) % 1000) / 1000;
            const offsetY = ((hash >> 24) % 1000) / 1000;
            p.position.x = c.gx * this.subSizeX + (offsetX - 0.5) * this.subSizeX * 0.6;
            p.position.z = c.gz * this.subSizeX + (offsetZ - 0.5) * this.subSizeX * 0.6;
            p.position.y = c.gy * this.subSizeY + this.subSizeY * 0.3 + offsetY * this.subSizeY * 0.4;
            p._gx = c.gx;
            p._gz = c.gz;
            p._gy = c.gy;
            p.visible = true;
            p.scale.setScalar(p.userData.scaleBase);
            p.userData.spawnTime = effectiveTime;
            this.primitiveKeys.add(k);
        }

        for (const p of this.primitivePool) {
            if (!p.visible) continue;
            const ud = p.userData;
            const alpha = ud.alphaBase * (0.5 + 0.5 * Math.sin(effectiveTime * ud.alphaSpeed + ud.alphaPhase));
            p.material.uniforms.uTime.value = effectiveTime;
            p.material.uniforms.uAlpha.value = alpha;
            p.material.uniforms.uWaveAmp.value = ud.waveAmp;
            p.material.uniforms.uColor1.value.set(colorA);
            p.material.uniforms.uColor2.value.set(colorB);
            p.material.uniforms.uCameraPos.value.copy(camera.position);
            p.material.needsUpdate = true;

            const clampedDt = Math.min(dt, 0.1);
            p.rotation.x += ud.rotSpeed.x * clampedDt * 0.5;
            p.rotation.y += ud.rotSpeed.y * clampedDt * 0.5;
            p.rotation.z += ud.rotSpeed.z * clampedDt * 0.5;

            p.rotation.x = Math.max(-Math.PI, Math.min(Math.PI, p.rotation.x));
            p.rotation.y = Math.max(-Math.PI, Math.min(Math.PI, p.rotation.y));
            p.rotation.z = Math.max(-Math.PI, Math.min(Math.PI, p.rotation.z));

            const bobOffset = Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;
            p.position.y = p._gy * this.subSizeY + this.subSizeY * 0.3 + bobOffset;
        }
    }
}