precision highp float;

uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uGrainIntensity;
uniform float uKnotIntensity;
uniform float uCrackGlow;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDepth;

vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 maxw = 2.0 * abs(vec4(dot(p0,v), dot(p1,v), dot(p2,v), dot(p3,v))) - 1.0;
    vec4 m = max(0.6 - maxw, vec4(0.0));
    return 42.0 * dot(m*m, m);
}

float woodGrain(vec2 uv, float time) {
    float scale = 8.0;
    vec2 p = uv * scale;
    float n1 = snoise(vec3(p.x * 0.3, p.y * 0.1, time * 0.05)) * 2.0;
    float n2 = snoise(vec3(p.x * 0.1 + 5.0, p.y * 0.05 + time * 0.02, 0.0)) * 4.0;
    float grain = snoise(vec3(p.x + n1 * 0.5 + n2, p.y * 2.0, time * 0.03));
    grain += 0.5 * snoise(vec3(p.x + n1 * 0.3, p.y * 4.0 + time * 0.02, 0.0));
    grain += 0.25 * snoise(vec3(p.x, p.y * 8.0 - time * 0.04, 3.0));
    return grain;
}

float woodKnots(vec3 pos, float time) {
    float knotScale = 0.15;
    vec3 kPos = pos * knotScale;
    float k1 = snoise(vec3(kPos.x + time*0.02, kPos.y*0.5, kPos.z + 10.0));
    float k2 = snoise(vec3(kPos.x - time*0.015, kPos.y, kPos.z*0.5 + 20.0));
    float knots = max(k1, k2);
    knots = smoothstep(0.3, 0.8, knots);
    float angle = atan(pos.z - 0.5, pos.x - 0.5);
    float swirl = snoise(vec3(angle * 2.0 + time * 0.1, pos.y * 2.0, 0.0));
    knots *= (0.7 + 0.3 * swirl);
    return knots;
}

float crackPattern(vec3 pos, float time) {
    float crack = snoise(vec3(pos.xz * 0.8, time * 0.04 + 50.0));
    crack += 0.5 * snoise(vec3(pos.xz * 1.5 + 10.0, time * 0.03));
    crack += 0.25 * snoise(vec3(pos.xz * 3.0 + 20.0, -time * 0.05));
    crack = smoothstep(0.4, 0.7, crack * 0.5 + 0.5);
    float branch = snoise(vec3(pos.y * 2.0 + time * 0.02, pos.x * 0.5, 30.0));
    crack *= (0.6 + 0.4 * smoothstep(0.2, 0.6, branch * 0.5 + 0.5));
    return crack;
}

void main() {
    vec3 localPos = vWorldPos;

    float grainVal = woodGrain(vUv, uTime);
    float knots = woodKnots(localPos, uTime) * uKnotIntensity;

    float baseGrain = grainVal * uGrainIntensity;

    vec3 lightColor = uColorA;
    vec3 darkColor = uColorB;

    vec3 woodBase = mix(darkColor, lightColor, baseGrain * 0.5 + 0.5);

    vec3 darkStain = woodBase * 0.4;
    woodBase = mix(woodBase, darkStain, knots * 0.7);

    float edgeFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    float edgeFadeY = smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
    float edge = edgeFade * edgeFadeY;

    vec3 endGrain = mix(darkColor, lightColor, 0.5 + 0.3 * snoise(vec3(vUv * 20.0, uTime * 0.01)));
    float endFactor = 1.0 - edge;
    woodBase = mix(woodBase, endGrain, endFactor * 0.5);

    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.0) * 0.2 + 0.1;

    vec3 finalColor = woodBase * diff;

    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    finalColor += fresnel * uColorA * 0.05;

    float glow = sin(uTime * 0.5 + vWorldPos.y * 0.3) * 0.5 + 0.5;
    finalColor += (uColorA + uColorB) * glow * 0.02;

    // Glowing cracks
    float crack = crackPattern(localPos, uTime);
    float heatPulse = sin(uTime * 1.5 + localPos.x * 0.5 + localPos.z * 0.3) * 0.5 + 0.5;
    vec3 crackColor = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.1), heatPulse);
    finalColor += crackColor * crack * uCrackGlow * (0.5 + heatPulse * 0.5);
    finalColor = mix(finalColor, crackColor, crack * uCrackGlow * 0.3);

    gl_FragColor = vec4(finalColor, 1.0);
}
