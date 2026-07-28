import * as THREE from 'three';
import { loadShader } from './utils.js';

export async function createCityMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color(0xff0055) },
            uColor2: { value: new THREE.Color(0x00ccff) },
            uColor3: { value: new THREE.Color(0x110022) },
            uFoldIntensity: { value: 1.0 },
            uTileOffset: { value: new THREE.Vector3(0, 0, 0) },
            uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
            //uAlpha: { value: 0.8 }
        },
        vertexShader: await loadShader('./shaders/city.vert'),
        fragmentShader: await loadShader('./shaders/city.frag'),
        wireframe: false,
        transparent: true,
        side: THREE.DoubleSide
    });
}

export async function createWallMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color(0xff0055) },
            uColor2: { value: new THREE.Color(0x00ccff) },
            uColor3: { value: new THREE.Color(0x110022) },
            uFoldIntensity: { value: 1.0 },
            uTileOffset: { value: new THREE.Vector3(0, 0, 0) },
            uCameraPos: { value: new THREE.Vector3(0, 0, 0) }
        },
        vertexShader: await loadShader('./shaders/wall.vert'),
        fragmentShader: await loadShader('./shaders/wall.frag'),
        transparent: true,
        depthWrite: false,
        wireframe: false,
        side: THREE.DoubleSide
    });
}

export async function createPrimitiveMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color(0xff0055) },
            uColor2: { value: new THREE.Color(0x00ccff) },
            uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
            uAlpha: { value: 0.8 },
            uWaveAmp: { value: 0.4 }
        },
        vertexShader: await loadShader('./shaders/primitive.vert'),
        fragmentShader: await loadShader('./shaders/primitive.frag'),
        transparent: true,
        depthWrite: false,
        wireframe: false,
        side: THREE.DoubleSide
    });
}
