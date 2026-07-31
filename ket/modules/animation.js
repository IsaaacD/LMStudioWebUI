import * as THREE from 'three';
import { joystickState, updateJoystickInputs } from './touchControls.js';
import { normalizeColor } from './utils.js'
import { updateStatusText } from './config.js';
import { KeyMouseControls } from './keyMouseControls.js';

const MAX_PITCH_ANGLE = Math.PI / 6;
const MAX_YAW_INCREMENT = Math.PI / 6;
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class AnimationLoop {
    constructor({ camera, composer, params, sceneManager, transitionEffect, raveEngine, fpsCounter, webrtcManager }) {
        this.camera = camera;
        this.composer = composer;
        this.params = params;
        this.sceneManager = sceneManager;
        this.transitionEffect = transitionEffect;
        this.raveEngine = raveEngine;
        this.fpsCounter = fpsCounter;
        this.webrtcManager = webrtcManager;
        this.controls = new KeyMouseControls();
        this.autoplayIdleTimer = 0;
        this.autoplayResumeDelay = 5;
        this.autoplayWasSuspended = false;
        this.autoAngle = 0;
        this.autoOffsetX = 0;
        this.autoOffsetY = 0;
        this.autoPitch = 0;
        this.autoPitchTarget = 0;
        this.autoPitchNextTime = 3 + Math.random() * 2;
        this.autoYaw = 0;
        this.autoYawTarget = 0;
        this.autoYawNextTime = 3 + Math.random() * 2;
        this.autoPitchTransitionDuration = 0;
        this.autoYawTransitionDuration = 0;
        this.wasUserMoving = false;
        this.onTimerUpdate = null;

        this.running = false;
    }

    start(clock) {
        this.clock = clock;
        this.running = true;
        this.frame = requestAnimationFrame(() => this.animate());
    }

    stop() {
        this.running = false;
        if (this.frame) cancelAnimationFrame(this.frame);
    }

    animate() {
        if (!this.running) return;
        requestAnimationFrame(() => this.animate());

        if (this.fpsCounter) this.fpsCounter.update();

        if (this.params.paused) {
            this.composer.render();
            return;
        }

        const rawTime = this.clock.getElapsedTime();
        const dt = this.clock.getDelta() || 0.016;

        if (this.params.raveMode) {
            this.raveEngine.update(dt, rawTime);
        }

        const activeParams = this.params.raveMode
            ? this.raveEngine.getActiveParams(this.params)
            : {
                timeScale: this.params.timeScale,
                bloomStrength: this.params.bloomStrength,
                bloomRadius: this.params.bloomRadius,
                foldIntensity: this.params.foldIntensity,
                edgeContrast: this.params.edgeContrast,
                autoplaySpeed: this.params.autoplaySpeed,
                colorA: normalizeColor(this.params.colorA, 'animation:112'),
                colorB: this.params.colorB
            };

        const effectiveTime = rawTime * activeParams.timeScale;

        if (this.transitionEffect.isIdle()) {
            if (this.sceneManager.update(dt) || this.params.forceNextScene) {
                this.params.forceNextScene = false;
                this.transitionEffect.start();
            }
        } else {
            this.transitionEffect.update(dt);
        }

        if (this.transitionEffect.consumeSwap()) {
            this.sceneManager.switchToNext();
        }

        const activeScene = this.sceneManager.getActiveScene();

        if (activeScene && activeScene.onUpdate) {
            activeScene.onUpdate(this.camera, effectiveTime, dt, activeParams);
        }

        this.composer.setPixelationSharpness(this.transitionEffect.getPixelationSharpness());
        this.composer.setFadeOverlayAlpha(this.transitionEffect.getOverlayAlpha());

        this.composer.update(activeParams);

        updateJoystickInputs();
        const leftActive = joystickState.left.isActive;
        const rightActive = joystickState.right.isActive;
        const isMoving = this.controls.isMoving() || leftActive || rightActive;

        if (isMoving) {
            if (this.params.autoplay) {
                this.autoplayWasSuspended = true;
            }
            this.autoplayIdleTimer = 0;
        } else {
            this.autoplayIdleTimer += dt;
        }

        if (this.autoplayIdleTimer >= this.autoplayResumeDelay && this.autoplayWasSuspended) {
            this.params.autoplay = true;
            this.autoplayWasSuspended = false;
            updateStatusText(this.params.paused, this.params.raveMode, this.params.autoplay);
        }

        const inAutoplayDelay = this.autoplayWasSuspended && this.autoplayIdleTimer < this.autoplayResumeDelay;
        const autoplaySpeedMult = inAutoplayDelay ? this.autoplayIdleTimer / this.autoplayResumeDelay : 1;
        const useManual = (!this.params.autoplay && !inAutoplayDelay && !this.params.raveMode) || (this.params.raveMode && (isMoving || this.controls.pointerLocked));

        if (useManual) {
            this.controls.applyManualControl(this.camera, this.params.speed * 0.5, joystickState, dt);
        } else {
            this.handleAutoControl(activeParams, dt, autoplaySpeedMult);
        }

        if (isMoving && this.params.raveMode) {
            this.wasUserMoving = true;
        }

        if (this.webrtcManager) this.webrtcManager.animateOrbs(dt);
        if (this.webrtcManager) this.webrtcManager.animateArrows(dt);

        if (activeScene) {
            this.composer.render(activeScene.threeScene);
        }

        if (this.onTimerUpdate) {
            this.onTimerUpdate(this.sceneManager.timer.elapsed, this.sceneManager.timer.maxDuration);
        }
    }

    handleAutoControl(activeParams, dt, speedMult) {
        if (this.wasUserMoving && this.params.raveMode) {
            this.autoAngle += 0.005 * activeParams.timeScale;
            const baseX = Math.sin(this.autoAngle) * (8 + Math.sin(this.autoAngle * 0.7) * 5);
            const baseY = Math.cos(this.autoAngle * 0.5) * 3 + 2;
            this.autoOffsetX = this.camera.position.x - baseX;
            this.autoOffsetY = this.camera.position.y - baseY;
            _euler.setFromQuaternion(this.camera.quaternion);
            const clampedPitch = Math.max(-MAX_PITCH_ANGLE, Math.min(MAX_PITCH_ANGLE, _euler.x));
            this.autoPitch = clampedPitch;
            this.autoPitchTarget = clampedPitch;
            this.autoYaw = _euler.y;
            this.autoYawTarget = _euler.y;
            this.autoPitchTransitionDuration = 0;
            this.autoYawTransitionDuration = 0;
            this.wasUserMoving = false;
        }

        this.autoAngle += 0.005 * activeParams.timeScale * speedMult;
        const autoR = 8 + Math.sin(this.autoAngle * 0.7) * 5;
        const targetX = Math.sin(this.autoAngle) * autoR + this.autoOffsetX;
        const targetY = Math.cos(this.autoAngle * 0.5) * 3 + 2 + this.autoOffsetY;
        const targetZ = this.camera.position.z - activeParams.autoplaySpeed * speedMult;

        this.camera.position.x += (targetX - this.camera.position.x) * 0.02;
        this.camera.position.y += (targetY - this.camera.position.y) * 0.02;
        this.camera.position.z += (targetZ - this.camera.position.z) * 0.05;

        this.autoPitchNextTime -= dt * activeParams.timeScale;
        if (this.autoPitchNextTime <= 0) {
            const randomOffset = (Math.random() * 2 - 1) * MAX_PITCH_ANGLE;
            this.autoPitchTarget = Math.max(-MAX_PITCH_ANGLE, Math.min(MAX_PITCH_ANGLE, this.autoPitchTarget + randomOffset));
            this.autoPitchNextTime = 1 + Math.random() * 2;
            this.autoPitchTransitionDuration = 2 + Math.random() * 3;
        }

        this.autoYawNextTime -= dt * activeParams.timeScale;
        if (this.autoYawNextTime <= 0) {
            const randomOffset = (Math.random() * 2 - 1) * MAX_YAW_INCREMENT;
            this.autoYawTarget += randomOffset;
            this.autoYawNextTime = 1 + Math.random() * 2;
            this.autoYawTransitionDuration = 2 + Math.random() * 3;
        }

        if (this.autoPitchTransitionDuration > 0) {
            const t = Math.min(1, dt / this.autoPitchTransitionDuration);
            this.autoPitch += (this.autoPitchTarget - this.autoPitch) * t;
            this.autoPitchTransitionDuration -= dt;
        }

        if (this.autoYawTransitionDuration > 0) {
            const t = Math.min(1, dt / this.autoYawTransitionDuration);
            this.autoYaw += (this.autoYawTarget - this.autoYaw) * t;
            this.autoYawTransitionDuration -= dt;
        }

        _euler.set(this.autoPitch, this.autoYaw, 0);
        this.camera.quaternion.setFromEuler(_euler);
    }
}
