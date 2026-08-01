uniform sampler2D tDiffuse;
uniform float uDarkness;
varying vec2 vUv;
void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    vec2 uv = vUv * (1.0 - vUv);
    float vig = uv.x * uv.y * 15.0;
    vig = pow(vig, uDarkness * 0.3);
    color.rgb *= vig;
    gl_FragColor = color;
}
