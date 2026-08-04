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
                "resolution": { value: new THREE.Vector2(innerWidth / 2, innerHeight / 2) },
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
                "uResolution": { value: new THREE.Vector2(innerWidth / 2, innerHeight / 2) }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.pixelationPass);
    }

    async initMergedEffectsPass() {
        if (this.mergedEffectsPass) return;
        const [vert, frag] = await Promise.all([
            loadShader('./shaders/merged-effects.vert'),
            loadShader('./shaders/merged-effects.frag')
        ]);
        this.mergedEffectsPass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "uDarkness": { value: 0.7 },
                "uGrainIntensity": { value: 0.04 },
                "uTime": { value: 0 },
                "uScanlineIntensity": { value: 0.03 },
                "uResolution": { value: new THREE.Vector2(innerWidth / 2, innerHeight / 2) }
            },
            vertexShader: vert,
            fragmentShader: frag
        });
        this.composer.addPass(this.mergedEffectsPass);
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
                "uResolution": { value: new THREE.Vector2(innerWidth / 2, innerHeight / 2) }
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
        const mu = this._mergedU;
        if (mu) {
            mu.uTime.value = effectiveTime;
            mu.uGrainIntensity.value = 0.03 + activeParams.foldIntensity * 0.02;
            const pulse = Math.sin(effectiveTime * 2.3) * 0.5 + 0.5;
            mu.uScanlineIntensity.value = 0.02 + activeParams.foldIntensity * 0.015 * (0.5 + pulse * 0.5);
        }
        const cp = this._chromaU;
        if (cp) {
            const glitch = Math.sin(effectiveTime * 1.7) * 0.5 + Math.sin(effectiveTime * 3.3) * 0.3 + Math.sin(effectiveTime * 7.1) * 0.2;
            cp.uAmount.value = 0.002 + activeParams.foldIntensity * 0.003 * (0.5 + glitch * 0.5);
        }
    }

    _cacheUniforms() {
        if (this.edgePass) this._edgeU = this.edgePass.uniforms;
        if (this.pixelationPass) this._pixelationU = this.pixelationPass.uniforms;
        if (this.mergedEffectsPass) this._mergedU = this.mergedEffectsPass.uniforms;
        if (this.chromaPass) this._chromaU = this.chromaPass.uniforms;
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

        const halfW = Math.floor(width / 2);
        const halfH = Math.floor(height / 2);

        this.composer.setSize(halfW, halfH);

        const eu = this._edgeU;
        if (eu) eu.resolution.value.set(halfW, halfH);
        const pu = this._pixelationU;
        if (pu) pu.uResolution.value.set(halfW, halfH);
        const mu = this._mergedU;
        if (mu) mu.uResolution.value.set(halfW, halfH);
        const mtu = this._meltU;
        if (mtu) mtu.uResolution.value.set(halfW, halfH);
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
            this._copyMesh = mesh;
            this._copyCam = cam;
        }
        this._copyMesh.material.map = rt.texture;
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
                if (this._snapshotRT) {
                    this._snapshotRT.dispose();
                    this._snapshotRT = null;
                }
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
