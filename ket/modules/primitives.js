import * as THREE from 'three';

const PRIMITIVE_COUNT = 1500;
const PRIMITIVES_PER_GRID_CELL = 0.7;

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
        this.RECYCLE_DIST = RECYCLE_DIST;
        this.RENDER_DIST = RENDER_DIST;
        this.primitiveKeys = new Set();

        const primitiveGeos = [
            new THREE.BoxGeometry(2, 2, 2, 8, 8, 8),
            new THREE.SphereGeometry(1.5, 16, 16),
            new THREE.CylinderGeometry(1.2, 1.2, 3, 16, 8)
        ];

        this.primitivePool = [];
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

    update(camera, effectiveTime, dt, colorA, colorB) {
        const pCx = Math.floor(camera.position.x / this.TILE_SIZE);
        const pCz = Math.floor(camera.position.z / this.TILE_SIZE);
        const pCy = Math.floor(camera.position.y / this.TILE_HEIGHT);
        const pHalf = Math.ceil(this.RENDER_DIST / this.TILE_SIZE);

        for (let i = 0; i < this.primitivePool.length; i++) {
            const p = this.primitivePool[i];
            if (p.visible) {
                const dx = Math.abs(p.position.x - camera.position.x);
                const dz = Math.abs(p.position.z - camera.position.z);
                const dy = Math.abs(p.position.y - camera.position.y);
                if (dx > this.RECYCLE_DIST || dz > this.RECYCLE_DIST || dy > this.RECYCLE_DIST) {
                    p.visible = false;
                    this.primitiveKeys.delete(key(p._gx, p._gy, p._gz));
                }
            }
        }

        for (let gy = pCy - 2; gy <= pCy + 2; gy++) {
            for (let gx = pCx - pHalf; gx <= pCx + pHalf; gx++) {
                for (let gz = pCz - pHalf; gz <= pCz + pHalf; gz++) {
                    const hash = cellHash(gx, gy, gz);
                    if ((hash % 100) / 100 > PRIMITIVES_PER_GRID_CELL) continue;
                    const k = key(gx, gy, gz);
                    if (this.primitiveKeys.has(k)) continue;
                    const availIdx = this.primitivePool.findIndex(p => !p.visible);
                    if (availIdx === -1) continue;
                    const p = this.primitivePool[availIdx];
                    const offsetX = ((hash >> 8) % 1000) / 1000;
                    const offsetZ = ((hash >> 16) % 1000) / 1000;
                    const offsetY = ((hash >> 24) % 1000) / 1000;
                    p.position.x = gx * this.TILE_SIZE + (offsetX - 0.5) * this.TILE_SIZE * 0.6;
                    p.position.z = gz * this.TILE_SIZE + (offsetZ - 0.5) * this.TILE_SIZE * 0.6;
                    p.position.y = gy * this.TILE_HEIGHT + this.TILE_HEIGHT * 0.3 + offsetY * this.TILE_HEIGHT * 0.4;
                    p._gx = gx;
                    p._gz = gz;
                    p._gy = gy;
                    p.visible = true;
                    p.scale.setScalar(p.userData.scaleBase);
                    this.primitiveKeys.add(k);
                }
            }
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

            p.rotation.x += ud.rotSpeed.x * dt * 0.5;
            p.rotation.y += ud.rotSpeed.y * dt * 0.5;
            p.rotation.z += ud.rotSpeed.z * dt * 0.5;

            const bobOffset = Math.sin(effectiveTime * ud.bobSpeed + ud.bobPhase) * ud.bobAmp;
            p.position.y = p._gy * this.TILE_HEIGHT + this.TILE_HEIGHT * 0.3 + bobOffset;
        }
    }
}
