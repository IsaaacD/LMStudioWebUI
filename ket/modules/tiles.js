import * as THREE from 'three';

const TILE_SIZE = 200;
const TILE_SEGMENTS = 128;
const RENDER_DIST = 240;
const RECYCLE_DIST = 200;
const GRID = Math.ceil(RENDER_DIST / TILE_SIZE) * 2 + 1;
const MAX_TILES = GRID * GRID;
const TILE_HEIGHT = 25;

const WALL_STRIP_LEN = RENDER_DIST * 2.5;
const WALL_STRIP_HEIGHT = TILE_HEIGHT * 3;
const WALLS_PER_POOL = 200;
const WALL_RECYCLE_DIST = 600;
const WALL_DENSITY = 0.6;
const WALL_PENDING_MAX = 40;
const WALL_WARMUP_FRAMES = 30;
const WALL_RESERVE_FRACTION = 0.15;
const WALL_POOL_STAGGER = 7;

export function getTileConstants() {
    return { TILE_SIZE, TILE_SEGMENTS, RENDER_DIST, RECYCLE_DIST, GRID, MAX_TILES, TILE_HEIGHT, WALL_STRIP_LEN, WALL_STRIP_HEIGHT, WALLS_PER_POOL };
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

function updateTiles(tiles, camX, camZ, camera, poolKeys, yOffset, halfY, recycleDistY, warmup) {
    const cx = Math.floor(camX / TILE_SIZE);
    const cz = Math.floor(camZ / TILE_SIZE);
    const cy = Math.floor(camera.position.y / TILE_HEIGHT);
    const half = Math.max(2, Math.ceil(RENDER_DIST / TILE_SIZE) + 1);
    const rdy = recycleDistY != null ? recycleDistY : RECYCLE_DIST;
    const effectiveMaxDistSq = RENDER_DIST * RENDER_DIST * warmup * warmup;
    const avail = [];

    for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (t.visible) {
            const dx = t.position.x - camX;
            const dz = t.position.z - camZ;
            const dy = t.position.y - camera.position.y;
            if (Math.abs(dx) > RECYCLE_DIST || Math.abs(dz) > RECYCLE_DIST || Math.abs(dy) > rdy) {
                t.visible = false;
                poolKeys.delete(key(t._gx, t._gy, t._gz));
                avail.push(i);
            }
        } else {
            avail.push(i);
        }
    }

    // Collect candidate positions filtered by max distance, sorted nearest-first
    const candidates = [];
    for (let gy = cy - halfY; gy <= cy + halfY; gy++) {
        for (let gx = cx - half; gx <= cx + half; gx++) {
            for (let gz = cz - half; gz <= cz + half; gz++) {
                if (poolKeys.has(key(gx, gy, gz))) continue;
                const wx = gx * TILE_SIZE;
                const wz = gz * TILE_SIZE;
                const wy = gy * TILE_HEIGHT + yOffset;
                const dx = wx - camX;
                const dz = wz - camZ;
                const dy = wy - camera.position.y;
                const distSq = dx * dx + dz * dz + dy * dy;
                if (distSq <= effectiveMaxDistSq) {
                    candidates.push({ gx, gy, gz, distSq });
                }
            }
        }
    }
    candidates.sort((a, b) => a.distSq - b.distSq);

    for (const c of candidates) {
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
            } else break;
        }
        const t = tiles[avail.pop()];
        t.position.x = c.gx * TILE_SIZE;
        t.position.z = c.gz * TILE_SIZE;
        t.position.y = c.gy * TILE_HEIGHT + yOffset;
        t._gx = c.gx;
        t._gz = c.gz;
        t._gy = c.gy;
        t.visible = true;
        poolKeys.add(key(c.gx, c.gy, c.gz));
    }
}

