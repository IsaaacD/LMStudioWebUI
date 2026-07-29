import * as THREE from 'three';

const TILE_SIZE = 200;
const TILE_SEGMENTS = 128;
const RENDER_DIST = 140;
const RECYCLE_DIST = 200;
const GRID = Math.ceil(RENDER_DIST / TILE_SIZE) * 2 + 1;
const MAX_TILES = GRID * GRID;
const TILE_HEIGHT = 25;

const WALL_STRIP_LEN = RENDER_DIST * 2.5;
const WALLS_PER_POOL = 600;

export function getTileConstants() {
    return { TILE_SIZE, TILE_SEGMENTS, RENDER_DIST, RECYCLE_DIST, GRID, MAX_TILES, TILE_HEIGHT, WALL_STRIP_LEN, WALLS_PER_POOL };
}

function key(ax, ay, az) { return `${ax},${ay},${az}`; }

function makePool(count, geo, material, scene, isCeiling) {
    const pool = [];
    for (let i = 0; i < count; i++) {
        const mat = material.clone();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = isCeiling ? Math.PI / 2 : -Math.PI / 2;
        mesh.position.y = isCeiling ? TILE_HEIGHT : 0;
        mesh.visible = false;
        scene.add(mesh);
        pool.push(mesh);
    }
    return pool;
}

function makeWallPool(count, geo, material, scene, rotY) {
    const pool = [];
    for (let i = 0; i < count; i++) {
        const mat = material.clone();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.y = rotY;
        mesh.position.y = TILE_HEIGHT / 2;
        mesh.visible = false;
        scene.add(mesh);
        pool.push(mesh);
    }
    return pool;
}

function updateTiles(tiles, camX, camZ, camera, poolKeys, yOffset, halfY) {
    const cx = Math.floor(camX / TILE_SIZE);
    const cz = Math.floor(camZ / TILE_SIZE);
    const cy = Math.floor(camera.position.y / 10 + Math.random() * TILE_HEIGHT);
    const half = Math.max(2, Math.ceil(RENDER_DIST / TILE_SIZE) + 1);
    const avail = [];

    for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (t.visible) {
            const dx = t.position.x - camX;
            const dz = t.position.z - camZ;
            const dy = t.position.y - camera.position.y;
            if (Math.abs(dx) > RECYCLE_DIST || Math.abs(dz) > RECYCLE_DIST || Math.abs(dy) > RECYCLE_DIST) {
                t.visible = false;
                poolKeys.delete(key(t._gx, t._gy, t._gz));
                avail.push(i);
            }
        } else {
            avail.push(i);
        }
    }

    for (let gy = cy - halfY; gy <= cy + halfY; gy++) {
        for (let gx = cx - half; gx <= cx + half; gx++) {
            for (let gz = cz - half; gz <= cz + half; gz++) {
                const k = key(gx, gy, gz);
                if (poolKeys.has(k)) continue;
                if (avail.length === 0) {
                    let farIdx = -1;
                    let farDist = 0;
                    for (let fi = 0; fi < tiles.length; fi++) {
                        const ft = tiles[fi];
                        if (!ft.visible) continue;
                        const fdx = ft.position.x - camX;
                        const fdz = ft.position.z - camZ;
                        const fdy = ft.position.y - camera.position.y;
                        const dist = fdx * fdx + fdz * fdz + fdy * fdy;
                        if (dist > farDist) {
                            farDist = dist;
                            farIdx = fi;
                        }
                    }
                    if (farIdx >= 0) {
                        const far = tiles[farIdx];
                        far.visible = false;
                        poolKeys.delete(key(far._gx, far._gy, far._gz));
                        avail.push(farIdx);
                    } else continue;
                }
                const t = tiles[avail.pop()];
                t.position.x = gx * TILE_SIZE;
                t.position.z = gz * TILE_SIZE;
                t.position.y = gy * TILE_HEIGHT + yOffset;
                t._gx = gx;
                t._gz = gz;
                t._gy = gy;
                t.visible = true;
                poolKeys.add(k);
            }
        }
    }
}

export class TileManager {
    constructor(scene, cityMaterial, wallMaterial) {
        const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, TILE_SEGMENTS, TILE_SEGMENTS);
        const wallGeo = new THREE.PlaneGeometry(WALL_STRIP_LEN, TILE_HEIGHT, Math.floor(TILE_SEGMENTS * 3), 8);

        this.floorTiles = makePool(MAX_TILES * 30, geo, cityMaterial, scene, false);
        this.ceilTiles = makePool(MAX_TILES * 30, geo, cityMaterial, scene, true);

