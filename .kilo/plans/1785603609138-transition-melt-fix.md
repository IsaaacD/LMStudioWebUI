# Transition Melt Bug Fix Plan

## Root Cause Analysis

### Issue 1: Animation Stalling (~4 seconds)

**Cause:** `TransitionMelt.update()` returns `true` at two points — end of `dissolve` (line 59) AND end of `cooldown` (line 71). In `animation.js:100-103`, every `true` return triggers `sceneManager.syncSwitchCount()`, which resets `timer.elapsed = 0` and rebuilds the switch schedule. Being called twice (once at dissolve→cooldown transition, once at cooldown→idle) corrupts the timer state and can cause the scene duration to be recalculated mid-transition, leading to premature re-triggering or frozen state.

Additionally, at `transitionMelt.js:58`, `this._snapshot = null` is set at the end of `dissolve`, clearing the snapshot before `cooldown` ends. This causes `isSnapshotReady()` to return `false` during cooldown, triggering an unnecessary re-capture of a snapshot at `animation.js:203-208` (capturing the already-swapped new scene).

### Issue 2: Navigation Failure (Scene Not Switching)

**Cause:** The swap window is a single frame. In `transitionMelt.js:41-45`, the `swapping` phase instantly transitions to `dissolve` within the same `update()` call. The `isReadyToSwap()` check at `animation.js:115` only returns `true` when `phase === 'swapping' && this.needSwap`. If that frame is skipped, blocked by a long render, or `requestAnimationFrame` delays execution, the swap is permanently missed. The `swapping` phase is one-frame-only and non-recoverable.

Additionally, `isReadyToSwap()` at line 92-94 only checks for the `swapping` phase, not `dissolve`. The swap must happen in that exact frame or never happens.

### Issue 3: Transition Latency (~3 seconds)

**Cause:** The total transition time is `freezeDuration (0.3s) + transitionDuration (1.5s) + cooldownDuration (2s) = 3.8s`. During the first ~2.3s (freeze + early dissolve), `revealBlend` is near 0, so the melt shader shows the frozen old scene (`melt.frag:150`). The new scene only becomes visible as `revealBlend` approaches 1 in the late dissolve phase. Combined with the 2-second cooldown where the scene is already swapped but the timer state is corrupted (from the double `syncSwitchCount`), the effective delay before the new scene is clearly visible and stable is ~3 seconds.

## Fixes

### Fix 1: `TransitionMelt.update()` — Return `true` only at idle

`update()` should only return `true` when the full transition lifecycle completes (phase returns to `idle`). Returning `true` at the end of `dissolve` causes a premature `syncSwitchCount()` call.

### Fix 2: `TransitionMelt.update()` — Don't clear snapshot during dissolve

Remove `this._snapshot = null` from the dissolve→cooldown transition. The snapshot should persist until `start()` is called for the next transition (which already clears it at line 23).

### Fix 3: `isReadyToSwap()` — Widen the swap window

Change `isReadyToSwap()` to also return `true` during the `dissolve` phase, not just `swapping`. This ensures the swap is not missed if the single `swapping` frame is skipped. Guard against double-swapping by tracking whether the swap has been consumed.

### Fix 4: `animation.js` — Sync only on idle return

Change the `finished` check to only call `syncSwitchCount()` when the transition returns to `idle`, not at intermediate phase boundaries.

## Files to Modify

1. **`ket/modules/transitionMelt.js`**
   - `update()`: Remove `return true` at end of `dissolve` phase (line 59). Keep `return true` only at end of `cooldown` (line 71) and in the default fallback (line 76).
   - `update()`: Remove `this._snapshot = null` from dissolve→cooldown transition (line 58).
   - `isReadyToSwap()`: Also return `true` when `phase === 'dissolve'` (line 92-94).
   - Add `this._swapConsumed` flag to prevent double-swapping.

2. **`ket/modules/animation.js`**
   - `animate()`: The `finished` handler at lines 100-103 is correct after the `TransitionMelt` fix (since `update()` will only return `true` at idle). No change needed here if Fix 1 is applied.

## Implementation Details

### `transitionMelt.js` changes:

```javascript
// In update(), dissolve phase: remove return true and _snapshot = null
if (this.phase === 'dissolve') {
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.transitionDuration);
    this.meltProgress = t;
    this.revealBlend = t;
    if (this.elapsed >= this.transitionDuration) {
        this.phase = 'cooldown';
        this.elapsed = 0;
        this.meltProgress = 1;
        this.revealBlend = 1;
        // REMOVED: this._snapshot = null;
        return false;  // Changed from true
    }
    return false;
}

// In isReadyToSwap(), widen swap window
isReadyToSwap() {
    if (this._swapConsumed) return false;
    return (this.phase === 'swapping' || this.phase === 'dissolve') && this.needSwap;
}

// In consumeSwap(), or add new logic to mark swap as consumed
consumeSwap() {
    if (this.needSwap) {
        this.needSwap = false;
        this._swapConsumed = true;
        return true;
    }
    return false;
}

// In start(), reset the consumed flag
start() {
    // ... existing code ...
    this._swapConsumed = false;
}
```

### `animation.js` changes:

```javascript
// At the swap check (line 115-123), call consumeSwap() after swapping
if (this.transitionEffect.isReadyToSwap()) {
    if (this._forceSceneSwitch) {
        this.sceneManager.switchToRandom();
        this._forceSceneSwitch = false;
    } else {
        this.sceneManager.switchIfTarget(this._pendingSceneTarget);
    }
    this._pendingSceneTarget = null;
    this.transitionEffect.consumeSwap();  // Prevents double-swap
}
```

## Validation

- Transition should complete its full lifecycle without stalling
- Scene should switch reliably on every transition
- New scene should become visible progressively during the dissolve phase (~1.5s), not after a 3s delay
- No double `syncSwitchCount()` calls during a single transition
