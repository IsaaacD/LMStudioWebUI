uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uCameraPos;
varying float vElevation;
//uniform float uAlpha;
varying vec2 vUv;
varying vec3 vWorldPosition;

float veinNoise(vec2 uv) {
    float n = 0.0;
    n += sin(uv.x * 10.0 + uTime) * 0.5;
    n += sin(uv.y * 10.0 + uTime * 0.5) * 0.5;
    n += sin((uv.x + uv.y) * 20.0 + uTime * 2.0) * 0.25;
    return n;
}

void main() {
    // Gradient between Color A and Color B over elevation + time
    float t = (sin(uTime * 0.3) * 0.5 + 0.5) * 0.5 + vElevation * 0.5;
    vec3 col1 = mix(uColor1, uColor2, t);
    vec3 col2 = mix(uColor2, uColor1, t);
    vec3 base = mix(uColor3, col1, 0.15);

    vec3 finalColor = base;

    // CITY LIGHTS
    if (vElevation > 0.5) {
    float windowPulse = sin(vWorldPosition.x * 2.0 + uTime + vWorldPosition.z * 2.0);
    if (windowPulse > 0.8) {
        finalColor = mix(finalColor, col2, 0.8);
    } else {
        finalColor = mix(finalColor, col1, 0.3);
    }
    }

    // VEINS
    float veins = veinNoise(vUv * 5.0 + uTime * 0.1);
    veins = smoothstep(0.6, 0.8, veins);
    finalColor = mix(finalColor, col1, veins * 0.5);

    // GRID
    float gridLine = step(0.98, fract(vUv.x * 20.0)) + step(0.98, fract(vUv.y * 20.0));
    finalColor += col2 * gridLine * 0.5;

    // Fog (camera-relative for infinite world)
    float dist = length(vWorldPosition.xz - uCameraPos.xz);
    float fogFactor = smoothstep(40.0, 120.0, dist);
    finalColor = mix(finalColor, vec3(0.05, 0.0, 0.1), fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}