# Multi-Scene Architecture Refactoring Plan

## Context

The codebase uses a single `THREE.Scene` with module-level singletons in `scene.js`. All managers (`TileManager`, `PrimitiveManager`, `ImageSpawner`, `HeartSpawner`) inject objects into that shared scene. `AnimationLoop` drives a monolithic render loop. `PostProcessor` renders that single scene through `EffectComposer`.

**Goal**: Multi-scene system with blink-to-black + pixelation-ramp transitions, time-based auto-switching (GUI-configurable durations), camera position persistence, and a city↔test rotation loop.

## Resolved Design Decisions

| Decision | Choice |
|---|---|
| Transition trigger | Time-based auto-switch, duration configurable per scene via GUI |
| Camera state | Shared camera carries position/rotation across all scenes |
| Transition effect | Quick blink to black (~300ms), scene swap at black, fade in with pixelation that sharpens over ~2s |
| Scene rotation | Fixed cycle: `city → test → city → test → ...` |
| Post-processing | Shared `EffectComposer`; `RenderPass.scene` swapped during transitions |
| Audio | Unchanged, continues across scene boundaries |

## Architecture

### `SceneDefinition` Interface

Each scene exports an object conforming to:

```js
{
  id: string,                  // unique key, e.g. "city", "test"
  name: string,                // display name for GUI
  threeScene: THREE.Scene,     // its own THREE.Scene graph
  defaultDuration: number,     // seconds before auto-advance (overridable via GUI)
  onEnter(camera) {},          // called when scene becomes active
  onExit(camera) {},           // called before scene is swapped out
  onUpdate(camera, effectiveTime, dt, activeParams) {}, // per-frame update
}
```

`activeParams` is the resolved parameter set (from `params` directly, or from `RaveEngine.getActiveParams()` in rave mode). It includes `colorA`, `colorB`, `foldIntensity`, `timeScale`, etc. — everything the city scene's managers need to update uniforms.

### `SceneManager` — Registry & Rotation Controller

```
SceneManager
├── scenes: Map<id, SceneDefinition>
├── rotation: string[]         // ordered scene IDs, e.g. ["city", "test"]
├── activeIndex: number        // current position in rotation
├── timer: { elapsed, maxDuration }
├── registerScene(definition)
├── getActiveScene() → SceneDefinition
├── nextScene() → SceneDefinition  // advance rotation, return target
├── switchTo(targetId)           // call onExit/swap/onEnter lifecycle
├── setDuration(sceneId, seconds) // GUI-driven duration override
├── getDuration(sceneId) → number
└── update(dt)                   // advance timer, return true if transition needed
```

**Timer logic**: `update(dt)` increments `timer.elapsed`. When `elapsed >= maxDuration`, returns `true` and resets elapsed to 0. The `maxDuration` comes from the active scene's `defaultDuration`, overridden by any GUI-set value.

### `TransitionEffect` — Blink + Pixelation Ramp

```
TransitionEffect
├── phase: 'idle' | 'fadingOut' | 'fadingIn'
├── elapsed: number            // time in current phase
├── fadeOutDuration: 0.3       // seconds for blink to black
├── fadeInDuration: 2.0        // seconds for pixelation to sharpen
├── pixelationPass: ShaderPass // post-processing pass, always in chain
├── start()                    // begin fadeOut phase
├── update(dt) → boolean       // advance phases, returns true when idle
├── getSharpness() → 0..1      // 0=fuzzy, 1=sharp (drives pixelation shader)
├── getBackgroundOverride() → Color|null  // black during fadeOut, null otherwise
└── isIdle() → boolean
```

**Phase timeline**:
```
t=0.0s  ── fadeOut begins (screen fades to black via background color override)
t=0.3s  ── screen is black, scene swap happens here (invisible to user)
t=0.3s  ── fadeIn begins, sharpness=0 (fully pixelated)
t=2.3s  ── sharpness=1 (fully sharp), transition complete, phase=idle
```

### Pixelation Shader

**`shaders/pixelate.frag`**:
```glsl
uniform sampler2D tDiffuse;
uniform float uSharpness;    // 0..1, driven by TransitionEffect.getSharpness()
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
    // Max block size when sharpness=0, 1px when sharpness=1
    float blockSize = mix(32.0, 1.0, uSharpness);
    vec2 pixelatedUv = floor(vUv * uResolution / blockSize) * blockSize / uResolution;
    gl_FragColor = texture2D(tDiffuse, pixelatedUv);
}
```

**`shaders/pixelate.vert`**: Standard full-screen vertex shader (same pattern as `sorbel.vert`).

The pixelation pass is a `ShaderPass` inserted as the **last pass** in the `EffectComposer` chain (after bloom and edge detection). When `uSharpness = 1.0`, it's a no-op passthrough.

