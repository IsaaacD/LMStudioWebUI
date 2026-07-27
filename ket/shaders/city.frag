uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uHueShift;
uniform vec3 uCameraPos;
varying float vElevation;
varying vec2 vUv;
varying vec3 vWorldPosition;

// HSV to RGB helper for dynamic color shifting
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float veinNoise(vec2 uv) {
    float n = 0.0;
    n += sin(uv.x * 10.0 + uTime) * 0.5;
    n += sin(uv.y * 10.0 + uTime * 0.5) * 0.5;
    n += sin((uv.x + uv.y) * 20.0 + uTime * 2.0) * 0.25;
    return n;
}

void main() {
    // Dynamic Colors based on Hue Shift
    vec3 col1 = hsv2rgb(vec3(0.9 + uHueShift, 0.8, 1.0)); // Magenta-ish
    vec3 col2 = hsv2rgb(vec3(0.5 + uHueShift, 0.8, 1.0)); // Cyan-ish
    vec3 col3 = hsv2rgb(vec3(0.7 + uHueShift, 0.5, 0.2)); // Dark Purple-ish

    vec3 finalColor = col3;

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
    finalColor = mix(finalColor, vec3(1.0, 0.0, 0.5), veins * 0.5);

    // GRID
    float gridLine = step(0.98, fract(vUv.x * 20.0)) + step(0.98, fract(vUv.y * 20.0));
    finalColor += vec3(0.0, 1.0, 1.0) * gridLine * 0.5;

    // Fog (camera-relative for infinite world)
    float dist = length(vWorldPosition.xz - uCameraPos.xz);
    float fogFactor = smoothstep(0.0, 60.0, dist);
    finalColor = mix(finalColor, vec3(0.05, 0.0, 0.1), fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}