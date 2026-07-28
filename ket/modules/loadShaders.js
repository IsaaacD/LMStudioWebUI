import * as THREE from 'three';
// ... other imports

// 1. Async loader function
async function loadShader(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.statusText}`);
    return await response.text();
}

// 2. Initialize everything after shaders are loaded
async function init() {
    try {
        // Load both shaders in parallel
        const [vertexSource, fragmentSource] = await Promise.all([
            loadShader('./shaders/city.vert'),
            loadShader('./shaders/city.frag'),
            loadShader('./shaders/wall.vert'),
            loadShader('./shaders/wall.frag'),
            loadShader('./shaders/postprocess.vert'),
            loadShader('./shaders/postprocess.frag')
        ]);

        // 3. Create material with fetched strings
        const cityMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexSource,
            fragmentShader: fragmentSource,
            uniforms: {
                uTime: { value: 0 },
                uColor1: { value: new THREE.Color(0xff0055) },
                uColor2: { value: new THREE.Color(0x00ccff) },
                uColor3: { value: new THREE.Color(0x110022) },
                uFoldIntensity: { value: 1.0 },
                uHueShift: { value: 0.0 }
            },
            wireframe: false,
            side: THREE.DoubleSide
        });

        // 4. Continue setup (geometry, scene, post-processing, etc.)
        setupScene(cityMaterial);
        setupControls();
        animate();

    } catch (error) {
        console.error('Shader initialization failed:', error);
        document.body.innerHTML = `<h1 style="color:red; text-align:center; margin-top:20vh;">Shader Load Failed. Check console.</h1>`;
    }
}

// Run init
init();