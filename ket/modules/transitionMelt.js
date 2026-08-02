export class TransitionMelt {
    constructor() {
        this.phase = 'idle';
        this.elapsed = 0;
        this.freezeDuration = 0.2;
        this.transitionDuration = 2.0;
        this.meltProgress = 0;
        this.revealBlend = 0;
        this.needSwap = false;
        this.snapshotCaptured = false;
        this._snapshot = null;
        this._swapConsumed = false;
        this.cooldown = 0;
        this.cooldownDuration = 1.0;
    }

    start() {
        this.phase = 'freeze';
        this.elapsed = 0;
        this.meltProgress = 0;
        this.revealBlend = 0;
        this.needSwap = false;
        this.snapshotCaptured = false;
        this._snapshot = null;
        this._swapConsumed = false;
        this.cooldown = 0;
    }

    update(dt) {
        if (this.phase === 'freeze') {
            this.elapsed += dt;
            if (this.elapsed >= this.freezeDuration) {
                this.phase = 'capturing';
            }
            return false;
        }

        if (this.phase === 'capturing') {
            this.phase = 'swapping';
            return false;
        }

        if (this.phase === 'swapping') {
            this.phase = 'dissolve';
            this.elapsed = 0;
            this.needSwap = true;
            return false;
        }

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
                this.snapshotCaptured = false;
                this._snapshot = null;
                return false;
            }
            return false;
        }

        if (this.phase === 'cooldown') {
            this.elapsed += dt;
            if (this.elapsed >= this.cooldownDuration) {
                this.phase = 'idle';
                this.elapsed = 0;
                this.meltProgress = 0;
                this.revealBlend = 0;
                return true;
            }
            return false;
        }

        return true;
    }

    setSnapshot(texture) {
        this._snapshot = texture;
        this.snapshotCaptured = true;
    }

    getSnapshot() {
        return this._snapshot;
    }

    isSnapshotReady() {
        return this.snapshotCaptured && this._snapshot !== null;
    }

    isReadyToSwap() {
        if (this._swapConsumed) return false;
        return (this.phase === 'swapping' || this.phase === 'dissolve') && this.needSwap;
    }

    getMeltProgress() {
        if (this.phase === 'idle') return 0;
        if (this.phase === 'freeze') return 0;
        if (this.phase === 'capturing') return 0;
        if (this.phase === 'swapping') return 0;
        if (this.phase === 'dissolve') return this.meltProgress;
        if (this.phase === 'cooldown') return 1;
        return 0;
    }

    getRevealBlend() {
        if (this.phase === 'cooldown') return 1;
        return this.revealBlend;
    }

    isFreezing() {
        return this.phase === 'freeze' || this.phase === 'capturing';
    }

    consumeSwap() {
        if (this.needSwap) {
            this.needSwap = false;
            this._swapConsumed = true;
            return true;
        }
        return false;
    }

    isIdle() {
        return this.phase === 'idle';
    }

    isTransitioning() {
        return this.phase !== 'idle';
    }

    isMeltActive() {
        return this.phase === 'freeze' || this.phase === 'capturing' || this.phase === 'swapping' || this.phase === 'dissolve';
    }
}
