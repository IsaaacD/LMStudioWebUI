# Fix SceneManager Determinism and Weight Issues

## Root Causes

1. **`_weightedPick` ignores `excludeId`** — The parameter is passed but never used. The current scene remains in the candidate pool and can be selected as its own successor, causing `_pickTarget` to return `null`.
2. **Timer-path consumes seed on null picks** — When `_pickTarget` returns `null`, `_nextPickSeed` was already incremented (line 200), but no switch happened. The seed is wasted and the next cycle re-picks from an advanced seed, breaking the deterministic mapping between switch events and scene choices.
3. **`_applyDuration` passes switch index instead of timestamp** — Line 118 calls `deriveDuration(this.lastSwitchCount, ...)` but `deriveDuration` expects a timestamp (see line 34 in `rebuild()` which correctly passes `t`).

## Fixes

### File: `ket/modules/sceneManager.js`

**Fix 1: Use `excludeId` in `_weightedPick`**
- Filter out `excludeId` from candidates when it is provided, so the current scene cannot be picked as its own successor.

**Fix 2: Advance `_nextPickSeed` inside `_pickTarget`, not before**
- Move the `_nextPickSeed++` into `_pickTarget()` so the seed is only consumed when a valid target is returned.
- In `update()` timer path (line 200), remove the pre-increment. Let `_pickTarget` handle seed advancement internally.
- In `resolveInitialScene()` (line 65), the seed is already set to `count` before the call, so `_pickTarget` will advance it correctly.

**Fix 3: Pass actual switch timestamp to `deriveDuration`**
- Line 118: Replace `this.lastSwitchCount` with `this.switchTimes[this.lastSwitchCount]` to pass the real timestamp.

## Validation

- Verify `_weightedPick` no longer returns the current scene's ID when `excludeId` is set.
- Verify `_applyDuration` produces different durations per switch event (not all the same value from hashing a small index).
- Verify the timer path doesn't skip switches due to repeated null returns.
