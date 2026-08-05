import * as THREE from 'three';
import { TileManager } from '../modules/tiles.js';
import { PrimitiveManager } from '../modules/primitives.js';
import { normalizeColor } from '../modules/utils.js';

const _tempColor = new THREE.Color();
const MIN_DURATION = 10;
const MAX_DURATION = MIN_DURATION * 2;
const WEIGHT = 3;

export async function createCityScene(cityMaterial, wallMaterial, primitiveMaterial, heartMaterial) {
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050011);
    threeScene.fog = new THREE.FogExp2(0x050011, 0.003);

    const TILE_SIZE = 200;
    const TILE_HEIGHT = 25;

    const tileManager = new TileManager(threeScene, cityMaterial, wallMaterial);
    const primitiveManager = new PrimitiveManager(
        threeScene, primitiveMaterial,
        TILE_SIZE, TILE_HEIGHT, 200, 140
    );

    return {
        id: 'nexus',
        name: 'Nexus',
        minDuration: MIN_DURATION,
        maxDuration: MAX_DURATION,
        threeScene,
        defaultDuration: 45,
        managers: { tileManager, primitiveManager },
        constants: { TILE_SIZE, TILE_HEIGHT },
        sharedMaterials: { cityMaterial, wallMaterial, primitiveMaterial, heartMaterial },
        weight: WEIGHT,
        onEnter() { },

        onExit() { },

        onUpdate(camera, effectiveTime, dt, activeParams) {
            cityMaterial.uniforms.uTime.value = effectiveTime;
            cityMaterial.uniforms.uFoldIntensity.value = activeParams.foldIntensity;
            _tempColor.set(normalizeColor(activeParams.colorA, 'cityScene:42'));
            cityMaterial.uniforms.uColor1.value.copy(_tempColor);
            _tempColor.set(normalizeColor(activeParams.colorB, 'cityScene:44'));
            cityMaterial.uniforms.uColor2.value.copy(_tempColor);

            wallMaterial.uniforms.uTime.value = effectiveTime;
            wallMaterial.uniforms.uFoldIntensity.value = activeParams.foldIntensity;
            _tempColor.set(normalizeColor(activeParams.colorA, 'cityScene:50'));
            wallMaterial.uniforms.uColor1.value.copy(_tempColor);
            _tempColor.set(normalizeColor(activeParams.colorB, 'cityScene:52'));
            wallMaterial.uniforms.uColor2.value.copy(_tempColor);

            cityMaterial.uniforms.uFogColor.value.copy(_tempColor);
            _tempColor.set(normalizeColor(activeParams.colorA, 'cityScene:42'));

            wallMaterial.uniforms.uFogColor.value.copy(_tempColor);
            primitiveManager.sharedMaterial.uniforms.uFogColor.value.copy(_tempColor);

            tileManager.update(camera);
            primitiveManager.update(camera, effectiveTime, dt, activeParams.colorA, activeParams.colorB);
        }
    };
}
