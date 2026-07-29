export class TransitionEffect {
    constructor() {
        this.phase = 'idle';
        this.elapsed = 0;
        this.fadeOutDuration = 0.25;
        this.fadeInDuration = 0.5;
        this.fadeOutProgress = 0;
        this.fadeInProgress = 0;
        this.needSwap = false;
    }

    start() {
        this.phase = 'fadingOut';
        this.elapsed = 0;
        this.fadeOutProgress = 0;
        this.fadeInProgress = 0;
        this.needSwap = false;
    }

    update(dt) {
        if (this.phase === 'fadingOut') {
            this.elapsed += dt;
            this.fadeOutProgress = Math.min(1, this.elapsed / this.fadeOutDuration);
            if (this.elapsed >= this.fadeOutDuration) {
                this.phase = 'fadingIn';
                this.elapsed = 0;
                this.fadeInProgress = 0;
                this.needSwap = true;
            }
            return false;
        }

        if (this.phase === 'fadingIn') {
            this.elapsed += dt;
            this.fadeInProgress = Math.min(1, this.elapsed / this.fadeInDuration);
            if (this.elapsed >= this.fadeInDuration) {
                this.phase = 'idle';
                this.elapsed = 0;
                this.fadeOutProgress = 0;
                this.fadeInProgress = 1;
                return true;
            }
            return false;
        }

        return true;
    }

    getOverlayAlpha() {
        if (this.phase === 'idle') return 0;
        if (this.phase === 'fadingOut') return this.fadeOutProgress;
        if (this.phase === 'fadingIn') return 1 - this.fadeInProgress;
        return 0;
    }

    getPixelationSharpness() {
        if (this.phase === 'idle') return 1;
        if (this.phase === 'fadingOut') return 1;
        if (this.phase === 'fadingIn') return this.fadeInProgress;
        return 1;
    }

    consumeSwap() {
        if (this.needSwap) {
            this.needSwap = false;
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
}
