# Warp + Edge Glow Transition Shader Plan

## Goal

Replace `ket/shaders/melt.frag` with a new transition shader that uses:
- **Bidirectional warping** (x and y axis distortion via noise-driven displacement)
- **Edge glow** (luminance spike along the warp boundary between old and new scenes)

The existing `TransitionMelt` JS class and postprocessing pipeline remain unchanged — only the fragment shader is replaced.

## Current State

- `melt.frag` implements a complex 4x3 plank grid with drip simulation, glitch lines, pixel jitter, and per-plank drift/sway. This is computationally heavy and was the source of stalling/latency bugs.
- The shader receives uniforms: `tDiffuse` (new scene), `uFrozenTexture` (snapshot of old scene), `uMeltProgress` (0→1), `uRevealBlend` (0→1), `uTime`, `uResolution`, `uColorA`, `uColorB`.
- `TransitionMelt` phases: idle → freeze → capturing → swapping → dissolve → cooldown → idle. The dissolve phase drives `uMeltProgress` and `uRevealBlend` from 0→1 over 1.2s.

## Design

### Warp Function

Use a multi-octave noise-based displacement that warps UV coordinates in both x and y. The warp intensity peaks mid-transition (around `uMeltProgress = 0.5`) and fades to zero at the start and end, creating a smooth "liquid tunnel" effect.

```
warpIntensity = sin(progress * PI)  // 0 at start/end, 1 at midpoint
displacement  = warpIntensity * noiseBasedOffset(uv, time)
```

The noise uses 3 octaves at different frequencies for organic, multi-scale distortion.

### Edge Glow

Compute the gradient magnitude of the warp displacement field. High-gradient regions (where the warp changes rapidly) get a colored glow using `uColorA` and `uColorB` blended by position. This creates a luminous boundary that traces the distortion front.

```
glow = gradientMagnitude(warpField) * glowIntensity
finalColor += glow * mix(uColorA, uColorB, uv.x)
```

### Scene Blend

Simple linear blend between frozen texture (old scene) and `tDiffuse` (new scene), controlled by `uRevealBlend`. The warped UVs are applied to both textures so the transition feels cohesive.

## Files to Modify

1. **`ket/shaders/melt.frag`** — Complete rewrite. Remove plank grid, drip, glitch, and pixel jitter logic. Replace with warp + glow implementation.

## Implementation Details

### `melt.frag` structure:

1. **Keep**: Uniform declarations, `vUv` varying, `hash()`, `noise()` functions, `uResolution`
2. **Remove**: `GRID_COLS/ROWS`, `PLANK_GAP`, `DRIFT_*`, `SWAY_*` constants, `columnNoise`, `easeOutCubic`, `meltEase`, the entire plank loop (lines 135-185), glitch lines, pixel jitter
3. **Add**:
   - `warpUV(vec2 uv, float progress, float time)` — returns displaced UV using multi-octave noise, intensity modulated by `sin(progress * PI)`
   - Edge glow computation via finite-difference gradient of the warp field
   - Final blend: `mix(frozenColor, newColor, uRevealBlend) + glow`

### Pseudocode for the new shader:

```
main():
    uv = vUv
    progress = uMeltProgress

    // Warp both scenes with same displacement for coherence
    warpedUv = warpUV(uv, progress, uTime)

    newColor  = texture2D(tDiffuse, warpedUv)
    frozenColor = texture2D(uFrozenTexture, warpedUv)

    // Compute edge glow from warp gradient
    dx = warpUV(uv + vec2(0.001, 0), progress, uTime).x - warpUV(uv - vec2(0.001, 0), progress, uTime).x
    dy = warpUV(uv + vec2(0, 0.001), progress, uTime).y - warpUV(uv - vec2(0, 0.001), progress, uTime).y
    glowIntensity = length(vec2(dx, dy)) * some_scale

    // Blend scenes
    blended = mix(frozenColor, newColor, uRevealBlend)

    // Add glow
    glowColor = mix(uColorA, uColorB, uv.x + 0.5 * sin(uTime))
    blended += glowColor * glowIntensity

    gl_FragColor = vec4(blended, 1.0)
```

### Warp function details:

```
warpUV(uv, progress, time):
    intensity = sin(progress * 3.14159) * 0.04  // Peak at midpoint, max 4% displacement
    offset = vec2(0)
    offset += noise(uv * 3.0 + time * 0.3) * 0.5
    offset += noise(uv * 6.0 - time * 0.5) * 0.25
    offset += noise(uv * 12.0 + time * 0.7) * 0.125
    return uv + offset * intensity
```

## Validation

- Transition completes smoothly without stalling (no heavy loop over 12 planks per fragment)
- Warping is visible along both x and y axes during the dissolve phase
- Edge glow appears as a luminous boundary that moves with the warp distortion
- Scene swap happens reliably (unchanged JS logic, simpler shader reduces per-frame cost)
- No visual artifacts at progress=0 (frozen scene, no warp) or progress=1 (new scene, no warp)
