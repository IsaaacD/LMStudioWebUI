uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vDisplacement;

void main() {
    float t = sin(uTime * 0.3 + vDisplacement * 3.0) * 0.5 + 0.5;
    vec3 baseColor = mix(uColor1, uColor2, t);

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 3.0);
    baseColor += fresnel * uColor2 * 0.8;

    float pulse = sin(uTime * 2.5) * 0.5 + 0.5;
    baseColor += pulse * uPulse * 0.2;

    float vein = sin(vUv.x * 15.0 + uTime * 1.5) * sin(vUv.y * 15.0 - uTime);
    vein = smoothstep(0.5, 0.9, vein * 0.5 + 0.5);
    baseColor = mix(baseColor, vec3(1.0), vein * 0.15);

    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(80.0, 200.0, dist);
    vec3 fogged = mix(baseColor, vec3(0.0), fogFactor);

    gl_FragColor = vec4(fogged, 0.9);
}
