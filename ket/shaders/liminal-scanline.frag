uniform sampler2D tDiffuse;
uniform float uIntensity;
uniform vec2 uResolution;
varying vec2 vUv;
void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    float line = sin(vUv.y * uResolution.y * 3.14159) * 0.5 + 0.5;
    float scanline = mix(1.0, 0.85, line * uIntensity);
    color.rgb *= scanline;
    gl_FragColor = color;
}
