import * as THREE from 'three';

const ARROW_LABEL_ABOVE = true;
const ARROW_LABEL_OFFSET = 0.6;
const ARROW_LABEL_MIN_SPREAD = 0.35;

// Shared geometries
const _coneGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
const _shaftGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.4, 6);
const _orbGeo = new THREE.SphereGeometry(3, 16, 16);
const _glowGeo = new THREE.SphereGeometry(8, 16, 16);
const _glow2Geo = new THREE.SphereGeometry(15, 16, 16);

export class WebRTCRenderer {
    constructor({ camera, peerData, onTeleportButtonUpdate, onArrowDoubleClick, domElement }) {
        this.camera = camera;
        this.peerData = peerData;
        this.onTeleportButtonUpdate = onTeleportButtonUpdate;
        this.onArrowDoubleClick = onArrowDoubleClick;
        this.orbGroup = null;
        this.arrowGroup = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredArrow = null;
        this.clickCount = 0;
        this.clickTimer = 0;
        this.clickTimeout = 400;
        this.domElement = domElement;

        this._mouseMoveHandler = (e) => {
            if (!this.domElement) return;
            const rect = this.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        };

        this._mouseDownHandler = () => {
            this.clickCount++;
            this.clickTimer = 0;
        };

        document.addEventListener('mousemove', this._mouseMoveHandler);
        if (this.domElement) {
            this.domElement.addEventListener('mousedown', this._mouseDownHandler);
        }
    }

    setCamera(cam) {
        this.camera = cam;
    }

    setDomElement(el) {
        this.domElement = el;
        if (el) {
            el.addEventListener('mousedown', this._mouseDownHandler);
        }
    }

    initOrbGroup(scene) {
        this.orbGroup = new THREE.Group();
        this.orbGroup.name = 'webrtc-orbs';
        if (scene) {
            scene.add(this.orbGroup);
        }
    }

    initArrowGroup(scene) {
        this.arrowGroup = new THREE.Group();
        this.arrowGroup.name = 'webrtc-arrows';
        if (scene) {
            scene.add(this.arrowGroup);
        }
    }

    refreshOrbParent(activeScene) {
        if (!activeScene || !activeScene.threeScene) return;
        const targetScene = activeScene.threeScene;
        if (this.orbGroup && this.orbGroup.parent !== targetScene) {
            if (this.orbGroup.parent) {
                this.orbGroup.parent.remove(this.orbGroup);
            }
            targetScene.add(this.orbGroup);
        }
        if (this.arrowGroup && this.arrowGroup.parent !== targetScene) {
            if (this.arrowGroup.parent) {
                this.arrowGroup.parent.remove(this.arrowGroup);
            }
            targetScene.add(this.arrowGroup);
        }
    }

    createHUDArrow(color) {
        const group = new THREE.Group();
        const c = new THREE.Color(color || '#00ccff');

        const coneMat = new THREE.MeshBasicMaterial({
            color: c,
            transparent: true,
            opacity: 0.95,
            fog: false,
            depthTest: false,
            renderOrder: 999
        });
        const cone = new THREE.Mesh(_coneGeo, coneMat);
        group.add(cone);

        const shaftMat = new THREE.MeshBasicMaterial({
            color: c,
            transparent: true,
            opacity: 0.65,
            fog: false,
            depthTest: false,
            renderOrder: 999
        });
        const shaft = new THREE.Mesh(_shaftGeo, shaftMat);
        shaft.position.y = -0.4;
        group.add(shaft);

        // const dotGeo = new THREE.SphereGeometry(0.07, 6, 6);
        // const dotMat = new THREE.MeshBasicMaterial({
        //     color: c,
        //     transparent: true,
        //     opacity: 1.0,
        //     fog: false,
        //     depthTest: false,
        //     renderOrder: 999
        // });
        // const dot = new THREE.Mesh(dotGeo, dotMat);
        // dot.position.y = -0.7;
        // group.add(dot);

        return group;
    }

