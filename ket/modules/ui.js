import {
    TOOLTIP_OFFSET_PX,
    GUI_SPEED_MIN, GUI_SPEED_MAX,
    GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX,
    GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX,
    GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX,
    GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX,
} from './utils.js';

function createTooltip() {
    const el = document.createElement('div');
    el.className = 'gui-tooltip';
    el.style.zIndex = '99999';
    document.body.appendChild(el);
    return el;
}

function attachTooltip(el, text, tooltipEl) {
    if (tooltipEl === null) return;

    const icon = document.createElement('span');
    icon.innerHTML = '?';
    icon.className = 'gui-info-icon';
    icon.addEventListener('mouseenter', (e) => {
        tooltipEl.textContent = text;
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = e.clientX + TOOLTIP_OFFSET_PX + 'px';
        tooltipEl.style.top = e.clientY + TOOLTIP_OFFSET_PX + 'px';
    });
    icon.addEventListener('mouseleave', () => { tooltipEl.style.opacity = '0'; });
    icon.addEventListener('mousemove', (e) => {
        tooltipEl.style.left = e.clientX + TOOLTIP_OFFSET_PX + 'px';
        tooltipEl.style.top = e.clientY + TOOLTIP_OFFSET_PX + 'px';
    });
    el.appendChild(icon);
}

function createSliderRow(label, value, min, max, step, onChange, tooltip, tooltipEl) {
    const row = document.createElement('div');
    row.className = 'gui-row';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'gui-label';
    labelSpan.textContent = label;
    if (tooltip) attachTooltip(labelSpan, tooltip, tooltipEl);

    const right = document.createElement('div');
    right.className = 'gui-row-right';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'gui-slider';
    input.min = min;
    input.max = max;
    input.step = step || 0.01;
    input.value = value;
    input.oninput = () => {
        valSpan.textContent = parseFloat(input.value).toFixed(2);
        onChange(parseFloat(input.value));
    };

    const valSpan = document.createElement('span');
    valSpan.className = 'gui-value';
    valSpan.textContent = value.toFixed(2);

    right.appendChild(input);
    right.appendChild(valSpan);
    row.appendChild(labelSpan);
    row.appendChild(right);

    return { row, input, valSpan };
}

function createButton(label, onClick, tooltip, tooltipEl) {
    const btn = document.createElement('button');
    btn.className = 'gui-btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    if (tooltip) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gui-btn-wrapper';
        wrapper.appendChild(btn);
        attachTooltip(btn, tooltip, tooltipEl);
        return { element: wrapper, btn };
    }
    return { element: btn, btn };
}

function createDisabledText(label, value, tooltip, tooltipEl) {
    const el = document.createElement('div');
    el.className = 'gui-disabled-text';
    el.innerHTML = `${label}: <span style="color: rgba(255,255,255,0.5);">${value}</span>`;
    if (tooltip) attachTooltip(el, tooltip, tooltipEl);
    return el;
}

function createColorRow(label, value, onChange, tooltip, tooltipEl) {
    const row = document.createElement('div');
    row.className = 'gui-color-row';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'gui-label';
    labelSpan.textContent = label;
    if (tooltip) attachTooltip(labelSpan, tooltip, tooltipEl);

    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'gui-color-swatch';
    input.value = value;
    input.addEventListener('input', () => { onChange(input.value); });

    row.appendChild(labelSpan);
    row.appendChild(input);

    return { row, input };
}

function createText(text, tooltip, tooltipEl) {
    const el = document.createElement('div');
    el.className = 'gui-folder-header';
    el.style.cursor = 'default';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = text;
    if (tooltip) attachTooltip(titleSpan, tooltip, tooltipEl);

    el.appendChild(titleSpan);
    return el;
}

function createFolder(title, tooltip, tooltipEl, collapsed = true) {
    const header = document.createElement('div');
    header.className = 'gui-folder-header';

    const arrow = document.createElement('span');
    arrow.className = 'gui-folder-arrow';
    arrow.textContent = '▶';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    if (tooltip) attachTooltip(titleSpan, tooltip, tooltipEl);

    header.appendChild(arrow);
    header.appendChild(titleSpan);

    const body = document.createElement('div');
    body.className = 'gui-folder-body';

    header.addEventListener('click', () => {
        collapsed = !collapsed;
        if (collapsed) {
            body.classList.remove('expanded');
        } else {
            body.classList.add('expanded');
        }
        arrow.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(90deg)';
    });

    arrow.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(90deg)';
    if (collapsed) {
        body.classList.remove('expanded');
    } else {
        body.classList.add('expanded');
    }

    return { header, body, collapsed };
}

