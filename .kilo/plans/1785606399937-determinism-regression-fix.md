# Determinism Regression Fix: Weighted Choice & Duration

## Problem

Two devices loading the same page on the same date should produce identical scene selections and durations. This is broken because `Date.now()` is used as a hash seed in duration derivation, producing different values per device.

Additionally, the `_weightedPick` exclusion logic was lost: `excludeId` is accepted as a parameter but never used, causing high-weight scenes to be re-selected and transitions to stall.

## Root Causes

### 1. `_applyDuration` uses `Date.now()` as hash seed (line 114)

```javascript
duration = deriveDuration(Date.now(), next.minDuration, next.maxDuration);
```

`Date.now()` differs by milliseconds across devices. Since `deriveDuration` feeds its seed into `hashNumber()`, two devices get different durations for the same scene.

### 2. `registerScene` uses `Date.now()` as hash seed (line 81)

```javascript
deriveDuration(Date.now(), definition.minDuration, definition.maxDuration);
```

Same issue for the initial duration of the first registered scene.

### 3. `_weightedPick` ignores `excludeId` (line 85-91)

The `excludeId` parameter is passed but never referenced in the body. The current scene can be re-selected. Since city has weight 3/7 (43%), it is frequently re-picked, causing `_pickTarget` to return `null` (guard at line 218) and transitions to stall.

## Determinism Analysis

| Component | Seed Source | Deterministic? |
|---|---|---|
| `_seed` (hashNumber) | URL `?seed=` or default `42` | Yes |
| `switchTimes[]` schedule | `todayAnchor()` + iterative hash | Yes |
| `_nextPickSeed` | Derived from switch count | Yes |
| `_weightedPick` seed | `_nextPickSeed` (deterministic) | Yes |
| `_applyDuration` seed | `Date.now()` | **NO** |
| `registerScene` seed | `Date.now()` | **NO** |

## Fixes

### Fix 1: `_applyDuration` - use `this.lastSwitchCount` as seed

`lastSwitchCount` is set before `_applyDuration` is called in every code path (`resolveInitialScene`, `switchTo`, `switchToNext`, `update`). It is deterministic (derived from the `switchTimes` schedule seeded by `todayAnchor()`).

```javascript
// _applyDuration line 114
// Before:
duration = deriveDuration(Date.now(), next.minDuration, next.maxDuration);
// After:
duration = deriveDuration(this.lastSwitchCount, next.minDuration, next.maxDuration);
```

### Fix 2: `registerScene` - use `todayAnchor()` as seed

At construction time, `_nextPickSeed` is 0 and `lastSwitchCount` has not been set yet. Use `todayAnchor()` for the initial duration.

```javascript
// registerScene line 81
// Before:
deriveDuration(Date.now(), definition.minDuration, definition.maxDuration)
// After:
deriveDuration(todayAnchor(), definition.minDuration, definition.maxDuration)
```

### Fix 3: `_weightedPick` - restore zero-weight exclusion

```javascript
// _weightedPick line 89-90
// Before:
const w = s?.weight ?? 1;
return { id, weight: w };
// After:
const w = s?.weight ?? 1;
return { id, weight: id === excludeId ? 0 : w };
```

This preserves correct weight distribution (total weight unchanged) while preventing the current scene from being re-selected.

## Validation

- Open the app on two devices (or two browser instances) at the same time on the same date
- Verify the same scene sequence and durations appear
- Verify no scene is shown twice in succession
- Verify transitions do not stall (no repeated `null` from `_pickTarget`)
