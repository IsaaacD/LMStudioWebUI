import * as THREE from 'three';
import { WebRTCRenderer } from './webrtcRender.js';
import { createQRCanvas } from './qrGenerator.js';

const STORAGE_KEY_ID = 'webrtc-user-id';
const STORAGE_KEY_PEERS = 'webrtc-peer-list';
const STORAGE_KEY_USERNAME = 'webrtc-username';
const STORAGE_KEY_COLOR = 'webrtc-user-color';

function saveUserId(id) {
    try { localStorage.setItem(STORAGE_KEY_ID, id); } catch { }
}

function loadUserId() {
    try { return localStorage.getItem(STORAGE_KEY_ID); } catch { return null; }
}

function savePeerList(ids) {
    try { localStorage.setItem(STORAGE_KEY_PEERS, JSON.stringify(ids)); } catch { }
}

function loadPeerList() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PEERS);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveUsername(name) {
    try { localStorage.setItem(STORAGE_KEY_USERNAME, name); } catch { }
}

function loadUsername() {
    try { return localStorage.getItem(STORAGE_KEY_USERNAME); } catch { return null; }
}

function saveUserColor(color) {
    try { localStorage.setItem(STORAGE_KEY_COLOR, color); } catch { }
}

function loadUserColor() {
    try { return localStorage.getItem(STORAGE_KEY_COLOR); } catch { return null; }
}

const urlParams = new URLSearchParams(window.location.search);
const isOnlineMode = urlParams.has('online');
const isDebugMode = urlParams.has('debug');
const autoJoinId = urlParams.get('joinId') || null;

