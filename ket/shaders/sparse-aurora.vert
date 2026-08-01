uniform float uTime;
uniform float uWaveAmp;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;

    float wave1 = sin(worldPos.x * 0.3 + uTime * 0.4) * uWaveAmp;
    float wave2 = sin(worldPos.x * 0.7 - uTime * 0.6) * uWaveAmp * 0.5;

    vec3 newPos = position;
    newPos.y += wave1 + wave2;
    newPos.z += sin(worldPos.x * 0.2 + uTime * 0.3) * uWaveAmp * 0.3;

    vUv = uv;
    vWorldPosition = (modelMatrix * vec4(newPos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
