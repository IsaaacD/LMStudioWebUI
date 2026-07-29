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

    // CITY LIGHTS (on elevated geometry)
    if (vElevation > 0.5) {
    float windowPulse = sin(vWorldPosition.x * 2.0 + uTime + vWorldPosition.z * 2.0);
    float lightFactor = smoothstep(0.75, 0.9, windowPulse);
    finalColor = mix(finalColor, mix(col1, col2, lightFactor), mix(0.3, 0.8, lightFactor));
    }

    // GROUND LIGHT STRIPS (always visible on floor, independent of elevation)
    float stripPulse = sin(vWorldPosition.x * 1.5 + uTime * 0.8 + vWorldPosition.z * 1.5);
    float stripIntensity = smoothstep(0.6, 0.95, stripPulse) * 0.6;
    finalColor += col2 * stripIntensity;

    // // VEINS
    // float veins = veinNoise(vUv * 5.0 + uTime * 0.1);
    // veins = smoothstep(0.6, 0.8, veins);
    // finalColor = mix(finalColor, col1, veins * 0.5);

    // GRID (anti-aa, restored visibility)
    float gridX = 1.0 - smoothstep(0.0, 0.06, abs(fract(vUv.x * 20.0) - 0.5) - 0.44);
    float gridY = 1.0 - smoothstep(0.0, 0.06, abs(fract(vUv.y * 20.0) - 0.5) - 0.44);
    finalColor += col2 * (gridX + gridY) * 0.5;

    // Fog (camera-relative for infinite world)
    float dist = length(vWorldPosition.xz - uCameraPos.xz);
    float fogFactor = smoothstep(40.0, 120.0, dist);
    finalColor = mix(finalColor, vec3(0.05, 0.0, 0.1), fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}