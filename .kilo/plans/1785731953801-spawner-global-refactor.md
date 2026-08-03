# Plan: Refactor imageSpawner & heartSpawner to Global Level

## Goal

Move `ImageSpawner` and `HeartSpawner` creation from `cityScene.js` to `index.js`. Spawners are created once, reparented to the active scene on every transition, and updated each frame in the animation loop. Pool meshes reset (hidden) on each scene transition.

## Context & Current State

- **Only `cityScene.js`** creates spawners (`ket/scenes/cityScene.js:26-27`), stores them in `managers`, and updates them in `onUpdate` (`:61-62`)
- **Other 3 scenes** (sparse, lumber, liminal) have no spawners
- Spawners add pool meshes to `this.scene` in their constructors
- `PostProcessor.render(scene)` sets `renderPass.scene = scene` per-frame — only the active scene renders
- `SceneManager.switchTo()` fires `onExit`/`onEnter` but has no spawner awareness

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Spawner lifetime | Created once in `index.js` | Avoids per-scene allocation, single source of truth |
| Scene attachment | `setScene()` reparents pool meshes | Spawners track `this.scene`; meshes must live in the rendered scene |
| State on transition | **Reset** (all meshes hidden) | User preference; avoids stale positions from old scene |
| Update location | Animation loop, after `activeScene.onUpdate` | Decouples spawners from individual scene code |
| Scene factory signature | **No change** | Spawners are managed externally; scenes don't need spawner refs |

## Implementation Tasks

### 1. Add `setScene()` and `reset()` to `ImageSpawner` (`ket/modules/imageSpawner.js`)

```js
// In ImageSpawner class:

setScene(newScene) {
    for (const mesh of this.pool) {
        this.scene.remove(mesh);
        newScene.add(mesh);
    }
    this.scene = newScene;
}

reset() {
    for (const mesh of this.pool) {
        mesh.visible = false;
    }
    this.nextFree = 0;
    this.nextSpawnTime = minMaxRange(2, 4);
    this.spawnCounter = 0;
}
```

### 2. Add `setScene()` and `reset()` to `HeartSpawner` (`ket/modules/heartSpawner.js`)

```js
// In HeartSpawner class:

setScene(newScene) {
    for (const mesh of this.pool) {
        this.scene.remove(mesh);
        newScene.add(mesh);
    }
    this.scene = newScene;
}

reset() {
    for (const mesh of this.pool) {
        mesh.visible = false;
    }
    this.nextFree = 0;
    this.nextSpawnTime = minMaxRange(1, 3);
    this.spawnCounter = 0;
}
```

### 3. Remove spawner creation from `cityScene.js` (`ket/scenes/cityScene.js`)

- **Delete** lines 4-5 (imports of `HeartSpawner` and `ImageSpawner`)
- **Delete** lines 26-27 (`new ImageSpawner(...)` and `new HeartSpawner(...)`)
- **Delete** `imageSpawner` and `heartSpawner` from `managers` object (line 36)
- **Delete** `imageSpawner.update(...)` and `heartSpawner.update(...)` from `onUpdate` (lines 61-62)
- If `managers` object becomes empty or only holds tileManager/primitiveManager, keep it as-is

### 4. Create spawners in `index.js` (`ket/index.js`)

After material creation (~line 78), before `resolveInitialScene()`:

```js
// After line 78 (heartMaterial creation):
const imageSpawner = new ImageSpawner(cityScene.threeScene, 'images/ralph.png');
const heartSpawner = new HeartSpawner(cityScene.threeScene, heartMaterial);
```

Actually, spawners need a `threeScene` but scenes aren't created yet at that point. The correct order:

1. Create scenes as before (lines 80-83)
2. Create spawners attached to the initial scene's `threeScene`
3. Pass spawners to `AnimationLoop`

```js
// After scene creation and registration (~line 87):
const initialScene = sceneManager.resolveInitialScene();

// Create global spawners attached to the initial active scene
const imageSpawner = new ImageSpawner(initialScene.threeScene, 'images/ralph.png');
const heartSpawner = new HeartSpawner(initialScene.threeScene, heartMaterial);
```

Add imports at top of `index.js`:
```js
import { ImageSpawner } from './modules/imageSpawner.js';
// HeartSpawner class is already imported via createHeartMaterial line, but need the class:
import { createHeartMaterial, HeartSpawner } from './modules/heartSpawner.js';
```

### 5. Pass spawners to `AnimationLoop` (`ket/index.js`)

Update `AnimationLoop` constructor call to include spawners:

```js
animationLoop = new AnimationLoop({
    camera,
    composer: postProcessor,
    params,
    sceneManager,
    transitionEffect,
    raveEngine,
    fpsCounter,
    webrtcManager,
    imageSpawner,
    heartSpawner
});
```

### 6. Update `AnimationLoop` (`ket/modules/animation.js`)

- Accept `imageSpawner` and `heartSpawner` in constructor
- Store as `this.imageSpawner` / `this.heartSpawner`
- Track `this._lastSpawnerScene` to detect transitions
- In `animate()`, after `activeScene.onUpdate()` call (~line 154), add spawner update logic:

```js
// After activeScene.onUpdate(...) call, before composer.update(...):

// Reparent spawners if scene changed
if (activeScene && this.imageSpawner && this.heartSpawner) {
    if (this._lastSpawnerScene !== activeScene.threeScene) {
        this.imageSpawner.reset();
        this.imageSpawner.setScene(activeScene.threeScene);
        this.heartSpawner.reset();
        this.heartSpawner.setScene(activeScene.threeScene);
        this._lastSpawnerScene = activeScene.threeScene;
    }

    this.imageSpawner.update(this.camera, effectiveTime, dt);
    this.heartSpawner.update(this.camera, effectiveTime, dt, activeParams.colorA, activeParams.colorB);
}
```

## Files Modified

| File | Change |
|---|---|
| `ket/modules/imageSpawner.js` | Add `setScene()`, `reset()` methods |
| `ket/modules/heartSpawner.js` | Add `setScene()`, `reset()` methods |
| `ket/scenes/cityScene.js` | Remove spawner imports, creation, manager entries, and update calls |
| `ket/index.js` | Import spawner classes, create instances, pass to AnimationLoop |
| `ket/modules/animation.js` | Accept spawners in constructor, update them each frame with scene-reparenting logic |

## Risk & Edge Cases

- **Initial scene**: Spawners are created after `resolveInitialScene()`, so `_lastSpawnerScene` is correctly set on first frame — no double-reset
- **Transition timing**: `reset()` + `setScene()` happen before spawner `update()` in the same frame, so no meshes render in the wrong scene
- **Heart material sharing**: `heartMaterial` is already created in `index.js` and shared with cityScene — no conflict
- **Image texture loading**: `ImageSpawner` loads async; the `loaded` flag already guards against early updates