// Wall-specific infinite update: mirrors floor logic for all 3 axes
function updateWallPool(pool, keys, type, camera, cx, cz, cy, halfXZ, wallHalfY, wallRecycleY, pending, warmup) {
    const camY = camera.position.y;
    const reserve = Math.floor(pool.length * WALL_RESERVE_FRACTION);
    const maxWallSpawnDist2 = RENDER_DIST * RENDER_DIST * warmup * warmup;

    const avail = [];
    for (let i = 0; i < pool.length; i++) {
        const t = pool[i];
        if (t.visible) {
            const perpDist = type === 'x'
                ? Math.abs(t.position.z - camera.position.z)
                : Math.abs(t.position.x - camera.position.x);
            const dy = Math.abs(t.position.y - camY);
            if (perpDist > WALL_RECYCLE_DIST || dy > wallRecycleY) {
                t.visible = false;
                keys.delete(key(t._gx, t._gy, t._gz));
                avail.push(i);
            } else {
                if (type === 'x') {
                    const newGx = Math.floor(t.position.x / TILE_SIZE);
                    if (newGx !== t._gx) {
                        keys.delete(key(t._gx, t._gy, t._gz));
                        t._gx = newGx;
                        keys.add(key(t._gx, t._gy, t._gz));
                    }
                } else {
                    const newGz = Math.floor(t.position.z / TILE_SIZE);
                    if (newGz !== t._gz) {
                        keys.delete(key(t._gx, t._gy, t._gz));
                        t._gz = newGz;
                        keys.add(key(t._gx, t._gy, t._gz));
                    }
                }
            }
        } else {
            avail.push(i);
        }
    }

    // Build candidate positions sorted nearest-first, capped by max spawn distance
    const positions = [];
    for (let gy = cy - wallHalfY; gy <= cy + wallHalfY; gy += 1) {
        for (let gi = -halfXZ; gi <= halfXZ; gi++) {
            const wx = type === 'x' ? camera.position.x : (cx + gi) * TILE_SIZE;
            const wz = type === 'z' ? camera.position.z : (cz + gi) * TILE_SIZE;
            const wy = gy * TILE_HEIGHT + TILE_HEIGHT / 2;
            const dx = wx - camera.position.x;
            const dz = wz - camera.position.z;
            const dy = wy - camY;
            const dist2 = dx * dx + dz * dz + dy * dy;
            if (dist2 <= maxWallSpawnDist2) {
                positions.push({ gi, gy, dist2 });
            }
        }
    }
    positions.sort((a, b) => a.dist2 - b.dist2);

    // Effective density: base density × warmup ramp
    const effectiveDensity = WALL_DENSITY * warmup;

    // Phase 0: retry previously failed positions (pop-in for gaps)
    const retry = pending.splice(0);
    for (const ppos of retry) {
        if (ppos.dist2 > maxWallSpawnDist2) continue;
        const stripGx = type === 'x' ? cx : (cx + ppos.gi);
        const stripGz = type === 'z' ? cz : (cz + ppos.gi);
        const k = key(stripGx, ppos.gy, stripGz);
        if (keys.has(k)) continue;
        if (avail.length <= reserve) {
            if (pending.length < WALL_PENDING_MAX) pending.push(ppos);
            continue;
        }
        placeWall(pool, avail, keys, type, cx, cz, ppos.gi, ppos.gy, camera);
    }

    // Prune pending queue of entries beyond max distance
    while (pending.length && pending[pending.length - 1].dist2 > maxWallSpawnDist2) {
        pending.pop();
    }

    // Phase 1: fill grid positions with uniform density
    for (const pos of positions) {
        if (avail.length <= reserve) break;
        const wHash = pos.gi * 374761393 + pos.gy * 668265263;
        if ((wHash & 0xff) > (255 * effectiveDensity)) continue;
        const stripGx = type === 'x' ? cx : (cx + pos.gi);
        const stripGz = type === 'z' ? cz : (cz + pos.gi);
        const k = key(stripGx, pos.gy, stripGz);
        if (keys.has(k)) continue;
        if (avail.length <= reserve) {
            if (pending.length < WALL_PENDING_MAX) pending.push({ gi: pos.gi, gy: pos.gy, dist2: pos.dist2 });
            continue;
        }
        placeWall(pool, avail, keys, type, cx, cz, pos.gi, pos.gy, camera);
    }
}

function placeWall(pool, avail, keys, type, cx, cz, gi, gy, camera) {
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
    keys.add(key(t._gx, t._gy, t._gz));
}

export class TileManager {
    constructor(scene, cityMaterial, wallMaterial) {
        const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, TILE_SEGMENTS, TILE_SEGMENTS);
        const wallGeo = new THREE.PlaneGeometry(WALL_STRIP_LEN, WALL_STRIP_HEIGHT, Math.floor(TILE_SEGMENTS * 3), 8);

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

        // Pending retry queues per wall pool
        this.wallPendingX = [];
        this.wallPendingZ = [];
        this.wallAngPendingX = [];
        this.wallAngPendingZ = [];

        // Warmup: ramp density from 20% to 100% over WALL_WARMUP_FRAMES
        this.wallFrame = 0;
        this.floorCeilFrame = 0;
    }

    update(camera) {
        this.floorCeilFrame++;
        const fcWarmup = Math.min(1, this.floorCeilFrame / WALL_WARMUP_FRAMES);
        updateTiles(this.floorTiles, camera.position.x, camera.position.z, camera, this.floorKeys, 0, 4, 10000, fcWarmup);
        updateTiles(this.ceilTiles, camera.position.x, camera.position.z, camera, this.ceilKeys, TILE_HEIGHT, 4, 5000, fcWarmup);

        const cx = Math.floor(camera.position.x / TILE_SIZE);
        const cz = Math.floor(camera.position.z / TILE_SIZE);
        const cy = Math.floor(camera.position.y / TILE_HEIGHT);
        const halfXZ = Math.max(2, Math.ceil(RENDER_DIST / TILE_SIZE) + 1);
        const wallHalfY = 10;
        const wallRecycleY = wallHalfY * 2 * TILE_HEIGHT + TILE_HEIGHT;

        // Warmup factor: 0.2 → 1.0 over WALL_WARMUP_FRAMES
        this.wallFrame++;
        const warmup = Math.min(1, 0.2 + 0.8 * (this.wallFrame / WALL_WARMUP_FRAMES));

        // Stagger wall pool activation: each pool starts WALL_POOL_STAGGER frames apart
        // so they don't all compete for the same cells near the camera at startup
        const wallPools = [
            { pool: this.wallTilesX, keys: this.wallKeysX, type: 'x', pending: this.wallPendingX },
            { pool: this.wallTilesZ, keys: this.wallKeysZ, type: 'z', pending: this.wallPendingZ },
            { pool: this.wallAngX, keys: this.wallAngKeysX, type: 'x', pending: this.wallAngPendingX },
            { pool: this.wallAngZ, keys: this.wallAngKeysZ, type: 'z', pending: this.wallAngPendingZ },
        ];

        for (let i = 0; i < wallPools.length; i++) {
            const staggeredFrame = Math.max(1, this.wallFrame - i * WALL_POOL_STAGGER);
            const poolWarmup = Math.min(1, 0.2 + 0.8 * (staggeredFrame / WALL_WARMUP_FRAMES));
            updateWallPool(wallPools[i].pool, wallPools[i].keys, wallPools[i].type, camera, cx, cz, cy, halfXZ, wallHalfY, wallRecycleY, wallPools[i].pending, poolWarmup);
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
