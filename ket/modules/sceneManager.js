/**
 * Daily schedule synchronization.
 * 
 * At init (and when the day rolls over), a chain of switch times is built
 * from midnight UTC. Each interval duration is derived from a hash of the
 * previous switch time, producing 45s–240s intervals. All devices compute
 * the identical schedule from the same daily anchor.
 * 
 * update() binary-searches Date.now() against the schedule and fires when
 * a new switch slot is reached. Scene selection in switchToRandomOrBaseline
 * is also deterministic, seeded by the switch count.
 * 
 * Override individual scene durations via setDuration().
 */
function hashNumber(n) {
    let h = (n + 0x9e3779b9) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0;
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const MIN_DURATION = 45;
const MAX_DURATION = 240;

function deriveDuration(seed) {
    return MIN_DURATION + hashNumber(seed) * (MAX_DURATION - MIN_DURATION);
}

export class SceneManager {
    constructor() {
        this.scenes = new Map();
        this.rotation = [];
        this.activeIndex = 0;
        this.timer = { elapsed: 0, maxDuration: 45 };
        this.durationOverrides = new Map();
        this.baselineSceneId = null;
        this.switchTimes = [];
        this.anchoredDate = null;
        this.lastSwitchCount = 0;
        this.rebuild();
        this.lastSwitchCount = this.getSwitchCount();
    }

    _todayAnchor() {
        const d = new Date();
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }

    rebuild() {
        const anchor = this._todayAnchor();
        if (this.anchoredDate === anchor) return;
        this.anchoredDate = anchor;
        this.switchTimes = [anchor];
        let t = anchor;
        const end = anchor + 86400000;
        while (t < end) {
            t += deriveDuration(t) * 1000;
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

    _timeUntilNextSwitch() {
        const count = this.getSwitchCount();
        const nextTime = this.switchTimes[count + 1];
        return Math.max(0, (nextTime - Date.now()) / 1000);
    }

    resolveInitialScene() {
        const count = this.getSwitchCount();
        this.lastSwitchCount = count;
        this.timer.elapsed = (Date.now() - this.switchTimes[count]) / 1000;
        if (count % 2 === 0) {
            this.activeIndex = this.rotation.indexOf(this.baselineSceneId);
            if (this.activeIndex === -1) this.activeIndex = 0;
        } else {
            const nonBaselineIds = this.rotation.filter(id => id !== this.baselineSceneId);
            if (nonBaselineIds.length > 0) {
                const pickIndex = Math.floor(hashNumber(count) * nonBaselineIds.length);
                this.activeIndex = this.rotation.indexOf(nonBaselineIds[pickIndex]);
                if (this.activeIndex === -1) this.activeIndex = 0;
            }
        }
        const active = this.getActiveScene();
        if (active) {
            this._applyDuration(active);
            if (active.onEnter) active.onEnter();
        }
        return active;
    }

    registerScene(definition) {
        this.scenes.set(definition.id, definition);
        this.rotation.push(definition.id);
        if (this.scenes.size === 1) {
            this.baselineSceneId = definition.id;
            this.timer.maxDuration =
                this.durationOverrides.get(definition.id) ??
                this._timeUntilNextSwitch();
        }
    }

    getActiveScene() {
        const activeId = this.rotation[this.activeIndex];
        return this.scenes.get(activeId);
    }

    isBaselineActive() {
        const active = this.getActiveScene();
        return active && active.id === this.baselineSceneId;
    }

    _applyDuration(next) {
        const override = this.durationOverrides.get(next.id);
        if (override !== undefined) {
            this.timer.maxDuration = override;
        } else {
            this.timer.maxDuration = this._timeUntilNextSwitch();
        }
    }

    switchTo(targetId) {
        const prev = this.getActiveScene();
        if (prev && prev.onExit) {
            prev.onExit();
        }
        this.activeIndex = this.rotation.indexOf(targetId);
        if (this.activeIndex === -1) {
            this.activeIndex = 0;
        }
        const next = this.getActiveScene();
        if (next) {
            this.lastSwitchCount = this.getSwitchCount();
            this._applyDuration(next);
            if (next.onEnter) {
                next.onEnter();
            }
        }
    }

    switchToNext() {
        const prev = this.getActiveScene();
        this.activeIndex = (this.activeIndex + 1) % this.rotation.length;
        const next = this.getActiveScene();
        if (prev && prev.onExit) {
            prev.onExit();
        }
        if (next) {
            this.lastSwitchCount = this.getSwitchCount();
            this._applyDuration(next);
            if (next.onEnter) {
                next.onEnter();
            }
        }
    }

    switchToRandomOrBaseline() {
        const count = this.getSwitchCount();
        if (this.isBaselineActive()) {
            const nonBaselineIds = this.rotation.filter(id => id !== this.baselineSceneId);
            if (nonBaselineIds.length === 0) {
                this.switchToNext();
                return;
            }
            const pickIndex = Math.floor(hashNumber(count) * nonBaselineIds.length);
            this.switchTo(nonBaselineIds[pickIndex]);
        } else {
            this.switchTo(this.baselineSceneId);
        }
    }

    setDuration(sceneId, seconds) {
        this.durationOverrides.set(sceneId, seconds);
        const active = this.getActiveScene();
        if (active && active.id === sceneId) {
            this.timer.maxDuration = seconds;
        }
    }

    getDuration(sceneId) {
        return this.durationOverrides.get(sceneId) ??
            (this.scenes.get(sceneId)?.defaultDuration ?? 45);
    }

    update(dt) {
        this.rebuild();
        const count = this.getSwitchCount();
        if (count > this.lastSwitchCount) {
            this.lastSwitchCount = count;
            this.timer.elapsed = 0;
            this._applyDuration(this.getActiveScene());
            return true;
        }
        this.timer.elapsed += dt;
        return false;
    }
}