uniform sampler2D tDiffuse;
uniform float uSharpness;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
    float blockSize = mix(32.0, 1.0, uSharpness);
    vec2 pixelatedUv = floor(vUv * uResolution / blockSize) * blockSize / uResolution;
    gl_FragColor = texture2D(tDiffuse, pixelatedUv);
}
