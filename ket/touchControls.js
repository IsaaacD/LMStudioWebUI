// ─── MULTI-TOUCH DUAL JOYSTICK CONTROLS MODULE ────────────────

export const JOYSTICK_RADIUS = 60;
export const JOYSTICK_DEADZONE = 0.15;
export const JOYSTICK_MAX_DRAG = 50;

export const joystickState = {
    left: {
        active: false,
        id: null,
        originX: 0,
        originY: 0,
        currentX: 0,
        currentY: 0,
        dx: 0,
        dy: 0
    },
    right: {
        active: false,
        id: null,
        originX: 0,
        originY: 0,
        currentX: 0,
        currentY: 0,
        dx: 0,
        dy: 0
    }
};

const joystickOverlay = document.createElement('div');
Object.assign(joystickOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9999'
});
document.body.appendChild(joystickOverlay);

function createJoystickVisual(baseX, baseY, dx, dy, isLeft) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'absolute',
        left: `${baseX - JOYSTICK_RADIUS}px`,
        top: `${baseY - JOYSTICK_RADIUS}px`,
        width: `${JOYSTICK_RADIUS * 2}px`,
        height: `${JOYSTICK_RADIUS * 2}px`,
        borderRadius: '50%',
        border: `2px solid rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.4)`,
        background: `radial-gradient(circle, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.1) 0%, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.05) 70%, transparent 100%)`,
        transition: 'opacity 0.3s ease'
    });

    const knob = document.createElement('div');
    const clampedDx = Math.max(-JOYSTICK_MAX_DRAG, Math.min(JOYSTICK_MAX_DRAG, dx));
    const clampedDy = Math.max(-JOYSTICK_MAX_DRAG, Math.min(JOYSTICK_MAX_DRAG, dy));
    Object.assign(knob.style, {
        position: 'absolute',
        left: `${JOYSTICK_RADIUS - 15 + clampedDx}px`,
        top: `${JOYSTICK_RADIUS - 15 + clampedDy}px`,
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.6) 0%, rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.3) 100%)`,
        boxShadow: `0 0 10px rgba(${isLeft ? '0, 204, 255' : '255, 0, 85'}, 0.5)`
    });

    container.appendChild(knob);
    return { container, knob };
}

function updateJoystickVisuals() {
    joystickOverlay.innerHTML = '';

    if (joystickState.left.active) {
        const leftVisual = createJoystickVisual(
            joystickState.left.originX,
            joystickState.left.originY,
            joystickState.left.dx,
            joystickState.left.dy,
            true
        );
        joystickOverlay.appendChild(leftVisual.container);
    }

    if (joystickState.right.active) {
        const rightVisual = createJoystickVisual(
            joystickState.right.originX,
            joystickState.right.originY,
            joystickState.right.dx,
            joystickState.right.dy,
            false
        );
        joystickOverlay.appendChild(rightVisual.container);
    }
}

export function applyJoystickDeadzone(value) {
    if (Math.abs(value) < JOYSTICK_DEADZONE) return 0;
    return Math.max(-1, Math.min(1, value));
}

function isTouchOnGui(touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return false;
    return el.closest('.lil-gui, .gui, #gui, [class*="gui"]') !== null;
}

function handleTouchStart(e, params) {
    if (params.paused || params.autoplay) {
        if (!params.raveMode)
            return;
    }
    if (e.changedTouches.length > 0 && isTouchOnGui(e.changedTouches[0])) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
        if (!joystickState.left.active) {
            joystickState.left.active = true;
            joystickState.left.id = touch.identifier;
            joystickState.left.originX = touch.clientX;
            joystickState.left.originY = touch.clientY;
            joystickState.left.currentX = touch.clientX;
            joystickState.left.currentY = touch.clientY;
            joystickState.left.dx = 0;
            joystickState.left.dy = 0;
        } else if (!joystickState.right.active) {
            joystickState.right.active = true;
            joystickState.right.id = touch.identifier;
            joystickState.right.originX = touch.clientX;
            joystickState.right.originY = touch.clientY;
            joystickState.right.currentX = touch.clientX;
            joystickState.right.currentY = touch.clientY;
            joystickState.right.dx = 0;
            joystickState.right.dy = 0;
        }
    }
    updateJoystickVisuals();
}

function handleTouchMove(e, params) {
    if (params.paused || params.autoplay && !params.raveMode) return;
    for (const touch of e.changedTouches) {
        if (isTouchOnGui(touch)) return;
    }
    e.preventDefault();

    for (const touch of e.changedTouches) {
        if (joystickState.left.active && touch.identifier === joystickState.left.id) {
            joystickState.left.currentX = touch.clientX;
            joystickState.left.currentY = touch.clientY;
            joystickState.left.dx = touch.clientX - joystickState.left.originX;
            joystickState.left.dy = touch.clientY - joystickState.left.originY;
        } else if (joystickState.right.active && touch.identifier === joystickState.right.id) {
            joystickState.right.currentX = touch.clientX;
            joystickState.right.currentY = touch.clientY;
            joystickState.right.dx = touch.clientX - joystickState.right.originX;
            joystickState.right.dy = touch.clientY - joystickState.right.originY;
        }
    }
    updateJoystickVisuals();
}

function handleTouchEnd(e) {
    for (const touch of e.changedTouches) {
        if (joystickState.left.active && touch.identifier === joystickState.left.id) {
            joystickState.left.active = false;
            joystickState.left.id = null;
            joystickState.left.dx = 0;
            joystickState.left.dy = 0;
        } else if (joystickState.right.active && touch.identifier === joystickState.right.id) {
            joystickState.right.active = false;
            joystickState.right.id = null;
            joystickState.right.dx = 0;
            joystickState.right.dy = 0;
        }
    }
    updateJoystickVisuals();
}

export function initTouchControls(params) {
    document.addEventListener('touchstart', (e) => handleTouchStart(e, params), { passive: false });
    document.addEventListener('touchmove', (e) => handleTouchMove(e, params), { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}
