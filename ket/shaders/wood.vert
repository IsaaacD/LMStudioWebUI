varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDepth;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vDepth = wp.z;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
