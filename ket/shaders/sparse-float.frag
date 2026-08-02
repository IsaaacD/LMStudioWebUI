uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vDisplacement;
varying vec3 vInstanceColor;

void main() {
    float t = sin(uTime * 0.3 + vDisplacement * 3.0) * 0.5 + 0.5;
    vec3 uniformBlend = mix(uColor1, uColor2, t);

    // Strong per-instance color
    vec3 baseColor = vInstanceColor * 2.0;

    // Fresnel rim glow
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 norm = normalize(vNormal);
    float fresnel = pow(1.0 - abs(dot(norm, viewDir)), 2.5);
    baseColor += fresnel * vInstanceColor * 2.5;

    // Pulsing inner glow
    float pulse = sin(uTime * 2.0 + vDisplacement * 5.0) * 0.5 + 0.5;
    baseColor += pulse * 0.6;

    // Vein highlight
    float vein = sin(vUv.x * 12.0 + uTime * 1.5) * sin(vUv.y * 12.0 - uTime);
    vein = smoothstep(0.6, 0.9, vein * 0.5 + 0.5);
    baseColor += vein * 0.4;

    // Opaque enough to see, slight transparency for depth
    float alpha = mix(0.75, 1.0, fresnel);

    // Distance fog
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(100.0, 250.0, dist);
    vec3 fogged = mix(baseColor, vec3(0.02, 0.02, 0.08), fogFactor);
    alpha *= (1.0 - fogFactor);

    gl_FragColor = vec4(fogged, alpha);
}
