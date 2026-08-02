uniform sampler2D tDiffuse;
uniform sampler2D uFrozenTexture;
uniform float uMeltProgress;
uniform float uRevealBlend;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform vec2 uResolution;

// Falling plank effect tuning
const int    NUM_PLANKS       = 38;
const float PLANK_MIN_HEIGHT  = 0.16;
const float PLANK_MAX_HEIGHT  = 0.38;
const float PLANK_MIN_WIDTH   = 0.2;
const float PLANK_MAX_WIDTH   = 0.52;
const float PLANK_FALL_SPEED  = 0.35;

varying vec2 vUv;

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

float columnNoise(float col) {
    float n = 0.0;
    n += 0.50 * hash(vec2(col, 1.0));
    n += 0.25 * hash(vec2(col, 2.0));
    n += 0.125 * hash(vec2(col, 3.0));
    n += 0.0625 * hash(vec2(col, 4.0));
    return n / 0.9375;
}

void main() {
    vec2 uv = vUv;
    float col = uv.x;
    float row = uv.y;

    vec4 currentColor = texture2D(tDiffuse, uv);
    vec4 frozenColor = texture2D(uFrozenTexture, uv);

    float baseThreshold = columnNoise(col * 1.0);
    float secondaryThreshold = columnNoise(col * 2.0 + 50.0) * 0.6;
    float tertiaryThreshold = columnNoise(col * 4.0 + 100.0) * 0.3;

    float speedVariation = 0.7 + 0.6 * hash(vec2(col, 7.0));
    float effectiveProgress = uMeltProgress * speedVariation;

    float mainDrip = smoothstep(
        baseThreshold - 0.08,
        baseThreshold + 0.08,
        effectiveProgress
    );

    float secondaryDrip = smoothstep(
        secondaryThreshold - 0.06,
        secondaryThreshold + 0.06,
        effectiveProgress * 1.15
    );

    float tertiaryDrip = smoothstep(
        tertiaryThreshold - 0.04,
        tertiaryThreshold + 0.04,
        effectiveProgress * 1.3
    );

    float drip = max(mainDrip, max(secondaryDrip * 0.7, tertiaryDrip * 0.4));

    float edgeSoftness = 0.03 + 0.04 * hash(vec2(col, 11.0));
    float meltBoundary = smoothstep(
        effectiveProgress - edgeSoftness,
        effectiveProgress + edgeSoftness,
        baseThreshold
    );

    float meltZone = smoothstep(0.0, 1.0, meltBoundary);

    float displacementAmount = meltZone * 0.04 * (1.0 + 0.5 * sin(uTime * 8.0 + col * 20.0));
    float dispNoise = noise(vec2(col * 30.0, uTime * 2.0)) - 0.5;
    float dispNoise2 = noise(vec2(col * 50.0 + 10.0, uTime * 3.0)) - 0.5;

    vec2 displacedUv = uv;
    displacedUv.y += displacementAmount * dispNoise;
    displacedUv.x += displacementAmount * 0.3 * dispNoise2;
    displacedUv = clamp(displacedUv, 0.0, 1.0);

    vec4 baseFrozen = texture2D(uFrozenTexture, displacedUv);

    float glitchLine = step(0.97, hash(vec2(floor(row * 80.0), floor(uTime * 15.0))));
    glitchLine *= meltZone;
    if (glitchLine > 0.5) {
        displacedUv.x += (noise(vec2(uTime * 5.0, 1.0)) - 0.5) * 0.02;
        baseFrozen = texture2D(uFrozenTexture, displacedUv);
    }

    vec4 meltedColor = baseFrozen;

    float pixelJitter = noise(vec2(col * 100.0, floor(uTime * 20.0))) * 0.005;
    if (meltZone > 0.5) {
        float jitterAmount = (meltZone - 0.5) * 2.0 * 0.01;
        meltedColor.r += pixelJitter * jitterAmount * 20.0;
        meltedColor.g += pixelJitter * jitterAmount * 20.0;
        meltedColor.b += pixelJitter * jitterAmount * 20.0;
    }

    // Falling plank overlay
    float plankCoverage = 0.0;
    vec4 plankColor = vec4(0.0);

    for (int i = 0; i < NUM_PLANKS; i++) {
        float fi = float(i);

        // Plank identity
        float plankId = hash(vec2(fi, 0.37));
        float plankX = hash(vec2(fi, 1.13));
        float plankY = hash(vec2(fi, 2.41));
        float plankW = mix(PLANK_MIN_WIDTH, PLANK_MAX_WIDTH, hash(vec2(fi, 3.73)));
        float plankH = mix(PLANK_MIN_HEIGHT, PLANK_MAX_HEIGHT, hash(vec2(fi, 4.91)));
        float plankDelay = hash(vec2(fi, 5.29)) * 0.5;
        float plankSpeed = mix(0.6, 1.4, hash(vec2(fi, 6.17)));
        float plankDrift = (hash(vec2(fi, 7.83)) - 0.5) * 0.15;

        // Plank fall position
        float fallT = max(0.0, (uMeltProgress - plankDelay) * plankSpeed * PLANK_FALL_SPEED * 3.0);
        float plankTop = plankY + fallT;
        float plankBottom = plankTop + plankH;
        float plankLeft = plankX + plankDrift * fallT;
        float plankRight = plankLeft + plankW;

        // Check if fragment is inside this plank
        float insideH = smoothstep(plankLeft - 0.005, plankLeft + 0.005, col) -
                        smoothstep(plankRight - 0.005, plankRight + 0.005, col);
        float insideV = smoothstep(plankTop - 0.005, plankTop + 0.005, row) -
                        smoothstep(plankBottom - 0.005, plankBottom + 0.005, row);
        float inside = insideH * insideV;

        // Sample frozen texture offset downward for plank
        vec2 plankUv = vec2(col, fract(row + fallT * 0.5));
        vec4 plankTexel = texture2D(uFrozenTexture, plankUv);

        // Blend plank colors
        float colorMix = hash(vec2(fi, 8.91));
        vec3 plankBase = mix(uColorA, uColorB, colorMix);
        vec3 plankTint = mix(plankTexel.rgb, plankBase, 0.55);

        plankCoverage += inside;
        plankColor.rgb += plankTint * inside;
    }

    plankCoverage = min(1.0, plankCoverage);
    meltedColor.rgb = mix(meltedColor.rgb, plankColor.rgb, plankCoverage * meltZone);

    float blendAmount = drip;
    blendAmount = smoothstep(0.0, 1.0, blendAmount);

    vec4 meltedResult = mix(meltedColor, baseFrozen, 1.0 - blendAmount);

    vec4 finalColor = mix(meltedResult, currentColor, uRevealBlend);

    gl_FragColor = finalColor;
}
