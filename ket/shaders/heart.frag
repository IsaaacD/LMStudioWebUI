#define PI 3.14159265359
#define NUM_POINTS 100.0
#define RADIUS 0.5
#define LINE_WIDTH 0.005
#define LINE_COLOR vec3(1.0, 0.2, 0.4)
#define BG_COLOR vec3(0.0, 0.0, 0.1)

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;

vec2 heartPosition(float t) {
    float x = 16.0 * pow(sin(t), 3.0);
    float y = 13.0 * cos(t) - 5.0 * cos(2.0*t) - 2.0 * cos(3.0*t) - cos(4.0*t);
    return vec2(x, y) * 0.05 * RADIUS;
}

void main() {
    vec2 uv = vUv - 0.5;
    vec2 aspect = vec2(1.0);
    uv.x *= aspect.x / aspect.y;

    float intensity = 0.0;
    float timeFactor = 0.5 + 0.5 * sin(uTime * 0.5);
    float maxConnections = floor(timeFactor * NUM_POINTS);

    for (float i = 0.0; i < maxConnections; i++) {
        float t1 = i / NUM_POINTS * PI * 2.0;
        float t2 = mod((2.0 * i), NUM_POINTS) / NUM_POINTS * PI * 2.0;

        vec2 p1 = heartPosition(t1);
        vec2 p2 = heartPosition(t2);

        float d = abs((p2.y - p1.y) * uv.x - (p2.x - p1.x) * uv.y + p2.x * p1.y - p2.y * p1.x)
                  / length(p2 - p1);

        intensity += smoothstep(LINE_WIDTH * 2.0, LINE_WIDTH, d) * 0.6;
    }

    vec3 color = mix(BG_COLOR, uColor, intensity);

    float dist = length(vUv - 0.5) * 2.0;
    float circleAlpha = 1.0 - smoothstep(0.85, 1.0, dist);

    gl_FragColor = vec4(color, intensity * uAlpha * circleAlpha);
}
