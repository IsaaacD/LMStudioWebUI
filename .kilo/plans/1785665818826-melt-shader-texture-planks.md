# Melt Shader: Texture-Translated Planks

## Goal

Rewire the plank loop so each plank displays the frozen scene texture, with the UV offset by the plank's drift. As planks slide up/down, the texture content slides with them. Where the translated UV goes out of bounds `[0,1]`, the plank becomes transparent and the new scene (`tDiffuse`) shows through.

## Current Problem

Lines 185-188 sample `uFrozenTexture` at the plank's **home** UV:
```glsl
vec2 sourceUv = vec2(plankX + localX * plankW, plankY + localY * plankH);
```
The texture is pinned; only the plank *frame* moves. Also, lines 192-206 blend a procedural wood grain over the texture sample at 55%, which obscures the scene content.

## Changes

### 1. Translate texture UV by drift offset

Inside the plank loop, replace the `sourceUv` computation (line 185-188) so the sampled region shifts with the plank:

```glsl
vec2 sourceUv = vec2(
    plankX + localX * plankW + swayX,
    plankY + localY * plankH + driftY
);
```

This makes the texture content travel with the plank frame. A plank drifting downward will display scene content that has shifted downward relative to its top edge.

### 2. Zero alpha for out-of-bounds texture samples

After computing `sourceUv`, check bounds. If either component falls outside `[0, 1]`, the fragment contribution for this plank is zero alpha (new scene shows through):

```glsl
float inBounds = step(0.0, sourceUv.x) * step(sourceUv.x, 1.0) *
                 step(0.0, sourceUv.y) * step(sourceUv.y, 1.0);
```

Multiply `plankFadeIn` by `inBounds` so out-of-bounds regions contribute nothing.

### 3. Remove procedural wood grain overlay

Delete lines 192-206 (`woodGrain1D`, `woodKnot`, `grainColor`, `tinted`). The frozen texture itself is the visual content. The plank color becomes just the texture sample:

```glsl
vec4 plankTexel = texture2D(uFrozenTexture, sourceUv);
vec3 pColor = plankTexel.rgb;
```

Keep the `edgeFade` (lines 203-204) for soft plank borders, but apply it to the texture color directly:
```glsl
pColor = mix(pColor * 0.3, pColor, edgeFade);
```

### 4. Preserve existing behavior

- `frozenAlpha` cross-fade (line 218) — unchanged
- `meltZone` / `meltBoundary` drip effect — unchanged
- `displacementAmount` distortion on the background frozen layer — unchanged
- Glitch lines and pixel jitter — unchanged
- Plank motion parameters (`driftDir`, `driftMax`, `swayAmount`, etc.) — unchanged
- `meltEase` easing curve — unchanged

## Affected Lines

| Line(s) | Change |
|---------|--------|
| 185-188 | Add `swayX`/`driftY` to `sourceUv` |
| After 188 | Insert `inBounds` check |
| 190 | Keep `texture2D` call |
| 192-206 | Delete wood grain/knot overlay, replace with direct texture color |
| 209 | Multiply `plankFadeIn` by `inBounds` |
| 211-212 | Use `pColor` instead of `tinted` |
| 56-73 | Delete `woodGrain1D` and `woodKnot` functions (no longer called) |

## Visual Result

- Planks carry a cutout of the frozen scene texture
- As planks drift, the texture region inside each plank slides with it
- Where the slide pushes texture out of bounds, the plank becomes transparent
- The new scene is visible through those transparent gaps
- The overall frozen layer still fades via `frozenAlpha` as `uMeltProgress` reaches 1.0
