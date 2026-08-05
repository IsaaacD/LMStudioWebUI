import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { initTouchControls } from './modules/touchControls.js';
import { getDefaultParams, randomizeParams, updateStatusText } from './modules/config.js';
import { FEATURES, setGlobalSeed, getGlobalSeed } from './modules/utils.js';
import { initScene, getCamera, getRenderer, getClock, onResize, getViewportSize } from './modules/scene.js';
import { createCityMaterial, createWallMaterial, createPrimitiveMaterial } from './modules/materials.js';
import { createHeartMaterial, HeartSpawner } from './modules/heartSpawner.js';
import { ImageSpawner } from './modules/imageSpawner.js';
import { initAudio, setSceneReadyCallback } from './modules/audio.js';
import { PostProcessor } from './modules/postprocessing.js';
import { RaveEngine } from './modules/raveMode.js';
import { initGUI } from './modules/ui.js';
import { AnimationLoop } from './modules/animation.js';
import { SceneManager } from './modules/sceneManager.js';
import { TransitionMelt } from './modules/transitionMelt.js';
import { FPSCounter } from './modules/fpsCounter.js';
import { WebRTCManager } from './modules/webrtc.js';

import { createCityScene } from './scenes/cityScene.js';
import { createSparseScreen } from './scenes/sparseScene.js';
import { createLumberScene } from './scenes/lumberScene.js'
import { createLiminalScene } from './scenes/liminalScene.js'
import { overrideMathRandomWithSeed } from './modules/utils.js';
import { loadAllAssets, setProgressCallback } from './modules/loader.js';


// Seed from URL param `?seed=123` so all clients stay in sync
const urlSeed = new URLSearchParams(window.location.search).get('seed');
if (urlSeed !== null) {
    setGlobalSeed(parseInt(urlSeed, 10));
    console.log('[seed] Math.random seeded with', getGlobalSeed());
    overrideMathRandomWithSeed()
}
overrideMathRandomWithSeed();

let postProcessor = null;
let animationLoop = null;
let params = null;
let fpsCounter = null;
let stats = null;
let webrtcManager = null;

// Expose seed for cross-client sync
window.__globalSeed = getGlobalSeed();

