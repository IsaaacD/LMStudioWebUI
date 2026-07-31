export class SceneManager {
    constructor() {
        this.scenes = new Map();
        this.rotation = [];
        this.activeIndex = 0;
        this.timer = { elapsed: 0, maxDuration: 45 };
        this.durationOverrides = new Map();
        this.baselineSceneId = null;
    }

    registerScene(definition) {
        this.scenes.set(definition.id, definition);
        this.rotation.push(definition.id);
        if (this.scenes.size === 1) {
            this.baselineSceneId = definition.id;
            this.timer.maxDuration =
                this.durationOverrides.get(definition.id) ?? definition.defaultDuration;
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
            this.timer.elapsed = 0;
            this.timer.maxDuration =
                this.durationOverrides.get(next.id) ?? next.defaultDuration;
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
            this.timer.elapsed = 0;
            this.timer.maxDuration =
                this.durationOverrides.get(next.id) ?? next.defaultDuration;
            if (next.onEnter) {
                next.onEnter();
            }
        }
    }

    switchToRandomOrBaseline() {
        if (this.isBaselineActive()) {
            const nonBaselineIds = this.rotation.filter(id => id !== this.baselineSceneId);
            if (nonBaselineIds.length === 0) {
                this.switchToNext();
                return;
            }
            const pick = nonBaselineIds[Math.floor(Math.random() * nonBaselineIds.length)];
            this.switchTo(pick);
            this.timer.maxDuration = 2 + Math.random() * 8;
        } else {
            this.switchTo(this.baselineSceneId);
            this.timer.maxDuration = 30 + Math.random() * 15;
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
        this.timer.elapsed += dt;
        if (this.timer.elapsed >= this.timer.maxDuration) {
            this.timer.elapsed = 0;
            return true;
        }
        return false;
    }
}
