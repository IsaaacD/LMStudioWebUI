uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float edgeStrength;
varying vec2 vUv;
void main() {
    vec2 texelSize = vec2(1.0 / resolution.x, 1.0 / resolution.y);
    vec4 center = texture2D(tDiffuse, vUv);
    vec4 top = texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y));
    vec4 bottom = texture2D(tDiffuse, vUv + vec2(0.0, -texelSize.y));
    vec4 left = texture2D(tDiffuse, vUv + vec2(-texelSize.x, 0.0));
    vec4 right = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0));
    float gx = abs(right.r - left.r);
    float gy = abs(top.r - bottom.r);
    float edge = 1.0 - min(1.0, sqrt(gx * gx + gy * gy));
    vec4 edgeColor = vec4(1.0, 1.0, 1.0, edge);
    gl_FragColor = mix(center, edgeColor, edge * edgeStrength);
}