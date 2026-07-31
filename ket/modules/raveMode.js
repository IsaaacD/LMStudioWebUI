import * as THREE from 'three';
import {
    GUI_BLOOM_STRENGTH_MIN, GUI_BLOOM_STRENGTH_MAX,
    GUI_BLOOM_RADIUS_MIN, GUI_BLOOM_RADIUS_MAX,
    GUI_FOLD_INTENSITY_MIN, GUI_FOLD_INTENSITY_MAX,
    GUI_VEIN_SPEED_MIN, GUI_VEIN_SPEED_MAX,
    GUI_EDGE_CONTRAST_MIN, GUI_EDGE_CONTRAST_MAX,
    GUI_TIMESCALE_MIN, GUI_TIMESCALE_MAX,
    GUI_AUTOPLAY_SPEED_MIN, GUI_AUTOPLAY_SPEED_MAX,
    normalizeColor,
} from './utils.js';

import { randomizeParams } from './config.js'

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

    syncCurrent(params) {
        this.raveCurrent.bloomStrength = params.bloomStrength;
        this.raveCurrent.bloomRadius = params.bloomRadius;
        this.raveCurrent.foldIntensity = params.foldIntensity;
        this.raveCurrent.veinSpeed = params.veinSpeed;
        this.raveCurrent.edgeContrast = params.edgeContrast;
        this.raveCurrent.timeScale = params.timeScale;
        this.raveCurrent.autoplaySpeed = params.autoplaySpeed;
        this.raveCurrent.colorA = params.colorA;
        this.raveCurrent.colorB = params.colorB;
        this.raveTarget = { ...this.raveCurrent };
    }

    pickTargets() {
        this.raveTarget = randomizeParams(this.raveTarget);
        // this.raveTarget.bloomStrength = GUI_BLOOM_STRENGTH_MIN + Math.random() * (GUI_BLOOM_STRENGTH_MAX - GUI_BLOOM_STRENGTH_MIN);
        // this.raveTarget.bloomRadius = GUI_BLOOM_RADIUS_MIN + Math.random() * (GUI_BLOOM_RADIUS_MAX - GUI_BLOOM_STRENGTH_MIN);
        // this.raveTarget.bloomRadius = GUI_BLOOM_RADIUS_MIN + Math.random() * (GUI_BLOOM_RADIUS_MAX - GUI_BLOOM_RADIUS_MIN);
        // this.raveTarget.foldIntensity = GUI_FOLD_INTENSITY_MIN + Math.random() * (GUI_FOLD_INTENSITY_MAX - GUI_FOLD_INTENSITY_MIN);
        // this.raveTarget.veinSpeed = GUI_VEIN_SPEED_MIN + Math.random() * (GUI_VEIN_SPEED_MAX - GUI_VEIN_SPEED_MIN);
        // this.raveTarget.edgeContrast = GUI_EDGE_CONTRAST_MIN + Math.random() * (GUI_EDGE_CONTRAST_MAX - GUI_EDGE_CONTRAST_MIN);
        // this.raveTarget.timeScale = GUI_TIMESCALE_MIN + Math.random() * (GUI_TIMESCALE_MAX - GUI_TIMESCALE_MIN);
        // this.raveTarget.autoplaySpeed = GUI_AUTOPLAY_SPEED_MIN + Math.random() * (GUI_AUTOPLAY_SPEED_MAX - GUI_AUTOPLAY_SPEED_MIN);
        // this.raveTarget.colorA = new THREE.Color().setRGB(Math.random(), Math.random(), Math.random()).getHexString();//normalizeColor(Math.floor(Math.random() * 0xffffff), 'raveMode:39');
        // this.raveTarget.colorB = new THREE.Color().setRGB(Math.random(), Math.random(), Math.random()).getHexString();//normalizeColor(Math.floor(Math.random() * 0xffffff), 'raveMode:39');
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

        this.raveTemp.set(normalizeColor(this.raveCurrent.colorA, 'raveMode:53'));
        this.raveTemp.lerp(new THREE.Color(normalizeColor(this.raveTarget.colorA, 'raveMode:54')), l);
        this.raveCurrent.colorA = '#' + this.raveTemp.getHexString();

        this.raveTemp.set(normalizeColor(this.raveCurrent.colorB));
        this.raveTemp.lerp(new THREE.Color(normalizeColor(this.raveTarget.colorB, 'raveMode:58')), l);
        this.raveCurrent.colorB = '#' + this.raveTemp.getHexString();
    }

    update(dt, rawTime) {
        // if (rawTime >= this.raveNextTime) {
        this.pickTargets();
        //     this.raveNextTime = rawTime + 1 + Math.random() * 2;
        // }
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
