uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    float curtain = sin(vUv.y * 8.0 + uTime * 0.5) * 0.5 + 0.5;
    curtain *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);

    float wave = sin(vUv.x * 6.0 + uTime * 0.8) * sin(vUv.x * 3.0 - uTime * 0.3);
    float band = smoothstep(0.2, 0.6, abs(wave));

    float t = sin(uTime * 0.15 + vUv.x * 2.0) * 0.5 + 0.5;
    vec3 color = mix(uColor1, uColor2, t);
    color += band * curtain * 0.3;

    float shimmer = sin(vUv.x * 30.0 + uTime * 3.0) * sin(vUv.y * 20.0 - uTime * 2.0);
    color += shimmer * 0.05;

    float alpha = curtain * (0.15 + band * 0.25);

    gl_FragColor = vec4(color, alpha);
}
