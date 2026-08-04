# LiminalScene Performance Optimization Plan

**Target:** Stabilize at 60 FPS (currently ~45 FPS).  
**File:** `ket/scenes/liminalScene.js` (622 lines)  
**Context:** Three.js corridor scene with instanced geometry, dynamic lights, and 7+ post-processing passes.

---

## Root Cause Analysis

The 45 FPS bottleneck comes from four compounding areas:

1. **Per-frame CPU work** — O(N×M) light pool selection, unnecessary `Math.sqrt`, GC-allocating helpers, and redundant `Math.sin` calls across ~75 lights and ~10 exit signs every frame.
2. **GPU lighting cost** — 6 pool `PointLight`s + 2 camera lights + N exit-sign lights all evaluated per-fragment in `MeshStandardMaterial` shaders.
3. **Post-processing pipeline** — 7+ full-screen passes at half resolution (Bloom, Edge, Pixelation, Grain, Chroma, Scanline, Vignette, Melt).
4. **Memory leaks on scene exit** — Textures, geometries, and materials are never disposed.

---

## Optimization Tasks (ordered by impact)

### 1. Reduce Per-Frame CPU Work in `onUpdate`

| # | Issue | Fix |
|---|-------|-----|
| 1a | `Math.sqrt(distSq)` on every light (line 529) — sqrt is unnecessary since comparison uses `distSq` against `LIGHT_ACTIVE_RADIUS_SQ` | Replace proximity calc: `const proximity = 1.0 - Math.sqrt(distSq) / LIGHT_ACTIVE_RADIUS` → precompute `1 / LIGHT_ACTIVE_RADIUS` and use `Math.sqrt` only once for proximity, or approximate with `distSq`-based falloff |
| 1b | Light pool slot selection is O(N×M) nested loop (lines 548-556) — for each active light, iterate all 6 pool slots | Replace with a sorted insertion or maintain a min-heap. With M=6 this is minor, but combined with N=75 outer iterations it adds up. Simple fix: track the farthest slot index instead of scanning all slots each time |
| 1c | `_p3.clone()` in `sampleCurveCache` (line 210) allocates a new `Vector3` every curve sample call | Inline the interpolation into `_camPos` and `_lookTarget` directly — reuse the existing temp vectors instead of cloning |
| 1d | 3-4 `Math.sin` calls per light in the flicker logic (lines 532-536) | Precompute a shared time value and reduce flicker terms from 3 sines to 2. Consider a lookup table for the slow-varying terms |
| 1e | `camera.updateProjectionMatrix()` every frame (line 494) for FOV oscillation | Batch: only call when FOV change exceeds a threshold (e.g., `Math.abs(fovDelta) > 0.5`) |
| 1f | Exit sign distance check (lines 582-610) — same O(N) loop with sqrt-free distSq but still iterates all ~10 exit signs every frame | Cache exit sign segment indices and only check those within ±N segments of the camera's current segment index instead of all exit signs |

### 2. Reduce GPU Lighting Overhead

| # | Issue | Fix |
|---|-------|-----|
| 2a | `MeshStandardMaterial` on all corridor geometry (lines 249-260) — PBR lighting is expensive per-fragment with multiple point lights | Switch to `MeshPhongMaterial` or `MeshLambertMaterial` for static corridor walls, floor, and ceiling. These materials have simpler lighting models that handle multiple lights more efficiently |
| 2b | 6 pool `PointLight`s + 2 camera lights + N exit sign `PointLight`s all active simultaneously | Reduce `LIGHT_POOL_SIZE` from 6 to 4. The fog density (0.035) already obscures distant lights, so 4 is visually sufficient |
| 2c | Exit sign `PointLight`s created per sign (line 387) with `decay: 2.0` — each adds to the per-fragment light loop | Replace exit sign point lights with an emissive-only approach: increase the `MeshBasicMaterial` brightness and rely on bloom post-processing for the glow effect, eliminating the per-fragment light evaluation entirely |
| 2d | `FogExp2` with density 0.035 (line 233) — exponential fog is computed per-fragment | Consider switching to `THREE.Fog` (linear fog) with a far distance that matches the visual cutoff. Linear fog is cheaper and visually similar in a corridor |

### 3. Post-Processing Pipeline Optimization

| # | Issue | Fix |
|---|-------|-----|
| 3a | `UnrealBloomPass` at half resolution with `threshold: 0.85` (postprocessing.js:19-22) — bloom runs multiple internal blur passes | Reduce bloom render samples or switch to a simpler bloom implementation. Consider lowering the bloom resolution to `width/4 × height/4` since the scene is already rendered at half res |
| 3b | 7 post-processing passes run every frame regardless of whether effects are active | Conditionally disable passes: Grain, Scanline, and Chroma should only run when `foldIntensity` is above a threshold. Vignette and Edge are static and can be merged into a single custom shader pass |
| 3c | Melt pass runs during transitions but the uniform updates (`updateMeltTime`) fire every frame when melt is enabled | Already guarded by `meltPass.enabled`, but verify the melt pass is disabled immediately after transitions complete |

### 4. Memory Management — Scene Exit Cleanup

| # | Issue | Fix |
|---|-------|-----|
| 4a | `onExit()` (line 448) only zeros light intensities — no geometry, material, or texture disposal | Add disposal loop: iterate `lightData` and `exitData`, call `.dispose()` on each `fixtureMat`, `signMat`, geometry, and texture. Call `threeScene.traverse()` to dispose child objects |
| 4b | Wall textures (6), floor texture, ceiling texture, light texture, exit sign texture are never disposed | Track all created textures in an array and dispose them in `onExit()` |
| 4c | InstancedMesh objects in `corridorGroup` are not disposed | Dispose geometries (`wallGeoLeft`, `wallGeoRight`, `ceilingGeo`, `floorGeo`, `endWallGeo`) and instanced meshes in `onExit()` |

### 5. Geometry and Draw Call Optimization

| # | Issue | Fix |
|---|-------|-----|
| 5a | Walls split across 7 material groups (6 wall variants + solid), each with separate InstancedMesh draw calls | Reduce wall material variants from 6 to 2-3. The visual difference between 6 wall textures in a foggy corridor is negligible |
| 5b | `endWallInst` creates additional InstancedMesh draws per material group | Merge end walls into the side wall InstancedMesh if geometry allows, or reduce the frequency of end walls (currently every segment) |

---

## Implementation Order

1. **Task 4 (Memory cleanup)** — Quick win, prevents leaks across scene switches
2. **Task 1a, 1e, 1f** — Low-risk CPU reductions with measurable impact
3. **Task 2a, 2c** — Material swap and exit sign light removal for GPU relief
4. **Task 1b, 1c, 1d** — Algorithmic CPU improvements
5. **Task 3 (Post-processing)** — Requires visual validation; do last
6. **Task 5 (Geometry reduction)** — Visual trade-off; validate with user

---

## Validation

- Run with `?fps` URL parameter to enable Stats panel
- Monitor GPU panel (click Stats to toggle) for frame time breakdown
- Target: CPU time < 8ms, GPU time < 8ms, total frame < 16.6ms
- Visual regression check: corridor should look identical at 60 FPS

## Risks

- Switching from `MeshStandardMaterial` to `MeshPhongMaterial` may change lighting appearance slightly
- Reducing wall texture variants from 6 to 2-3 is a visual trade-off
- Post-processing pass reduction may change the intended aesthetic
