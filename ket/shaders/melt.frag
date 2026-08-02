uniform sampler2D tDiffuse;
uniform sampler2D uFrozenTexture;
uniform float uMeltProgress;
uniform float uRevealBlend;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;

// --- Tunable parameters ---
const float MELT_MAX_WARP        = 0.06;
const float MELT_GRAVITY_PULL    = 0.035;
const float MELT_DRIP_STRENGTH   = 0.025;
const float MELT_SWAY_STRENGTH   = 0.012;
const float MELT_GLOW_SCALE      = 100.0;
const float MELT_GLOW_MAX        = 0.6;
const float MELT_VISCOUS_FREQ    = 3.0;
const float MELT_DRIP_FREQ       = 8.0;
const float MELT_SWAY_FREQ       = 5.0;
const float MELT_TIME_SPEED      = 0.4;
const float MELT_DRIP_TIME_SPEED = 0.6;
const float MELT_TWIST_STRENGTH  = 0.03;
const float MELT_TWIST_FREQ      = 2.0;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 meltWarp(vec2 uv, float progress, float time) {
    float envelope = sin(progress * 3.14159265);
    if (envelope < 0.001) return uv;

    vec2 offset = vec2(0.0);
    float t = time * MELT_TIME_SPEED;

    offset.y -= MELT_GRAVITY_PULL * envelope * (1.0 - uv.y);
    offset.y += (noise(uv * MELT_VISCOUS_FREQ + vec2(0.0, t)) - 0.5) * MELT_MAX_WARP * envelope;
    offset.x += (noise(uv * MELT_SWAY_FREQ + vec2(t * 0.7, 0.0)) - 0.5) * MELT_SWAY_STRENGTH * envelope;

    float dripWave = sin(uv.x * MELT_DRIP_FREQ * 3.14159 + time * MELT_DRIP_TIME_SPEED) * 0.5 + 0.5;
    offset.y -= MELT_DRIP_STRENGTH * envelope * dripWave * (1.0 - uv.y);
    offset.x += (noise(uv * MELT_DRIP_FREQ + vec2(0.0, time * MELT_DRIP_TIME_SPEED * 0.5)) - 0.5) * MELT_DRIP_STRENGTH * 0.5 * envelope;

    float twistAngle = MELT_TWIST_STRENGTH * envelope * sin(uv.y * MELT_TWIST_FREQ * 3.14159 + time * MELT_TIME_SPEED * 0.8);
    float twistCos = cos(twistAngle);
    float twistSin = sin(twistAngle);
    vec2 centered = uv - vec2(0.5);
    offset.x += centered.x * twistCos + centered.y * twistSin - centered.x;
    offset.y += -centered.x * twistSin + centered.y * twistCos - centered.y;

    return uv + offset;
}

void main() {
    vec2 uv = vUv;
    float progress = uMeltProgress;

    vec2 warpedUv = meltWarp(uv, progress, uTime);
    warpedUv = clamp(warpedUv, 0.0, 1.0);

    vec4 newColor = texture2D(tDiffuse, warpedUv);
    vec4 frozenColor = texture2D(uFrozenTexture, warpedUv);

    float dx = meltWarp(uv + vec2(0.001, 0.0), progress, uTime).x - meltWarp(uv - vec2(0.001, 0.0), progress, uTime).x;
    float dy = meltWarp(uv + vec2(0.0, 0.001), progress, uTime).y - meltWarp(uv - vec2(0.0, 0.001), progress, uTime).y;
    float glowIntensity = clamp(length(vec2(dx, dy)) * MELT_GLOW_SCALE, 0.0, MELT_GLOW_MAX);

    vec3 blended = mix(frozenColor.rgb, newColor.rgb, uRevealBlend);

    vec3 glowColor = mix(uColorA, uColorB, uv.x + 0.5 * sin(uTime * 0.5));
    blended += glowColor * glowIntensity;

    gl_FragColor = vec4(blended, 1.0);
}
