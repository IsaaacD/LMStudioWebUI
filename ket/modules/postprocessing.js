import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { loadShader } from './utils.js';
import { defaultParams } from './config.js';

export class PostProcessor {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.composer = new EffectComposer(renderer);
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        const halfW = Math.floor(innerWidth / 2);
        const halfH = Math.floor(innerHeight / 2);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(halfW, halfH),
            1.5, 0.4, 0.85
        );
        this.composer.addPass(this.bloomPass);

        this.fadeOverlay = document.createElement('div');
        Object.assign(this.fadeOverlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            opacity: '0',
            pointerEvents: 'none',
            zIndex: '9999'
        });
        document.body.appendChild(this.fadeOverlay);
    }

    async initEdgePass() {
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/sorbel.vert'),
            loadShader('./shaders/sorbel.frag')
        ]);
        this.edgePass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                "edgeStrength": { value: 0.5 }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.edgePass);
    }

    async initPixelationPass() {
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/pixelate.vert'),
            loadShader('./shaders/pixelate.frag')
        ]);
        this.pixelationPass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "uSharpness": { value: 1.0 },
                "uResolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.pixelationPass);
    }

    async initGrainPass() {
        if (this.grainPass) return;
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/liminal-grain.vert'),
            loadShader('./shaders/liminal-grain.frag')
        ]);
        this.grainPass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "uIntensity": { value: 0.04 },
                "uTime": { value: 0 }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.grainPass);
    }

    async initVignettePass() {
        if (this.vignettePass) return;
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/liminal-vignette.vert'),
            loadShader('./shaders/liminal-vignette.frag')
        ]);
        this.vignettePass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "uDarkness": { value: 0.7 }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.vignettePass);
    }

    async initChromaticAberrationPass() {
        if (this.chromaPass) return;
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/liminal-chroma.vert'),
            loadShader('./shaders/liminal-chroma.frag')
        ]);
        this.chromaPass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "uAmount": { value: 0.002 }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.chromaPass);
    }

    async initScanlinePass() {
        if (this.scanlinePass) return;
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/liminal-scanline.vert'),
            loadShader('./shaders/liminal-scanline.frag')
        ]);
        this.scanlinePass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "uIntensity": { value: 0.03 },
                "uResolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.scanlinePass);
    }

    async initMeltPass() {
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/melt.vert'),
            loadShader('./shaders/melt.frag')
        ]);
        this.meltPass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "uFrozenTexture": { value: null },
                "uMeltProgress": { value: 0 },
                "uRevealBlend": { value: 0 },
                "uColorA": { value: new THREE.Color(defaultParams.colorA) },
                "uColorB": { value: new THREE.Color(defaultParams.colorB) },
                "uTime": { value: 0 },
                "uResolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.meltPass.enabled = false;
        this.composer.addPass(this.meltPass);
        this._snapshotRT = null;
    }

    setScene(threeScene) {
        this.renderPass.scene = threeScene;
    }

    setPixelationSharpness(value) {
        const pu = this._pixelationU;
        if (pu) pu.uSharpness.value = value;
    }

    setFadeOverlayAlpha(alpha) {
        this.fadeOverlay.style.opacity = String(alpha);
    }

    update(activeParams, effectiveTime) {
        this.bloomPass.strength = activeParams.bloomStrength;
        this.bloomPass.radius = activeParams.bloomRadius;
        const ep = this._edgeU;
        if (ep) ep.edgeStrength.value = activeParams.edgeContrast;
        const gp = this._grainU;
        if (gp) {
            gp.uTime.value = effectiveTime;
            gp.uIntensity.value = 0.03 + activeParams.foldIntensity * 0.02;
        }
        const cp = this._chromaU;
        if (cp) {
            const glitch = Math.sin(effectiveTime * 1.7) * 0.5 + Math.sin(effectiveTime * 3.3) * 0.3 + Math.sin(effectiveTime * 7.1) * 0.2;
            cp.uAmount.value = 0.002 + activeParams.foldIntensity * 0.003 * (0.5 + glitch * 0.5);
        }
        const sp = this._scanlineU;
        if (sp) {
            const pulse = Math.sin(effectiveTime * 2.3) * 0.5 + 0.5;
            sp.uIntensity.value = 0.02 + activeParams.foldIntensity * 0.015 * (0.5 + pulse * 0.5);
        }
    }

    _cacheUniforms() {
        if (this.edgePass) this._edgeU = this.edgePass.uniforms;
        if (this.pixelationPass) this._pixelationU = this.pixelationPass.uniforms;
        if (this.grainPass) this._grainU = this.grainPass.uniforms;
        if (this.chromaPass) this._chromaU = this.chromaPass.uniforms;
        if (this.scanlinePass) this._scanlineU = this.scanlinePass.uniforms;
        if (this.meltPass) this._meltU = this.meltPass.uniforms;
    }

    render(scene) {
        if (scene !== undefined) {
            this.setScene(scene);
        }
        this.composer.render();
    }

    resize(width, height) {
        if (this._width === width && this._height === height) return;
        this._width = width;
        this._height = height;
        this.composer.setSize(width, height);
        const eu = this._edgeU;
        if (eu) eu.resolution.value.set(width, height);
        const pu = this._pixelationU;
        if (pu) pu.uResolution.value.set(width, height);
        const su = this._scanlineU;
        if (su) su.uResolution.value.set(width, height);
        const mu = this._meltU;
        if (mu) mu.uResolution.value.set(width, height);
    }

    captureSnapshot() {
        if (!this.renderer) return null;
        const rt = this.composer.writeBuffer;
        if (!rt || !rt.texture) return null;
        if (!this._snapshotRT) {
            this._snapshotRT = new THREE.WebGLRenderTarget(
                rt.width, rt.height,
                { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
            );
        }
        if (!this._copyScene) {
            const geo = new THREE.PlaneGeometry(2, 2);
            const mat = new THREE.MeshBasicMaterial({ map: null });
            const mesh = new THREE.Mesh(geo, mat);
            const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            this._copyScene = new THREE.Scene();
            this._copyScene.add(mesh);
            this._copyScene.add(cam);
            this._copyMesh = mesh;
            this._copyCam = cam;
        }
        this._copyMesh.material.map = rt.texture;
        this._copyMesh.material.needsUpdate = true;
        this.renderer.setRenderTarget(this._snapshotRT);
        this.renderer.render(this._copyScene, this._copyCam);
        this.renderer.setRenderTarget(null);
        return this._snapshotRT.texture;
    }

    setMeltSnapshot(texture) {
        const mu = this._meltU;
        if (mu && texture) {
            mu.uFrozenTexture.value = texture;
            this.meltPass.enabled = true;
        }
    }

    setMeltProgress(progress) {
        const mu = this._meltU;
        if (mu) mu.uMeltProgress.value = progress;
    }

    setRevealBlend(value) {
        const mu = this._meltU;
        if (mu) {
            mu.uRevealBlend.value = value;
            if (value >= 1) {
                this.meltPass.enabled = false;
            }
        }
    }

    updateMeltTime(time) {
        if (this.meltPass.enabled) {
            const mu = this._meltU;
            if (mu) mu.uTime.value = time;
        }
    }
}