### Test Scene

A minimal scene in `scenes/testScene.js`:
- Dark background (`0x000000`)
- Heavy fog (`FogExp2(0x000000, 0.02)`) for depth fade
- 50 floating `THREE.IcosahedronGeometry` meshes with `MeshStandardMaterial`
- Two `PointLight` sources with animated color cycling
- `onUpdate` rotates and bounces the geometries
- Visually distinct from city scene to confirm transitions work

## Refactored Module Responsibilities

### `modules/scene.js` — Shared Infrastructure

**Remove**: `scene` singleton, `getScene()`.
**Keep**: `camera`, `renderer`, `clock` as shared singletons.
**No rename**: Keep export names (`getCamera()`, `getRenderer()`, `getClock()`) — they were never scene-specific.

### `modules/postprocessing.js` — PostProcessor

**Add**:
- `pixelationPass` as last pass in composer chain
- `setScene(threeScene)` — swaps `this.renderPass.scene`
- `setPixelationSharpness(value)` — updates `pixelationPass.uniforms.uSharpness`
- `render()` becomes `render(scene)` — calls `setScene(scene)` then `composer.render()`

### `modules/animation.js` — AnimationLoop

**Constructor** now accepts `{ sceneManager, transitionEffect, composer, params, ... }` instead of individual managers.

**Per-frame `animate()` logic**:

```
1. if (transitionEffect.isIdle()) {
       // Advance scene timer
       if (sceneManager.update(dt)) {
           // Timer expired, start transition
           transitionEffect.start();
       }
   } else {
       // Mid-transition
       if (transitionEffect.update(dt)) {
           // Transition finished, back to idle
       } else if (transitionEffect.phase === 'fadingOut') {
           // Still fading, nothing to render visibly
           composer.render(null); // or skip
       } else if (transitionEffect.phase just entered 'fadingIn') {
           // Scene was already swapped at fadeOut→fadeIn boundary
       }
   }

2. activeScene = sceneManager.getActiveScene()

3. activeScene.onUpdate(camera, effectiveTime, dt)

4. composer.setPixelationSharpness(transitionEffect.getSharpness())

5. Apply background override if transitionEffect provides one

6. composer.render(activeScene.threeScene)

7. Camera control logic (unchanged — camera is shared)
```

**Camera control**: Unchanged. Manual/auto camera movement applies to the shared camera regardless of active scene.

### `modules/config.js`

**Add** to `defaultParams`:
```js
sceneDurationCity: 45,     // seconds
sceneDurationTest: 10,    // seconds
```

### `modules/ui.js`

**Add** to GUI under a new "Scenes" folder:
- `Scene Duration (City)` — slider, drives `params.sceneDurationCity`
- `Scene Duration (Test)` — slider, drives `params.sceneDurationTest`
- `Next Scene` — button, manually triggers transition
- `Current Scene` — read-only label showing active scene name

### `index.js` — Bootstrap

```js
async function bootstrap() {
    initScene(); // initializes camera, renderer, clock (no scene)
    initAudio(...);

    // Create materials (shared across scenes that use them)
    const cityMaterial = await createCityMaterial();
    // ...

    // Build scene manager
    const sceneManager = new SceneManager();
    sceneManager.registerScene(await createCityScene(cityMaterial, wallMaterial, ...));
    sceneManager.registerScene(await createTestScene());

    // Build transition effect
    const postProcessor = new PostProcessor(renderer, camera);
    await postProcessor.initEdgePass();
    postProcessor.initPixelationPass(); // NEW

    const transitionEffect = new TransitionEffect(postProcessor);

    // Build animation loop
    const animationLoop = new AnimationLoop({
        sceneManager,
        transitionEffect,
        composer: postProcessor,
        params,
        // ... camera control params unchanged
    });

    // ... resize handler, audio callback, etc.
}
```

### `scenes/cityScene.js` — Current Scene Wrapped

Exports `async function createCityScene(cityMaterial, wallMaterial, primitiveMaterial, heartMaterial)`.

Returns a `SceneDefinition` that:
- Creates its own `THREE.Scene` with `FogExp2(0x050011, 0.0003)` background
- Instantiates `TileManager`, `PrimitiveManager`, `ImageSpawner`, `HeartSpawner` against its own scene
- `onEnter()`: no-op (objects persist in scene graph)
- `onExit()`: no-op (objects persist, just not rendered)
- `onUpdate(camera, effectiveTime, dt)`: delegates to all four managers' `update()` calls, plus uniform updates (the logic currently in `AnimationLoop.animate()` lines 115-158)

### `scenes/testScene.js` — Temporary Test Scene

