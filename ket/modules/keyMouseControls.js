import * as THREE from 'three';

const MAX_PITCH_ANGLE = Math.PI / 6;
const MAX_YAW_INCREMENT = Math.PI / 6;

const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class KeyMouseControls {
    constructor() {
        this.keys = {
            w: false, a: false, s: false, d: false,
            q: false, e: false,
            arrowleft: false, arrowright: false,
            arrowup: false, arrowdown: false
        };
        this.mouseYawDelta = 0;
        this.mousePitchDelta = 0;
        this.pointerLocked = false;
        this.manualRotation = null;

        this.bindInput();
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

    isMoving() {
        return (
            this.keys.w || this.keys.s || this.keys.a || this.keys.d ||
            this.keys.q || this.keys.e
        );
    }

    applyManualControl(camera, moveSpeed, joystickState, dt) {
        camera.getWorldDirection(_dir);
        _right.crossVectors(_dir, camera.up).normalize();

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

        if (joystickState?.left?.isActive) {
            forwardInput += joystickState.left.forward;
            strafeInput += joystickState.left.strafe;
        }

        if (joystickState?.right?.isActive) {
            verticalInput += joystickState.right.vertical;
            yawInput += joystickState.right.yaw;
            pitchInput += joystickState.right.pitch;
        }

        if (this.keys.arrowleft) yawInput += 0.1;
        if (this.keys.arrowright) yawInput -= 0.1;
        if (this.keys.arrowup) pitchInput += 0.1;
        if (this.keys.arrowdown) pitchInput -= 0.1;

        yawInput -= this.mouseYawDelta;
        pitchInput -= this.mousePitchDelta;
        this.mouseYawDelta = 0;
        this.mousePitchDelta = 0;

        yawInput = Math.max(-MAX_YAW_INCREMENT, Math.min(MAX_YAW_INCREMENT, yawInput));

        camera.position.addScaledVector(_dir, forwardInput * moveSpeed);
        camera.position.addScaledVector(_right, strafeInput * moveSpeed);
        camera.position.y += verticalInput * moveSpeed;

        if (yawInput !== 0 || pitchInput !== 0) {
            _euler.setFromQuaternion(camera.quaternion);
            _euler.y -= yawInput;
            _euler.x -= pitchInput;
            _euler.x = Math.max(-MAX_PITCH_ANGLE, Math.min(MAX_PITCH_ANGLE, _euler.x));
            camera.quaternion.setFromEuler(_euler);
            camera.getWorldDirection(_dir);
        }

        camera.lookAt(
            camera.position.x + _dir.x,
            camera.position.y + _dir.y,
            camera.position.z + _dir.z
        );

        this.manualRotation = camera.quaternion.clone();
    }
}
