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
        const sobelEdgeShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                "edgeStrength": { value: 0.5 }
            },
            vertexShader: await loadShader('./shaders/sorbel.vert'),
            fragmentShader: await loadShader('./shaders/sorbel.frag')
        };

        this.edgePass = new ShaderPass(sobelEdgeShader);
        this.composer.addPass(this.edgePass);
    }

    async initPixelationPass() {
        const pixelateShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "uSharpness": { value: 1.0 },
                "uResolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: await loadShader('./shaders/pixelate.vert'),
            fragmentShader: await loadShader('./shaders/pixelate.frag')
        };

        this.pixelationPass = new ShaderPass(pixelateShader);
        this.composer.addPass(this.pixelationPass);
    }

    async initGrainPass() {
        if (this.grainPass) return;
        const grainShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "uIntensity": { value: 0.04 },
                "uTime": { value: 0 }
            },
            vertexShader: await loadShader('./shaders/liminal-grain.vert'),
            fragmentShader: await loadShader('./shaders/liminal-grain.frag')
        };
        this.grainPass = new ShaderPass(grainShader);
        this.composer.addPass(this.grainPass);
    }

    async initVignettePass() {
        if (this.vignettePass) return;
        const vignetteShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "uDarkness": { value: 0.7 }
            },
            vertexShader: await loadShader('./shaders/liminal-vignette.vert'),
            fragmentShader: await loadShader('./shaders/liminal-vignette.frag')
        };
        this.vignettePass = new ShaderPass(vignetteShader);
        this.composer.addPass(this.vignettePass);
    }

    async initChromaticAberrationPass() {
        if (this.chromaPass) return;
        const chromaShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "uAmount": { value: 0.002 }
            },
            vertexShader: await loadShader('./shaders/liminal-chroma.vert'),
            fragmentShader: await loadShader('./shaders/liminal-chroma.frag')
        };
        this.chromaPass = new ShaderPass(chromaShader);
        this.composer.addPass(this.chromaPass);
    }

    async initScanlinePass() {
        if (this.scanlinePass) return;
        const scanlineShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "uIntensity": { value: 0.03 },
                "uResolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: await loadShader('./shaders/liminal-scanline.vert'),
            fragmentShader: await loadShader('./shaders/liminal-scanline.frag')
        };
        this.scanlinePass = new ShaderPass(scanlineShader);
        this.composer.addPass(this.scanlinePass);
    }

    removeLiminalPasses() {
        const passesToRemove = ['grainPass', 'vignettePass', 'chromaPass', 'scanlinePass'];
        for (const key of passesToRemove) {
            if (this[key]) {
                this.composer.removePass(this[key]);
                this[key] = null;
            }
        }
    }

    setScene(threeScene) {
        this.renderPass.scene = threeScene;
    }

    setPixelationSharpness(value) {
        if (this.pixelationPass) {
            this.pixelationPass.uniforms.uSharpness.value = value;
        }
    }

    setFadeOverlayAlpha(alpha) {
        this.fadeOverlay.style.opacity = String(alpha);
    }

    update(activeParams, effectiveTime) {
        this.bloomPass.strength = activeParams.bloomStrength;
        this.bloomPass.radius = activeParams.bloomRadius;
        if (this.edgePass) {
            this.edgePass.uniforms['edgeStrength'].value = activeParams.edgeContrast;
        }
        if (this.grainPass) {
            this.grainPass.uniforms['uTime'].value = effectiveTime || 0;
            this.grainPass.uniforms['uIntensity'].value = 0.03 + activeParams.foldIntensity * 0.02;
        }
        if (this.chromaPass) {
            const t = effectiveTime || 0;
            const glitch = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 3.3) * 0.3 + Math.sin(t * 7.1) * 0.2;
            this.chromaPass.uniforms['uAmount'].value = 0.002 + activeParams.foldIntensity * 0.003 * (0.5 + glitch * 0.5);
        }
        if (this.scanlinePass) {
            const t = effectiveTime || 0;
            const pulse = Math.sin(t * 2.3) * 0.5 + 0.5;
            this.scanlinePass.uniforms['uIntensity'].value = 0.02 + activeParams.foldIntensity * 0.015 * (0.5 + pulse * 0.5);
        }
    }

    render(scene) {
        if (scene !== undefined) {
            this.setScene(scene);
        }
        this.composer.render();
    }

    resize(width, height) {
        this.composer.setSize(width, height);
        if (this.edgePass) {
            this.edgePass.uniforms['resolution'].value.set(width, height);
        }
        if (this.pixelationPass) {
            this.pixelationPass.uniforms.uResolution.value.set(width, height);
        }
        if (this.scanlinePass) {
            this.scanlinePass.uniforms.uResolution.value.set(width, height);
        }
        if (this.meltPass) {
            this.meltPass.uniforms.uResolution.value.set(width, height);
        }
    }

    async initMeltPass() {
        const meltShader = {
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
            vertexShader: await loadShader('./shaders/melt.vert'),
            fragmentShader: await loadShader('./shaders/melt.frag')
        };
        this.meltPass = new ShaderPass(meltShader);
        this.meltPass.enabled = false;
        this.composer.addPass(this.meltPass);
        this._snapshotRT = null;
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
        if (this.meltPass && texture) {
            this.meltPass.uniforms.uFrozenTexture.value = texture;
            this.meltPass.enabled = true;
        }
    }

    setMeltProgress(progress) {
        if (this.meltPass) {
            this.meltPass.uniforms.uMeltProgress.value = progress;
        }
    }

    setRevealBlend(value) {
        if (this.meltPass) {
            this.meltPass.uniforms.uRevealBlend.value = value;
            if (value >= 1) {
                this.meltPass.enabled = false;
            }
        }
    }

    updateMeltTime(time) {
        if (this.meltPass) {
            this.meltPass.uniforms.uTime.value = time;
        }
    }
}