    syncArrowSet(peersWithData) {
        if (!this.arrowGroup) return;

        const existingIds = new Set();
        for (const child of this.arrowGroup.children) {
            existingIds.add(child.userData.peerId);
        }

        const neededIds = new Set();
        for (const [peerId, data] of peersWithData) {
            neededIds.add(peerId);
            let arrow = this.arrowGroup.children.find(c => c.userData.peerId === peerId && !c.userData.isLabel);
            if (!arrow) {
                arrow = this.createHUDArrow(data.color || '#00ccff');
                arrow.userData.peerId = peerId;
                arrow.userData.targetDir = new THREE.Vector3();
                arrow.userData.username = data.username || 'anon';
                arrow.userData.isLabel = false;

                const label = this.createTextSprite(
                    `${data.username || 'anon'}: 0m`,
                    data.color || '#00ccff'
                );
                label.userData.peerId = peerId;
                label.userData.isLabel = true;
                label.userData.arrowRef = arrow;
                label.scale.set(1.2, 0.3, 1);
                this.arrowGroup.add(label);
                arrow.userData.label = label;

                this.arrowGroup.add(arrow);
            }
        }

        for (const id of existingIds) {
            if (!neededIds.has(id)) {
                const toRemove = this.arrowGroup.children.find(c => c.userData.peerId === id && !c.userData.isLabel);
                if (toRemove) {
                    this.arrowGroup.remove(toRemove);
                    for (const mesh of toRemove.children) {
                        if (mesh.material) mesh.material.dispose();
                    }
                    if (toRemove.userData.label && toRemove.userData.label.material) {
                        toRemove.userData.label.material.dispose();
                    }
                }
                const labelRemove = this.arrowGroup.children.find(c => c.userData.peerId === id && c.userData.isLabel);
                if (labelRemove) {
                    this.arrowGroup.remove(labelRemove);
                    if (labelRemove.material) labelRemove.material.dispose();
                }
            }
        }
    }

    animateArrows(dt) {
        if (!this.arrowGroup || !this.camera) return;

        const dtClamped = Math.min(dt, 0.05);
        const lerpFactor = Math.min(1, dtClamped * 30);

        const camPos = this.camera.position.clone();
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);

        const camRight = new THREE.Vector3();
        camRight.crossVectors(camDir, this.camera.up).normalize();

        const camUp = new THREE.Vector3();
        camUp.crossVectors(camRight, camDir).normalize();

        const peersWithData = [];
        for (const [peerId, data] of this.peerData) {
            if (data.position) peersWithData.push([peerId, data]);
        }

        this.syncArrowSet(peersWithData);

        this._hoverAndClick(dt);

        const hudDist = 2;
        const halfFov = this.camera.fov * 0.5 * (Math.PI / 180);
        const maxOffset = hudDist * Math.tan(halfFov) * 0.4;
        const leftBias = -maxOffset * 0.75;
        const aspect = this.camera.aspect || 1.6;
        const hardLimitX = hudDist * Math.tan(halfFov) * aspect * 0.95;
        const hardLimitY = hudDist * Math.tan(halfFov) * 0.95;

        const visibleArrows = [];

        for (const arrow of this.arrowGroup.children) {
            if (arrow.userData.isLabel) continue;

            const peerId = arrow.userData.peerId;
            const peerData = this.peerData.get(peerId);
            if (!peerData || !peerData.position) {
                arrow.visible = false;
                continue;
            }

            const targetPos = new THREE.Vector3(
                peerData.position.x,
                peerData.position.y,
                peerData.position.z
            );

            const toPeer = new THREE.Vector3().subVectors(targetPos, camPos);
            const dist = toPeer.length();
            toPeer.normalize();

            const forwardDot = camDir.dot(toPeer);

            if (forwardDot < -0.1) {
                arrow.visible = false;
                continue;
            }

            arrow.visible = true;

            const rightComp = camRight.dot(toPeer);
            const upComp = camUp.dot(toPeer);

            let offsetX = Math.max(-maxOffset, Math.min(maxOffset, rightComp * maxOffset)) + leftBias;
            let offsetY = Math.max(-maxOffset, Math.min(maxOffset, upComp * maxOffset));
            offsetX = Math.max(-hardLimitX, Math.min(hardLimitX, offsetX));
            offsetY = Math.max(-hardLimitY, Math.min(hardLimitY, offsetY));

            const desiredPos = camPos.clone();
            desiredPos.addScaledVector(camDir, hudDist);
            desiredPos.addScaledVector(camRight, offsetX);
            desiredPos.addScaledVector(camUp, offsetY);

            arrow.position.lerp(desiredPos, lerpFactor);

            // Clamp post-lerp position to HUD bounds using correct camera-basis projection
            const relPos = arrow.position.clone().sub(camPos);
            const fwdComp = camDir.dot(relPos);
            let rc = camRight.dot(relPos);
            let uc = camUp.dot(relPos);
            rc = Math.max(-hardLimitX, Math.min(hardLimitX, rc));
            uc = Math.max(-hardLimitY, Math.min(hardLimitY, uc));
            arrow.position.copy(camPos)
                .addScaledVector(camDir, fwdComp)
                .addScaledVector(camRight, rc)
                .addScaledVector(camUp, uc);

            const currentDir = arrow.userData.targetDir;
            currentDir.lerp(toPeer, lerpFactor);

            const upVec = new THREE.Vector3(0, 1, 0);
            const rotQuat = new THREE.Quaternion().setFromUnitVectors(upVec, currentDir.clone());
            arrow.quaternion.slerp(rotQuat, lerpFactor);

            const distScale = Math.max(0.8, Math.min(2.2, 3.5 - dist * 0.012));
            const s = arrow.scale;
            const ts = s.x + (distScale - s.x) * lerpFactor;
            arrow.scale.set(ts, ts, ts);

            for (const mesh of arrow.children) {
                if (mesh.isMesh && mesh.material) {
                    const baseOp = mesh === arrow.children[0] ? 0.95 :
                        mesh === arrow.children[1] ? 0.65 : 1.0;
                    mesh.material.opacity = baseOp * Math.max(0.5, 1 - dist * 0.002);
                }
            }

            if (arrow.userData.hovered) {
                const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.15;
                const hs = ts * pulse;
                arrow.scale.set(hs, hs, hs);
                for (const mesh of arrow.children) {
                    if (mesh.isMesh && mesh.material) {
                        mesh.material.opacity = Math.min(1, mesh.material.opacity + 0.2);
                    }
                }
            }

            visibleArrows.push({
                arrow,
                peerId,
                peerData,
                dist,
                scale: ts,
                label: arrow.userData.label
            });
        }

