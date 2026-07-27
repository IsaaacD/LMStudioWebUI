
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uHueShift;
uniform vec3 uCameraPos;
varying float vElevation;
varying vec2 vUv;
varying vec3 vWorldPosition;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float veinNoise(vec2 uv) {
    float n = 0.0;
    n += sin(uv.x * 12.0 + uTime * 1.2) * 0.4;
    n += sin(uv.y * 8.0 + uTime * 0.8) * 0.6;
    n += sin((uv.x - uv.y) * 15.0 + uTime * 1.5) * 0.3;
    return n;
}

void main() {
    vec3 col1 = hsv2rgb(vec3(0.95 + uHueShift, 0.7, 1.0));
    vec3 col2 = hsv2rgb(vec3(0.55 + uHueShift, 0.7, 1.0));
    vec3 col3 = hsv2rgb(vec3(0.75 + uHueShift, 0.4, 0.15));

    vec3 finalColor = col3;

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
    finalColor = mix(finalColor, vec3(0.0, 1.0, 0.6), veins * 0.4);

    float gridLine = step(0.97, fract(vUv.x * 16.0)) + step(0.97, fract(vUv.y * 16.0));
    finalColor += vec3(1.0, 0.3, 0.8) * gridLine * 0.4;

    float dist = length(vWorldPosition.xz - uCameraPos.xz);
    float fogFactor = smoothstep(0.0, 60.0, dist);
    finalColor = mix(finalColor, vec3(0.05, 0.0, 0.1), fogFactor);

    gl_FragColor = vec4(finalColor, 0.55);
}