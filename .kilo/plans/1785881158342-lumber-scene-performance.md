# Lumber Scene Performance Optimization Plan

**Current State:** ~45 FPS **Target:** Stable 60 FPS
**Budget:** Gain ~1.67ms per frame (from ~22.2ms to 16.7ms)

---

## 1. GPU Fragment Shader — Highest Impact

### 1.1 Reduce Simplex Noise Calls (Critical)

**Problem:** `wood-instanced.frag` calls `snoise()` up to **9 times per fragment** when cracks are enabled. Each `snoise` is ~100+ ALU instructions. With 110 lumber instances + 24 wall planks, this dominates GPU time.

| Function | snoise Calls |
|---|---|
| `woodGrain()` | 3 |
| `woodKnots()` | 2 |
| `crackPattern()` | 3 |
| End grain | 1 |
| **Total per fragment (crack enabled)** | **9** |

**Actions:**
- **Reduce `woodGrain` from 3 to 2 snoise calls:** Remove the finest detail layer (`snoise(vec3(p.x, p.y * 8.0 - time * 0.04, 3.0))` at line 76). The 0.25 weight makes it visually minor.
- **Reduce `woodKnots` from 2 to 1 snoise call:** Drop the `swirl` snoise at line 87. Replace with a simpler `sin(angle * 3.0 + time * 0.1)` approximation.
- **Reduce `crackPattern` from 3 to 2 snoise calls:** Drop the `branch` snoise at line 97. Replace with `sin(pos.y * 2.0 + time * 0.02)` approximation.
- **Reduce end grain from 1 to 0 snoise calls:** Replace `snoise(vec3(vUv * 20.0, t * 0.01))` with a hash-based pseudo-random using `fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453)`.
- **Net reduction:** 9 -> 5 snoise calls per fragment (**44% reduction in fragment ALU work**).

### 1.2 Conditional Crack Evaluation

**Problem:** `crackPattern` is evaluated for ~60% of instances (`useCrack > 0.4` in init). The `if (vUseCrack > 0.5)` branch at line 142 still compiles both paths on most GPUs.

**Actions:**
- Move the crack `if` check earlier and short-circuit all crack-related computation. Currently the structure already does this, but ensure the compiler can eliminate dead code by hoisting `vUseCrack` check before any crack variable computation.

### 1.3 Lower Shader Precision Where Possible

**Action:** Change `precision highp float;` to `precision mediump float;` in the fragment shader. Wood textures don't need high precision. This can double fragment throughput on mobile/low-end GPUs. Test visually first — if banding appears, keep `highp` only for `vWorldPos` and lighting calculations.

---

## 2. CPU Per-Frame Hot Path

### 2.1 Reduce Temporary Object Creation in Lumber Loop

**Problem:** Lines 478-486 create Euler -> Quaternion -> Matrix every frame for all 110 lumber pieces:
```js
_tempEuler.set(ld.rotX, ld.rotY, ld.rotZ);
_tempQuat.setFromEuler(_tempEuler);
_tempVec3.set(...);
_tempMatrix.compose(_tempVec3, _tempQuat, _tempScale);
```

**Actions:**
- **Skip Euler->Quat conversion:** Store rotation as a pre-allocated `THREE.Quaternion` per lumber piece in `lumberData`. Update the quaternion directly with `setFromAxisAngle` or incremental rotation, avoiding Euler entirely.
- **Use `_tempMatrix.makeTranslation` + rotation multiplication:** For pieces with minimal rotation, use `makeTranslation` and skip quaternion composition when rotation speeds are near zero.
- **Cache `_right` and `_up` components:** The camera basis vectors `_right` and `_up` are recomputed every frame (line 378-380). Cache them and only recompute when camera rotation changes significantly.

### 2.2 Batch Debris Position Updates

**Problem:** 60 debris pieces each do individual `mesh.position.set` and `mesh.rotation` updates (lines 614-634). Each `mesh.position.x = ...` triggers Three.js internal dirty flags.

