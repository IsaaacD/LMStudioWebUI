uniform sampler2D tDiffuse;
uniform float uIntensity;
uniform float uTime;
varying vec2 vUv;
void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    float grain = fract(sin(dot(vUv + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    color.rgb += (grain - 0.5) * uIntensity;
    gl_FragColor = color;
}
