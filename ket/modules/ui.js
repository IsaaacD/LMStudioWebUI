import GUI from 'lil-gui';

export function initGUI(params, guiControllers) {
    const gui = new GUI({ title: 'Trip Controls' });

    const tooltipEl = document.createElement('div');
    Object.assign(tooltipEl.style, {
        position: 'fixed', pointerEvents: 'none', background: 'rgba(10,10,20,0.92)',
        color: '#ddd', padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
        lineHeight: '1.4', maxWidth: '240px', zIndex: '99999', display: 'none',
        boxShadow: '0 2px 12px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)'
    });
    document.body.appendChild(tooltipEl);

    function addInfoIcon(domEl, text) {
        const icon = document.createElement('span');
        icon.innerHTML = 'ⓘ&nbsp;';
        Object.assign(icon.style, {
            marginLeft: '6px', cursor: 'help', fontSize: '11px', opacity: '0.5',
            color: '#aaa', fontWeight: 'bold', userSelect: 'none'
        });
        icon.addEventListener('mouseenter', (e) => {
            tooltipEl.textContent = text;
            tooltipEl.style.display = 'block';
            tooltipEl.style.left = e.clientX + 14 + 'px';
            tooltipEl.style.top = e.clientY + 14 + 'px';
        });
        icon.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none'; });
        icon.addEventListener('mousemove', (e) => {
            tooltipEl.style.left = e.clientX + 14 + 'px';
            tooltipEl.style.top = e.clientY + 14 + 'px';
        });
        domEl.prepend(icon);
    }

    const movFolder = gui.addFolder('Movement');
    const modeCtrl = movFolder.add(params, 'controlMode').name('Mode').disable();
    addInfoIcon(modeCtrl.domElement, 'Current control mode: Auto (autopilot) or Manual (WASD)');
    const swCtrl = movFolder.add(params, 'switchMode').name('🔄 Switch Auto/Manual');
    addInfoIcon(swCtrl.domElement, 'Toggle between automatic flight and manual WASD controls');
    const speedCtrl = movFolder.add(params, 'speed', 0, 5).name('Flight Speed');
    addInfoIcon(speedCtrl.domElement, 'Movement speed in manual mode (WASD keys)');
    const autoSpeedCtrl = movFolder.add(params, 'autoplaySpeed', 0, 3).name('Auto Speed');
    addInfoIcon(autoSpeedCtrl.domElement, 'Forward speed of the camera in autopilot mode');
    const timeCtrl = movFolder.add(params, 'timeScale', 0, 3).name('Time Dilation');
    addInfoIcon(timeCtrl.domElement, 'Global time multiplier — affects animation speed and shader effects');
    const paCtrl = movFolder.add(params, 'togglePause').name('⏸ Pause / Resume');
    addInfoIcon(paCtrl.domElement, 'Pause or resume the animation loop');
    movFolder.close();

    const visFolder = gui.addFolder('Visuals');
    const blCtrl = visFolder.add(params, 'bloomStrength', 0, 3).name('Bloom Glow');
    addInfoIcon(blCtrl.domElement, 'Intensity of the bloom post-processing glow effect');
    const radiusCtrl = visFolder.add(params, 'bloomRadius', 0, 1).name('Glow Radius');
    addInfoIcon(radiusCtrl.domElement, 'Spread radius of the bloom glow');
    const foldCtrl = visFolder.add(params, 'foldIntensity', 0, 3).name('Fold Intensity');
    addInfoIcon(foldCtrl.domElement, 'Strength of the terrain folding and distortion in shaders');
    const veinCtrl = visFolder.add(params, 'veinSpeed', 0, 3).name('Vein Flow');
    addInfoIcon(veinCtrl.domElement, 'Speed of the organic vein patterns flowing across surfaces');
    const colorACtrl = visFolder.addColor(params, 'colorA').name('Color A');
    addInfoIcon(colorACtrl.domElement, 'Primary accent color for terrain and walls');
    const colorBCtrl = visFolder.addColor(params, 'colorB').name('Color B');
    addInfoIcon(colorBCtrl.domElement, 'Secondary accent color for terrain and walls');
    const edgeCtrl = visFolder.add(params, 'edgeContrast', 0, 0.45).name('Outline Strength');
    addInfoIcon(edgeCtrl.domElement, 'Intensity of the edge-detection outline effect');
    visFolder.close();

    const actFolder = gui.addFolder('Actions');
    const raCtrl = actFolder.add(params, 'randomize').name('🎲 Randomize');
    addInfoIcon(raCtrl.domElement, 'Randomize all visual and movement parameters for a new look');
    actFolder.close();

    gui.close();

    guiControllers.updateDisplays = (p) => {
        speedCtrl.updateDisplay();
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