**Actions:**
- **Convert debris to InstancedMesh:** Same as lumber and wall planks. This reduces 60 individual draw calls to 1, and allows batch matrix updates. Expected savings: ~60 draw calls eliminated.

### 2.3 Optimize Nearby Lumber Count

**Problem:** Lines 383-390 iterate all 110 lumber pieces every frame to count nearby pieces for fog density.

**Action:** Maintain a running count. Increment/decrement when pieces cross the `zOffset` thresholds at spawn/recycle time, instead of scanning every frame.

### 2.4 Reduce Params Changed Check Overhead

**Problem:** Lines 414-453 check `paramsChanged` and then iterate all 110 lumber pieces to update color arrays. The color comparison `activeParams.colorA !== lastColorA` compares string references, which may fire more often than needed.

**Action:** Normalize the color strings to a canonical form before comparison, or compare the actual RGB values stored in the arrays.

---

## 3. Rendering Pipeline

### 3.1 Post-Processing Pass Count

**Problem:** The `EffectComposer` runs **9 passes** per frame:
1. RenderPass
2. UnrealBloomPass
3. EdgePass (Sobel)
4. PixelationPass
5. ChromaticAberrationPass
6. GrainPass
7. ScanlinePass
8. VignettePass
9. MeltPass (when active)

At half resolution this is better, but 9 full-screen passes is still heavy.

**Actions:**
- **Merge Vignette + Grain + Scanline into a single shader pass:** These are all simple per-pixel operations that can be combined into one fragment shader, reducing 3 passes to 1.
- **Disable MeltPass when not in transition:** Already done via `enabled = false`, but verify it's not still being rendered.
- **Profile BloomPass settings:** The bloom uses `halfW x halfH` resolution. Consider reducing to `quarterW x quarterH` for the bloom specifically.

### 3.2 Frustum Culling

**Problem:** `lumberMesh.frustumCulled = false` at line 83 disables frustum culling for all 110 lumber instances.

**Action:** Re-enable frustum culling (`lumberMesh.frustumCulled = true`). Three.js will automatically skip instances outside the view frustum. Since lumber pieces spawn at `SPAWN_DISTANCE = 80` and the FOV is有限, many distant instances can be skipped.

---

## 4. Memory and Allocation

### 4.1 Avoid Per-Frame Color Object Creation

**Problem:** In `wallPlankData` init (line 207-208), `new THREE.Color()` is created for each plank. These persist but are only used once during init.

**Action:** Already minimal impact since it's init-time only. No change needed.

### 4.2 Sawdust Color Array Update

**Problem:** Lines 548-551 update `sawdustColors` every frame for active sawdust particles, then set `needsUpdate = true` unconditionally.

**Action:** Only set `needsUpdate = true` if any sawdust particle changed state this frame. Track a dirty flag.

---

## 5. Summary of Expected Gains

| Optimization | Estimated FPS Gain | Effort |
|---|---|---|
| Reduce snoise calls (9->5) | +8-12 FPS | Medium |
| Convert debris to InstancedMesh | +3-5 FPS | Medium |
| Merge post-processing passes (3->1) | +3-5 FPS | Medium |
| Re-enable frustum culling | +2-3 FPS | Low |
| Cache camera basis vectors | +1-2 FPS | Low |
| Skip Euler->Quat in lumber loop | +1-2 FPS | Low |
| Running nearby count | +1 FPS | Low |
| Lower shader precision (mediump) | +2-4 FPS (mobile) | Low |

**Total estimated gain: +15-28 FPS**, which should comfortably reach 60 FPS even on lower-end hardware.

---

## 6. Implementation Order

1. **Fragment shader snoise reduction** — biggest single win
2. **Re-enable frustum culling** — one-line change, immediate benefit
3. **Convert debris to InstancedMesh** — reduces draw calls
4. **Merge post-processing passes** — reduces full-screen passes
5. **Cache camera basis vectors** — reduces CPU math
6. **Skip Euler->Quat in lumber loop** — reduces per-frame allocations
7. **Lower shader precision** — test on target hardware
