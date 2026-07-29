import * as THREE from 'three';
import { initTouchControls } from './modules/touchControls.js';
import { loadShader } from './modules/utils.js';
import { defaultParams, randomizeParams, updateStatusText } from './modules/config.js';
import { initScene, getScene, getCamera, getRenderer, getClock, onResize } from './modules/scene.js';
import { createCityMaterial, createWallMaterial, createPrimitiveMaterial } from './modules/materials.js';
import { initAudio, setSceneReadyCallback } from './modules/audio.js';
import { getTileConstants, TileManager } from './modules/tiles.js';
import { PrimitiveManager } from './modules/primitives.js';
import { ImageSpawner } from './modules/imageSpawner.js';
import { PostProcessor } from './modules/postprocessing.js';
import { RaveEngine } from './modules/raveMode.js';
import { initGUI } from './modules/ui.js';
import { AnimationLoop } from './modules/animation.js';

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
    const imageSpawner = new ImageSpawner(scene, 'images/ralph.png');

    const guiControllers = {};
    initGUI(params, guiControllers);

    initTouchControls(params);

    animationLoop = new AnimationLoop({
        camera,
        composer: postProcessor,
        params,
        tileManager,
        primitiveManager,
        imageSpawner,
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
