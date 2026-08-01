/* ── Resource Loader with Progress Tracking ── */

import { preloadShader } from './utils.js';

const ASSET_MANIFEST = [
    // Shaders: materials
    { id: 'shader-city-v', type: 'shader', path: './shaders/city.vert' },
    { id: 'shader-city-f', type: 'shader', path: './shaders/city-line.frag' },
    { id: 'shader-wall-v', type: 'shader', path: './shaders/wall.vert' },
    { id: 'shader-wall-f', type: 'shader', path: './shaders/wall.frag' },
    { id: 'shader-prim-v', type: 'shader', path: './shaders/primitive.vert' },
    { id: 'shader-prim-f', type: 'shader', path: './shaders/primitive.frag' },
    { id: 'shader-heart-v', type: 'shader', path: './shaders/heart.vert' },
    { id: 'shader-heart-f', type: 'shader', path: './shaders/heart.frag' },
    { id: 'shader-wood-v', type: 'shader', path: './shaders/wood.vert' },
    { id: 'shader-wood-f', type: 'shader', path: './shaders/wood.frag' },
    // Sparse scene shaders
    { id: 'shader-sparse-float-v', type: 'shader', path: './shaders/sparse-float.vert' },
    { id: 'shader-sparse-float-f', type: 'shader', path: './shaders/sparse-float.frag' },
    { id: 'shader-sparse-grid-v', type: 'shader', path: './shaders/sparse-grid.vert' },
    { id: 'shader-sparse-grid-f', type: 'shader', path: './shaders/sparse-grid.frag' },
    { id: 'shader-sparse-aurora-v', type: 'shader', path: './shaders/sparse-aurora.vert' },
    { id: 'shader-sparse-aurora-f', type: 'shader', path: './shaders/sparse-aurora.frag' },
    { id: 'shader-wood-crack-f', type: 'shader', path: './shaders/wood-crack.frag' },
    // Liminal scene shaders
    { id: 'shader-liminal-grain-v', type: 'shader', path: './shaders/liminal-grain.vert' },
    { id: 'shader-liminal-grain-f', type: 'shader', path: './shaders/liminal-grain.frag' },
    { id: 'shader-liminal-vignette-v', type: 'shader', path: './shaders/liminal-vignette.vert' },
    { id: 'shader-liminal-vignette-f', type: 'shader', path: './shaders/liminal-vignette.frag' },
    { id: 'shader-liminal-chroma-v', type: 'shader', path: './shaders/liminal-chroma.vert' },
    { id: 'shader-liminal-chroma-f', type: 'shader', path: './shaders/liminal-chroma.frag' },
    { id: 'shader-liminal-scanline-v', type: 'shader', path: './shaders/liminal-scanline.vert' },
    { id: 'shader-liminal-scanline-f', type: 'shader', path: './shaders/liminal-scanline.frag' },
    // Shaders: postprocessing
    { id: 'shader-sorbel-v', type: 'shader', path: './shaders/sorbel.vert' },
    { id: 'shader-sorbel-f', type: 'shader', path: './shaders/sorbel.frag' },
    { id: 'shader-pixel-v', type: 'shader', path: './shaders/pixelate.vert' },
    { id: 'shader-pixel-f', type: 'shader', path: './shaders/pixelate.frag' },
    // Audio
    { id: 'audio-music', type: 'audio', path: './music/lights.mp3' },
    // Images
    { id: 'img-ralph', type: 'image', path: './images/ralph.png' },
];

let _allLoaded = false;
let _onProgress = null;

export function setProgressCallback(fn) {
    _onProgress = fn;
}

export function isAllLoaded() {
    return _allLoaded;
}

function emitProgress(loadedCount) {
    if (_onProgress) {
        _onProgress(loadedCount, ASSET_MANIFEST.length);
    }
}

async function loadSingle(asset) {
    try {
        let result;
        if (asset.type === 'shader') {
            const res = await fetch(asset.path);
            if (!res.ok) throw new Error(`Shader ${asset.path}: ${res.statusText}`);
            result = await res.text();
            preloadShader(asset.path, result);
        } else if (asset.type === 'audio') {
            const res = await fetch(asset.path);
            if (!res.ok) throw new Error(`Audio ${asset.path}: ${res.statusText}`);
            result = await res.blob();
        } else if (asset.type === 'image') {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Image ${asset.path} failed`));
                img.src = asset.path;
            });
        }
        return result;
    } catch (err) {
        console.error(`[Loader] Failed: ${asset.id}`, err);
        return null;
    }
}

export async function loadAllAssets() {
    let loadedCount = 0;
    const promises = ASSET_MANIFEST.map(async (asset) => {
        const result = await loadSingle(asset);
        if (result !== null) {
            loadedCount++;
        }
        emitProgress(loadedCount);
        return { asset, ok: result !== null, value: result };
    });
    const results = await Promise.all(promises);
    _allLoaded = true;
    emitProgress(ASSET_MANIFEST.length);
    return results;
}
