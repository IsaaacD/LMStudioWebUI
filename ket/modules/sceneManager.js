import { deriveDuration, hashNumber, todayAnchor } from './utils.js';

const MIN_DURATION = 15;
const MAX_DURATION = 60;

export class SceneManager {
    constructor() {
        this.scenes = new Map();
        this.rotation = [];
        this.activeIndex = 0;
        this.timer = { elapsed: 0, maxDuration: 45 };
        this.durationOverrides = new Map();
        this.switchTimes = [];
        this._pickCache = { count: -1, target: null };
        this.anchoredDate = null;
        this.lastSwitchCount = 0;
        this.composer = null;
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
        const first = this.scenes.values().next().value;
        const minDur = first?.minDuration ?? MIN_DURATION;
        const maxDur = first?.maxDuration ?? MAX_DURATION;
        while (t < end) {
            t += deriveDuration(t, minDur, maxDur) * 1000;
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
                this.timeUntilNextSwitch();
        }
    }

    _weightedPick(seed, excludeId) {
        const candidates = this.rotation
            .filter(id => id !== excludeId)
            .map(id => {
                const s = this.scenes.get(id);
                return { id, weight: s?.weight ?? 1 };
            });
        if (candidates.length === 0) return this.rotation[0] ?? null;
        if (candidates.length === 1) return candidates[0].id;
        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let r = hashNumber(seed) * totalWeight;
        for (const c of candidates) {
            r -= c.weight;
            if (r <= 0) return c.id;
        }
        return candidates[candidates.length - 1].id;
    }

    getActiveScene() {
        const activeId = this.rotation[this.activeIndex];
        return this.scenes.get(activeId);
    }

    _applyDuration(next) {
        let duration;
        const override = this.durationOverrides.get(next.id);
        if (override !== undefined) {
            duration = override;
        } else {
            duration = this.timeUntilNextSwitch();
        }
        this.timer.maxDuration = Math.max(next.minDuration, Math.min(next.maxDuration, duration));
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

    switchToRandomOrBaseline() {
        const count = this.getSwitchCount();
        const currentId = this.rotation[this.activeIndex];
        const targetId = this._weightedPick(count);
        if (targetId === currentId) return;
        this.switchTo(targetId);
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

    update(dt) {
        this.rebuild();
        const count = this.getSwitchCount();
        if (count > this.lastSwitchCount) {
            this.lastSwitchCount = count;
            this.timer.elapsed = 0;
            this._applyDuration(this.getActiveScene());
            return this._pickTarget(count);
        }
        this.timer.elapsed += dt;
        if (this.timer.elapsed >= this.timer.maxDuration) {
            return this._pickTarget(count);
        }
        return null;
    }

    _pickTarget(count) {
        if (this._pickCache.count !== count) {
            const targetId = this._weightedPick(count);
            const currentId = this.rotation[this.activeIndex];
            this._pickCache = { count, target: (targetId === currentId) ? null : targetId };
        }
        return this._pickCache.target;
    }

    switchIfTarget(targetId) {
        if (targetId) this.switchTo(targetId);
    }
} 