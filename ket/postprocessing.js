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

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(innerWidth, innerHeight),
            1.5, 0.4, 0.85
        );
        this.composer.addPass(this.bloomPass);

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

    update(activeParams) {
        this.bloomPass.strength = activeParams.bloomStrength;
        this.bloomPass.radius = activeParams.bloomRadius;
        if (this.edgePass) {
            this.edgePass.uniforms['edgeStrength'].value = activeParams.edgeContrast;
        }
    }

    render() {
        this.composer.render();
    }

    resize(width, height) {
        this.composer.setSize(width, height);
        if (this.edgePass) {
            this.edgePass.uniforms['resolution'].value.set(width, height);
        }
    }
}
