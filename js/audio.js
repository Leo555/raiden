// audio.js - Procedural audio using Web Audio API (Enhanced)

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.musicGain = null;
        this.sfxGain = null;
        this.musicPlaying = false;
        this.musicNodes = [];
        this.musicType = 'none'; // 'none', 'menu', 'battle', 'boss'
        this.musicLoopTimeout = null;
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.25;
            this.musicGain.connect(this.ctx.destination);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.4;
            this.sfxGain.connect(this.ctx.destination);
        } catch (e) {
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ==============================
    // SOUND EFFECTS
    // ==============================

    playShoot() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playExplosion(size = 1) {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const duration = 0.3 + size * 0.15;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Layered noise with resonance
        for (let i = 0; i < bufferSize; i++) {
            const progress = i / bufferSize;
            const envelope = Math.pow(1 - progress, 1.8);
            // Low rumble + noise
            const noise = (Math.random() * 2 - 1);
            const rumble = Math.sin(i / this.ctx.sampleRate * 80 * (1 - progress * 0.7)) * 0.5;
            data[i] = (noise * 0.6 + rumble * 0.4) * envelope;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35 * Math.min(size, 2), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600 + 400 * size, t);
        filter.frequency.exponentialRampToValueAtTime(80, t + duration);
        filter.Q.value = 2;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        source.start();
    }

    playPowerup() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc2.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
        osc2.frequency.setValueAtTime(600, t + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(1600, t + 0.18);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.2);
        osc2.start(t + 0.05);
        osc2.stop(t + 0.25);
    }

    playBomb() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 1.2);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const time = i / this.ctx.sampleRate;
            const envelope = Math.pow(1 - i / bufferSize, 1.3);
            data[i] = (Math.random() * 2 - 1) * envelope *
                      (Math.sin(time * 40 * (1 - time * 0.5)) * 0.4 + 0.6);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        source.connect(gain);
        gain.connect(this.sfxGain);
        source.start();
    }

    playBossAlert() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, t + i * 0.3);
            osc.frequency.exponentialRampToValueAtTime(100, t + i * 0.3 + 0.2);
            gain.gain.setValueAtTime(0, t + i * 0.3);
            gain.gain.linearRampToValueAtTime(0.3, t + i * 0.3 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.3 + 0.25);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t + i * 0.3);
            osc.stop(t + i * 0.3 + 0.25);
        }
    }

    playHit() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // --- New SFX ---

    /** Combo multiplier increase - ascending arpeggio */
    playComboUp() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t + i * 0.06);
            gain.gain.linearRampToValueAtTime(0.18, t + i * 0.06 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t + i * 0.06);
            osc.stop(t + i * 0.06 + 0.15);
        });
    }

    /** Combo break - descending tone */
    playComboBreak() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    /** Graze - short crisp ding */
    playGraze() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc2.type = 'sine';
        osc.frequency.value = 2400;
        osc2.frequency.value = 3600;
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
        osc2.start(t);
        osc2.stop(t + 0.06);
    }

    /** Level/weapon upgrade sound */
    playLevelUp() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4-E5 arpeggio
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t + i * 0.07);
            gain.gain.linearRampToValueAtTime(0.15, t + i * 0.07 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.2);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t + i * 0.07);
            osc.stop(t + i * 0.07 + 0.2);
        });
    }

    /** Coin pickup - bright double ding */
    playCoin() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = 1318.5; // E6
        osc2.frequency.value = 1760;   // A6
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        osc1.start(t);
        osc1.stop(t + 0.08);
        osc2.start(t + 0.06);
        osc2.stop(t + 0.15);
    }

    // ==============================
    // MUSIC SYSTEM
    // ==============================

    startMusic() {
        if (!this.enabled || !this.ctx) return;
        this._stopMusicInternal();
        this.musicPlaying = true;
        this.musicType = 'battle';
        this._playBattleLoop();
    }

    playMenuMusic() {
        if (!this.enabled || !this.ctx) return;
        this._stopMusicInternal();
        this.musicPlaying = true;
        this.musicType = 'menu';
        this._playMenuLoop();
    }

    playBossMusic() {
        if (!this.enabled || !this.ctx) return;
        this._stopMusicInternal();
        this.musicPlaying = true;
        this.musicType = 'boss';
        this._playBossLoop();
    }

    stopMusic() {
        this._stopMusicInternal();
    }

    _stopMusicInternal() {
        this.musicPlaying = false;
        this.musicType = 'none';
        if (this.musicLoopTimeout) {
            clearTimeout(this.musicLoopTimeout);
            this.musicLoopTimeout = null;
        }
        this.musicNodes.forEach(n => {
            try { n.stop(); } catch(e) {}
        });
        this.musicNodes = [];
    }

    // --- MENU MUSIC ---
    _playMenuLoop() {
        if (!this.musicPlaying || this.musicType !== 'menu' || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bpm = 70;
        const beatDur = 60 / bpm;
        const barDur = beatDur * 8;

        // Ambient pad (slow evolving chord)
        const padNotes = [65.41, 98.00, 130.81, 196.00]; // C2, G2, C3, G3
        padNotes.forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            // Slow fade in and sustain
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.06, t + barDur * 0.3);
            gain.gain.setValueAtTime(0.06, t + barDur * 0.7);
            gain.gain.linearRampToValueAtTime(0, t + barDur);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(t);
            osc.stop(t + barDur + 0.1);
            this.musicNodes.push(osc);
        });

        // Slow arpeggio (sci-fi feel)
        const arpNotes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 196.00];
        arpNotes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const noteStart = t + i * beatDur;
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.07, noteStart + 0.05);
            gain.gain.setValueAtTime(0.07, noteStart + beatDur * 0.4);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + beatDur * 0.9);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + beatDur);
            this.musicNodes.push(osc);
        });

        // Bass drone
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.value = 55; // A1
        bassGain.gain.setValueAtTime(0.04, t);
        const bassFilter = this.ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.value = 200;
        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.musicGain);
        bassOsc.start(t);
        bassOsc.stop(t + barDur + 0.1);
        this.musicNodes.push(bassOsc);

        // Schedule next
        this.musicLoopTimeout = setTimeout(() => {
            if (this.musicPlaying && this.musicType === 'menu') this._playMenuLoop();
        }, barDur * 1000 - 50);
    }

    // --- BATTLE MUSIC ---
    _playBattleLoop() {
        if (!this.musicPlaying || this.musicType !== 'battle' || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bpm = 150;
        const beatDur = 60 / bpm;
        const barDur = beatDur * 16; // 4 bars of 4 beats = 16 beats total

        // --- KICK DRUM (on beats 1,5,9,13) ---
        const kickBeats = [0, 4, 8, 12];
        kickBeats.forEach(beat => {
            const kickStart = t + beat * beatDur;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, kickStart);
            osc.frequency.exponentialRampToValueAtTime(40, kickStart + 0.1);
            gain.gain.setValueAtTime(0.25, kickStart);
            gain.gain.exponentialRampToValueAtTime(0.001, kickStart + 0.15);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(kickStart);
            osc.stop(kickStart + 0.15);
            this.musicNodes.push(osc);
        });

        // --- HI-HAT (eighth notes) ---
        for (let i = 0; i < 32; i++) {
            const hatStart = t + i * beatDur / 2;
            const bufSize = Math.floor(this.ctx.sampleRate * 0.04);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 10);
            }
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const gain = this.ctx.createGain();
            gain.gain.value = i % 2 === 0 ? 0.07 : 0.035;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 8000;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            src.start(hatStart);
            this.musicNodes.push(src);
        }

        // --- SNARE (on beats 3,7,11,15) ---
        const snareBeats = [2, 6, 10, 14];
        snareBeats.forEach(beat => {
            const snareStart = t + beat * beatDur;
            const bufSize = Math.floor(this.ctx.sampleRate * 0.1);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                const env = Math.pow(1 - j / bufSize, 3);
                d[j] = (Math.random() * 2 - 1) * env;
            }
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.12;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 3000;
            filter.Q.value = 1;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            src.start(snareStart);
            this.musicNodes.push(src);
        });

        // --- BASS LINE (16 eighth notes, 2 notes per beat) ---
        // Pattern: A2-A2-C3-C3-D3-D3-E3-E3 | A2-A2-C3-C3-D3-E3-D3-C3
        const bassPattern = [
            110, 110, 130.81, 130.81, 146.83, 146.83, 164.81, 164.81,
            110, 110, 130.81, 130.81, 146.83, 164.81, 146.83, 130.81
        ];
        bassPattern.forEach((freq, i) => {
            const noteStart = t + i * beatDur;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.12, noteStart);
            gain.gain.setValueAtTime(0.12, noteStart + beatDur * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStart + beatDur * 0.9);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + beatDur * 0.95);
            this.musicNodes.push(osc);
        });

        // --- MELODY LINE (synth lead) ---
        // 8-bar melody using pentatonic scale
        const melodyNotes = [
            // Bar 1-2
            { freq: 440, start: 0, dur: 1 },
            { freq: 523.25, start: 1, dur: 1 },
            { freq: 587.33, start: 2, dur: 0.5 },
            { freq: 659.25, start: 2.5, dur: 1.5 },
            // Bar 3-4
            { freq: 587.33, start: 4, dur: 1 },
            { freq: 523.25, start: 5, dur: 0.5 },
            { freq: 440, start: 5.5, dur: 0.5 },
            { freq: 392, start: 6, dur: 2 },
            // Bar 5-6
            { freq: 440, start: 8, dur: 0.5 },
            { freq: 523.25, start: 8.5, dur: 0.5 },
            { freq: 659.25, start: 9, dur: 1 },
            { freq: 783.99, start: 10, dur: 1 },
            { freq: 659.25, start: 11, dur: 1 },
            // Bar 7-8
            { freq: 587.33, start: 12, dur: 1 },
            { freq: 523.25, start: 13, dur: 1 },
            { freq: 440, start: 14, dur: 2 },
        ];
        melodyNotes.forEach(note => {
            const noteStart = t + note.start * beatDur;
            const noteDur = note.dur * beatDur;
            const osc = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc2.type = 'sawtooth';
            osc.frequency.value = note.freq;
            osc2.frequency.value = note.freq * 1.003; // Slight detune for thickness
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.06, noteStart + 0.02);
            gain.gain.setValueAtTime(0.06, noteStart + noteDur * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDur);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3000, noteStart);
            filter.frequency.exponentialRampToValueAtTime(800, noteStart + noteDur);
            osc.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + noteDur + 0.01);
            osc2.start(noteStart);
            osc2.stop(noteStart + noteDur + 0.01);
            this.musicNodes.push(osc);
            this.musicNodes.push(osc2);
        });

        // Schedule next loop
        this.musicLoopTimeout = setTimeout(() => {
            if (this.musicPlaying && this.musicType === 'battle') this._playBattleLoop();
        }, barDur * 1000 - 50);
    }

    // --- BOSS MUSIC ---
    _playBossLoop() {
        if (!this.musicPlaying || this.musicType !== 'boss' || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bpm = 170;
        const beatDur = 60 / bpm;
        const barDur = beatDur * 16;

        // --- HEAVY KICK (every beat) ---
        for (let i = 0; i < 16; i++) {
            if (i % 2 === 0 || i % 4 === 3) { // Syncopated kick
                const kickStart = t + i * beatDur;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(180, kickStart);
                osc.frequency.exponentialRampToValueAtTime(35, kickStart + 0.12);
                gain.gain.setValueAtTime(0.3, kickStart);
                gain.gain.exponentialRampToValueAtTime(0.001, kickStart + 0.15);
                osc.connect(gain);
                gain.connect(this.musicGain);
                osc.start(kickStart);
                osc.stop(kickStart + 0.15);
                this.musicNodes.push(osc);
            }
        }

        // --- AGGRESSIVE HI-HAT (16th notes) ---
        for (let i = 0; i < 64; i++) {
            const hatStart = t + i * beatDur / 4;
            const bufSize = Math.floor(this.ctx.sampleRate * 0.03);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 12);
            }
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const gain = this.ctx.createGain();
            gain.gain.value = i % 4 === 0 ? 0.08 : 0.03;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 9000;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            src.start(hatStart);
            this.musicNodes.push(src);
        }

        // --- HEAVY BASS (chromatic tension) ---
        const bossBass = [
            82.41, 82.41, 87.31, 87.31, 82.41, 82.41, 77.78, 77.78,
            82.41, 82.41, 87.31, 92.50, 87.31, 82.41, 77.78, 73.42
        ];
        bossBass.forEach((freq, i) => {
            const noteStart = t + i * beatDur;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.02, noteStart + beatDur * 0.85);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, noteStart);
            filter.frequency.exponentialRampToValueAtTime(200, noteStart + beatDur);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + beatDur * 0.9);
            this.musicNodes.push(osc);
        });

        // --- AGGRESSIVE SYNTH STABS ---
        const stabPattern = [
            { beat: 0, freq: 329.63, dur: 0.5 },
            { beat: 0.5, freq: 311.13, dur: 0.5 },
            { beat: 2, freq: 329.63, dur: 0.5 },
            { beat: 3, freq: 349.23, dur: 1 },
            { beat: 4, freq: 329.63, dur: 0.5 },
            { beat: 4.5, freq: 293.66, dur: 0.5 },
            { beat: 6, freq: 329.63, dur: 1 },
            { beat: 7, freq: 311.13, dur: 1 },
            { beat: 8, freq: 329.63, dur: 0.5 },
            { beat: 8.5, freq: 349.23, dur: 0.5 },
            { beat: 10, freq: 392.00, dur: 1 },
            { beat: 11, freq: 349.23, dur: 1 },
            { beat: 12, freq: 329.63, dur: 1 },
            { beat: 13, freq: 311.13, dur: 1 },
            { beat: 14, freq: 293.66, dur: 2 },
        ];
        stabPattern.forEach(stab => {
            const noteStart = t + stab.beat * beatDur;
            const noteDur = stab.dur * beatDur;
            const osc = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc2.type = 'square';
            osc.frequency.value = stab.freq;
            osc2.frequency.value = stab.freq * 2.01;
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.07, noteStart + 0.01);
            gain.gain.setValueAtTime(0.07, noteStart + noteDur * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDur);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(4000, noteStart);
            filter.frequency.exponentialRampToValueAtTime(600, noteStart + noteDur);
            filter.Q.value = 3;
            osc.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + noteDur + 0.01);
            osc2.start(noteStart);
            osc2.stop(noteStart + noteDur + 0.01);
            this.musicNodes.push(osc);
            this.musicNodes.push(osc2);
        });

        // Schedule next loop
        this.musicLoopTimeout = setTimeout(() => {
            if (this.musicPlaying && this.musicType === 'boss') this._playBossLoop();
        }, barDur * 1000 - 50);
    }
}