if (new URLSearchParams(window.location.search).has('fps')) {
    //    fpsCounter = new FPSCounter();
    //   fpsCounter.init();

    stats = new Stats();
    stats.dom.classList.add('stats');
    stats.dom.classList.add('gui');
    stats.dom.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        z-index: 99999;
        pointer-events: auto;
    `;
    let statsMode = 0;
    stats.dom.addEventListener('click', () => {
        statsMode += 1;
        if (statsMode > 1) statsMode = 0;
        stats.showPanel(statsMode);
    });
    document.body.appendChild(stats.dom);
}

async function bootstrap() {
    const splashEl = document.getElementById('splash');
    const splashSub = document.getElementById('splash-sub');
    const progressTrack = document.getElementById('splash-progress-track');
    const progressBar = document.getElementById('splash-progress-bar');
    const progressText = document.getElementById('splash-progress-text');

    initAudio(splashEl, splashSub);

    progressTrack.classList.add('visible');
    progressText.classList.add('visible');
    splashSub.textContent = 'INITIALIZING...';
    splashSub.style.animation = 'none';

    setProgressCallback((loaded, total) => {
        const pct = Math.round((loaded / total) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = `LOADING ${pct}%`;
    });

    await loadAllAssets();

    const urlSceneId = new URLSearchParams(window.location.search).get('scene');
    const isDirectSceneLoad = urlSceneId !== null;
    if (isDirectSceneLoad) {
        splashEl.style.display = 'none';
    } else {
        splashSub.textContent = 'CLICK TO ENTER';
        splashSub.style.animation = 'breathe 3s ease-in-out infinite';
        splashEl.classList.add('ready');
        progressText.textContent = 'ALL ASSETS LOADED';
    }

    await initScene();

    const cityMaterial = await createCityMaterial();
    const wallMaterial = await createWallMaterial();
    const primitiveMaterial = await createPrimitiveMaterial();
    const heartMaterial = await createHeartMaterial();
    const sceneManager = new SceneManager();
    const cityScene = await createCityScene(cityMaterial, wallMaterial, primitiveMaterial, heartMaterial);
    const sparseScene = await createSparseScreen();
    const lumberScene = await createLumberScene();
    const liminalScene = await createLiminalScene();
    sceneManager.registerScene(cityScene);
    sceneManager.registerScene(sparseScene);
    sceneManager.registerScene(lumberScene);
    sceneManager.registerScene(liminalScene);

    if (isDirectSceneLoad && sceneManager.scenes.has(urlSceneId)) {
        sceneManager.lockScene(urlSceneId);
        console.log(`[scene] Locked to scene: ${urlSceneId}`);
    }

    const initialScene = sceneManager.resolveInitialScene();

    const imageSpawner = new ImageSpawner(initialScene.threeScene, 'images/ralph.png');
    const heartSpawner = new HeartSpawner(initialScene.threeScene, heartMaterial);

    const camera = getCamera();
    const renderer = getRenderer();
    const clock = getClock();

    postProcessor = new PostProcessor(renderer, initialScene.threeScene, camera);
    sceneManager.composer = postProcessor;
    await Promise.all([
        postProcessor.initEdgePass(),
        postProcessor.initPixelationPass(),
        postProcessor.initChromaticAberrationPass(),
        postProcessor.initMergedEffectsPass(),
        postProcessor.initMeltPass()
    ]);

    postProcessor._cacheUniforms();

    const transitionEffect = new TransitionMelt();

    params = { ...getDefaultParams() };
    if (isDirectSceneLoad && sceneManager.scenes.has(urlSceneId)) {
        params.autoplay = true;
        params.controlMode = 'Auto';
    }

    const isDebug = new URLSearchParams(window.location.search).has('debug');

    params.switchMode = () => {
        if (params.controlMode === 'Auto') {
            params.autoplay = false;
            params.controlMode = 'Manual';
        } else {
            params.autoplay = true;
            params.controlMode = 'Auto';
        }
        //if (guiControllers) guiControllers.updateModeDisplay();
        updateStatusText(params.paused, params.raveMode, params.autoplay);
    };

    params.toggleRaveMode = () => {
        params.raveMode = !params.raveMode;
        if (params.raveMode) {
            raveEngine.syncCurrent(params);
            raveEngine.pickTargets();
        }
        if (guiControllers.updateRaveToggle) guiControllers.updateRaveToggle();
        updateStatusText(params.paused, params.raveMode, params.autoplay);
    };

    params.togglePause = () => {
        params.paused = !params.paused;
        updateStatusText(params.paused, params.raveMode, params.autoplay);
    };

    params.randomize = () => {
        randomizeParams(params);
        raveEngine.syncCurrent(params);
        if (guiControllers.updateDisplays) guiControllers.updateDisplays(params);
    };

    const raveEngine = new RaveEngine(params);

    const guiControllers = {};
    if (!isDirectSceneLoad) {
        initGUI(params, guiControllers, sceneManager, raveEngine);
    }

    initTouchControls(params);

    if (FEATURES.webrtc && FEATURES.onlineMode) {
        webrtcManager = new WebRTCManager();
        webrtcManager.setCamera(camera);
        webrtcManager.setSceneManager(sceneManager);
        webrtcManager.setParams(params);
        webrtcManager.initActiveScene(initialScene.threeScene);
        //webrtcManager.setDomElement(renderer.domElement);
        webrtcManager.init();
    }

    animationLoop = new AnimationLoop({
        camera,
        composer: postProcessor,
        params,
        sceneManager,
        transitionEffect,
        raveEngine,
        fpsCounter,
        stats,
        webrtcManager,
        imageSpawner,
        heartSpawner
    });

    animationLoop.onTimerUpdate = (elapsed, maxDuration) => {
        if (window._updateSceneGui) window._updateSceneGui(elapsed, maxDuration);
    };

    if (webrtcManager) webrtcManager.setAnimationLoop(animationLoop);

    window.addEventListener('resize', () => {
        onResize();
        const { w, h } = getViewportSize();
        postProcessor.resize(w, h);
    });

    document.addEventListener('focusout', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
            const doResize = () => {
                onResize();
                const { w, h } = getViewportSize();
                postProcessor.resize(w, h);
            };
            setTimeout(doResize, 100);
            setTimeout(doResize, 400);
        }
    }, true);

    setSceneReadyCallback(() => {
        animationLoop.start(clock);
    });

    if (isDirectSceneLoad) {
        animationLoop.start(clock);
    }
}

bootstrap();