        this.wallTilesX = makeWallPool(WALLS_PER_POOL, wallGeo, wallMaterial, scene, 0);
        this.wallTilesZ = makeWallPool(WALLS_PER_POOL, wallGeo, wallMaterial, scene, Math.PI / 2);
        this.wallAngX = makeWallPool(WALLS_PER_POOL, wallGeo, wallMaterial, scene, 0.3);
        this.wallAngZ = makeWallPool(WALLS_PER_POOL, wallGeo, wallMaterial, scene, Math.PI / 2 + 0.3);

        this.floorKeys = new Set();
        this.ceilKeys = new Set();
        this.wallKeysX = new Set();
        this.wallKeysZ = new Set();
        this.wallAngKeysX = new Set();
        this.wallAngKeysZ = new Set();
    }

    update(camera) {
        updateTiles(this.floorTiles, camera.position.x, camera.position.z, camera, this.floorKeys, 0, 4);
        updateTiles(this.ceilTiles, camera.position.x, camera.position.z, camera, this.ceilKeys, TILE_HEIGHT, 4);

        const cy = Math.floor(camera.position.y / TILE_HEIGHT);
        const wallHalfY = 10;
        const cx = Math.floor(camera.position.x / TILE_SIZE);
        const cz = Math.floor(camera.position.z / TILE_SIZE);
        const halfXZ = Math.max(2, Math.ceil(RENDER_DIST / TILE_SIZE) + 1);

        for (const wConfig of [
            { pool: this.wallTilesX, keys: this.wallKeysX, type: 'x' },
            { pool: this.wallTilesZ, keys: this.wallKeysZ, type: 'z' },
            { pool: this.wallAngX, keys: this.wallAngKeysX, type: 'x' },
            { pool: this.wallAngZ, keys: this.wallAngKeysZ, type: 'z' }
        ]) {
            const { pool, keys, type } = wConfig;

            const avail = [];
            for (let i = 0; i < pool.length; i++) {
                const t = pool[i];
                if (t.visible) {
                    const perpDist = type === 'x'
                        ? Math.abs(t.position.z - camera.position.z)
                        : Math.abs(t.position.x - camera.position.x);
                    const dy = Math.abs(t.position.y - camera.position.y);
                    if (perpDist > RECYCLE_DIST || dy > RECYCLE_DIST) {
                        t.visible = false;
                        keys.delete(key(t._gx, t._gy, t._gz));
                        avail.push(i);
                    }
                } else {
                    avail.push(i);
                }
            }

            for (let gy = cy - wallHalfY; gy <= cy + wallHalfY; gy++) {
                for (let gi = -halfXZ; gi <= halfXZ; gi++) {
                    const wHash = gi * 374761393 + gy * 668265263;
                    if ((wHash & 0xff) > 200) continue;
                    const stripGx = type === 'x' ? cx : (cx + gi);
                    const stripGz = type === 'z' ? cz : (cz + gi);
                    const k = key(stripGx, gy, stripGz);
                    if (keys.has(k)) continue;
                    if (avail.length === 0) {
                        let farIdx = -1, farDist = 0;
                        for (let fi = 0; fi < pool.length; fi++) {
                            const ft = pool[fi];
                            if (!ft.visible) continue;
                            const pd = type === 'x' ? Math.abs(ft.position.z - camera.position.z) : Math.abs(ft.position.x - camera.position.x);
                            const vd = Math.abs(ft.position.y - camera.position.y);
                            const d = pd * pd + vd * vd;
                            if (d > farDist) { farDist = d; farIdx = fi; }
                        }
                        if (farIdx >= 0) {
                            const ft = pool[farIdx];
                            ft.visible = false;
                            keys.delete(key(ft._gx, ft._gy, ft._gz));
                            avail.push(farIdx);
                        } else continue;
                    }
                    const t = pool[avail.pop()];
                    if (type === 'x') {
                        t.position.x = camera.position.x;
                        t.position.z = cz * TILE_SIZE + gi * TILE_SIZE;
                        t._gx = cx;
                        t._gz = cz + gi;
                    } else {
                        t.position.x = cx * TILE_SIZE + gi * TILE_SIZE;
                        t.position.z = camera.position.z;
                        t._gx = cx + gi;
                        t._gz = cz;
                    }
                    t.position.y = gy * TILE_HEIGHT + TILE_HEIGHT / 2;
                    t._gy = gy;
                    t.visible = true;
                    keys.add(k);
                }
            }
        }
    }

    getAllTiles() {
        return this.floorTiles.concat(this.ceilTiles)
            .concat(this.wallTilesX, this.wallTilesZ)
            .concat(this.wallAngX, this.wallAngZ);
    }

    getFloorCeilTiles() {
        return this.floorTiles.concat(this.ceilTiles);
    }

    getWallTiles() {
        return this.wallTilesX.concat(this.wallTilesZ).concat(this.wallAngX).concat(this.wallAngZ);
    }
}