Exports `async function createTestScene()`.

Returns a `SceneDefinition` that:
- Creates a `THREE.Scene` with black background and heavy fog
- Populates with ~50 icosahedron meshes
- `onUpdate()`: rotates/bounces geometries, cycles light colors

### Manager Modules (tiles.js, primitives.js, etc.)

**Unchanged**. These modules receive a `scene` reference in their constructor and add objects to it. When called from `cityScene.js`, they receive the city scene's `THREE.Scene`. No modifications needed.

## File Structure After Refactor

```
ket/
├── index.js                          # bootstrap, wires SceneManager + TransitionEffect
├── modules/
│   ├── scene.js                      # shared camera, renderer, clock (no scene singleton)
│   ├── sceneManager.js               # NEW: scene registry, rotation, timer
│   ├── transition.js                 # NEW: blink+pixelation transition controller
│   ├── animation.js                  # refactored: delegates to sceneManager
│   ├── postprocessing.js             # adds pixelation pass, parameterized render(scene)
│   ├── config.js                     # adds scene duration defaults
│   ├── ui.js                         # adds Scenes folder to GUI
│   ├── raveMode.js                   # unchanged
│   ├── touchControls.js              # unchanged
│   ├── utils.js                      # unchanged
│   ├── materials.js                  # unchanged
│   ├── tiles.js                      # unchanged
│   ├── primitives.js                 # unchanged
│   ├── heartSpawner.js               # unchanged
│   └── imageSpawner.js               # unchanged
├── scenes/                           # NEW directory
│   ├── cityScene.js                  # wraps current city/tunnel logic
│   └── testScene.js                  # minimal test scene
└── shaders/
    ├── pixelate.vert                 # NEW: full-screen vertex shader
    ├── pixelate.frag                 # NEW: resolution-based pixelation
    └── (existing shaders unchanged)
```

## Implementation Order

### 1. Foundation modules (no visible change)
- Create `modules/sceneManager.js` — registry, rotation, timer
- Create `modules/transition.js` — phase machine, sharpness curve
- Create `shaders/pixelate.vert` and `shaders/pixelate.frag`

### 2. Post-processing extension
- Add `initPixelationPass()` to `PostProcessor`
- Add `setScene()`, `setPixelationSharpness()` methods
- Change `render()` to accept scene parameter

### 3. Scene wrapping
- Create `scenes/cityScene.js` — migrate city manager logic from `AnimationLoop` into `onUpdate()`
- Create `scenes/testScene.js` — minimal geometric scene

### 4. `scene.js` cleanup
- Remove `scene` singleton and `getScene()` export
- Everything else unchanged

### 5. `AnimationLoop` refactor
- Replace manager-specific constructor params with `sceneManager` + `transitionEffect`
- Replace inline update logic with `activeScene.onUpdate()` delegation
- Insert transition phase handling in `animate()`

### 6. Bootstrap wiring
- Refactor `index.js` to use `SceneManager`, register both scenes
- Instantiate `TransitionEffect`, wire to `PostProcessor`

### 7. GUI extension
- Add "Scenes" folder to `ui.js` with duration sliders and next-scene button
- Wire duration params to `SceneManager.setDuration()`

### 8. Config defaults
- Add `sceneDurationCity` and `sceneDurationTest` to `defaultParams`

## Validation Steps

1. **Single-scene parity**: Run with only city scene registered. Verify visual output is identical to current behavior (tile animation, primitives, hearts, images, post-processing, camera control).
2. **Transition fires**: With both scenes registered, verify blink-to-black occurs after city duration expires, test scene appears pixelated, then sharpens over 2 seconds.
3. **Rotation loop**: Verify city → test → city cycle repeats correctly.
4. **Camera carry-over**: Move camera manually in city scene, verify position/rotation is preserved when test scene appears.
5. **GUI duration override**: Change scene duration in GUI, verify timer responds immediately.
6. **Manual next-scene button**: Verify button triggers transition regardless of timer state.
7. **Pause interaction**: Verify `params.paused` freezes both scene updates and transition timer.

## Risks

| Risk | Mitigation |
|---|---|
| `RenderPass.scene` swap causes GPU state issues | Swap only during fadeOut phase when screen is black |
| Pixelation pass adds overhead every frame | `uSharpness=1.0` is a no-op in fragment shader (single texture sample at native UV) |
| City scene managers accumulate objects over time | Managers already use object pooling with recycling; behavior unchanged |
| `AnimationLoop` uniform update logic scattered across scene's `onUpdate` | Extract cleanly into `cityScene.onUpdate()`; no logic is duplicated |
| `getScene()` removal breaks external callers | Only `index.js:33` calls it; update during bootstrap refactor |
