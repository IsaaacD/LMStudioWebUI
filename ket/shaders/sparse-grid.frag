uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vWave;

void main() {
    float gridX = abs(fract(vWorldPosition.x * 0.2) - 0.5);
    float gridZ = abs(fract(vWorldPosition.z * 0.2) - 0.5);
    float lineX = smoothstep(0.45, 0.48, gridX);
    float lineZ = smoothstep(0.45, 0.48, gridZ);
    float grid = max(lineX, lineZ);

    float dist = length(vWorldPosition.xz - cameraPosition.xz);
    float fade = 1.0 - smoothstep(10.0, 150.0, dist);

    float t = sin(uTime * 0.2 + vWave) * 0.5 + 0.5;
    vec3 color = mix(uColor1, uColor2, t);
    color += grid * uColor2 * 0.5;

    float pulse = sin(dist * 0.1 - uTime * 2.0) * 0.5 + 0.5;
    color += pulse * 0.1;

    gl_FragColor = vec4(color, grid * fade * 0.8);
}