function showToast(message, color, onFollowClick) {
    const existing = document.getElementById('teleport-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'teleport-toast';
    toast.classList = 'gui';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color};
        color: #000;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        font-weight: bold;
        letter-spacing: 0.1em;
        padding: 10px 24px;
        border-radius: 6px;
        z-index: 10000;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.3s ease;
        user-select: none;
    `;

    document.body.appendChild(toast);
    onFollowClick();
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });

    const dismiss = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    };

    // toast.addEventListener('click', () => {
    //     if (onFollowClick) onFollowClick();
    //     dismiss();
    // });

    setTimeout(() => dismiss(), 3000);
}

export class WebRTCManager {
    constructor() {
        this.peers = new Map();
        this.peerData = new Map();
        this.userId = null;
        this.username = 'anon';
        this.userColor = loadUserColor() || '#00ccff';
        this.el = null;
        this.peer = null;
        this.inputEl = null;
        this.savedPeerIds = loadPeerList();
        this.gossipTimer = null;
        this.GOSSIP_INTERVAL = 200;
        this.camera = null;
        this.activeScene = null;
        this.sceneManager = null;
        this.params = null;
        this.animationLoop = null;
        this.followTarget = null;
        this.followTargetId = null;

        this.isDestroying = false;
        this.pendingJoinId = null;
        this.sentBytes = 0;
        this.receivedBytes = 0;
        this.sentCount = 0;
        this.receivedCount = 0;

        this.renderer = new WebRTCRenderer({
            camera: null,
            peerData: this.peerData,
            onTeleportButtonUpdate: () => this.updateTeleportButton(),
            onArrowDoubleClick: (peerData, peerId) => this.teleportToPeer(peerData, peerId)
        });
    }

    setCamera(cam) {
        this.camera = cam;
        this.renderer.setCamera(cam);
    }

    setDomElement(el) {
        this.renderer.setDomElement(el);
    }

    initActiveScene(scene) {
        this.activeScene = scene;
        this.renderer.initOrbGroup(scene);
        this.renderer.initArrowGroup(scene);
    }

    setSceneManager(sm) {
        this.sceneManager = sm;
    }

    setParams(p) {
        this.params = p;
    }

    setAnimationLoop(loop) {
        this.animationLoop = loop;
    }

    init() {
        if (isOnlineMode) {
            this.showOnlineSplash();
        } else {
            this.el = this.createUI();
            this.connectPeerJS();
        }
        this.createDebugPanel();
        window.addEventListener('beforeunload', () => {
            this.broadcastDisconnect();
            this.destroy();
        });
    }

    showOnlineSplash() {
        const savedName = loadUsername();
        if (savedName) {
            this.username = savedName;
            this.el = this.createUI();
            this.connectPeerJS();
            return;
        }

        const overlay = document.createElement('div');
        overlay.classList = 'gui';
        overlay.id = 'online-splash';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 100001;
            transition: opacity 1s ease;
        `;

        const title = document.createElement('div');

        title.textContent = 'ONLINE MODE';
        title.style.cssText = `
            font-family: 'Courier New', monospace;
            font-size: clamp(18px, 4vw, 36px);
            color: #fff;
            text-shadow: 0 0 10px #ff0055, 0 0 30px #ff0055, 0 0 60px #00ccff;
            letter-spacing: 0.3em;
            margin-bottom: 40px;
        `;
        overlay.appendChild(title);

        const form = document.createElement('div');
        form.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        `;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'username';
        nameInput.value = savedName || '';
        nameInput.maxLength = 16;
        nameInput.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 204, 255, 0.3);
            border-radius: 6px;
            padding: 10px 16px;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            text-align: center;
            outline: none;
            width: 240px;
        `;
        form.appendChild(nameInput);

        const colorLabel = document.createElement('div');
        colorLabel.textContent = 'YOUR COLOR';
        colorLabel.style.cssText = `
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.4);
            letter-spacing: 0.2em;
        `;
        form.appendChild(colorLabel);

        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = this.userColor;
        colorPicker.style.cssText = `
            width: 60px;
            height: 30px;
            border: 1px solid rgba(0, 204, 255, 0.3);
            border-radius: 4px;
            background: transparent;
            cursor: pointer;
            padding: 0;
        `;
        form.appendChild(colorPicker);

        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'JOIN';
        joinBtn.style.cssText = `
            margin-top: 12px;
            background: rgba(0, 204, 255, 0.15);
            border: 1px solid rgba(0, 204, 255, 0.4);
            border-radius: 6px;
            padding: 10px 32px;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            letter-spacing: 0.2em;
            cursor: pointer;
        `;
        form.appendChild(joinBtn);

        overlay.appendChild(form);
        document.body.appendChild(overlay);

        const closeSplash = () => {
            this.username = nameInput.value.trim() || 'anon';
            this.userColor = colorPicker.value;
            saveUsername(this.username);
            saveUserColor(this.userColor);
            this.pendingJoinId = autoJoinId;
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 1000);
            this.el = this.createUI();
            this.connectPeerJS();
        };

        joinBtn.addEventListener('click', closeSplash);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') closeSplash();
        });
        nameInput.focus();
    }

    createUI() {
        const container = document.createElement('div');
        container.classList = 'gui';
        container.id = 'webrtc-panel';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            color: rgba(255, 255, 255, 0.7);
            font-family: 'Courier New', monospace;
            font-size: 12px;
            letter-spacing: 0.15em;
            background: rgba(5, 0, 20, 0.6);
            border-radius: 6px;
            border: 1px solid rgba(0, 204, 255, 0.15);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            pointer-events: auto;
            z-index: 99990;
            user-select: none;
            line-height: 1.6;
            max-width: 280px;
            overflow: hidden;
            transition: max-height 0.35s ease, max-width 0.35s ease;
            max-height: 40px;
            max-width: 60px;
        `;

        const tab = document.createElement('div');
        tab.id = 'webrtc-tab';
        tab.classList = 'gui';
        tab.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 16px;
            cursor: pointer;
            border-bottom: 1px solid rgba(0, 204, 255, 0.15);
            background: rgba(5, 0, 20, 0.8);
        `;

        const arrowIcon = document.createElement('span');
        arrowIcon.id = 'webrtc-tab-arrow';
        arrowIcon.textContent = '▲';
        arrowIcon.style.cssText = `
            font-size: 10px;
            color: rgba(0, 204, 255, 0.7);
            transition: transform 0.35s ease;
            display: inline-block;
            transform: rotate(180deg);
        `;
        tab.appendChild(arrowIcon);

        const content = document.createElement('div');
        content.id = 'webrtc-content';
        content.classList = 'gui';
        content.style.cssText = `
            padding: 0 16px;
            max-height: 0px;
            overflow-y: auto;
            opacity: 0;
            transition: max-height 0.35s ease, opacity 0.25s ease, padding 0.35s ease;
        `;

        let isCollapsed = true;
        let contentHeight = null;

        const togglePanel = () => {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                contentHeight = content.scrollHeight;
                content.style.maxHeight = contentHeight + 'px';
                content.style.opacity = '0';
                content.style.padding = '0 16px';
                arrowIcon.style.transform = 'rotate(180deg)';
                requestAnimationFrame(() => {
                    content.style.maxHeight = '0px';
                });
                container.style.maxHeight = '40px';
                container.style.maxWidth = '60px';
            } else {
                if (!contentHeight) contentHeight = 600;
                container.style.maxWidth = '280px';
                content.style.maxHeight = contentHeight + 'px';
                content.style.opacity = '1';
                content.style.padding = '12px 16px';
                arrowIcon.style.transform = 'rotate(0deg)';
                container.style.maxHeight = '600px';
                setTimeout(() => {
                    if (!isCollapsed) content.style.maxHeight = '600px';
                }, 360);
            }
        };

        tab.addEventListener('click', togglePanel);

        const countEl = document.createElement('div');
        countEl.id = 'webrtc-count';
        countEl.innerHTML = `ONLINE: <span style="color: #00ccff; font-weight: bold;">1</span>`;
        content.appendChild(countEl);

        if (isOnlineMode) {
            const nameEl = document.createElement('div');
            nameEl.id = 'webrtc-name';
            nameEl.style.cssText = `
                margin-top: 4px;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
            `;
            nameEl.innerHTML = `<span style="color: ${this.userColor};">${this.username}</span>`;
            content.appendChild(nameEl);

            const posEl = document.createElement('div');
            posEl.id = 'webrtc-pos';
            posEl.style.cssText = `
                margin-top: 4px;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.3);
                letter-spacing: 0.1em;
            `;
            posEl.textContent = 'POS: 0, 0, 0';
            content.appendChild(posEl);

            const osEl = document.createElement('div');
            osEl.id = 'webrtc-orient-speed';
            osEl.style.cssText = `
                margin-top: 4px;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.3);
                letter-spacing: 0.1em;
            `;
            osEl.textContent = 'ORIENT: 0.000 rad/s';
            content.appendChild(osEl);
        }

        const idRow = document.createElement('div');
        idRow.style.cssText = `
            margin-top: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        `;

        const idEl = document.createElement('div');
        idEl.id = 'webrtc-id';
        idEl.style.cssText = `
            flex: 1;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.4);
            word-break: break-all;
        `;
        idEl.innerHTML = 'YOUR ID: <span style="color: rgba(255,255,255,0.6);">connecting...</span>';
        idRow.appendChild(idEl);

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'COPY';
        copyBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 204, 255, 0.2);
            border-radius: 4px;
            padding: 2px 8px;
            color: rgba(255, 255, 255, 0.5);
            font-family: 'Courier New', monospace;
            font-size: 9px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
        `;
        copyBtn.addEventListener('click', () => {
            if (this.userId) {
                navigator.clipboard.writeText(this.userId).then(() => {
                    copyBtn.textContent = 'COPIED';
                    setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500);
                });
            }
        });
        idRow.appendChild(copyBtn);

        const shareBtn = document.createElement('button');
        shareBtn.textContent = 'SHARE';
        shareBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 204, 255, 0.2);
            border-radius: 4px;
            padding: 2px 8px;
            color: rgba(255, 255, 255, 0.5);
            font-family: 'Courier New', monospace;
            font-size: 9px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
        `;
        shareBtn.addEventListener('click', () => {
            if (this.userId) {
                const base = window.location.origin + window.location.pathname;
                const shareUrl = `${base}?online=true&joinId=${this.userId}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                    shareBtn.textContent = 'COPIED';
                    setTimeout(() => { shareBtn.textContent = 'SHARE'; }, 1500);
                });
            }
        });
        idRow.appendChild(shareBtn);

        const qrBtn = document.createElement('button');
        qrBtn.textContent = 'QR';
        qrBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 204, 255, 0.2);
            border-radius: 4px;
            padding: 2px 8px;
            color: rgba(255, 255, 255, 0.5);
            font-family: 'Courier New', monospace;
            font-size: 9px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
        `;
        qrBtn.addEventListener('click', () => {
            if (this.userId) {
                const base = window.location.origin + window.location.pathname;
                const shareUrl = `${base}?online=true&joinId=${this.userId}`;
                try {
                    const qrCanvas = createQRCanvas(shareUrl, Math.min(500, window.innerWidth - 80));
                    const overlay = document.createElement('div');
                    overlay.style.cssText = `
                        position: fixed;
                        top: 0; left: 0;
                        width: 100%; height: 100%;
                        background: rgba(0, 0, 0, 0.45);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 100002;
                    `;
                    qrCanvas.style.cssText = `
                        width:80%;
                        max-width:20em;
                        height:auto;
                        border-radius: 8px;
                    `;
                    const closeBtn = document.createElement('button');
                    closeBtn.textContent = '✕';
                    closeBtn.classList = 'gui';
                    closeBtn.style.cssText = `
                        position: fixed;
                        top: 20px; right: 20px;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        border-radius: 50%;
                        width: 40px; height: 40px;
                        color: #fff;
                        font-size: 18px;
                        cursor: pointer;
                        z-index: 100003;
                    `;
                    closeBtn.addEventListener('click', () => overlay.remove());
                    overlay.appendChild(qrCanvas);
                    overlay.appendChild(closeBtn);
                    document.body.appendChild(overlay);
                } catch {
                    console.error('[QR] Failed to generate QR code');
                }
            }
        });
        idRow.appendChild(qrBtn);
        content.appendChild(idRow);

        const inputRow = document.createElement('div');
        inputRow.style.cssText = `
            margin-top: 10px;
            display: flex;
            gap: 6px;
        `;

        this.inputEl = document.createElement('input');
        this.inputEl.type = 'text';
        this.inputEl.placeholder = 'paste peer ID';
        this.inputEl.style.cssText = `
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 204, 255, 0.2);
            border-radius: 4px;
            padding: 4px 8px;
            color: rgba(255, 255, 255, 0.8);
            font-family: 'Courier New', monospace;
            font-size: 11px;
            outline: none;
        `;

        const connectBtn = document.createElement('button');
        connectBtn.textContent = 'CONNECT';
        connectBtn.style.cssText = `
            background: rgba(0, 204, 255, 0.15);
            border: 1px solid rgba(0, 204, 255, 0.3);
            border-radius: 4px;
            padding: 4px 10px;
            color: rgba(255, 255, 255, 0.7);
            font-family: 'Courier New', monospace;
            font-size: 10px;
            cursor: pointer;
            white-space: nowrap;
        `;

        connectBtn.addEventListener('click', () => {
            const peerId = this.inputEl.value.trim();
            if (peerId && peerId !== this.userId) {
                this.connectToPeer(peerId);
                this.inputEl.value = '';
            }
        });

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') connectBtn.click();
        });

        inputRow.appendChild(this.inputEl);
        inputRow.appendChild(connectBtn);
        content.appendChild(inputRow);

        if (isOnlineMode) {
            const teleportBtn = document.createElement('button');
            teleportBtn.id = 'teleport-btn';
            teleportBtn.textContent = 'TELEPORT TO RANDO';
            teleportBtn.disabled = true;
            teleportBtn.style.cssText = `
                margin-top: 10px;
                width: 100%;
                background: rgba(255, 0, 85, 0.15);
                border: 1px solid rgba(255, 0, 85, 0.3);
                border-radius: 4px;
                padding: 6px 10px;
                color: rgba(255, 255, 255, 0.7);
                font-family: 'Courier New', monospace;
                font-size: 10px;
                letter-spacing: 0.15em;
                cursor: pointer;
            `;
            teleportBtn.addEventListener('click', () => {
                this.teleportToRandomPeer();
            });
            content.appendChild(teleportBtn);
        }

        container.appendChild(tab);
        container.appendChild(content);
        document.body.appendChild(container);
        return container;
    }

    updateDisplay() {
        if (!this.el) return;
        const countEl = this.el.querySelector('#webrtc-count');
        if (countEl) {
            countEl.innerHTML = `ONLINE: <span style="color: #00ccff; font-weight: bold;">${this.connectedCount}</span>`;
        }
    }

    updateIdDisplay() {
        if (!this.el) return;
        const idEl = this.el.querySelector('#webrtc-id');
        if (idEl && this.userId) {
            idEl.innerHTML = `YOUR ID: <span style="color: rgba(255,255,255,0.6);">${this.userId}</span>`;
        }
    }

    updateNameDisplay() {
        if (!this.el || !isOnlineMode) return;
        const nameEl = this.el.querySelector('#webrtc-name');
        if (nameEl) {
            const savedName = loadUsername();
            this.username = savedName;
            nameEl.innerHTML = `<span style="color: ${this.userColor};">${this.username}</span>`;
        }
    }

    updatePosDisplay() {
        if (!this.el || !isOnlineMode || !this.camera) return;
        const posEl = this.el.querySelector('#webrtc-pos');
        if (posEl) {
            const p = this.camera.position;
            posEl.textContent = `POS: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
        }
        const osEl = this.el.querySelector('#webrtc-orient-speed');
        if (osEl) {
            osEl.textContent = `SPEED: ${this.params ? this.params.speed.toFixed(1) : '0.0'}`;
        }
    }

    get connectedCount() {
        let count = 1;
        for (const [, entry] of this.peers) {
            if (entry.connected) count++;
        }
        return count;
    }

    getMyPeerList() {
        const ids = [];
        for (const peerId of this.peers.keys()) {
            ids.push(peerId);
        }
        savePeerList(ids);
        return ids;
    }

    persistPeers() {
        savePeerList(this.getMyPeerList());
    }

    getMyPosition() {
        if (!this.camera) return null;
        const pos = this.camera.position;
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        return {
            x: pos.x,
            y: pos.y,
            z: pos.z,
            bearing: Math.atan2(dir.x, dir.z),
            speed: this.params ? this.params.speed : 0
        };
    }

    buildPeerSnapshot() {
        const snapshot = {};
        const myPos = this.getMyPosition();
        if (myPos) {
            snapshot[this.userId] = {
                username: this.username,
                color: this.userColor,
                position: myPos
            };
        }
        for (const [peerId, data] of this.peerData) {
            if (data.position) {
                snapshot[peerId] = data;
            }
        }
        return snapshot;
    }

    broadcastDisconnect() {
        const msg = {
            type: 'disconnect',
            myId: this.userId
        };
        const bytes = this.measureBytes(msg);
        for (const [, entry] of this.peers) {
            if (entry.connected && entry.conn) {
                try {
                    entry.conn.send(msg);
                    this.sentBytes += bytes;
                    this.sentCount++;
                    this.updateDebugPanel();
                } catch { }
            }
        }
    }

    measureBytes(data) {
        try {
            const json = JSON.stringify(data);
            const blob = new Blob([json]);
            return blob.size;
        } catch {
            return 0;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2);
        return `${val} ${units[i]}`;
    }

    createDebugPanel() {
        if (!isDebugMode) return;
        const panel = document.createElement('div');
        panel.id = 'webrtc-debug';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            color: rgba(255, 255, 255, 0.7);
            font-family: 'Courier New', monospace;
            font-size: 11px;
            letter-spacing: 0.1em;
            background: rgba(5, 0, 20, 0.7);
            border-radius: 6px;
            border: 1px solid rgba(255, 0, 85, 0.3);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99990;
            user-select: none;
            padding: 10px 14px;
            line-height: 1.7;
            min-width: 180px;
        `;
        panel.innerHTML = `
            <div style="color: rgba(255,0,85,0.8); font-weight: bold; margin-bottom: 4px;">DEBUG</div>
            <div>SENT: <span id="webrtc-debug-sent" style="color: #00ccff;">0 (0 B)</span></div>
            <div>RECV: <span id="webrtc-debug-recv" style="color: #00ccff;">0 (0 B)</span></div>
            <div>AVG: <span id="webrtc-debug-avg" style="color: #00ccff;">0 B</span></div>
        `;
        document.body.appendChild(panel);
    }

    updateDebugPanel() {
        if (!isDebugMode) return;
        const sentEl = document.getElementById('webrtc-debug-sent');
        const recvEl = document.getElementById('webrtc-debug-recv');
        const avgEl = document.getElementById('webrtc-debug-avg');
        if (sentEl) sentEl.textContent = `${this.sentCount} (${this.formatBytes(this.sentBytes)})`;
        if (recvEl) recvEl.textContent = `${this.receivedCount} (${this.formatBytes(this.receivedBytes)})`;
        const total = this.sentCount + this.receivedCount;
        const avg = total > 0 ? (this.sentBytes + this.receivedBytes) / total : 0;
        if (avgEl) avgEl.textContent = this.formatBytes(avg);
    }

    sendSnapshotToPeer(conn) {
        if (!isOnlineMode) return;
        const snapshot = this.buildPeerSnapshot();
        const msg = {
            type: 'peer-list',
            peers: this.getMyPeerList(),
            myId: this.userId,
            username: this.username,
            color: this.userColor,
            position: this.getMyPosition(),
            snapshot: snapshot
        };
        try {
            const bytes = this.measureBytes(msg);
            conn.send(msg);
            this.sentBytes += bytes;
            this.sentCount++;
            this.updateDebugPanel();
        } catch { }
    }

    broadcastPeerList() {
        if (this.isDestroying) return;
        const list = this.getMyPeerList();
        const snapshot = this.buildPeerSnapshot();
        const msg = {
            type: 'peer-list',
            peers: list,
            myId: this.userId,
            username: this.username,
            color: this.userColor,
            position: this.getMyPosition(),
            snapshot: snapshot
        };
        const bytes = this.measureBytes(msg);
        for (const [, entry] of this.peers) {
            if (entry.connected && entry.conn) {
                try {
                    entry.conn.send(msg);
                    this.sentBytes += bytes;
                    this.sentCount++;
                    this.updateDebugPanel();
                } catch { }
            }
        }
    }

    handlePeerList(data) {
        const msgPeers = data.peers;
        const myKnown = new Set(this.peers.keys());
        let changed = false;

        for (const peerId of msgPeers) {
            if (peerId === this.userId) continue;
            if (!myKnown.has(peerId)) {
                this.connectToPeer(peerId);
                changed = true;
            }
        }

        if (isOnlineMode && data.snapshot) {
            for (const [peerId, peerInfo] of Object.entries(data.snapshot)) {
                if (peerId === this.userId) continue;
                const existing = this.peerData.get(peerId);
                if (peerInfo.position) {
                    this._updatePeerPosition(peerId, peerInfo.position, peerInfo.username, peerInfo.color, peerInfo.position.speed);
                } else if (existing && existing.position) {
                    this.peerData.set(peerId, { ...peerInfo, position: existing.position, velocity: existing.velocity, lastUpdateTime: existing.lastUpdateTime });
                } else {
                    this.peerData.set(peerId, peerInfo);
                }
            }
            this.renderer.updateOrbs();
            this.updateTeleportButton();
        }

        if (changed) {
            this.broadcastPeerList();
        }
    }

    handlePositionUpdate(data) {
        if (data.myId && isOnlineMode) {
            this._updatePeerPosition(data.myId, data.position, data.username, data.color, data.position ? data.position.speed : 0);
            this.renderer.updateOrbs();
            this.updateTeleportButton();
        }
    }

    _updatePeerPosition(peerId, position, username, color, speed) {
        if (!position) return;
        const existing = this.peerData.get(peerId);
        const now = performance.now();
        let velocity = { x: 0, y: 0, z: 0 };
        if (existing && existing.position && existing.lastUpdateTime) {
            const dt = Math.max((now - existing.lastUpdateTime) / 1000, 0.016);
            velocity.x = (position.x - existing.position.x) / dt;
            velocity.y = (position.y - existing.position.y) / dt;
            velocity.z = (position.z - existing.position.z) / dt;
            const mag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
            const maxSpeed = Math.max(speed || 3, 15);
            if (mag > maxSpeed) {
                const s = maxSpeed / mag;
                velocity.x *= s;
                velocity.y *= s;
                velocity.z *= s;
            }
        }
        this.peerData.set(peerId, {
            username,
            color,
            position,
            velocity,
            lastUpdateTime: now
        });
    }

    handleDisconnect(data) {
        const peerId = data.myId;
        if (!peerId) return;
        this.peers.delete(peerId);
        this.peerData.delete(peerId);
        this.persistPeers();
        this.updateDisplay();
        this.broadcastPeerList();
        if (isOnlineMode) {
            this.renderer.updateOrbs();
            this.updateTeleportButton();
        }
    }

    startGossipTimer() {
        if (this.gossipTimer) clearInterval(this.gossipTimer);
        this.gossipTimer = setInterval(() => {
            if (this.sceneManager) {
                const activeScene = this.sceneManager.getActiveScene();
                this.renderer.refreshOrbParent(activeScene);
            }
            this.updateNameDisplay();
            this.updatePosDisplay();
            this.broadcastPeerList();
        }, this.GOSSIP_INTERVAL);
    }

    stopGossipTimer() {
        if (this.gossipTimer) {
            clearInterval(this.gossipTimer);
            this.gossipTimer = null;
        }
    }

    animateOrbs(dt) {
        this.renderer.animateOrbs(dt);
    }

    animateArrows(dt) {
        this.renderer.animateArrows(dt);
    }

    connectPeerJS() {
        const savedId = loadUserId();
        this.peer = new Peer(savedId || null, {
            debug: 0
        });

        this.peer.on('open', (id) => {
            this.userId = id;
            console.log(`[webrtc] connected as ${id}`);
            saveUserId(id);
            this.updateIdDisplay();
            this.updateNameDisplay();
            this.updateDisplay();
            this.startGossipTimer();

            if (this.pendingJoinId && this.pendingJoinId !== this.userId) {
                console.log(`[webrtc] auto-joining session ${this.pendingJoinId}`);
                this.connectToPeer(this.pendingJoinId);
                this.pendingJoinId = null;
            }

            if (savedId && this.savedPeerIds.length > 0) {
                console.log(`[webrtc] attempting to reconnect to ${this.savedPeerIds.length} saved peer(s)`);
                for (const peerId of this.savedPeerIds) {
                    if (peerId !== this.userId) {
                        this.connectToPeer(peerId);
                    }
                }
            }
        });

        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.warn('[webrtc] peer error:', err.type);
            if (err.type === 'unavailable' && savedId) {
                console.log('[webrtc] saved ID unavailable, generating new one');
                localStorage.removeItem(STORAGE_KEY_ID);
                this.peer.destroy();
                this.connectPeerJS();
            } else if (err.type === 'unavailable') {
                setTimeout(() => this.connectPeerJS(), 500);
            }
        });

        this.peer.on('disconnected', () => {
            console.log('[webrtc] disconnected, reconnecting...');
            setTimeout(() => this.peer.reconnect(), 3000);
        });
    }

    handleIncomingConnection(conn) {
        if (this.peers.has(conn.peer)) return;

        const entry = { conn, peerId: conn.peer, connected: false };
        this.peers.set(conn.peer, entry);

        conn.on('open', () => {
            entry.connected = true;
            this.persistPeers();
            this.updateDisplay();
            this.sendSnapshotToPeer(conn);
            this.broadcastPeerList();
        });

        this.attachDataHandler(conn, entry);

        conn.on('close', () => {
            entry.connected = false;
            this.peers.delete(conn.peer);
            this.peerData.delete(conn.peer);
            if (!this.isDestroying) {
                this.persistPeers();
                this.updateDisplay();
                this.broadcastPeerList();
                if (isOnlineMode) {
                    this.renderer.updateOrbs();
                    this.updateTeleportButton();
                }
            }
        });

        conn.on('error', () => {
            entry.connected = false;
            this.peers.delete(conn.peer);
            this.peerData.delete(conn.peer);
            if (!this.isDestroying) {
                this.persistPeers();
                this.updateDisplay();
                this.broadcastPeerList();
                if (isOnlineMode) {
                    this.renderer.updateOrbs();
                    this.updateTeleportButton();
                }
            }
        });
    }

    attachDataHandler(conn, entry) {
        conn.on('data', (data) => {
            const bytes = this.measureBytes(data);
            this.receivedBytes += bytes;
            this.receivedCount++;
            this.updateDebugPanel();
            if (data.type === 'ping') {
                const pong = { type: 'pong' };
                conn.send(pong);
                this.sentBytes += this.measureBytes(pong);
                this.sentCount++;
                this.updateDebugPanel();
            }
            if (data.type === 'peer-list') {
                this.handlePeerList(data);
            }
            if (data.type === 'position-update') {
                this.handlePositionUpdate(data);
            }
            if (data.type === 'disconnect') {
                this.handleDisconnect(data);
            }
        });
    }

    connectToPeer(remoteId, attempt = 1, maxAttempts = 3) {
        if (!this.peer || this.peers.has(remoteId)) return;

        const conn = this.peer.connect(remoteId, {
            reliable: true
        });

        const entry = { conn, peerId: remoteId, connected: false };
        this.peers.set(remoteId, entry);

        conn.on('open', () => {
            entry.connected = true;
            this.persistPeers();
            this.updateDisplay();
            this.sendSnapshotToPeer(conn);
            this.broadcastPeerList();
        });

        this.attachDataHandler(conn, entry);

        const cleanup = () => {
            entry.connected = false;
            this.peers.delete(remoteId);
            this.peerData.delete(remoteId);
            if (!this.isDestroying) {
                this.persistPeers();
                this.updateDisplay();
                this.broadcastPeerList();
                if (isOnlineMode) this.renderer.updateOrbs();
            }
        };

        conn.on('close', () => {
            cleanup();
        });

        conn.on('error', () => {
            cleanup();
            if (attempt < maxAttempts) {
                console.log(`[webrtc] connect to ${remoteId} failed, retry ${attempt + 1}/${maxAttempts}`);
                setTimeout(() => this.connectToPeer(remoteId, attempt + 1, maxAttempts), 1000);
            }
        });
    }

    teleportToRandomPeer() {
        if (!this.camera || !isOnlineMode) return;
        const peerEntries = Array.from(this.peerData.entries());
        if (peerEntries.length === 0) return;
        let peerIdx = Math.floor(Math.random() * peerEntries.length);
        const [peerId, data] = peerEntries[peerIdx];
        if (!data.position) return;
        this.placeCameraNearTarget(data.position, data.username, data.color, peerId);
        this.broadcastPeerList();
    }

    teleportToPeer(peerData, peerId) {
        if (!this.camera || !peerData.position) return;
        this.placeCameraNearTarget(peerData.position, peerData.username, peerData.color, peerId);
        this.broadcastPeerList();
    }

    startFollowing(peerId, peerData) {
        this.followTarget = peerData;
        this.followTargetId = peerId;
        if (this.animationLoop) this.animationLoop.pauseForTeleport(2);
    }

    stopFollowing() {
        this.followTarget = null;
        this.followTargetId = null;
    }

    placeCameraNearTarget(pos, username, color, peerId) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 6;
        const height = 3 + Math.random() * 4;
        this.camera.position.set(
            pos.x + Math.cos(angle) * distance,
            pos.y + height,
            pos.z + Math.sin(angle) * distance
        );
        this.camera.lookAt(pos.x, pos.y, pos.z);
        if (this.animationLoop) this.animationLoop.pauseForTeleport(2);
        showToast(`Teleported to and following ${username}`, color, () => {
            const data = this.peerData.get(peerId);
            if (data && data.position) {
                this.startFollowing(peerId, data);
                //showToast(`Following ${username}`, color);
            }
        });
    }

    updateTeleportButton() {
        const btn = this.el ? this.el.querySelector('#teleport-btn') : null;
        if (!btn) return;
        if (this.peerData.size > 0) {
            btn.disabled = false;
            btn.style.opacity = '1';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.15';
        }
    }

    destroy() {
        this.stopGossipTimer();
        this.persistPeers();
        this.isDestroying = true;
        for (const [, entry] of this.peers) {
            if (entry.conn) entry.conn.close();
        }
        this.peers.clear();
        this.peerData.clear();
        this.renderer.destroy();
        if (this.peer) this.peer.destroy();
        if (this.el) this.el.remove();
        const debugEl = document.getElementById('webrtc-debug');
        if (debugEl) debugEl.remove();
    }
}