        this.resolveLabelOverlap(visibleArrows, camPos, camDir, camRight, camUp, hudDist, lerpFactor);
    }

    _hoverAndClick(dt) {
        if (!this.camera || !this.arrowGroup) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const arrows = this.arrowGroup.children.filter(c => !c.userData.isLabel && c.visible);
        const intersects = this.raycaster.intersectObjects(arrows, true);

        let newHover = null;
        if (intersects.length > 0) {
            let hitObj = intersects[0].object;
            while (hitObj && !hitObj.userData.peerId) {
                hitObj = hitObj.parent;
            }
            if (hitObj && hitObj.userData.peerId) {
                newHover = hitObj;
            }
        }

        if (this.hoveredArrow !== newHover) {
            if (this.hoveredArrow) {
                this.hoveredArrow.userData.hovered = false;
            }
            this.hoveredArrow = newHover;
            if (this.hoveredArrow) {
                this.hoveredArrow.userData.hovered = true;
            }
        }

        this.clickTimer += dt * 1000;
        if (this.clickTimer > this.clickTimeout) {
            this.clickCount = 0;
        }

        if (this.clickCount >= 2 && this.hoveredArrow) {
            const peerData = this.peerData.get(this.hoveredArrow.userData.peerId);
            if (peerData && peerData.position && this.onArrowDoubleClick) {
                this.onArrowDoubleClick(peerData);
            }
            this.clickCount = 0;
        }
    }

    resolveLabelOverlap(visibleArrows, camPos, camDir, camRight, camUp, hudDist, lerpFactor) {
        for (const entry of visibleArrows) {
            if (!entry.label) continue;

            // Snap label directly to arrow to prevent detachment during fast camera movement
            entry.label.position.copy(entry.arrow.position);
            if (ARROW_LABEL_ABOVE) {
                entry.label.position.y += ARROW_LABEL_OFFSET * entry.scale;
            } else {
                entry.label.position.y -= ARROW_LABEL_OFFSET * entry.scale;
            }

            const distText = `${entry.peerData.username || 'anon'}: ${Math.round(entry.dist)}m`;
            this.updateTextSprite(entry.label, distText, entry.peerData.color || '#00ccff');
            //entry.label.scale.set(2.4 * entry.scale, 0.6 * entry.scale, 1);
        }
    }

    updateTextSprite(sprite, text, color) {
        if (!sprite || !sprite.userData) return;

        if (sprite.userData.cachedText === text) return;
        sprite.userData.cachedText = text;

        const baseSize = 1024;
        const width = Math.max(baseSize / 4 * text.length, 256);
        const height = baseSize / 4;

        let canvas = sprite.userData.canvas;
        if (!canvas || canvas.width !== width || canvas.height !== height) {
            canvas = document.createElement('canvas');
            sprite.userData.canvas = canvas;
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 150px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color || '#00ccff';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        if (sprite.material.map) {
            sprite.material.map.dispose();
        }
        const newTexture = new THREE.CanvasTexture(canvas);
        newTexture.minFilter = THREE.LinearFilter;
        sprite.material.map = newTexture;
        sprite.material.needsUpdate = true;
    }

    updateOrbs() {
        if (!this.orbGroup) return;

        const existingIds = new Set();
        for (const child of this.orbGroup.children) {
            existingIds.add(child.userData.peerId);
        }

        const dataIds = new Set();
        for (const [peerId, data] of this.peerData) {
            if (!data.position) continue;
            dataIds.add(peerId);
            this.updateOrb(peerId, data);
        }

        for (const id of existingIds) {
            if (!dataIds.has(id)) {
                const toRemove = this.orbGroup.children.find(c => c.userData.peerId === id);
                if (toRemove) {
                    this.orbGroup.remove(toRemove);
                    if (toRemove.material) toRemove.material.dispose();
                }
            }
        }
    }

    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const size = 1024;
        canvas.width = size / 4 * text.length;
        canvas.height = size / 4;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 250px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color || '#00ccff';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, renderOrder: 999 });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2, 0.5, 1);
        return sprite;
    }

    updateOrb(peerId, data) {
        let orb = this.orbGroup.children.find(c => c.userData.peerId === peerId);

        if (!orb) {
            const color = new THREE.Color(data.color || '#00ccff');
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9,
                fog: false
            });
            orb = new THREE.Mesh(_orbGeo, material);
            orb.userData.peerId = peerId;
            orb.userData.targetPosition = new THREE.Vector3(data.position.x, data.position.y, data.position.z);

            const glowMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.15,
                side: THREE.BackSide,
                fog: false
            });
            const glow = new THREE.Mesh(_glowGeo, glowMat);
            orb.add(glow);

            const glow2Mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.06,
                side: THREE.BackSide,
                fog: false
            });
            const glow2 = new THREE.Mesh(_glow2Geo, glow2Mat);
            orb.add(glow2);

            const light = new THREE.PointLight(color, 3, 50);
            orb.add(light);

            const label = this.createTextSprite(data.username || 'anon', data.color || '#00ccff');
            label.position.y = 4;
            orb.add(label);

            this.orbGroup.add(orb);
        }

        orb.userData.targetPosition.set(data.position.x, data.position.y, data.position.z);
        orb.userData.speed = data.position ? data.position.speed : 3;
    }

    animateOrbs(dt) {
        if (!this.orbGroup) return;
        for (const orb of this.orbGroup.children) {
            const target = orb.userData.targetPosition;
            if (!target) continue;
            const dx = target.x - orb.position.x;
            const dy = target.y - orb.position.y;
            const dz = target.z - orb.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 0.01) continue;
            const peerSpeed = orb.userData.speed || 3;
            const lerpSpeed = Math.max(peerSpeed * 2, 8);
            const move = Math.min(lerpSpeed * dt * 60, dist);
            orb.position.x += (dx / dist) * move;
            orb.position.y += (dy / dist) * move;
            orb.position.z += (dz / dist) * move;
        }
    }

    tryTeleportArrow(ndcX, ndcY) {
        if (!this.arrowGroup || !this.camera) return false;

        this.mouse.set(ndcX, ndcY);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const arrows = this.arrowGroup.children.filter(c => !c.userData.isLabel && c.visible);
        const intersects = this.raycaster.intersectObjects(arrows, true);

        if (intersects.length > 0) {
            let hitObj = intersects[0].object;
            while (hitObj && !hitObj.userData.peerId) {
                hitObj = hitObj.parent;
            }
            if (hitObj && hitObj.userData.peerId) {
                const peerData = this.peerData.get(hitObj.userData.peerId);
                if (peerData && peerData.position && this.onArrowDoubleClick) {
                    this.onArrowDoubleClick(peerData);
                    return true;
                }
            }
        }
        return false;
    }

    destroy() {
        document.removeEventListener('mousemove', this._mouseMoveHandler);
        if (this.domElement) {
            this.domElement.removeEventListener('mousedown', this._mouseDownHandler);
        }
        if (this.orbGroup) {
            for (const child of this.orbGroup.children) {
                if (child.material) child.material.dispose();
            }
            this.orbGroup.clear();
        }
        if (this.arrowGroup) {
            for (const child of this.arrowGroup.children) {
                if (child.userData.isLabel) {
                    if (child.material) child.material.dispose();
                } else {
                    for (const mesh of child.children) {
                        if (mesh.material) mesh.material.dispose();
                    }
                }
            }
            this.arrowGroup.clear();
        }
    }
}
