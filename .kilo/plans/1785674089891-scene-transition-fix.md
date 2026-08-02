# Fix: Premature Transition in `SceneManager.update()`

## Bug Location

`ket/modules/sceneManager.js`, line 208, inside the `update(dt)` method (lines 188-211).

## Root Cause

The `update(dt)` method has two paths for triggering a scene transition:

1. **Switch-time path** (lines 191-196): When `getSwitchCount()` detects a new scheduled switch time has passed.
2. **Duration path** (lines 197-209): When `elapsed >= maxDuration`.

In the duration path, when `_pickTarget()` returns `null`/falsy (line 202 condition fails), line 208 executes:

```js
this.timer.elapsed = this.timer.elapsed - this.timer.maxDuration;
```

This leaves `elapsed` as a small positive remainder (e.g., `45.016 - 45 = 0.016`). On the next frame, `dt` (~0.016s) is added via line 197. If `maxDuration` has been reduced (e.g., by a duration override or a scene with a shorter minDuration), the remainder + accumulated `dt` values can quickly exceed the new `maxDuration`, causing a premature transition fire.

**The correct behavior:** The duration check should only fire a transition when the full elapsed time since the last reset has reached `maxDuration`. The subtraction on line 208 corrupts the timer state by resetting elapsed to a remainder instead of letting it continue naturally.

## Fix

Remove line 208 entirely:

```js
// BEFORE (line 208)
this.timer.elapsed = this.timer.elapsed - this.timer.maxDuration;

// AFTER
// (line deleted)
```

The timer state is already correctly managed by the other paths:
- When a switch time is detected (lines 191-196), `elapsed` resets to `0`.
- When a target is successfully picked (lines 202-206), `elapsed` resets to `0`.
- When no target is found, `elapsed` retains its value and continues accumulating on the next frame via line 197. The switch-time path (line 191) will eventually catch up and trigger the transition at the correct time.

## Affected Files

- `ket/modules/sceneManager.js` — line 208 removed

## Validation

1. After a failed `_pickTarget()`, verify the transition does not re-fire on the next frame.
2. Confirm normal transitions still fire correctly when `elapsed >= maxDuration` and a target is available.
3. Confirm the switch-time-based path (lines 191-196) remains unaffected.
4. Verify the UI timer display (`onTimerUpdate` callback at `animation.js:222`) shows correct countdown behavior.
