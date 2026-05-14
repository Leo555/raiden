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

    /**
     * Schedule the next loop iteration with a small lookahead so the new loop's
     * nodes are created and started slightly before the current loop ends.
     * This eliminates the audible gap/click between iterations.
     */
    _scheduleNextLoop(loopDurSec, type, fn) {
        const lookaheadMs = 200;
        const delayMs = Math.max(10, loopDurSec * 1000 - lookaheadMs);
        this.musicLoopTimeout = setTimeout(() => {
            if (this.musicPlaying && this.musicType === type) fn.call(this);
        }, delayMs);
    }

    // --- MENU MUSIC ---
    // Calm, atmospheric ambient track that loops every 16 beats (~13.7s @70bpm).
    _playMenuLoop() {
        if (!this.musicPlaying || this.musicType !== 'menu' || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bpm = 70;
        const beatDur = 60 / bpm;
        const loopDur = beatDur * 16; // ~13.7s
        const ctx = this.ctx;

        // ---- Ambient pad (long sustained chord, slow swell) ----
        // C minor 9 voicing: C3 Eb3 G3 Bb3 D4
        const padNotes = [130.81, 155.56, 196.00, 233.08, 293.66];
        padNotes.forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            // Gentle swell across the loop
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.04, t + loopDur * 0.25);
            gain.gain.linearRampToValueAtTime(0.05, t + loopDur * 0.6);
            gain.gain.linearRampToValueAtTime(0.02, t + loopDur);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(t);
            // Stop slightly after the next loop has started (overlapped fade)
            osc.stop(t + loopDur + 0.3);
            this.musicNodes.push(osc);
        });

        // ---- Sub bass drone (very low, filtered) ----
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.value = 65.41; // C2
        bassGain.gain.setValueAtTime(0, t);
        bassGain.gain.linearRampToValueAtTime(0.08, t + 1);
        bassGain.gain.linearRampToValueAtTime(0.08, t + loopDur - 1);
        bassGain.gain.linearRampToValueAtTime(0, t + loopDur + 0.2);
        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);
        bassOsc.start(t);
        bassOsc.stop(t + loopDur + 0.3);
        this.musicNodes.push(bassOsc);

        // ---- Sparse melody (ethereal bell-like triangle) over 16 beats ----
        // Pentatonic minor: C Eb F G Bb
        const melody = [
            { beat: 0,  freq: 523.25, dur: 2 },   // C5
            { beat: 2,  freq: 622.25, dur: 2 },   // Eb5
            { beat: 4,  freq: 698.46, dur: 1.5 }, // F5
            { beat: 5.5,freq: 783.99, dur: 2.5 }, // G5
            { beat: 8,  freq: 698.46, dur: 1 },   // F5
            { beat: 9,  freq: 622.25, dur: 1 },   // Eb5
            { beat: 10, freq: 523.25, dur: 2 },   // C5
            { beat: 12, freq: 466.16, dur: 1 },   // Bb4
            { beat: 13, freq: 523.25, dur: 3 },   // C5 (long tail)
        ];
        melody.forEach(n => {
            const noteStart = t + n.beat * beatDur;
            const noteDur = n.dur * beatDur;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = n.freq;
            // Bell-like envelope: fast attack, long exponential decay
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.08, noteStart + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDur);
            // Soft lowpass
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2500;
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + noteDur + 0.05);
            this.musicNodes.push(osc);
        });

        // ---- High shimmer (sparse single notes for cosmic feel) ----
        const shimmer = [
            { beat: 3,  freq: 1567.98 }, // G6
            { beat: 7,  freq: 1396.91 }, // F6
            { beat: 11, freq: 1864.66 }, // Bb6
            { beat: 14, freq: 1567.98 }, // G6
        ];
        shimmer.forEach(n => {
            const noteStart = t + n.beat * beatDur;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = n.freq;
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.025, noteStart + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 1.2);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + 1.3);
            this.musicNodes.push(osc);
        });

        this._scheduleNextLoop(loopDur, 'menu', this._playMenuLoop);
    }

    // --- BATTLE MUSIC ---
    // Driving 16-beat loop with kick / hat / snare / bass / chord pad / lead.
    // Loop length matches the melody length so phrases align cleanly.
    _playBattleLoop() {
        if (!this.musicPlaying || this.musicType !== 'battle' || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bpm = 140;
        const beatDur = 60 / bpm;
        const loopDur = beatDur * 16; // 16 beats = ~6.86s
        const ctx = this.ctx;

        // ---- KICK DRUM on beats 1, 5, 9, 13 + ghost on 14.5 ----
        const kickBeats = [0, 4, 8, 12, 14.5];
        kickBeats.forEach((beat, idx) => {
            const kickStart = t + beat * beatDur;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, kickStart);
            osc.frequency.exponentialRampToValueAtTime(40, kickStart + 0.12);
            const vel = idx === 4 ? 0.15 : 0.28;
            gain.gain.setValueAtTime(vel, kickStart);
            gain.gain.exponentialRampToValueAtTime(0.001, kickStart + 0.18);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(kickStart);
            osc.stop(kickStart + 0.2);
            this.musicNodes.push(osc);
        });

        // ---- HI-HAT (8th notes, alternating velocity) ----
        for (let i = 0; i < 32; i++) {
            const hatStart = t + i * beatDur / 2;
            const bufSize = Math.floor(ctx.sampleRate * 0.04);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 10);
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.value = i % 2 === 0 ? 0.06 : 0.03;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 8500;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            src.start(hatStart);
            this.musicNodes.push(src);
        }

        // ---- SNARE on beats 3, 7, 11, 15 ----
        const snareBeats = [2, 6, 10, 14];
        snareBeats.forEach(beat => {
            const snareStart = t + beat * beatDur;
            const bufSize = Math.floor(ctx.sampleRate * 0.12);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                const env = Math.pow(1 - j / bufSize, 3);
                d[j] = (Math.random() * 2 - 1) * env;
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.value = 0.12;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2800;
            filter.Q.value = 1.2;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            src.start(snareStart);
            this.musicNodes.push(src);
        });

        // ---- BASS LINE (driving 8th notes, A minor / C major) ----
        // 16 eighth-notes per loop (2 per beat × 8 beats × 2 = oh wait it's 16 beats)
        // Actually 16 beats × 2 = 32 8ths, but we keep the pattern more musical
        // by playing on quarter beats with sustain.
        const bassPattern = [
            110.00, 110.00, 130.81, 130.81, // A2 A2 C3 C3
            146.83, 146.83, 164.81, 130.81, // D3 D3 E3 C3
            110.00, 110.00, 130.81, 146.83, // A2 A2 C3 D3
            164.81, 146.83, 130.81, 123.47, // E3 D3 C3 B2
        ];
        bassPattern.forEach((freq, i) => {
            const noteStart = t + i * beatDur;
            const noteDur = beatDur * 0.9;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.11, noteStart + 0.01);
            gain.gain.setValueAtTime(0.11, noteStart + noteDur * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStart + noteDur);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500;
            filter.Q.value = 2;
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + noteDur + 0.02);
            this.musicNodes.push(osc);
        });

        // ---- CHORD PAD (sustained, fills the harmonic space) ----
        // Two-chord progression: Am (A C E) -> F (F A C) -> C (C E G) -> G (G B D)
        const chords = [
            { beat: 0,  notes: [220.00, 261.63, 329.63] }, // Am
            { beat: 4,  notes: [174.61, 220.00, 261.63] }, // F
            { beat: 8,  notes: [261.63, 329.63, 392.00] }, // C
            { beat: 12, notes: [196.00, 246.94, 293.66] }, // G
        ];
        chords.forEach(chord => {
            const chordStart = t + chord.beat * beatDur;
            const chordDur = beatDur * 4;
            chord.notes.forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, chordStart);
                gain.gain.linearRampToValueAtTime(0.025, chordStart + 0.1);
                gain.gain.setValueAtTime(0.025, chordStart + chordDur * 0.7);
                gain.gain.linearRampToValueAtTime(0, chordStart + chordDur);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 1200;
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);
                osc.start(chordStart);
                osc.stop(chordStart + chordDur + 0.05);
                this.musicNodes.push(osc);
            });
        });

        // ---- MELODY LEAD (synth lead, beats 0-16, aligned to loop) ----
        // A natural minor melody, expressive phrasing
        const melodyNotes = [
            // Bars 1-2 (beats 0-7)
            { beat: 0,    freq: 440.00, dur: 1   }, // A4
            { beat: 1,    freq: 523.25, dur: 1   }, // C5
            { beat: 2,    freq: 659.25, dur: 0.5 }, // E5
            { beat: 2.5,  freq: 587.33, dur: 1.5 }, // D5
            { beat: 4,    freq: 523.25, dur: 1   }, // C5
            { beat: 5,    freq: 440.00, dur: 0.5 }, // A4
            { beat: 5.5,  freq: 392.00, dur: 0.5 }, // G4
            { beat: 6,    freq: 440.00, dur: 2   }, // A4
            // Bars 3-4 (beats 8-15)
            { beat: 8,    freq: 523.25, dur: 1   }, // C5
            { beat: 9,    freq: 659.25, dur: 1   }, // E5
            { beat: 10,   freq: 783.99, dur: 1   }, // G5
            { beat: 11,   freq: 659.25, dur: 1   }, // E5
            { beat: 12,   freq: 587.33, dur: 1   }, // D5
            { beat: 13,   freq: 523.25, dur: 1   }, // C5
            { beat: 14,   freq: 493.88, dur: 0.5 }, // B4
            { beat: 14.5, freq: 440.00, dur: 1.5 }, // A4
        ];
        melodyNotes.forEach(note => {
            const noteStart = t + note.beat * beatDur;
            const noteDur = note.dur * beatDur;
            const osc = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc2.type = 'sawtooth';
            osc.frequency.value = note.freq;
            osc2.frequency.value = note.freq * 1.005; // detune for chorus
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.055, noteStart + 0.02);
            gain.gain.setValueAtTime(0.055, noteStart + noteDur * 0.75);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDur);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2800, noteStart);
            filter.frequency.exponentialRampToValueAtTime(900, noteStart + noteDur);
            filter.Q.value = 1.5;
            osc.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + noteDur + 0.02);
            osc2.start(noteStart);
            osc2.stop(noteStart + noteDur + 0.02);
            this.musicNodes.push(osc, osc2);
        });

        this._scheduleNextLoop(loopDur, 'battle', this._playBattleLoop);
    }

    // --- BOSS MUSIC ---
    // High-intensity 16-beat loop with driving kick, aggressive bass, and stabs.
    _playBossLoop() {
        if (!this.musicPlaying || this.musicType !== 'boss' || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bpm = 165;
        const beatDur = 60 / bpm;
        const loopDur = beatDur * 16; // ~5.8s
        const ctx = this.ctx;

        // ---- HEAVY KICK (4-on-the-floor + syncopation) ----
        const kickBeats = [0, 2, 3.5, 4, 6, 7.5, 8, 10, 11.5, 12, 14, 15.5];
        kickBeats.forEach(beat => {
            const kickStart = t + beat * beatDur;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(190, kickStart);
            osc.frequency.exponentialRampToValueAtTime(38, kickStart + 0.12);
            gain.gain.setValueAtTime(0.32, kickStart);
            gain.gain.exponentialRampToValueAtTime(0.001, kickStart + 0.16);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(kickStart);
            osc.stop(kickStart + 0.18);
            this.musicNodes.push(osc);
        });

        // ---- AGGRESSIVE HI-HAT (16th notes) ----
        for (let i = 0; i < 64; i++) {
            const hatStart = t + i * beatDur / 4;
            const bufSize = Math.floor(ctx.sampleRate * 0.025);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 12);
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.value = i % 4 === 0 ? 0.08 : (i % 2 === 0 ? 0.04 : 0.025);
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 9000;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            src.start(hatStart);
            this.musicNodes.push(src);
        }

        // ---- INDUSTRIAL SNARE on beats 3, 7, 11, 15 ----
        const snareBeats = [2, 6, 10, 14];
        snareBeats.forEach(beat => {
            const snareStart = t + beat * beatDur;
            const bufSize = Math.floor(ctx.sampleRate * 0.1);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                const env = Math.pow(1 - j / bufSize, 2.5);
                d[j] = (Math.random() * 2 - 1) * env;
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.value = 0.14;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 3500;
            filter.Q.value = 1.5;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            src.start(snareStart);
            this.musicNodes.push(src);
        });

        // ---- HEAVY BASS (Phrygian dominant for tension) ----
        // E phrygian: E F G A Bb C D - very tense, dark feel
        const bossBass = [
            82.41, 82.41, 87.31, 82.41,  // E2 E2 F2 E2
            73.42, 82.41, 87.31, 92.50,  // D2 E2 F2 F#2 (chromatic climb)
            82.41, 82.41, 87.31, 82.41,  // E2 E2 F2 E2
            87.31, 92.50, 97.99, 87.31,  // F2 F#2 G2 F2
        ];
        bossBass.forEach((freq, i) => {
            const noteStart = t + i * beatDur;
            const noteDur = beatDur * 0.95;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.16, noteStart + 0.01);
            gain.gain.setValueAtTime(0.16, noteStart + noteDur * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.02, noteStart + noteDur);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(700, noteStart);
            filter.frequency.exponentialRampToValueAtTime(250, noteStart + noteDur);
            filter.Q.value = 3;
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + noteDur + 0.02);
            this.musicNodes.push(osc);
        });

        // ---- DARK CHORD PAD (sustained tritone-heavy stabs) ----
        const bossChords = [
            { beat: 0, notes: [164.81, 207.65, 246.94] }, // E G# B  (E major - bright start)
            { beat: 4, notes: [146.83, 174.61, 220.00] }, // D F A   (D minor)
            { beat: 8, notes: [164.81, 196.00, 233.08] }, // E G Bb  (E dim - tension)
            { beat: 12,notes: [155.56, 196.00, 233.08] }, // Eb G Bb (Eb major - resolution build)
        ];
        bossChords.forEach(chord => {
            const chordStart = t + chord.beat * beatDur;
            const chordDur = beatDur * 4;
            chord.notes.forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, chordStart);
                gain.gain.linearRampToValueAtTime(0.022, chordStart + 0.08);
                gain.gain.setValueAtTime(0.022, chordStart + chordDur * 0.75);
                gain.gain.linearRampToValueAtTime(0, chordStart + chordDur);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 900;
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);
                osc.start(chordStart);
                osc.stop(chordStart + chordDur + 0.05);
                this.musicNodes.push(osc);
            });
        });

        // ---- AGGRESSIVE SYNTH LEAD STABS ----
        const stabPattern = [
            { beat: 0,    freq: 329.63, dur: 0.5 }, // E5
            { beat: 0.5,  freq: 311.13, dur: 0.5 }, // Eb5
            { beat: 1.5,  freq: 329.63, dur: 0.5 }, // E5
            { beat: 2,    freq: 349.23, dur: 0.5 }, // F5
            { beat: 3,    freq: 392.00, dur: 1   }, // G5
            { beat: 4,    freq: 349.23, dur: 0.5 }, // F5
            { beat: 4.5,  freq: 329.63, dur: 0.5 }, // E5
            { beat: 5.5,  freq: 293.66, dur: 0.5 }, // D5
            { beat: 6,    freq: 329.63, dur: 2   }, // E5 long
            { beat: 8,    freq: 392.00, dur: 0.5 }, // G5
            { beat: 8.5,  freq: 415.30, dur: 0.5 }, // G#5
            { beat: 9.5,  freq: 466.16, dur: 0.5 }, // Bb5
            { beat: 10,   freq: 523.25, dur: 1   }, // C6
            { beat: 11,   freq: 466.16, dur: 1   }, // Bb5
            { beat: 12,   freq: 415.30, dur: 0.5 }, // G#5
            { beat: 12.5, freq: 392.00, dur: 0.5 }, // G5
            { beat: 13,   freq: 349.23, dur: 1   }, // F5
            { beat: 14,   freq: 329.63, dur: 2   }, // E5 final
        ];
        stabPattern.forEach(stab => {
            const noteStart = t + stab.beat * beatDur;
            const noteDur = stab.dur * beatDur;
            const osc = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc2.type = 'square';
            osc.frequency.value = stab.freq;
            osc2.frequency.value = stab.freq * 2.005;
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.06, noteStart + 0.005);
            gain.gain.setValueAtTime(0.06, noteStart + noteDur * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDur);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(4500, noteStart);
            filter.frequency.exponentialRampToValueAtTime(700, noteStart + noteDur);
            filter.Q.value = 4;
            osc.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);
            osc.start(noteStart);
            osc.stop(noteStart + noteDur + 0.02);
            osc2.start(noteStart);
            osc2.stop(noteStart + noteDur + 0.02);
            this.musicNodes.push(osc, osc2);
        });

        this._scheduleNextLoop(loopDur, 'boss', this._playBossLoop);
    }
}
