import { deriveDuration, hashNumber, todayAnchor } from './utils.js';

const MIN_DURATION = 15;
const MAX_DURATION = 60;

export class SceneManager {
    constructor(options = {}) {
        this.scenes = new Map();
        this.rotation = [];
        this.activeIndex = 0;
        this.timer = { elapsed: 0, maxDuration: 45 };
        this.durationOverrides = new Map();
        this.switchTimes = [];
        this._nextPickSeed = Date.now();
        this.useSequential = false;
        this.timerPaused = false;
        this.anchoredDate = null;
        this.lastSwitchCount = 0;
        this.composer = null;
        this.hashSeed = options.hashSeed ?? 42;
        this.rebuild();
        this.lastSwitchCount = this.getSwitchCount();
    }
    rebuild() {
        const anchor = todayAnchor();
        if (this.anchoredDate === anchor) return;
        this.anchoredDate = anchor;
        this.switchTimes = [anchor];
        let t = anchor;
        const end = anchor + 86400000;
        const active = this.getActiveScene();
        const minDur = active?.minDuration ?? MIN_DURATION;
        const maxDur = active?.maxDuration ?? MAX_DURATION;
        while (t < end) {
            t += deriveDuration(t, minDur, maxDur, this.hashSeed) * 1000;
            this.switchTimes.push(t);
        }
    }

    getSwitchCount() {
        const now = Date.now();
        let lo = 0, hi = this.switchTimes.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            if (this.switchTimes[mid] <= now) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return Math.max(0, lo - 1);
    }

    timeUntilNextSwitch() {
        const count = this.getSwitchCount();
        const nextTime = this.switchTimes[count + 1];
        return Math.max(0, (nextTime - Date.now()) / 1000);
    }



    resolveInitialScene() {
        const count = this.getSwitchCount();
        this.lastSwitchCount = count;
        this.timer.elapsed = (Date.now() - this.switchTimes[count]) / 1000;
        const targetId = this._weightedPick(count);
        this.activeIndex = this.rotation.indexOf(targetId);
        if (this.activeIndex === -1) this.activeIndex = 0;
        const active = this.getActiveScene();
        if (active) {
            this._applyDuration(active);
            if (active.onEnter) active.onEnter(this.composer);
        }
        return active;
    }

    registerScene(definition) {
        definition.minDuration = definition.minDuration ?? MIN_DURATION;
        definition.maxDuration = definition.maxDuration ?? MAX_DURATION;
        definition.weight = definition.weight ?? 1;
        this.scenes.set(definition.id, definition);
        this.rotation.push(definition.id);
        if (this.scenes.size === 1) {
            this.timer.maxDuration =
                this.durationOverrides.get(definition.id) ??
                deriveDuration(todayAnchor(), definition.minDuration, definition.maxDuration, this.hashSeed);
        }
    }

    _weightedPick(seed = Date.now()) {
        const candidates = this.rotation
            .map(id => {
                const s = this.scenes.get(id);
                const w = s?.weight ?? 1;
                return { id, weight: w };
            });
        if (candidates.length === 0) return null;
        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let r = hashNumber(seed, this.hashSeed) * totalWeight;
        for (const c of candidates) {
            r -= c.weight;
            if (r <= 0) return c.id;
        }
        return candidates[candidates.length - 1].id;
    }

    getActiveScene() {
        //const activeId = this.scenes.values().next().value;
        const activeId = this.rotation[this.activeIndex];
        return this.scenes.get(activeId);
    }

    _applyDuration(next) {
        let duration;
        const override = this.durationOverrides.get(next.id);
        if (override !== undefined) {
            duration = Math.max(next.minDuration, Math.min(next.maxDuration, override));
        } else {
            duration = deriveDuration(this.switchTimes[this.lastSwitchCount], next.minDuration, next.maxDuration, this.hashSeed);
        }
        this.timer.maxDuration = duration;
    }

    switchTo(targetId) {
        const prev = this.getActiveScene();
        if (prev && prev.onExit) {
            prev.onExit(this.composer);
        }
        this.activeIndex = this.rotation.indexOf(targetId);
        if (this.activeIndex === -1) {
            this.activeIndex = 0;
        }
        const next = this.getActiveScene();
        if (next) {
            this.lastSwitchCount = this.getSwitchCount();
            this.timer.elapsed = 0;
            this._applyDuration(next);
            if (next.onEnter) {
                next.onEnter(this.composer);
            }
        }
    }

    switchToNext() {
        const prev = this.getActiveScene();
        this.activeIndex = (this.activeIndex + 1) % this.rotation.length;
        const next = this.getActiveScene();
        if (prev && prev.onExit) {
            prev.onExit(this.composer);
        }
        if (next) {
            this.lastSwitchCount = this.getSwitchCount();
            this.timer.elapsed = 0;
            this._applyDuration(next);
            if (next.onEnter) {
                next.onEnter(this.composer);
            }
        }
    }

    switchToRandom() {
        if (this.timerPaused) this._nextPickSeed = Date.now();
        const target = this._pickTarget();
        if (target) this.switchTo(target);
    }

    setDuration(sceneId, seconds) {
        this.durationOverrides.set(sceneId, seconds);
        const active = this.getActiveScene();
        if (active && active.id === sceneId) {
            this.timer.maxDuration = seconds;
        }
    }

    getDuration(sceneId) {
        const scene = this.scenes.get(sceneId);
        const duration = this.durationOverrides.get(sceneId) ?? scene?.defaultDuration ?? 45;
        return Math.max(scene?.minDuration, Math.min(scene?.maxDuration, duration));
    }

    syncSwitchCount() {
        this.rebuild();
        this.lastSwitchCount = this.getSwitchCount();
    }

    advanceTimer(dt) {
        this.timer.elapsed += dt;
    }

    update(dt) {
        this.rebuild();
        if (this.timerPaused) return null;
        const count = this.getSwitchCount();
        if (count > this.lastSwitchCount) {
            this.lastSwitchCount = count;
            this.timer.elapsed = 0;
            this._nextPickSeed = count;
            return this._pickTarget();
        }
        this.timer.elapsed += dt;
        if (this.timer.elapsed >= this.timer.maxDuration) {
            this.lastSwitchCount = this.getSwitchCount();
            this._nextPickSeed = this.lastSwitchCount;
            const target = this._pickTarget();
            if (target) {
                this.timer.elapsed = 0;
                const targetScene = this.scenes.get(target);
                if (targetScene) this._applyDuration(targetScene);
                return target;
            }
        }
        return null;
    }

    _pickTarget() {
        const currentId = this.rotation[this.activeIndex];
        let targetId;
        if (this.useSequential) {
            const nextIndex = (this.activeIndex + 1) % this.rotation.length;
            targetId = this.rotation[nextIndex];
        } else {
            //let attempts = 0;
            //do {
            targetId = this._weightedPick(this._nextPickSeed);
            //   attempts++;
            // } while (targetId === currentId && attempts < this.rotation.length);
        }

        return targetId;
    }

    switchIfTarget(targetId) {
        if (targetId) this.switchTo(targetId);
    }
} 