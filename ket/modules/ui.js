import GUI from 'lil-gui';
import {
    TOOLTIP_Z_INDEX, TOOLTIP_MAX_WIDTH, TOOLTIP_BACKGROUND, TOOLTIP_TEXT_COLOR,
    TOOLTIP_PADDING, TOOLTIP_BORDER_RADIUS, TOOLTIP_FONT_SIZE, TOOLTIP_LINE_HEIGHT,
    TOOLTIP_BOX_SHADOW, TOOLTIP_BORDER, TOOLTIP_OFFSET_PX,
    INFO_ICON_MARGIN_LEFT, INFO_ICON_FONT_SIZE, INFO_ICON_OPACITY, INFO_ICON_COLOR,
    GUI_SPEED_MIN, GUI_SPEED_MAX,
    GUI_AUTOPLAY_SPEED_MIN, GUI_AUTOPLAY_SPEED_MAX,
    GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX,
    GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX,
    GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX,
    GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX,
    GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX,
    GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX,
} from './utils.js';

export function initGUI(params, guiControllers, sceneManager, raveEngine) {
    const gui = new GUI({ title: 'Trip Controls' });

    const tooltipEl = document.createElement('div');
    Object.assign(tooltipEl.style, {
        position: 'fixed', pointerEvents: 'none', background: TOOLTIP_BACKGROUND,
        color: TOOLTIP_TEXT_COLOR, padding: TOOLTIP_PADDING, borderRadius: TOOLTIP_BORDER_RADIUS,
        fontSize: TOOLTIP_FONT_SIZE, lineHeight: TOOLTIP_LINE_HEIGHT, maxWidth: TOOLTIP_MAX_WIDTH,
        zIndex: TOOLTIP_Z_INDEX, display: 'none', boxShadow: TOOLTIP_BOX_SHADOW,
        border: TOOLTIP_BORDER
    });
    document.body.appendChild(tooltipEl);

    function addInfoIcon(domEl, text) {
        const icon = document.createElement('span');
        icon.innerHTML = 'ⓘ&nbsp;';
        Object.assign(icon.style, {
            marginLeft: INFO_ICON_MARGIN_LEFT, cursor: 'help', fontSize: INFO_ICON_FONT_SIZE,
            opacity: INFO_ICON_OPACITY, color: INFO_ICON_COLOR, fontWeight: 'bold',
            userSelect: 'none'
        });
        icon.addEventListener('mouseenter', (e) => {
            tooltipEl.textContent = text;
            tooltipEl.style.display = 'block';
            tooltipEl.style.left = e.clientX + TOOLTIP_OFFSET_PX + 'px';
            tooltipEl.style.top = e.clientY + TOOLTIP_OFFSET_PX + 'px';
        });
        icon.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none'; });
        icon.addEventListener('mousemove', (e) => {
            tooltipEl.style.left = e.clientX + TOOLTIP_OFFSET_PX + 'px';
            tooltipEl.style.top = e.clientY + TOOLTIP_OFFSET_PX + 'px';
        });
        domEl.prepend(icon);
    }

    const movFolder = gui.addFolder('Movement');
    const modeCtrl = movFolder.add(params, 'controlMode').name('Mode').disable();
    addInfoIcon(modeCtrl.domElement, 'Current control mode: Auto (autopilot) or Manual (WASD)');
    const swCtrl = movFolder.add(params, 'switchMode').name('🔄 Switch Auto/Manual');
    addInfoIcon(swCtrl.domElement, 'Toggle between automatic flight and manual WASD controls');
    const speedCtrl = movFolder.add(params, 'speed', GUI_SPEED_MIN, GUI_SPEED_MAX).name('Flight Speed');
    addInfoIcon(speedCtrl.domElement, 'Movement speed in manual mode (WASD keys)');
    const autoSpeedCtrl = movFolder.add(params, 'autoplaySpeed', GUI_AUTOPLAY_SPEED_MIN, GUI_AUTOPLAY_SPEED_MAX).name('Auto Speed');
    addInfoIcon(autoSpeedCtrl.domElement, 'Forward speed of the camera in autopilot mode');
    autoSpeedCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.autoplaySpeed = v; raveEngine.raveTarget.autoplaySpeed = v; } });
    const timeCtrl = movFolder.add(params, 'timeScale', GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX).name('Time Dilation');
    addInfoIcon(timeCtrl.domElement, 'Global time multiplier — affects animation speed and shader effects');
    timeCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.timeScale = v; raveEngine.raveTarget.timeScale = v; } });
    const paCtrl = movFolder.add(params, 'togglePause').name('⏸ Pause / Resume');
    addInfoIcon(paCtrl.domElement, 'Pause or resume the animation loop');
    movFolder.close();

    const visFolder = gui.addFolder('Visuals');
    const blCtrl = visFolder.add(params, 'bloomStrength', GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX).name('Bloom Glow');
    addInfoIcon(blCtrl.domElement, 'Intensity of the bloom post-processing glow effect');
    blCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.bloomStrength = v; raveEngine.raveTarget.bloomStrength = v; } });
    const radiusCtrl = visFolder.add(params, 'bloomRadius', GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX).name('Glow Radius');
    addInfoIcon(radiusCtrl.domElement, 'Spread radius of the bloom glow');
    radiusCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.bloomRadius = v; raveEngine.raveTarget.bloomRadius = v; } });
    const foldCtrl = visFolder.add(params, 'foldIntensity', GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX).name('Fold Intensity');
    addInfoIcon(foldCtrl.domElement, 'Strength of the terrain folding and distortion in shaders');
    foldCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.foldIntensity = v; raveEngine.raveTarget.foldIntensity = v; } });
    const veinCtrl = visFolder.add(params, 'veinSpeed', GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX).name('Vein Flow');
    addInfoIcon(veinCtrl.domElement, 'Speed of the organic vein patterns flowing across surfaces');
    veinCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.veinSpeed = v; raveEngine.raveTarget.veinSpeed = v; } });
    const colorACtrl = visFolder.addColor(params, 'colorA').name('Color A');
    addInfoIcon(colorACtrl.domElement, 'Primary accent color for terrain and walls');
    colorACtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.colorA = v; raveEngine.raveTarget.colorA = v; } });
    const colorBCtrl = visFolder.addColor(params, 'colorB').name('Color B');
    addInfoIcon(colorBCtrl.domElement, 'Secondary accent color for terrain and walls');
    colorBCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.colorB = v; raveEngine.raveTarget.colorB = v; } });
    const edgeCtrl = visFolder.add(params, 'edgeContrast', GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX).name('Outline Strength');
    addInfoIcon(edgeCtrl.domElement, 'Intensity of the edge-detection outline effect');
    edgeCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.edgeContrast = v; raveEngine.raveTarget.edgeContrast = v; } });
    // const partCtrl = visFolder.add(params, 'particles').name('Particles');
    // addInfoIcon(partCtrl.domElement, 'Toggle flying particle effects in scenes');
    // partCtrl.onChange((v) => { if (raveEngine) { raveEngine.raveCurrent.particles = v; raveEngine.raveTarget.particles = v; } });
    visFolder.close();

    const actFolder = gui.addFolder('Actions');
    const raCtrl = actFolder.add(params, 'randomize').name('🎲 Randomize');
    addInfoIcon(raCtrl.domElement, 'Randomize all visual and movement parameters for a new look');
    actFolder.close();

    let sceneInfo = null;
    let timerDisplay = null;

    if (sceneManager) {
        const sceneFolder = gui.addFolder('Scenes');

        sceneInfo = { name: 'loading...' };
        const sceneInfoCtrl = sceneFolder.add(sceneInfo, 'name').name('Current Scene').disable();
        window._sceneInfoCtrl = sceneInfoCtrl;

        // const cityDuration = { value: sceneManager.getDuration('city') || 45 };
        // const cityDurCtrl = sceneFolder.add(cityDuration, 'value', 5, 120, 1).name('City Duration (s)');
        // addInfoIcon(cityDurCtrl.domElement, 'Time before auto-switching from city scene');
        // cityDurCtrl.onChange((v) => sceneManager.setDuration('city', v));

        // const testDuration = { value: sceneManager.getDuration('test') || 10 };
        // const testDurCtrl = sceneFolder.add(testDuration, 'value', 3, 60, 1).name('Test Duration (s)');
        // addInfoIcon(testDurCtrl.domElement, 'Time before auto-switching from test scene');
        // testDurCtrl.onChange((v) => sceneManager.setDuration('test', v));

        const nextSceneBtn = {
            'Next Scene': () => {
                params.forceNextScene = true;
            }
        };
        const nextSceneCtrl = sceneFolder.add(nextSceneBtn, 'Next Scene').name('⏭ Next Scene');
        addInfoIcon(nextSceneCtrl.domElement, 'Manually trigger transition to next scene');

        timerDisplay = { elapsed: '0s' };
        const timerCtrl = sceneFolder.add(timerDisplay, 'elapsed').name('Timer').disable();

        const nextSwitchDisplay = { next: '0s' };
        const nextSwitchCtrl = sceneFolder.add(nextSwitchDisplay, 'next').name('Next Switch').disable();
        window._updateNextSwitchDisplay = nextSwitchDisplay;
        window._nextSwitchCtrl = nextSwitchCtrl;
        window._timerCtrl = timerCtrl;

        sceneFolder.close();
    }

    window._updateSceneGui = (elapsed, maxDuration) => {
        if (sceneInfo && sceneManager) {
            const active = sceneManager.getActiveScene();
            if (active) {
                sceneInfo.name = active.name;
                if (window._sceneInfoCtrl) window._sceneInfoCtrl.updateDisplay();
            }
            const remaining = Math.max(0, maxDuration - elapsed);
            if (timerDisplay) {
                timerDisplay.elapsed = remaining.toFixed(1) + 's';
                if (window._timerCtrl) window._timerCtrl.updateDisplay();
            }
            if (window._updateNextSwitchDisplay) {
                window._updateNextSwitchDisplay.next = sceneManager.timeUntilNextSwitch().toFixed(1) + 's';
                if (window._nextSwitchCtrl) window._nextSwitchCtrl.updateDisplay();
            }
        }
    };

    gui.close();

    guiControllers.updateDisplays = (p) => {
        speedCtrl.updateDisplay();
        blCtrl.updateDisplay();
        foldCtrl.updateDisplay();
        edgeCtrl.updateDisplay();
        veinCtrl.updateDisplay();
        radiusCtrl.updateDisplay();
        autoSpeedCtrl.updateDisplay();
        timeCtrl.updateDisplay();
        colorACtrl.updateDisplay();
        colorBCtrl.updateDisplay();
    };

    guiControllers.updateModeDisplay = () => {
        modeCtrl.updateDisplay();
    };
}
