import * as THREE from 'three';
import { TileManager } from '../modules/tiles.js';
import { PrimitiveManager } from '../modules/primitives.js';
import { HeartSpawner } from '../modules/heartSpawner.js';
import { ImageSpawner } from '../modules/imageSpawner.js';

export async function createCityScene(cityMaterial, wallMaterial, primitiveMaterial, heartMaterial) {
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050011);
    threeScene.fog = new THREE.FogExp2(0x050011, 0.0003);

    const TILE_SIZE = 200;
    const TILE_HEIGHT = 25;

    const tileManager = new TileManager(threeScene, cityMaterial, wallMaterial);
    const primitiveManager = new PrimitiveManager(
        threeScene, primitiveMaterial,
        TILE_SIZE, TILE_HEIGHT, 200, 140
    );
    const imageSpawner = new ImageSpawner(threeScene, 'images/ralph.png');
    const heartSpawner = new HeartSpawner(threeScene, heartMaterial);

    return {
        id: 'city',
        name: 'City',
        threeScene,
        defaultDuration: 45,
        managers: { tileManager, primitiveManager, imageSpawner, heartSpawner },
        constants: { TILE_SIZE, TILE_HEIGHT },

        onEnter() {},

        onExit() {},

        onUpdate(camera, effectiveTime, dt, activeParams) {
            for (const t of tileManager.getFloorCeilTiles()) {
                if (!t.visible) continue;
                t.material.uniforms.uTime.value = effectiveTime;
                t.material.uniforms.uFoldIntensity.value = activeParams.foldIntensity;
                t.material.uniforms.uColor1.value.set(activeParams.colorA);
                t.material.uniforms.uColor2.value.set(activeParams.colorB);
                t.material.uniforms.uTileOffset.value.set(
                    t._gx * TILE_SIZE, t._gz * TILE_SIZE, t._gy * TILE_HEIGHT
                );
                t.material.uniforms.uCameraPos.value.copy(camera.position);
            }
            for (const t of tileManager.getWallTiles()) {
                if (!t.visible) continue;
                t.material.uniforms.uTime.value = effectiveTime;
                t.material.uniforms.uFoldIntensity.value = activeParams.foldIntensity;
                t.material.uniforms.uColor1.value.set(activeParams.colorA);
                t.material.uniforms.uColor2.value.set(activeParams.colorB);
                t.material.uniforms.uTileOffset.value.set(
                    t._gx * TILE_SIZE, t._gz * TILE_SIZE, t._gy * TILE_HEIGHT
                );
                t.material.uniforms.uCameraPos.value.copy(camera.position);
            }

            tileManager.update(camera);
            primitiveManager.update(camera, effectiveTime, dt, activeParams.colorA, activeParams.colorB);
            imageSpawner.update(camera, effectiveTime, dt);
            heartSpawner.update(camera, effectiveTime, dt, activeParams.colorA, activeParams.colorB);
        }
    };
}
