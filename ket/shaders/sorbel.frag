
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float edgeStrength;
varying vec2 vUv;
void main() {
    vec2 texelSize = vec2(1.0 / resolution.x, 1.0 / resolution.y);
    float tx = -texture2D(tDiffuse, vUv + vec2(-texelSize.x, -texelSize.y)).r
                - 2.0 * texture2D(tDiffuse, vUv + vec2(-texelSize.x, 0.0)).r
                - texture2D(tDiffuse, vUv + vec2(-texelSize.x, texelSize.y)).r
                + texture2D(tDiffuse, vUv + vec2(texelSize.x, -texelSize.y)).r
                + 2.0 * texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0)).r
                + texture2D(tDiffuse, vUv + vec2(texelSize.x, texelSize.y)).r;
                
    float ty = -texture2D(tDiffuse, vUv + vec2(-texelSize.x, -texelSize.y)).r
                - 2.0 * texture2D(tDiffuse, vUv + vec2(0.0, -texelSize.y)).r
                - texture2D(tDiffuse, vUv + vec2(texelSize.x, -texelSize.y)).r
                + texture2D(tDiffuse, vUv + vec2(-texelSize.x, texelSize.y)).r
                + 2.0 * texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y)).r
                + texture2D(tDiffuse, vUv + vec2(texelSize.x, texelSize.y)).r;
    
    float edge = 1.0 - min(1.0, length(vec2(tx, ty)));
    vec4 edgeColor = vec4(1.0, 1.0, 1.0, edge);
    vec4 texel = texture2D(tDiffuse, vUv);
    
    // Mix strength controlled by uniform
    gl_FragColor = mix(texel, edgeColor, edge * edgeStrength);
}