import * as THREE from 'three';
import { initTouchControls } from './touchControls.js';
import { loadShader } from './utils.js';
import { defaultParams, randomizeParams, updateStatusText } from './config.js';
import { initScene, getScene, getCamera, getRenderer, getClock, onResize } from './scene.js';
import { createCityMaterial, createWallMaterial, createPrimitiveMaterial } from './materials.js';
import { initAudio, setSceneReadyCallback } from './audio.js';
import { getTileConstants, TileManager } from './tiles.js';
import { PrimitiveManager } from './primitives.js';
import { PostProcessor } from './postprocessing.js';
import { RaveEngine } from './raveMode.js';
import { initGUI } from './ui.js';
import { AnimationLoop } from './animation.js';

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

    const scene = getScene();
    const camera = getCamera();
    const renderer = getRenderer();
    const clock = getClock();

    postProcessor = new PostProcessor(renderer, scene, camera);
    await postProcessor.initEdgePass();

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

    const tileConstants = getTileConstants();
    const tileManager = new TileManager(scene, cityMaterial, wallMaterial);
    const primitiveManager = new PrimitiveManager(scene, primitiveMaterial, tileConstants.TILE_SIZE, tileConstants.TILE_HEIGHT, tileConstants.RECYCLE_DIST, tileConstants.RENDER_DIST);

    const guiControllers = {};
    initGUI(params, guiControllers);

    initTouchControls(params);

    animationLoop = new AnimationLoop({
        camera,
        composer: postProcessor,
        params,
        tileManager,
        primitiveManager,
        raveEngine,
        tileConstants
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
