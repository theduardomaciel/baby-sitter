(() => {
    const config = window.BABY_SITTER_CONFIG || {};
    const motionEventsUrl = config.motionEventsUrl || '/motion-events';
    const motionSoundIntervalMs = Number(config.motionSoundIntervalMs || 1200);
    const storageKey = 'baby_sitter_sound_enabled';

    const overlay = document.getElementById('motion-overlay');
    const status = document.getElementById('status');
    const soundToggle = document.getElementById('sound-toggle');

    let soundEnabled = localStorage.getItem(storageKey) !== 'false';
    let audioContext = null;
    let motionActive = false;
    let soundIntervalId = null;
    let vibrationIntervalId = null;
    let audioUnlocked = false;

    function setSoundButtonState() {
        soundToggle.classList.toggle('active', soundEnabled);
        soundToggle.textContent = soundEnabled ? 'Som: ligado' : 'Som: desligado';
    }

    function ensureAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        return audioContext;
    }

    function unlockAudioIfNeeded() {
        if (audioUnlocked || !soundEnabled) {
            return;
        }

        audioUnlocked = true;
        ensureAudioContext();

        if (motionActive) {
            startSoundLoop();
        }
    }

    function playMotionAlert() {
        if (!soundEnabled) {
            return;
        }

        const context = ensureAudioContext();
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(920, now);
        oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.14);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }

    function stopSoundLoop() {
        if (soundIntervalId !== null) {
            clearInterval(soundIntervalId);
            soundIntervalId = null;
        }
    }

    function stopVibrationLoop() {
        if (vibrationIntervalId !== null) {
            clearInterval(vibrationIntervalId);
            vibrationIntervalId = null;
        }

        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
    }

    // stronger vibration pattern: three short pulses then a pause
    const VIBRATION_PATTERN = [120, 60, 120];

    function startVibrationLoop() {
        if (!motionActive || !navigator.vibrate) {
            return;
        }

        stopVibrationLoop();
        navigator.vibrate(VIBRATION_PATTERN);
        vibrationIntervalId = window.setInterval(() => {
            if (motionActive) {
                navigator.vibrate(VIBRATION_PATTERN);
            }
        }, motionSoundIntervalMs);
    }

    function startSoundLoop() {
        if (!soundEnabled || !motionActive) {
            return;
        }

        stopSoundLoop();
        playMotionAlert();
        soundIntervalId = window.setInterval(() => {
            if (motionActive && soundEnabled) {
                playMotionAlert();
            }
        }, motionSoundIntervalMs);
    }

    function updateMotionState(active) {
        if (motionActive === active) {
            return;
        }

        motionActive = active;
        overlay.classList.toggle('active', active);
        status.classList.toggle('active', active);
        status.textContent = active ? 'Movimento detectado' : 'Aguardando movimento';

        if (active) {
            startSoundLoop();
            startVibrationLoop();
            return;
        }

        stopSoundLoop();
        stopVibrationLoop();
    }

    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem(storageKey, String(soundEnabled));
        setSoundButtonState();

        if (soundEnabled && motionActive) {
            unlockAudioIfNeeded();
            startSoundLoop();
            return;
        }

        stopSoundLoop();
    });

    document.addEventListener('pointerdown', unlockAudioIfNeeded, { once: true, passive: true });
    document.addEventListener('keydown', unlockAudioIfNeeded, { once: true });
    document.addEventListener('touchstart', unlockAudioIfNeeded, { once: true, passive: true });

    setSoundButtonState();

    const source = new EventSource(motionEventsUrl);

    source.addEventListener('open', () => {
        status.textContent = 'Aguardando movimento';
    });

    source.addEventListener('motion', (event) => {
        const payload = JSON.parse(event.data);
        updateMotionState(Boolean(payload.active));
    });

    source.addEventListener('error', () => {
        stopSoundLoop();
        stopVibrationLoop();
        motionActive = false;
        overlay.classList.remove('active');
        status.classList.remove('active');
        status.textContent = 'Câmera indisponível';
    });
})();