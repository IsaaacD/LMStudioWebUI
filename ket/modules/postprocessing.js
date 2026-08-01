import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { loadShader } from './utils.js';

export class PostProcessor {
    constructor(renderer, scene, camera) {
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
    }
}