function createToggleButton(label, isActive, onChange, tooltip, tooltipEl) {
    const btn = document.createElement('button');
    btn.className = 'gui-btn';
    btn.textContent = label;
    if (isActive) {
        btn.style.borderColor = 'rgba(255, 0, 85, 0.4)';
        btn.style.background = 'rgba(255, 0, 85, 0.12)';
    }
    btn.addEventListener('click', () => {
        onChange();
    });
    if (tooltip) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gui-btn-wrapper';
        wrapper.appendChild(btn);
        attachTooltip(btn, tooltip, tooltipEl);
        return { element: wrapper, btn };
    }
    return { element: btn, btn };
}

export function initGUI(params, guiControllers, sceneManager, raveEngine) {
    const tooltipEl = null;//createTooltip();

    const container = document.createElement('div');
    container.className = 'gui-panel';
    container.id = 'debug-panel';

    // Tab
    const tab = document.createElement('div');
    tab.className = 'gui-tab';

    const arrowIcon = document.createElement('span');
    arrowIcon.className = 'gui-tab-arrow';
    arrowIcon.textContent = '▲';
    tab.appendChild(arrowIcon);

    // Content
    const content = document.createElement('div');
    content.className = 'gui-content';

    let isCollapsed = true;

    const togglePanel = () => {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            content.style.opacity = '0';
            content.style.padding = '0 14px';
            arrowIcon.style.transform = 'rotate(180deg)';
            container.style.maxHeight = '40px';
            container.style.maxWidth = '44px';
        } else {
            container.style.maxWidth = '260px';
            content.style.opacity = '1';
            content.style.padding = '10px 14px';
            arrowIcon.style.transform = 'rotate(0deg)';
            container.style.maxHeight = '100%';
        }
    };

    tab.addEventListener('click', togglePanel);
    const settingsFolder = createFolder('General', 'General settings for the trip.', tooltipEl, false);
    //settingsFolder.body.classList.add('expanded');
    content.appendChild(settingsFolder.header);
    content.appendChild(settingsFolder.body);
    const pauseBtnResult = createToggleButton('Pause', params.paused, (e) => {
        params.togglePause();
        console.log(e);
    }, 'Pause or resume the animation loop', tooltipEl);
    settingsFolder.body.appendChild(pauseBtnResult.element);

    // --- Mode display ---
    // const modeDisplay = createDisabledText('Mode', params.controlMode,
    //     'Current control mode: Auto (autopilot) or Manual (WASD)', tooltipEl);
    // content.appendChild(modeDisplay);

    // --- Switch button ---
    const switchBtnResult = createButton(`Movement: ${params.controlMode}`, () => {
        params.switchMode();
        switchBtnResult.btn.textContent = `Movement: ${params.controlMode}`;
    }, 'Toggle between automatic flight and manual WASD controls', tooltipEl);
    settingsFolder.body.appendChild(switchBtnResult.element);

    // --- Rave toggle ---
    const raveBtnResult = createToggleButton(params.raveMode ? 'Rave: ON' : 'Rave: OFF', params.raveMode, () => {
        params.toggleRaveMode();
    }, 'Toggle rave mode — auto-randomizes visual parameters (works in any control mode)', tooltipEl);
    settingsFolder.body.appendChild(raveBtnResult.element);

    guiControllers.updateRaveToggle = () => {
        raveBtnResult.btn.textContent = params.raveMode ? 'Rave: ON' : 'Rave: OFF';
        if (params.raveMode) {
            raveBtnResult.btn.style.borderColor = 'rgba(255, 0, 85, 0.4)';
            raveBtnResult.btn.style.background = 'rgba(255, 0, 85, 0.12)';
        } else {
            raveBtnResult.btn.style.borderColor = '';
            raveBtnResult.btn.style.background = '';
        }
    };

    // --- Movement folder ---
    const movFolder = createFolder('MOVEMENT', 'Movement and timing controls', tooltipEl);
    content.appendChild(movFolder.header);
    content.appendChild(movFolder.body);

    const speedSlider = createSliderRow('Speed', params.speed, GUI_SPEED_MIN, GUI_SPEED_MAX, 0.1,
        (v) => { params.speed = v; },
        'Movement speed (WASD keys/touch/auto)', tooltipEl);
    movFolder.body.appendChild(speedSlider.row);

    const timeSlider = createSliderRow('Dilation', params.timeScale, GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX, 0.05,
        (v) => {
            params.timeScale = v;
            if (raveEngine) { raveEngine.raveCurrent.timeScale = v; raveEngine.raveTarget.timeScale = v; }
        },
        'Global time multiplier — affects animation speed and shader effects', tooltipEl);
    movFolder.body.appendChild(timeSlider.row);

    // --- Visuals folder ---
    const visFolder = createFolder('VISUALS', 'Visual effect controls', tooltipEl);
    content.appendChild(visFolder.header);
    content.appendChild(visFolder.body);

    const bloomSlider = createSliderRow('Glow', params.bloomStrength, GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX, 0.01,
        (v) => {
            params.bloomStrength = v;
            if (raveEngine) { raveEngine.raveCurrent.bloomStrength = v; raveEngine.raveTarget.bloomStrength = v; }
        },
        'Intensity of the bloom post-processing glow effect', tooltipEl);
    visFolder.body.appendChild(bloomSlider.row);

    const radiusSlider = createSliderRow('Radiation', params.bloomRadius, GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX, 0.05,
        (v) => {
            params.bloomRadius = v;
            if (raveEngine) { raveEngine.raveCurrent.bloomRadius = v; raveEngine.raveTarget.bloomRadius = v; }
        },
        'Spread radius of the bloom glow', tooltipEl);
    visFolder.body.appendChild(radiusSlider.row);

    const colorARow = createColorRow('Color A', params.colorA,
        (v) => {
            params.colorA = v;
            if (raveEngine) { raveEngine.raveCurrent.colorA = v; raveEngine.raveTarget.colorA = v; }
        },
        'Primary accent color for terrain and walls', tooltipEl);
    visFolder.body.appendChild(colorARow.row);

    const colorBRow = createColorRow('Color B', params.colorB,
        (v) => {
            params.colorB = v;
            if (raveEngine) { raveEngine.raveCurrent.colorB = v; raveEngine.raveTarget.colorB = v; }
        },
        'Secondary accent color for terrain and walls', tooltipEl);
    visFolder.body.appendChild(colorBRow.row);

    const edgeSlider = createSliderRow('Outline', params.edgeContrast, GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX, 0.005,
        (v) => {
            params.edgeContrast = v;
            if (raveEngine) { raveEngine.raveCurrent.edgeContrast = v; raveEngine.raveTarget.edgeContrast = v; }
        },
        'Intensity of the edge-detection outline effect', tooltipEl);
    visFolder.body.appendChild(edgeSlider.row);

    const randBtnResult = createButton('Randomize', () => {
        params.randomize();
        speedSlider.valSpan.textContent = params.speed.toFixed(2);
        speedSlider.input.value = params.speed;
        timeSlider.valSpan.textContent = params.timeScale.toFixed(2);
        timeSlider.input.value = params.timeScale;
        bloomSlider.valSpan.textContent = params.bloomStrength.toFixed(2);
        bloomSlider.input.value = params.bloomStrength;
        radiusSlider.valSpan.textContent = params.bloomRadius.toFixed(2);
        radiusSlider.input.value = params.bloomRadius;
        edgeSlider.valSpan.textContent = params.edgeContrast.toFixed(2);
        edgeSlider.input.value = params.edgeContrast;
        colorARow.input.value = params.colorA;
        colorBRow.input.value = params.colorB;
    }, 'Randomize all visual and movement parameters for a new look', tooltipEl);
    visFolder.body.appendChild(randBtnResult.element);

    // --- Scenes folder ---
    let sceneInfo = null;
    let timerDisplay = null;
    let nextSwitchDisplay = null;
    let sceneNameEl = null;
    let sequentialToggle = null;
    let timerEl = null;
    let nextSwitchEl = null;

    if (sceneManager) {
        const sceneFolder = createFolder('SCENES', 'Scene management', tooltipEl);
        content.appendChild(sceneFolder.header);
        content.appendChild(sceneFolder.body);

        sceneInfo = { name: 'loading...' };
        sceneNameEl = createDisabledText('Current Scene', sceneInfo.name, null, null);
        sceneFolder.body.appendChild(sceneNameEl);

        sequentialToggle = { value: true };
        const seqBtnResult = createToggleButton('Auto Switch: ON', true, () => {
            sequentialToggle.value = !sequentialToggle.value;
            sceneManager.useSequential = sequentialToggle.value;
            sceneManager.timerPaused = !sequentialToggle.value;
            seqBtnResult.btn.textContent = `Auto Switch: ${sequentialToggle.value ? 'ON' : 'OFF'}`;
            if (sequentialToggle.value) {
                seqBtnResult.btn.style.borderColor = 'rgba(0, 204, 255, 0.5)';
                seqBtnResult.btn.style.background = 'rgba(0, 204, 255, 0.2)';
            } else {
                seqBtnResult.btn.style.borderColor = 'rgba(0, 204, 255, 0.25)';
                seqBtnResult.btn.style.background = 'rgba(0, 204, 255, 0.12)';
            }
        }, 'Bypass weighted rotation and cycle scenes in order', tooltipEl);
        sceneFolder.body.appendChild(seqBtnResult.element);

        const nextSceneBtnResult = createButton('Next Scene', () => {
            params.forceNextOrdered = true;
        }, 'Manually trigger transition to next scene', tooltipEl);
        sceneFolder.body.appendChild(nextSceneBtnResult.element);

        timerDisplay = { elapsed: '0s' };
        timerEl = createDisabledText('Elapsed', '0s', null, null);
        sceneFolder.body.appendChild(timerEl);

        nextSwitchDisplay = { next: '0s' };
        nextSwitchEl = createDisabledText('Next Switch', '0s', null, null);
        sceneFolder.body.appendChild(nextSwitchEl);
    }

    window._updateSceneGui = (elapsed, maxDuration) => {
        if (sceneInfo && sceneManager && sceneNameEl && timerEl && nextSwitchEl) {
            const active = sceneManager.getActiveScene();
            if (active) {
                sceneInfo.name = active.name;
                sceneNameEl.innerHTML = `Current Scene: <span style="color: rgba(255,255,255,0.5);">${active.name}</span>`;
            }
            if (timerDisplay && timerEl) {
                timerDisplay.elapsed = elapsed.toFixed(1) + 's';
                timerEl.innerHTML = `Timer: <span style="color: rgba(255,255,255,0.5);">${elapsed.toFixed(1)}s</span>`;
            }
            if (nextSwitchDisplay && nextSwitchEl) {
                if (sceneManager.timerPaused) {
                    nextSwitchDisplay.next = 'paused';
                    nextSwitchEl.innerHTML = `Next Switch: <span style="color: rgba(255,255,255,0.5);">paused</span>`;
                } else {
                    nextSwitchDisplay.next = sceneManager.timeUntilNextSwitch().toFixed(1) + 's';
                    nextSwitchEl.innerHTML = `Next Switch: <span style="color: rgba(255,255,255,0.5);">${sceneManager.timeUntilNextSwitch().toFixed(1)}s</span>`;
                }
            }
        }
    };

    container.appendChild(tab);
    container.appendChild(content);
    document.body.appendChild(container);

    guiControllers.updateDisplays = (p) => {
        speedSlider.valSpan.textContent = p.speed.toFixed(2);
        speedSlider.input.value = p.speed;
        bloomSlider.valSpan.textContent = p.bloomStrength.toFixed(2);
        bloomSlider.input.value = p.bloomStrength;
        edgeSlider.valSpan.textContent = p.edgeContrast.toFixed(2);
        edgeSlider.input.value = p.edgeContrast;
        radiusSlider.valSpan.textContent = p.bloomRadius.toFixed(2);
        radiusSlider.input.value = p.bloomRadius;
        timeSlider.valSpan.textContent = p.timeScale.toFixed(2);
        timeSlider.input.value = p.timeScale;
        colorARow.input.value = p.colorA;
        colorBRow.input.value = p.colorB;
    };

    guiControllers.updateModeDisplay = () => {
        switchBtnResult.btn.textContent = `Movement: ${params.controlMode}`;
        //console.log('updateModeDisplay called, params.controlMode:', params.controlMode);
    };
}
