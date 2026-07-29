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
import { createCityScene } from './scenes/cityScene.js';
import { createTestScene } from './scenes/testScene.js';

let postProcessor = null;
let animationLoop = null;
let params = null;

async function bootstrap() {
    initScene();

    const splashEl = document.getElementById('splash');
    const splashSub = document.getElementById('splash-sub');
    initAudio(splashEl, splashSub);

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
        raveEngine
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
