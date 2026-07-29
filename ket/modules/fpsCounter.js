export class FPSCounter {
    constructor() {
        this.frames = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.el = null;
    }

    init() {
        this.el = document.createElement('div');
        this.el.id = 'fps-counter';
        this.el.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            color: #0f0;
            font: bold 14px/1 monospace;
            background: rgba(0,0,0,0.6);
            padding: 4px 8px;
            border-radius: 4px;
            pointer-events: none;
            z-index: 99991;
            user-select: none;
        `;
        document.body.appendChild(this.el);
    }

    update() {
        this.frames++;
        const now = performance.now();
        if (now - this.lastTime >= 1000) {
            this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
            this.el.textContent = `${this.fps} FPS`;
            this.frames = 0;
            this.lastTime = now;
        }
    }
}
