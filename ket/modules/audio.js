import {
    TOOLTIP_Z_INDEX, AUDIO_BUTTON_FONT_SIZE, AUDIO_BUTTON_MARGIN_LEFT,
    AUDIO_BUTTON_PADDING, AUDIO_BUTTON_BORDER_RADIUS, AUDIO_BUTTON_POSITION_OFFSET,
    AUDIO_INITIAL_VOLUME, SPLASH_EXIT_DELAY_MS,
} from './utils.js';

let audioElement = null;
let audioMuted = true;
let audioStarted = false;
let audioBtnEl = null;

export function initAudio(splashEl, splashSub) {
    audioElement = new Audio('./lights.mp3');
    audioElement.loop = true;
    audioElement.volume = AUDIO_INITIAL_VOLUME;

    audioBtnEl = document.createElement('button');
    audioBtnEl.innerText = '🔇';
    audioBtnEl.classList = 'gui';
    Object.assign(audioBtnEl.style, {
        background: 'transparent', border: 'none', color: '#fff', fontSize: AUDIO_BUTTON_FONT_SIZE,
        cursor: 'pointer', marginLeft: AUDIO_BUTTON_MARGIN_LEFT, padding: AUDIO_BUTTON_PADDING,
        borderRadius: AUDIO_BUTTON_BORDER_RADIUS, top: AUDIO_BUTTON_POSITION_OFFSET,
        left: AUDIO_BUTTON_POSITION_OFFSET, position: 'fixed', zIndex: TOOLTIP_Z_INDEX
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
        setTimeout(() => { splashEl.style.display = 'none'; }, SPLASH_EXIT_DELAY_MS);
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
