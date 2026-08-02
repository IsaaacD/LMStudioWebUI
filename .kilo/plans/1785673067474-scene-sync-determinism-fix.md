# Plan: Fix Non-Deterministic Scene Transitions (Updated)

## Status

Partially implemented. `_pickTarget()` now passes `this._nextPickSeed` to `_weightedPick()` (line 221). **One remaining source of non-determinism.**

## Root Cause

In `sceneManager.js`, the `_pickTarget()` method now correctly uses `this._nextPickSeed` as the seed. However, in the **switch-time path** of `update()`, `_nextPickSeed` is set to `Date.now()`, which differs across devices:

| Path | Line | `_nextPickSeed` value | Deterministic? |
|---|---|---|---|
| Switch-time path | 194 | `Date.now()` | **No** |
| Duration path | 200 | `this.lastSwitchCount` | Yes |
| Constructor | 14 | `Date.now()` | No (minor, see below) |

The switch-time path fires when `getSwitchCount()` detects a new scheduled switch window. It picks a scene using `_nextPickSeed`, but since `_nextPickSeed` is set to `Date.now()`, different devices pick different scenes.

## Remaining Fix

### 1. Use deterministic seed in switch-time path

**File:** `ket/modules/sceneManager.js:194`

```js
// BEFORE
this._nextPickSeed = Date.now();

// AFTER
this._nextPickSeed = count;
```

`count` is already in scope and is the deterministic switch count — the same value used as seed in `resolveInitialScene()` (line 65) and equivalent to `this.lastSwitchCount` in the duration path (line 200).

### 2. (Optional) Initialize `_nextPickSeed` deterministically in constructor

**File:** `ket/modules/sceneManager.js:14`

```js
// BEFORE
this._nextPickSeed = Date.now();

// AFTER
this._nextPickSeed = 0;
```

This is minor: `resolveInitialScene()` bypasses `_pickTarget()` and calls `_weightedPick(count)` directly, so the constructor value is never used for the initial scene. But if any code path calls `_pickTarget()` before the first `update()`, a deterministic default avoids drift.

## Validation

- Open the app on two devices at the same time on the same day
- Both devices should switch to the same scene at every switch boundary
- Verify `_weightedPick` receives the same seed value on both devices for the same switch count

## Risk

Low. Single-line change to use an already-available deterministic variable instead of `Date.now()`.
