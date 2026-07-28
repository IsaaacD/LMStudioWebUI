
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uCameraPos;
varying float vElevation;
varying vec2 vUv;
varying vec3 vWorldPosition;

float veinNoise(vec2 uv) {
    float n = 0.0;
    n += sin(uv.x * 12.0 + uTime * 1.2) * 0.4;
    n += sin(uv.y * 8.0 + uTime * 0.8) * 0.6;
    n += sin((uv.x - uv.y) * 15.0 + uTime * 1.5) * 0.3;
    return n;
}

void main() {
    // Gradient between Color A and Color B over elevation + time
    float t = (cos(uTime * 0.3) * 0.5 + 0.5) * 0.5 + vElevation * 0.5;
    vec3 col1 = mix(uColor1, uColor2, t);
    vec3 col2 = mix(uColor2, uColor1, t);
    vec3 base = mix(uColor3, col1, 0.15);

    vec3 finalColor = base;

    if (vElevation > 0.5) {
    float pulse = sin(vWorldPosition.y * 3.0 + uTime * 1.5 + vWorldPosition.z * 2.0);
    if (pulse > 0.7) {
        finalColor = mix(finalColor, col2, 0.9);
    } else {
        finalColor = mix(finalColor, col1, 0.4);
    }
    }

    float veins = veinNoise(vUv * 6.0 + uTime * 0.08);
    veins = smoothstep(0.5, 0.85, veins);
    finalColor = mix(finalColor, col1, veins * 0.4);

    float gridLine = step(0.97, fract(vUv.x * 16.0)) + step(0.97, fract(vUv.y * 16.0));
    finalColor += col2 * gridLine * 0.4;

    float dist = length(vWorldPosition.xz - uCameraPos.xz);
    float fogFactor = smoothstep(0.0, 80.0, dist);
    finalColor = mix(finalColor, vec3(0.05, 0.0, 0.1), fogFactor);

    gl_FragColor = vec4(finalColor, 0.55);
}