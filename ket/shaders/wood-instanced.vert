precision highp float;

uniform float uTime;

attribute vec3 instColorA;
attribute vec3 instColorB;
attribute float instGrainIntensity;
attribute float instKnotIntensity;
attribute float instCrackGlow;
attribute float instUseCrack;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDepth;
varying vec3 vColorA;
varying vec3 vColorB;
varying float vGrainIntensity;
varying float vKnotIntensity;
varying float vCrackGlow;
varying float vUseCrack;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vDepth = wp.z;
    vColorA = instColorA;
    vColorB = instColorB;
    vGrainIntensity = instGrainIntensity;
    vKnotIntensity = instKnotIntensity;
    vCrackGlow = instCrackGlow;
    vUseCrack = instUseCrack;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
