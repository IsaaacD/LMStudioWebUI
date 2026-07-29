uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uCameraPos;
uniform float uAlpha;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vDisplacement;

void main() {
    float t = sin(uTime * 0.4 + vDisplacement * 2.0) * 0.5 + 0.5;
    vec3 baseColor = mix(uColor1, uColor2, t);

    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
    baseColor += fresnel * uColor2 * 0.6;

    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
    baseColor += pulse * 0.15;

    float vein1 = sin(vUv.x * 20.0 + uTime * 2.0) * sin(vUv.y * 20.0 - uTime * 1.5);
    vein1 = smoothstep(0.6, 0.9, vein1 * 0.5 + 0.5);
    baseColor = mix(baseColor, uColor1, vein1 * 0.4);

    float dist = length(vWorldPosition - uCameraPos);
    float fogFactor = smoothstep(200.0, 450.0, dist);

    float edge = smoothstep(0.0, 0.3, vDisplacement + 1.0) * smoothstep(1.0, 0.3, vDisplacement + 1.0);
    baseColor += edge * uColor2 * 0.3;

    vec3 fogged = mix(baseColor, vec3(0.05, 0.0, 0.1), fogFactor);

    gl_FragColor = vec4(fogged, uAlpha);
}
