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

        // Layered oscillators for a thicker, more impactful alert
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        const toneGain = context.createGain();
        const masterGain = context.createGain();
        const filter = context.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        // start frequencies and a short sweep down for a punchy impact
        osc1.frequency.setValueAtTime(780, now);
        osc1.frequency.exponentialRampToValueAtTime(420, now + 0.12);

        osc2.frequency.setValueAtTime(920, now);
        osc2.frequency.exponentialRampToValueAtTime(520, now + 0.12);
        osc2.detune.setValueAtTime(-8, now);

        // tone envelope
        toneGain.gain.setValueAtTime(0.0001, now);
        toneGain.gain.exponentialRampToValueAtTime(0.65, now + 0.02);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

        // gentle lowpass to round the edges and emphasize punch
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3600, now);
        filter.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

        // master gain to avoid clipping and allow final shaping
        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.exponentialRampToValueAtTime(1.0, now + 0.005);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

        osc1.connect(toneGain);
        osc2.connect(toneGain);
        toneGain.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(context.destination);

        const stopTime = now + 0.38;
        osc1.start(now);
        osc2.start(now);
        osc1.stop(stopTime);
        osc2.stop(stopTime);
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