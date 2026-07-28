import * as THREE from 'three';
import { joystickState, updateJoystickInputs } from './touchControls.js';

export class AnimationLoop {
    constructor({ camera, composer, params, tileManager, primitiveManager, raveEngine, tileConstants }) {
        this.camera = camera;
        this.composer = composer;
        this.params = params;
        this.tileManager = tileManager;
        this.primitiveManager = primitiveManager;
        this.raveEngine = raveEngine;
        this.TILE_SIZE = tileConstants.TILE_SIZE;
        this.TILE_HEIGHT = tileConstants.TILE_HEIGHT;
        this.keys = { w: false, a: false, s: false, d: false, q: false, e: false };
        this.autoAngle = 0;
        this.autoOffsetX = 0;
        this.autoOffsetY = 0;
        this.autoPitch = 0;
        this.wasUserMoving = false;
        this.manualRotation = null;
        this.mouseYawDelta = 0;
        this.mousePitchDelta = 0;
        this.pointerLocked = false;

        this.bindInput();
        this.running = false;
    }

    bindInput() {
        document.addEventListener('mousemove', (e) => {
            if (this.pointerLocked) {
                this.mouseYawDelta -= e.movementX * 0.002;
                this.mousePitchDelta -= e.movementY * 0.002;
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !this.pointerLocked) {
                const el = e.target;
                if (el.closest('#splash, .lil-gui, .gui, #gui, [class*="gui"]')) return;
                document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement !== null;
        });

        document.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k in this.keys) this.keys[k] = true;
        });

        document.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k in this.keys) this.keys[k] = false;
        });
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
                colorA: this.params.colorA,
                colorB: this.params.colorB
            };

        const effectiveTime = rawTime * activeParams.timeScale;

        for (const t of this.tileManager.getFloorCeilTiles()) {
            if (!t.visible) continue;
            t.material.uniforms.uTime.value = effectiveTime;
            t.material.uniforms.uFoldIntensity.value = activeParams.foldIntensity;
            t.material.uniforms.uColor1.value.set(activeParams.colorA);
            t.material.uniforms.uColor2.value.set(activeParams.colorB);
            t.material.uniforms.uTileOffset.value.set(t._gx * this.TILE_SIZE, t._gz * this.TILE_SIZE, t._gy * this.TILE_HEIGHT);
            t.material.uniforms.uCameraPos.value.copy(this.camera.position);
        }
        for (const t of this.tileManager.getWallTiles()) {
            if (!t.visible) continue;
            t.material.uniforms.uTime.value = effectiveTime;
            t.material.uniforms.uFoldIntensity.value = activeParams.foldIntensity;
            t.material.uniforms.uColor1.value.set(activeParams.colorA);
            t.material.uniforms.uColor2.value.set(activeParams.colorB);
            t.material.uniforms.uTileOffset.value.set(t._gx * this.TILE_SIZE, t._gz * this.TILE_SIZE, t._gy * this.TILE_HEIGHT);
            t.material.uniforms.uCameraPos.value.copy(this.camera.position);
        }

        this.composer.update(activeParams);

        updateJoystickInputs();
        const leftActive = joystickState.left.isActive;
        const rightActive = joystickState.right.isActive;
        const isMoving = this.keys.w || this.keys.s || this.keys.a || this.keys.d || this.keys.q || this.keys.e || leftActive || rightActive || this.pointerLocked;
        const useManual = !this.params.autoplay && !this.params.raveMode || (this.params.raveMode && isMoving);

        if (useManual) {
            this.handleManualControl(activeParams, dt, leftActive, rightActive);
        } else {
            this.handleAutoControl(activeParams, dt);
        }



        if (isMoving && this.params.raveMode) {
            this.wasUserMoving = true;
        }

        this.tileManager.update(this.camera);
        this.primitiveManager.update(this.camera, effectiveTime, dt, activeParams.colorA, activeParams.colorB);

        this.composer.render();
    }

    handleManualControl(activeParams, dt, leftActive, rightActive) {
        const moveSpeed = this.params.speed * 0.5;
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();

        let forwardInput = 0;
        let strafeInput = 0;
        let verticalInput = 0;
        let yawInput = 0;
        let pitchInput = 0;

        if (this.keys.w) forwardInput += 1;
        if (this.keys.s) forwardInput -= 1;
        if (this.keys.a) strafeInput -= 1;
        if (this.keys.d) strafeInput += 1;
        if (this.keys.e) verticalInput += 1;
        if (this.keys.q) verticalInput -= 1;

        if (leftActive) {
            forwardInput += joystickState.left.forward;
            strafeInput += joystickState.left.strafe;
        }

        if (rightActive) {
            verticalInput += joystickState.right.vertical;
            yawInput += joystickState.right.yaw;
            pitchInput += joystickState.right.pitch;
        }

        yawInput -= this.mouseYawDelta;
        pitchInput -= this.mousePitchDelta;
        this.mouseYawDelta = 0;
        this.mousePitchDelta = 0;

        this.camera.position.addScaledVector(dir, forwardInput * moveSpeed);
        this.camera.position.addScaledVector(right, strafeInput * moveSpeed);
        this.camera.position.y += verticalInput * moveSpeed;

        if (yawInput !== 0 || pitchInput !== 0) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(this.camera.quaternion);
            euler.y -= yawInput;
            euler.x -= pitchInput;
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
            this.camera.quaternion.setFromEuler(euler);
            this.camera.getWorldDirection(dir);
        }

        this.camera.lookAt(this.camera.position.x + dir.x, this.camera.position.y + dir.y, this.camera.position.z + dir.z);
        this.manualRotation = this.camera.quaternion.clone();
    }

    handleAutoControl(activeParams, dt) {
        if (this.wasUserMoving && this.params.raveMode) {
            this.autoAngle += 0.005 * activeParams.timeScale;
            const baseX = Math.sin(this.autoAngle) * (8 + Math.sin(this.autoAngle * 0.7) * 5);
            const baseY = Math.cos(this.autoAngle * 0.5) * 3 + 2;
            this.autoOffsetX = this.camera.position.x - baseX;
            this.autoOffsetY = this.camera.position.y - baseY;
            this.autoPitch = this.camera.rotation.x;
            this.wasUserMoving = false;
        }

        this.autoAngle += 0.005 * activeParams.timeScale;
        const autoR = 8 + Math.sin(this.autoAngle * 0.7) * 5;
        const targetX = Math.sin(this.autoAngle) * autoR + this.autoOffsetX;
        const targetY = Math.cos(this.autoAngle * 0.5) * 3 + 2 + this.autoOffsetY;
        const targetZ = this.camera.position.z - activeParams.autoplaySpeed;

        this.camera.position.x += (targetX - this.camera.position.x) * 0.02;
        this.camera.position.y += (targetY - this.camera.position.y) * 0.02;
        this.camera.position.z += (targetZ - this.camera.position.z) * 0.05;

        this.autoPitch += Math.sin(this.autoAngle * 0.3) * 0.001 * activeParams.timeScale;
        this.autoPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.autoPitch));

        const euler = new THREE.Euler(this.autoPitch, 0, 0, 'YXZ');
        const autoQuat = new THREE.Quaternion().setFromEuler(euler);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const lookTarget = this.camera.position.clone().add(forward.multiplyScalar(10)).applyQuaternion(autoQuat);
        this.camera.lookAt(lookTarget);
    }
}
