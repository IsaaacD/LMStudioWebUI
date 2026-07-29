import * as THREE from 'three';
import { initTouchControls } from './modules/touchControls.js';
import { defaultParams, randomizeParams, updateStatusText } from './modules/config.js';
import { initScene, getCamera, getRenderer, getClock, onResize } from './modules/scene.js';
import { createCityMaterial, createWallMaterial, createPrimitiveMaterial } from './modules/materials.js';
import { createHeartMaterial } from './modules/heartSpawner.js';
import { initAudio, setSceneReadyCallback } from './modules/audio.js';
import { PostProcessor } from './modules/postprocessing.js';
import { RaveEngine } from './modules/raveMode.js';
import { initGUI } from './modules/ui.js';
import { AnimationLoop } from './modules/animation.js';
import { SceneManager } from './modules/sceneManager.js';
import { TransitionEffect } from './modules/transition.js';
import { FPSCounter } from './modules/fpsCounter.js';
import { createCityScene } from './scenes/cityScene.js';
import { createTestScene } from './scenes/testScene.js';
import { loadAllAssets, setProgressCallback } from './modules/loader.js';

let postProcessor = null;
let animationLoop = null;
let params = null;
let fpsCounter = null;

if (new URLSearchParams(window.location.search).has('fps')) {
    fpsCounter = new FPSCounter();
    fpsCounter.init();
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

    splashSub.textContent = 'CLICK TO ENTER';
    splashSub.style.animation = 'breathe 3s ease-in-out infinite';
    splashEl.classList.add('ready');
    progressText.textContent = 'ALL ASSETS LOADED';

    await initScene();

    const cityMaterial = await createCityMaterial();
    const wallMaterial = await createWallMaterial();
    const primitiveMaterial = await createPrimitiveMaterial();
    const heartMaterial = await createHeartMaterial();
    const sceneManager = new SceneManager();
    const cityScene = await createCityScene(cityMaterial, wallMaterial, primitiveMaterial, heartMaterial);
    const testScene = await createTestScene();
    sceneManager.registerScene(cityScene);
    sceneManager.registerScene(testScene);

    const camera = getCamera();
    const renderer = getRenderer();
    const clock = getClock();

    postProcessor = new PostProcessor(renderer, cityScene.threeScene, camera);
    await postProcessor.initEdgePass();
    await postProcessor.initPixelationPass();

    const transitionEffect = new TransitionEffect();

    params = { ...defaultParams };

    params.switchMode = () => {
        if (params.controlMode === 'Auto') {
            params.autoplay = false;
            params.raveMode = false;
            params.controlMode = 'Manual';
        } else if (params.controlMode === 'Manual') {
            params.autoplay = false;
            params.raveMode = true;
            params.controlMode = 'Rave';
            raveEngine.pickTargets();
            raveEngine.raveNextTime = clock.getElapsedTime() + 1 + Math.random() * 2;
        } else {
            params.autoplay = true;
            params.raveMode = false;
            params.controlMode = 'Auto';
        }
        guiControllers.updateModeDisplay();
        updateStatusText(params.paused, params.raveMode, params.autoplay);
    };

    params.togglePause = () => {
        params.paused = !params.paused;
        updateStatusText(params.paused, params.raveMode, params.autoplay);
    };

    params.randomize = () => {
        randomizeParams(params);
        guiControllers.updateDisplays(params);
    };

    const raveEngine = new RaveEngine(params);

    const guiControllers = {};
    initGUI(params, guiControllers, sceneManager);

    initTouchControls(params);

    animationLoop = new AnimationLoop({
        camera,
        composer: postProcessor,
        params,
        sceneManager,
        transitionEffect,
        raveEngine,
        fpsCounter
    });

    window.addEventListener('resize', () => {
        onResize();
        postProcessor.resize(innerWidth, innerHeight);
    });

    setSceneReadyCallback(() => {
        animationLoop.start(clock);
    });
}

bootstrap();
