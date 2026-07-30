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

    update(activeParams) {
        this.bloomPass.strength = activeParams.bloomStrength;
        this.bloomPass.radius = activeParams.bloomRadius;
        if (this.edgePass) {
            this.edgePass.uniforms['edgeStrength'].value = activeParams.edgeContrast;
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
    }
}
