const STORAGE_KEY_ID = 'webrtc-user-id';
const STORAGE_KEY_PEERS = 'webrtc-peer-list';

function saveUserId(id) {
    try {
        localStorage.setItem(STORAGE_KEY_ID, id);
    } catch { }
}

function loadUserId() {
    try {
        return localStorage.getItem(STORAGE_KEY_ID);
    } catch {
        return null;
    }
}

function savePeerList(ids) {
    try {
        localStorage.setItem(STORAGE_KEY_PEERS, JSON.stringify(ids));
    } catch { }
}

function loadPeerList() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PEERS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export class WebRTCManager {
    constructor() {
        this.peers = new Map();
        this.userId = null;
        this.el = null;
        this.peer = null;
        this.inputEl = null;
        this.savedPeerIds = loadPeerList();
        this.gossipTimer = null;
        this.GOSSIP_INTERVAL = 5000;
    }

    init() {
        this.el = this.createUI();
        this.connectPeerJS();
    }

    createUI() {
        const container = document.createElement('div');
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
            padding: 12px 16px;
            border-radius: 6px;
            border: 1px solid rgba(0, 204, 255, 0.15);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            pointer-events: auto;
            z-index: 99990;
            user-select: none;
            line-height: 1.6;
            max-width: 280px;
        `;

        const countEl = document.createElement('div');
        countEl.id = 'webrtc-count';
        countEl.innerHTML = `ONLINE: <span style="color: #00ccff; font-weight: bold;">1</span>`;
        container.appendChild(countEl);

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
        container.appendChild(idRow);

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
        container.appendChild(inputRow);

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

    broadcastPeerList() {
        const list = this.getMyPeerList();
        const msg = { type: 'peer-list', peers: list };
        for (const [, entry] of this.peers) {
            if (entry.connected && entry.conn) {
                try {
                    entry.conn.send(msg);
                } catch { }
            }
        }
    }

    handlePeerList(msgPeers) {
        const myKnown = new Set(this.peers.keys());
        let changed = false;
        for (const peerId of msgPeers) {
            if (peerId === this.userId) continue;
            if (!myKnown.has(peerId)) {
                this.connectToPeer(peerId);
                changed = true;
            }
        }
        if (changed) {
            this.broadcastPeerList();
        }
    }

    startGossipTimer() {
        if (this.gossipTimer) clearInterval(this.gossipTimer);
        this.gossipTimer = setInterval(() => {
            this.broadcastPeerList();
        }, this.GOSSIP_INTERVAL);
    }

    stopGossipTimer() {
        if (this.gossipTimer) {
            clearInterval(this.gossipTimer);
            this.gossipTimer = null;
        }
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
            this.updateDisplay();
            this.startGossipTimer();

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
                setTimeout(() => this.connectPeerJS(), 5000);
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
            this.broadcastPeerList();
        });

        conn.on('data', (data) => {
            if (data.type === 'ping') {
                conn.send({ type: 'pong' });
            }
            if (data.type === 'peer-list') {
                this.handlePeerList(data.peers);
            }
        });

        conn.on('close', () => {
            entry.connected = false;
            this.peers.delete(conn.peer);
            this.persistPeers();
            this.updateDisplay();
            this.broadcastPeerList();
        });

        conn.on('error', () => {
            entry.connected = false;
            this.peers.delete(conn.peer);
            this.persistPeers();
            this.updateDisplay();
            this.broadcastPeerList();
        });
    }

    connectToPeer(remoteId) {
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
            this.broadcastPeerList();
        });

        conn.on('close', () => {
            entry.connected = false;
            this.peers.delete(remoteId);
            this.persistPeers();
            this.updateDisplay();
            this.broadcastPeerList();
        });

        conn.on('error', () => {
            entry.connected = false;
            this.peers.delete(remoteId);
            this.persistPeers();
            this.updateDisplay();
            this.broadcastPeerList();
        });
    }

    destroy() {
        this.stopGossipTimer();
        for (const [, entry] of this.peers) {
            if (entry.conn) entry.conn.close();
        }
        this.peers.clear();
        if (this.peer) this.peer.destroy();
        if (this.el) this.el.remove();
    }
}