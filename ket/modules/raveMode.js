import * as THREE from 'three';

export class RaveEngine {
    constructor(params) {
        this.raveTemp = new THREE.Color();
        this.raveCurrent = {
            bloomStrength: params.bloomStrength,
            bloomRadius: params.bloomRadius,
            foldIntensity: params.foldIntensity,
            veinSpeed: params.veinSpeed,
            edgeContrast: params.edgeContrast,
            timeScale: params.timeScale,
            autoplaySpeed: params.autoplaySpeed,
            colorA: params.colorA,
            colorB: params.colorB
        };
        this.raveTarget = { ...this.raveCurrent };
        this.raveNextTime = 0;
    }

    pickTargets() {
        this.raveTarget.bloomStrength = 0.5 + Math.random() * 2.5;
        this.raveTarget.bloomRadius = 0.1 + Math.random() * 0.9;
        this.raveTarget.foldIntensity = 0.5 + Math.random() * 2.5;
        this.raveTarget.veinSpeed = 0.5 + Math.random() * 3;
        this.raveTarget.edgeContrast = Math.random() * 0.45;
        this.raveTarget.timeScale = 0.5 + Math.random() * 3;
        this.raveTarget.autoplaySpeed = 0.5 + Math.random() * 3;
        this.raveTarget.colorA = Math.floor(Math.random() * 0xffffff);
        this.raveTarget.colorB = Math.floor(Math.random() * 0xffffff);
    }

    lerp(dt) {
        const l = 1 - Math.pow(0.001, dt);
        this.raveCurrent.bloomStrength += (this.raveTarget.bloomStrength - this.raveCurrent.bloomStrength) * l;
        this.raveCurrent.bloomRadius += (this.raveTarget.bloomRadius - this.raveCurrent.bloomRadius) * l;
        this.raveCurrent.foldIntensity += (this.raveTarget.foldIntensity - this.raveCurrent.foldIntensity) * l;
        this.raveCurrent.veinSpeed += (this.raveTarget.veinSpeed - this.raveCurrent.veinSpeed) * l;
        this.raveCurrent.edgeContrast += (this.raveTarget.edgeContrast - this.raveCurrent.edgeContrast) * l;
        this.raveCurrent.timeScale += (this.raveTarget.timeScale - this.raveCurrent.timeScale) * l;
        this.raveCurrent.autoplaySpeed += (this.raveTarget.autoplaySpeed - this.raveCurrent.autoplaySpeed) * l;

        this.raveTemp.set(this.raveCurrent.colorA);
        this.raveTemp.lerp(new THREE.Color(this.raveTarget.colorA), l);
        this.raveCurrent.colorA = this.raveTemp.getHex();

        this.raveTemp.set(this.raveCurrent.colorB);
        this.raveTemp.lerp(new THREE.Color(this.raveTarget.colorB), l);
        this.raveCurrent.colorB = this.raveTemp.getHex();
    }

    update(dt, rawTime) {
        if (rawTime >= this.raveNextTime) {
            this.pickTargets();
            this.raveNextTime = rawTime + 1 + Math.random() * 2;
        }
        this.lerp(dt);
    }

    getActiveParams(params) {
        return {
            timeScale: this.raveCurrent.timeScale,
            bloomStrength: this.raveCurrent.bloomStrength,
            bloomRadius: this.raveCurrent.bloomRadius,
            foldIntensity: this.raveCurrent.foldIntensity,
            edgeContrast: this.raveCurrent.edgeContrast,
            autoplaySpeed: this.raveCurrent.autoplaySpeed,
            colorA: this.raveCurrent.colorA,
            colorB: this.raveCurrent.colorB
        };
    }

    getPickTargetsFn() {
        return () => this.pickTargets();
    }

    getRaveNextTime() {
        return this.raveNextTime;
    }
}
