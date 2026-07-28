let audioElement = null;
let audioMuted = true;
let audioStarted = false;
let audioBtnEl = null;

export function initAudio(splashEl, splashSub) {
    audioElement = new Audio('./lights.mp3');
    audioElement.loop = true;
    audioElement.volume = 0.5;

    audioBtnEl = document.createElement('button');
    audioBtnEl.innerText = '🔇';
    audioBtnEl.classList = 'gui';
    Object.assign(audioBtnEl.style, {
        background: 'transparent', border: 'none', color: '#fff', fontSize: '16px',
        cursor: 'pointer', marginLeft: '8px', padding: '2px 6px', borderRadius: '4px',
        top: '10px', left: '10px', position: 'fixed', zIndex: '99999'
    });
    audioBtnEl.addEventListener('click', toggleAudio);
    document.body.appendChild(audioBtnEl);

    splashEl.addEventListener('click', () => enterScene(splashEl, splashSub));
    splashEl.addEventListener('touchend', (e) => { e.preventDefault(); enterScene(splashEl, splashSub); });
}

function enterScene(splashEl, splashSub) {
    if (audioStarted) return;

    splashSub.textContent = 'LOADING...';
    splashSub.style.animation = 'none';

    attemptAutoplay(() => {
        splashEl.classList.add('exit');
        setTimeout(() => { splashEl.style.display = 'none'; }, 2000);
        if (onSceneReady) onSceneReady();
    });
}

let onSceneReady = null;

export function setSceneReadyCallback(fn) {
    onSceneReady = fn;
}

function attemptAutoplay(exitAfter) {
    audioElement.play().then(() => {
        if (audioMuted) {
            audioElement.pause();
        }
        audioStarted = true;
        updateAudioButton();
        exitAfter();
    }).catch(() => {
        audioMuted = true;
        exitAfter();
        document.addEventListener('click', () => {
            if (audioMuted) {
                audioElement.play().then(() => {
                    audioMuted = false;
                    audioStarted = true;
                    updateAudioButton();
                }).catch(() => { });
            }
        }, { once: true });
    });
}

function toggleAudio() {
    if (!audioStarted || audioMuted) {
        audioElement.play().then(() => {
            audioMuted = false;
            audioStarted = true;
            updateAudioButton();
        }).catch(() => { });
    } else {
        audioElement.pause();
        audioMuted = true;
        updateAudioButton();
    }
}

function updateAudioButton() {
    if (audioBtnEl) {
        audioBtnEl.innerText = audioStarted && !audioMuted ? '🔊' : '🔇';
    }
}

export function getAudioStarted() { return audioStarted; }
export function getAudioMuted() { return audioMuted; }
