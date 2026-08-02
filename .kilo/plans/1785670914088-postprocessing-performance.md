# Post-Processing Performance Diagnostic & Optimization Plan

## Problem Statement

iPhone 14 maintains 60 FPS until post-processing effects engage, then drops to a locked 30 FPS. This is a classic iOS thermal/power throttling trigger caused by GPU-bound post-processing at full resolution.

## Root Cause Analysis

### 1. Sobel Edge Detection — `sorbel.frag` (CRITICAL)

**18 texture lookups per fragment**, every frame, at full resolution. On iPhone 14 (1170x2532 CSS, ~1755x3798 with pixel ratio 1.5), that is ~6.6M fragments x 18 samples = **~119M texture reads per frame**. This is the single heaviest shader and the primary trigger for GPU thermal throttling.

### 2. Melt Shader — `melt.frag` (CRITICAL)

Calls `meltWarp()` **4 times per fragment** (1 for warping + 3 for numerical Jacobian derivative). Each `meltWarp()` calls `noise()` 3 times, and each `noise()` calls `hash()` 4 times. Total: **64 hash computations + 16 noise interpolations + 2 texture lookups per pixel**, every frame during transitions.

### 3. Seven Full-Resolution Passes

The pipeline chains: RenderPass -> Bloom (half res) -> Edge (full) -> Pixelation (full) -> Grain (full) -> Vignette (full) -> Chroma (full) -> Scanline (full) -> Melt (full). **7 of 9 passes run at full device resolution**. Each pass allocates intermediate framebuffers and reads/writes the full framebuffer.

### 4. Per-Frame GC Pressure

- `raveMode.js:68,72`: `new THREE.Color()` called **every frame** in `lerp()`
- `heartSpawner.js:151,152`: `new THREE.Color()` called every frame in `update()`
- `sparseScene.js:524`: `new THREE.Color()` every frame
- These allocations trigger mobile GC pauses that compound with GPU stalls

### 5. Material `needsUpdate` Every Frame

`cityScene.js:51,59`, `primitives.js:186`, `heartSpawner.js:156`, `sparseScene.js:738` all set `material.needsUpdate = true` every frame. This forces Three.js to re-check shader program uniforms and potentially recompile programs each frame.

### 6. Snapshot RenderTarget Leak

`postprocessing.js:239`: `captureSnapshot()` allocates `this._snapshotRT` once but never disposes it. Old snapshot textures accumulate GPU memory.

## Optimization Tasks

### Task 1: Reduce Sobel Texture Lookups (Highest Impact)

**File**: `ket/shaders/sorbel.frag`

Replace the 18-lookup Sobel operator with a 4-lookup simplified edge detection, or switch to a single-pass difference approach:
- Use a pre-downsampled render target (half resolution) for edge detection
- Replace Sobel with a cheaper 4-neighbor gradient or use `dFdx`/`dFdy` hardware derivatives

### Task 2: Downsample Post-Processing Pipeline

**File**: `ket/modules/postprocessing.js`

Set the EffectComposer render target to half resolution for all passes except the final one. On mobile, the visual difference at arm's length is negligible:
- Add `this.composer.setSize(width / 2, height / 2)` after construction, or set individual pass render target sizes
- Only the final pass output needs full resolution (scale up with linear filtering)

### Task 3: Optimize Melt Shader Jacobian

**File**: `ket/shaders/melt.frag`

Replace the numerical Jacobian (3 extra `meltWarp` calls at lines 77-78) with an analytical derivative. The warp function is composed of sines, noise, and linear transforms — its derivative can be computed analytically with far fewer operations. Alternatively, precompute the glow intensity in a separate, cheaper pass.

### Task 4: Eliminate Per-Frame Object Allocations

**Files**: `ket/modules/raveMode.js`, `ket/modules/heartSpawner.js`, `ket/scenes/sparseScene.js`

- `raveMode.js:68,72`: Reuse `this.raveTemp` for both colorA and colorB lerp (set the target color into a second temp, then lerp)
- `heartSpawner.js:151,152`: Use the existing `_tempColor` to set uniform values instead of constructing new `THREE.Color` objects
- `sparseScene.js:524`: Cache the background color or use a temp variable

### Task 5: Remove Per-Frame `needsUpdate`

**Files**: `ket/scenes/cityScene.js`, `ket/modules/primitives.js`, `ket/modules/heartSpawner.js`, `ket/scenes/sparseScene.js`

Uniform values updated via `.value.copy()` or `.value.set()` do not require `needsUpdate = true`. Only geometry changes or material property changes (not uniform changes) require it. Remove all per-frame `needsUpdate = true` on materials.

### Task 6: Fix Snapshot RenderTarget Leak

**File**: `ket/modules/postprocessing.js`

In `setMeltSnapshot()`, after the melt transition completes and `meltPass.enabled` is set to false, dispose the snapshot texture:
```
if (value >= 1) {
    this.meltPass.enabled = false;
    if (this._snapshotRT) {
        this._snapshotRT.dispose();
        this._snapshotRT = null;
    }
}
```

### Task 7: Cap Device Pixel Ratio Lower on Mobile

**File**: `ket/modules/scene.js`

Line 13 caps at 1.5. Reduce to 1.0 for post-processing heavy workloads, or detect iOS and use a lower cap:
```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
```

## Expected Impact (Priority Order)

| Task | Impact | Risk |
|------|--------|------|
| 1. Sobel optimization | Very High | Low |
| 2. Downsample pipeline | Very High | Low |
| 3. Melt Jacobian fix | High | Medium |
| 4. GC elimination | Medium | Low |
| 5. needsUpdate removal | Medium | Low |
| 6. Snapshot leak fix | Low (memory) | Low |
| 7. Pixel ratio cap | Medium | Low |

Tasks 1 and 2 together address the primary GPU bandwidth bottleneck that triggers iOS thermal throttling. Tasks 4 and 5 reduce CPU-side stutter. Task 3 reduces transition-time GPU spikes.

## Validation

- Test on iPhone 14 with `?fps` URL parameter to observe FPS counter
- Verify 60 FPS sustained for 5+ minutes (thermal steady state)
- Check that visual quality degradation from downsampling is acceptable at viewing distance
- Confirm no memory growth over 30 minutes of scene transitions
