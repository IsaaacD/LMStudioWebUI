uniform sampler2D tDiffuse;
uniform float uDarkness;
uniform float uGrainIntensity;
uniform float uTime;
uniform float uScanlineIntensity;
uniform vec2 uResolution;
varying vec2 vUv;
void main() {
    vec4 color = texture2D(tDiffuse, vUv);

    // Vignette
    vec2 uv = vUv * (1.0 - vUv);
    float vig = uv.x * uv.y * 15.0;
    vig = pow(vig, uDarkness * 0.3);
    color.rgb *= vig;

    // Grain
    float grain = fract(sin(dot(vUv + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    color.rgb += (grain - 0.5) * uGrainIntensity;

    // Scanline
    float line = sin(vUv.y * uResolution.y * 3.14159) * 0.5 + 0.5;
    float scanline = mix(1.0, 0.85, line * uScanlineIntensity);
    color.rgb *= scanline;

    gl_FragColor = color;
}
