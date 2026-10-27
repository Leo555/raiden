// main.js - Game entry point and main loop (Enhanced)

import {
    GAME_WIDTH, GAME_HEIGHT, BASE_WIDTH, MAX_WIDTH,
    setGameWidth, isDesktopPointer, clamp
} from './utils.js';
import { InputManager, CONTROLS_P1, CONTROLS_P2 } from './input.js';
import { AudioManager } from './audio.js';
import { Background } from './background.js';
import { ParticleSystem } from './particles.js';
import { BulletSystem } from './bullets.js';
import { Player } from './player.js';
import { EnemySystem } from './enemies.js';
import { Boss } from './boss.js';
import { PowerUpSystem } from './powerups.js';
import { CollisionSystem } from './collision.js';
import { LevelManager } from './levels.js';
import { UISystem } from './ui.js';
import { ComboSystem } from './combo.js';
import { FloatingTextSystem } from './floatingText.js';
import { AchievementSystem } from './achievements.js';
// Note: ./challenge.js is dynamically imported on demand inside
// _startChallenge() so its ~8 KB doesn't sit in the first-paint
// critical path. Players who never tap "Challenge Mode" never pay
// the parse/eval cost.

// Dev only: a plain static server (npm run dev) serves index.html as-is, where
// the inline <style> still holds the build-time placeholder, so NO CSS would
// load (white page, canvas stuck top-left). Production builds replace the
// placeholder, so this is a no-op there.
(function ensureDevStyles() {
    const inline = document.querySelector('head style');
    if (inline && inline.textContent.includes('__INLINE_CSS__')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/style.css';
        document.head.appendChild(link);
    }
})();

// Local 2-player co-op presets (shared keyboard). Fixed ship colours replace
// the skin in 2P so the two pilots are always distinguishable.
const TWO_PLAYER_PRESETS = [
    {
        controls: CONTROLS_P1,
        useMouseTouch: false,
        palette: { color: '#2288ff', secondaryColor: '#55aaff' },
        label: 'P1',
        bulletColor: null,         // keep the default blue bullets
        spawnFraction: 0.3
    },
    {
        controls: CONTROLS_P2,
        useMouseTouch: false,
        palette: { color: '#ff7722', secondaryColor: '#ffaa44' },
        label: 'P2',
        bulletColor: '#ffaa55',    // orange bullets
        spawnFraction: 0.7
    }
];

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        // alpha:false lets the browser skip per-pixel compositing against
        // the page background, and disabling smoothing avoids costly
        // bilinear filtering when the canvas is upscaled on hi-dpi
        // displays. Both are pure wins for a pixel-art-style game.
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.ctx.imageSmoothingEnabled = false;
        // Desktop: the logical field width follows the window's aspect ratio
        // so the game fills the whole screen. Must be decided before any
        // system that sizes itself from GAME_WIDTH (e.g. Background) is built.
        setGameWidth(this._computeFieldWidth());
        this.canvas.width = GAME_WIDTH;
        this.canvas.height = GAME_HEIGHT;

        this.state = 'menu'; // menu, playing, paused, gameover, levelcomplete, challenge_select, challenge_playing
        this.challengeMode = null; // 'time_attack' or 'survival'
        this.lastTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = 0;

        // Adaptive quality: 0 = full, 1 = reduced, 2 = potato. Updated
        // every second from the FPS sample. Subsystems that emit lots
        // of particles / spawn lots of enemies should consult this to
        // shed work on weak devices.
        this._qualityLevel = 0;
        this._qualityGoodStreak = 0;

        // Init systems
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager();
        this.background = new Background();
        this.particles = new ParticleSystem();
        this.bullets = new BulletSystem(this.particles);
        this.player = new Player(this.bullets, this.particles, this.audio, this.input);
        this.player.initWeaponSystem();
        this.player.initSkinSystem(); // NEW: Initialize skin system
        // Second pilot for local co-op. Only joins the match (this.players)
        // when "2 PLAYERS" is chosen; it never needs a skin system because
        // 2P uses fixed palettes.
        this.player2 = new Player(this.bullets, this.particles, this.audio, this.input);
        this.player2.initWeaponSystem();
        this.twoPlayer = false;
        this.players = [this.player];
        // Enemy/boss aiming: they take a single target point, so in 2P we
        // alternate which living pilot is the target every few seconds.
        this._aimIndex = 0;
        this._aimTimer = 0;
        this._aimX = 0;
        this._aimY = 0;
        this.powerups = new PowerUpSystem(this.particles);
        this.enemySystem = new EnemySystem(this.bullets, this.particles, this.audio, this.powerups);
        this.boss = new Boss(this.bullets, this.particles, this.audio, this.powerups);
        this.levelManager = new LevelManager(this.enemySystem, this.boss, this.audio);
        // Provide boss reference to weapon system (legacy hook, currently no-op)
        if (this.player.weaponSystem && this.player.weaponSystem.setBossRef) {
            this.player.weaponSystem.setBossRef(this.boss);
        }
        this.ui = new UISystem();

        // New systems
        this.combo = new ComboSystem(this.audio);
        this.floatingText = new FloatingTextSystem();

        // Achievement system
        this.achievements = new AchievementSystem(this.audio);

        // Challenge mode (initially null, activated when mode selected)
        this.challenge = null;

        // Listen for achievement reward events
        window.addEventListener('achievement-reward', (e) => {
            this._handleAchievementReward(e.detail);
        });

        // Pass combo and floatingText to collision
        this.collision = new CollisionSystem(
            this.player, this.bullets, this.enemySystem,
            this.boss, this.powerups, this.particles,
            this.combo, this.floatingText, this.audio,
            this.challenge, this.ui
        );

        this.levelCompleteTimer = 0;
        this.pauseCooldown = 0;

        // Track boss state for music switching
        this._wasBossActive = false;

        this._bindUIEvents();
        this._resizeCanvas();
        window.addEventListener('resize', () => this._onWindowResize());

        // Auto-focus canvas for keyboard input
        this.canvas.focus();

        // Bind the loop callback once so requestAnimationFrame doesn't
        // allocate a fresh arrow-function closure every frame.
        this._loopBound = (t) => this._loop(t);

        // Hide the first-paint loading placeholder. We do it from
        // requestAnimationFrame so the user sees the canvas filled
        // with the menu *before* the spinner fades, instead of a
        // brief black gap.
        requestAnimationFrame((t) => {
            this._hideLoadingScreen();
            this._loop(t);
        });
    }

    _hideLoadingScreen() {
        const el = document.getElementById('loadingScreen');
        if (!el) return;
        el.classList.add('hide');
        // Remove from the DOM after the fade-out so it never accepts
        // pointer events nor occupies layout.
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }

    _bindUIEvents() {
        // Shared handler: convert page coordinates to canvas-space then dispatch
        // to the right state-specific click target (menu / gameover buttons).
        let lastTapTime = 0;
        const handlePointer = (clientX, clientY) => {
            const now = Date.now();
            if (now - lastTapTime < 200) return; // debounce click/touchend duplication
            lastTapTime = now;

            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            // Re-focus canvas after interaction to keep keyboard input working
            this.canvas.focus();

            this.audio.init();
            this.audio.resume();

            if (this.state === 'menu') {
                if (!this.audio.musicPlaying) {
                    this.audio.playMenuMusic();
                }
                if (this.ui.isStartButtonClicked(x, y)) {
                    this._startGame(false);
                } else if (this.ui.isTwoPlayerButtonClicked(x, y)) {
                    this._startGame(false, true);
                } else if (this.ui.isChallengeButtonClicked(x, y)) {
                    this.state = 'challenge_select';
                    // Warm up the challenge module while the user is
                    // picking Time Attack vs Survival. The import is
                    // cached, so the actual _startChallenge() call
                    // a moment later resolves immediately.
                    if (!this._challengeModulePromise) {
                        this._challengeModulePromise = import('./challenge.js');
                    }
                } else if (this.ui.isEndlessButtonClicked(x, y)) {
                    this._startGame(true);
                }
            } else if (this.state === 'challenge_select') {
                if (this.ui.isTimeAttackButtonClicked(x, y)) {
                    this._startChallenge('time_attack');
                } else if (this.ui.isSurvivalButtonClicked(x, y)) {
                    this._startChallenge('survival');
                } else if (this.ui.isBackButtonClicked(x, y)) {
                    this.state = 'menu';
                }
            } else if (this.state === 'gameover') {
                if (this.ui.isRestartButtonClicked(x, y)) {
                    // Keep the current mode: 2P restarts as 2P
                    this._startGame(false, this.twoPlayer);
                } else if (this.ui.isMenuButtonClicked(x, y)) {
                    this.state = 'menu';
                    this._syncFieldWidth(); // window may have been resized during the run
                    this.audio.playMenuMusic();
                }
            }
        };

        // Desktop: mouse click
        this.canvas.addEventListener('click', (e) => {
            handlePointer(e.clientX, e.clientY);
        });

        // Mobile fallback: touchend fires even when the browser decides not to synthesise click.
        // (Browsers skip click synthesis if the finger moves even a few pixels during the touch.)
        this.canvas.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            handlePointer(t.clientX, t.clientY);
        });

        // Handle keyboard start
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Enter' || e.code === 'Space') {
                if (this.state === 'menu') {
                    this.audio.init();
                    this.audio.resume();
                    this._startGame(false);
                }
            }

            // Press 2 on the menu to start local co-op (desktop only)
            if ((e.code === 'Digit2' || e.code === 'Numpad2') && this.state === 'menu' && this.ui.twoPlayerAvailable) {
                this.audio.init();
                this.audio.resume();
                this._startGame(false, true);
            }
            // NEW: Keyboard shortcuts for Achievement & Skin UI
            if (e.code === 'KeyA' && this.state === 'paused') {
                // A key: Open achievement progress (in pause menu)
                this.state = 'achievement_view';
                e.preventDefault();
            }
            if (e.code === 'KeyS' && this.state === 'paused') {
                // S key: Open skin selection (in pause menu)
                this.state = 'skin_select';
                e.preventDefault();
            }
            // ESC: Close Achievement or Skin UI
            if (e.code === 'Escape') {
                if (this.state === 'achievement_view' || this.state === 'skin_select') {
                    this.state = 'paused';
                    e.preventDefault();
                }
            }
        });
    }

    /**
     * Switch between 1P and local 2P: pick the active roster, apply the
     * control / look presets, and tell the collision system who is playing.
     * Must run before player.reset() so spawn positions are correct.
     */
    _setupPlayers(twoPlayer) {
        this.twoPlayer = !!twoPlayer;
        this.players = this.twoPlayer ? [this.player, this.player2] : [this.player];
        if (this.twoPlayer) {
            this.player.configure(TWO_PLAYER_PRESETS[0]);
            this.player2.configure(TWO_PLAYER_PRESETS[1]);
        } else {
            this.player.configure(); // legacy: WASD+arrows+mouse/touch, skin colours
        }
        this._aimIndex = 0;
        this._aimTimer = 0;
        if (this.collision) this.collision.setPlayers(this.players);
    }

    _allPlayersDown() {
        for (let i = 0; i < this.players.length; i++) {
            if (!this.players[i].isOut()) return false;
        }
        return true;
    }

    /**
     * Pick the point enemies / bosses aim at. With one pilot this is just
     * that ship. With two living pilots the target alternates every 2-3.5s;
     * if only one is alive (respawning pilots do not count) it is targeted.
     */
    _updateAim(dt) {
        const ps = this.players;
        let target = ps[0];
        if (ps.length > 1) {
            const a = ps[0], b = ps[1];
            if (a.active && b.active) {
                this._aimTimer -= dt;
                if (this._aimTimer <= 0) {
                    this._aimIndex ^= 1;
                    this._aimTimer = 2 + Math.random() * 1.5;
                }
                target = this._aimIndex ? b : a;
            } else if (a.active) {
                target = a;
            } else if (b.active) {
                target = b;
            } else {
                target = this._aimIndex ? b : a;
            }
        }
        this._aimX = target.x + target.width / 2;
        this._aimY = target.y + target.height / 2;
    }

    _startGame(endless, twoPlayer = false) {
        // New run: adopt the current window's field width before anything spawns.
        this._syncFieldWidth();
        this.state = 'playing';
        this._setupPlayers(twoPlayer && !endless);
        for (const p of this.players) p.reset();
        this.enemySystem.clear();
        this.bullets.clearAll();
        this.powerups.clear();
        this.particles.clear();
        this.boss.active = false;
        this.levelManager.reset();
        this.combo.reset();
        this.floatingText.clear();
        this._wasBossActive = false;

        // Reset achievement stats for new game
        this.achievements.stats.reset();
        this.achievements.stats.totalGames++;

        if (endless) {
            this.levelManager.endlessMode = true;
            this.levelManager.state = 'playing';
            this.levelManager.endlessDifficulty = 1;
            this.levelManager.enemySystem = this.enemySystem;
            this.enemySystem.difficulty = 1;
        } else {
            this.levelManager.startLevel(0);
        }

        this.audio.startMusic();
    }

    _handleAchievementReward(reward) {
        if (!reward) return;

        // Rewards go to the first pilot who is still in the fight (in 1P: the player).
        let target = this.player;
        for (const p of this.players) {
            if (p.active || p.respawning) { target = p; break; }
        }

        switch (reward.type) {
            case 'score':
                target.score += reward.value;
                break;
            case 'bomb':
                target.bombs += reward.value;
                break;
            case 'life':
                target.lives += reward.value;
                break;
            case 'shield':
                target.shield = Math.min(
                    target.shield + reward.value,
                    target.maxShield || 100
                );
                break;
            case 'weapon_upgrade':
                if (target.weaponLevel < target.maxWeaponLevel) {
                    target.weaponLevel++;
                }
                break;
        }
    }

    async _startChallenge(mode) {
        this.challengeMode = mode;

        // Lazy-load the challenge module the first time the player
        // taps Time Attack / Survival. After the first call the
        // module is cached by the import engine, so subsequent
        // invocations resolve synchronously off the microtask queue.
        if (!this._challengeModulePromise) {
            this._challengeModulePromise = import('./challenge.js');
        }
        const { TimeAttackMode, SurvivalMode } = await this._challengeModulePromise;

        // The state may have changed while we were awaiting the
        // import (e.g. user backed out). Bail out gracefully.
        if (this.challengeMode !== mode) return;
        this._syncFieldWidth();
        this.state = 'challenge_playing';

        if (mode === 'time_attack') {
            if (!this.challenge) {
                this.challenge = new TimeAttackMode();
            }
            this.challenge.start();
        } else if (mode === 'survival') {
            if (!this.challenge) {
                this.challenge = new SurvivalMode();
            }
            this.challenge.start();
        }

        // Challenge modes are single-player: switch back from any 2P setup.
        this._setupPlayers(false);
        this.player.reset();
        this.enemySystem.clear();
        this.bullets.clearAll();
        this.powerups.clear();
        this.particles.clear();
        this.combo.reset();
        this.floatingText.clear();

        // Start endless enemy spawning for challenge mode
        this.levelManager.reset();
        this.levelManager.endlessMode = true;
        this.levelManager.state = 'playing';
        this.levelManager.endlessDifficulty = 1;
        this.levelManager.enemySystem = this.enemySystem;
        this.enemySystem.difficulty = 1;
        this.levelManager.startLevel(0);

        // Update collision system with challenge reference
        if (this.collision) {
            this.collision.challenge = this.challenge;
        }

        this.audio.startMusic();
    }

    /**
     * Logical field width for the current window. Desktop pointers get a
     * field as wide as the window's aspect ratio allows (so there are no
     * side bars); phones / tablets keep the classic 540-wide portrait field.
     */
    _computeFieldWidth() {
        if (!isDesktopPointer()) return BASE_WIDTH;
        const ratio = window.innerWidth / Math.max(1, window.innerHeight);
        return clamp(Math.round(GAME_HEIGHT * ratio), BASE_WIDTH, MAX_WIDTH);
    }

    /**
     * Re-fit the field width to the window. Only safe BETWEEN games (menu /
     * before a new run): changing it mid-run would shove ships, enemies and
     * the boss around. Mid-run window resizes just rescale the canvas.
     */
    _syncFieldWidth() {
        const w = this._computeFieldWidth();
        if (w !== GAME_WIDTH) {
            setGameWidth(w);
            // Assigning width also clears the canvas and resets context state.
            this.canvas.width = w;
            this.ctx.imageSmoothingEnabled = false;
            // Star / cloud fields are sized from the width at construction.
            this.background = new Background();
        }
        this._resizeCanvas();
    }

    _onWindowResize() {
        if (this.state === 'menu' || this.state === 'challenge_select') {
            this._syncFieldWidth();
        } else {
            this._resizeCanvas();
        }
    }

    _resizeCanvas() {
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;
        const gameRatio = GAME_WIDTH / GAME_HEIGHT;

        // Fit the canvas entirely inside the viewport while preserving aspect ratio.
        // Both width and height must be <= viewport, otherwise the canvas overflows
        // and the off-screen portion can visually "wrap" to the top, producing the
        // colored band of game content (score popups, enemy bullets, etc).
        let displayH = windowH;
        let displayW = displayH * gameRatio;
        if (displayW > windowW) {
            displayW = windowW;
            displayH = displayW / gameRatio;
        }

        this.canvas.style.width = `${displayW}px`;
        this.canvas.style.height = `${displayH}px`;
    }

    _loop(timestamp) {
        const dt = Math.max(0, Math.min((timestamp - this.lastTime) / 1000, 0.05));

        // ----------------------------------------------------------
        // Throttle non-gameplay states to ~30 fps. The menu, pause,
        // gameover and level-complete screens don't need 60 fps - this
        // halves CPU/GPU work and is much friendlier on battery.
        // ----------------------------------------------------------
        const idleStates = this._idleStates || (this._idleStates = new Set([
            'menu', 'paused', 'gameover', 'levelcomplete', 'challenge_select'
        ]));
        const targetInterval = idleStates.has(this.state) ? 1 / 30 : 0;
        if (timestamp - this.lastTime < targetInterval * 1000) {
            requestAnimationFrame(this._loopBound);
            return;
        }
        this.lastTime = timestamp;

        // FPS counter
        this.frameCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 1) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;

            // Adaptive quality. Sustained low FPS means the device
            // can't keep up - shed visual / spawn load before the
            // experience degrades further. Quality stays at the worst
            // level seen so far (we only ratchet up after a longer
            // good window) to avoid oscillation.
            const fps = this.fps;
            let target = 0;
            if (fps < 35) target = 2;       // potato mode
            else if (fps < 50) target = 1;  // reduced
            // ratchet down quickly, ratchet up only after 5s of grace
            if (target > this._qualityLevel) {
                const previous = this._qualityLevel;
                this._qualityLevel = target;
                this._qualityGoodStreak = 0;
                // Inform the player we shed visual load. Only on the
                // first downgrade per session - repeating this every
                // second would be noise.
                if (this.ui && previous === 0) {
                    this.ui.notify('PERFORMANCE MODE ON', 90);
                }
            } else if (target < this._qualityLevel) {
                this._qualityGoodStreak = (this._qualityGoodStreak || 0) + 1;
                if (this._qualityGoodStreak >= 5) {
                    this._qualityLevel = target;
                    this._qualityGoodStreak = 0;
                }
            } else {
                this._qualityGoodStreak = 0;
            }
            // Push the quality level to subsystems that can adapt.
            if (this.particles) this.particles.qualityLevel = this._qualityLevel;
            if (this.enemySystem) this.enemySystem.qualityLevel = this._qualityLevel;
            // Tighten the enemy-bullet cap on weak devices: 220 / 150 / 90.
            if (this.bullets) {
                this.bullets._enemyBulletCap =
                    this._qualityLevel === 2 ? 90 :
                    this._qualityLevel === 1 ? 150 : 220;
            }
        }

        try {
            this._update(dt);
            this._draw();
        } catch (e) {
            console.error('Game loop error:', e);
        }

        requestAnimationFrame(this._loopBound);
    }

    _update(dt) {
        // Pause toggle
        if (this.pauseCooldown > 0) this.pauseCooldown -= dt * 60;
        if (this.input.isPause() && this.pauseCooldown <= 0) {
            if (this.state === 'playing' || this.state === 'paused') {
                this.state = this.state === 'paused' ? 'playing' : 'paused';
                this.pauseCooldown = 20;
                this.input.clearKey('KeyP');
            }
        }

        if (this.state === 'paused') {
            this.background.update(dt);
            return;
        }

        if (this.state === 'menu' || this.state === 'challenge_select') {
            this.background.update(dt);
            return;
        }

        if (this.state === 'challenge_playing') {
            this._updateChallenge(dt);
            return;
        }

        if (this.state === 'gameover') {
            this.background.update(dt);
            this.particles.update(dt);
            this.floatingText.update(dt);
            return;
        }

        if (this.state === 'levelcomplete') {
            this.levelCompleteTimer -= dt * 60;
            this.background.update(dt);
            this.particles.update(dt);
            this.floatingText.update(dt);
            if (this.levelCompleteTimer <= 0) {
                // Co-op: a fallen pilot rejoins with 1 life when the next sector starts
                for (const p of this.players) p.revive();
                const nextLevel = this.levelManager.currentLevel + 1;
                if (nextLevel >= this.levelManager.getTotalLevels()) {
                    // Game completed - start endless
                    this.ui.notify('ALL SECTORS CLEARED!', 120);
                    this.levelManager.endlessMode = true;
                    this.levelManager.state = 'playing';
                    this.levelManager.currentLevel = nextLevel;
                    this.state = 'playing';
                } else {
                    this.levelManager.startLevel(nextLevel);
                    this.state = 'playing';
                }
                // Resume battle music after boss
                this.audio.startMusic();
                this._wasBossActive = false;
            }
            return;
        }

        // Main game update
        this.background.update(dt);
        this.ui.update(dt);
        for (const p of this.players) p.update(dt, this.enemySystem.enemies);
        this._updateAim(dt);
        const pcx = this._aimX;
        const pcy = this._aimY;
        this.enemySystem.update(dt, pcx, pcy);
        this.boss.update(dt, pcx, pcy, this.enemySystem);
        this.bullets.update(dt, this.enemySystem.enemies, pcx, pcy);
        this.powerups.update(dt);
        this.particles.update(dt);
        this.collision.update(dt);
        this.levelManager.update(dt);

        // Update combo system
        this.combo.update(dt);
        this.floatingText.update(dt);

        // Update achievement system
        const gameState = {
            state: this.state,
            player: this.player,
            levelManager: this.levelManager,
            combo: this.combo
        };
        this.achievements.update(dt, gameState);

        // Background speed based on combo
        this.background.setComboSpeed(this.combo.multiplier);

        // Music state management - switch to boss music when boss appears
        if (this.boss.active && !this.boss.defeated && !this._wasBossActive) {
            this._wasBossActive = true;
            this.audio.playBossMusic();
        }
        // Switch back to battle music when boss is defeated
        if (this._wasBossActive && (!this.boss.active || this.boss.defeated)) {
            if (this.state === 'playing') {
                this._wasBossActive = false;
                this.audio.startMusic();
            }
        }

        // Check game over (2P: only when BOTH pilots are out)
        if (this._allPlayersDown()) {
            this.state = 'gameover';
            this.audio.stopMusic();
            // 2P runs are not ranked on the solo high-score board
            if (!this.twoPlayer) this.ui.saveHighScore(this.player.score);
        }

        // Check level complete
        if (this.levelManager.isComplete() && this.state === 'playing') {
            this.state = 'levelcomplete';
            this.levelCompleteTimer = 150;
            this.ui.notify('BOSS DEFEATED!', 90);
            this.ui.shake(8);
            this.ui.flash('#ffffff', 0.6);
            // Drop multiple powerups
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    this.powerups.spawnRandom(
                        GAME_WIDTH / 2 + (Math.random() - 0.5) * 100,
                        100 + Math.random() * 100
                    );
                }, i * 200);
            }
        }

        // Boss defeat effects
        if (this.boss.defeated && this.boss.active) {
            this.ui.shake(3);
        }
    }

    _updateChallenge(dt) {
        if (!this.challenge || !this.challenge.isActive) return;

        // Update challenge timer
        this.challenge.update(dt);

        // Update game systems
        this.background.update(dt);
        this.levelManager.update(dt);
        for (const p of this.players) p.update(dt, this.enemySystem.enemies);
        this._updateAim(dt);
        const pcx = this._aimX;
        const pcy = this._aimY;
        this.enemySystem.update(dt, pcx, pcy);
        this.boss.update(dt, pcx, pcy, this.enemySystem);
        this.bullets.update(dt, this.enemySystem.enemies, pcx, pcy);
        this.powerups.update(dt);
        this.particles.update(dt);
        this.collision.update(dt);

        // Update combo and floating text
        this.combo.update(dt);
        this.floatingText.update(dt);

        // Update achievement system
        const gameState = {
            state: this.state,
            player: this.player,
            levelManager: this.levelManager,
            combo: this.combo
        };
        this.achievements.update(dt, gameState);

        // Track enemy kills for Time Attack
        if (this.challengeMode === 'time_attack') {
            // Enemy system should call challenge.onEnemyKill() when enemies die
            // This is handled in collision.js
        }

        // Check challenge completion
        if (this.challenge.isTimeUp()) {
            this._endChallenge();
        }

        // Check game over
        if (this._allPlayersDown()) {
            this._endChallenge();
        }
    }

    _drawChallengeUI(ctx) {
        if (!this.challenge) return;

        // Draw challenge-specific HUD
        ctx.save();

        // Challenge mode indicator
        ctx.fillStyle = this.challengeMode === 'time_attack' ? '#ff8800' : '#4488ff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        const modeText = this.challengeMode === 'time_attack' ? 'TIME ATTACK' : 'SURVIVAL MODE';
        ctx.fillText(modeText, GAME_WIDTH / 2, 25);

        // Timer or waves survived
        if (this.challengeMode === 'time_attack') {
            const timeRemaining = this.challenge.getTimeRemaining();
            const seconds = Math.ceil(timeRemaining / 60);
            ctx.fillStyle = seconds <= 10 ? '#ff4444' : '#ffffff';
            ctx.font = 'bold 18px monospace';
            ctx.fillText(`TIME: ${seconds}s`, GAME_WIDTH / 2, 50);

            // Score in challenge
            ctx.fillStyle = '#ffcc00';
            ctx.font = '12px monospace';
            ctx.fillText(`SCORE: ${this.challenge.score}`, GAME_WIDTH / 2, 70);
        } else if (this.challengeMode === 'survival') {
            ctx.fillStyle = '#44bbff';
            ctx.font = '14px monospace';
            ctx.fillText(`WAVES: ${this.challenge.wavesSurvived}`, GAME_WIDTH / 2, 50);
        }

        ctx.restore();
    }

    _endChallenge() {
        if (!this.challenge) return;

        // Save score
        this.challenge.saveScore();

        // Show result
        const finalScore = this.challenge.score || this.player.score;
        this.ui.notify(`CHALLENGE COMPLETE! SCORE: ${finalScore}`, 180);

        // Return to challenge select
        setTimeout(() => {
            this.state = 'challenge_select';
            this.challenge.isActive = false;
        }, 3000);
    }

    _draw() {
        const ctx = this.ctx;

        // CRITICAL: clear the entire canvas every frame BEFORE applying any
        // transform (screen shake). The background fill is drawn AFTER the
        // translate(shake.x, shake.y), so without an explicit clear here the
        // edges of the canvas would never be overwritten when shake != 0,
        // letting old frames (bullets, explosions, score popups) accumulate
        // along the left/right/top/bottom strips. This is what caused the
        // "weird border that gets worse over time".
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Screen shake
        const shake = this.ui.getShakeOffset();
        ctx.save();
        ctx.translate(shake.x, shake.y);

        // Background
        this.background.draw(ctx);

        if (this.state === 'menu') {
            this.ui.drawStartScreen(ctx);
            ctx.restore();
            return;
        }

        if (this.state === 'challenge_select') {
            this.ui.drawChallengeSelect(ctx);
            ctx.restore();
            return;
        }

        if (this.state === 'achievement_view') {
            this.ui.drawAchievementProgress(ctx, this.achievements);
            ctx.restore();
            return;
        }

        if (this.state === 'skin_select') {
            this.ui.drawSkinSelection(ctx, this.player.skinSystem, this.player.skinSystem.currentSkin);
            ctx.restore();
            return;
        }

        if (this.state === 'challenge_playing') {
            this._drawChallengeUI(ctx);
            // Continue with normal game drawing
        }

        // Game elements
        this.powerups.draw(ctx);
        for (const p of this.players) p.draw(ctx);
        this.enemySystem.draw(ctx);
        this.boss.draw(ctx);
        this.bullets.draw(ctx);
        this.particles.draw(ctx);

        // Floating text (damage/score numbers)
        this.floatingText.draw(ctx);

        // Combo UI
        this.combo.draw(ctx);

        // Achievement notifications
        this.achievements.draw(ctx);

        // Boss HP bar
        if (this.boss.active) {
            this.boss.drawHPBar(ctx);
        }

        // Level transition
        this.levelManager.drawTransition(ctx);

        // HUD
        if (this.twoPlayer) {
            this.ui.drawHUD2P(ctx, this.players, this.levelManager);
        } else {
            this.ui.drawHUD(ctx, this.player, this.levelManager, this.powerups);
        }
        this.ui.drawNotifications(ctx);
        this.ui.drawFlash(ctx);

        // Overlays
        if (this.state === 'paused') {
            this.ui.drawPaused(ctx);
        } else if (this.state === 'gameover') {
            if (this.twoPlayer) {
                const team = this.players.reduce((sum, p) => sum + p.score, 0);
                this.ui.drawGameOver(ctx, team, this.players);
            } else {
                this.ui.drawGameOver(ctx, this.player.score);
            }
        } else if (this.state === 'levelcomplete') {
            this.ui.drawLevelComplete(ctx, this.levelManager.currentLevel);
        }

        // FPS
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`FPS: ${this.fps}`, GAME_WIDTH - 5, 12);
        ctx.textAlign = 'left';

        ctx.restore();

        // Edge mask: paint solid black 1px borders on the outer edges of the canvas
        // (drawn AFTER restore so screen-shake never offsets them). This eliminates
        // any colored fringe that browsers may produce when scaling the canvas DOM
        // element to fit the viewport.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, GAME_WIDTH, 1);
        ctx.fillRect(0, GAME_HEIGHT - 1, GAME_WIDTH, 1);
        ctx.fillRect(0, 0, 1, GAME_HEIGHT);
        ctx.fillRect(GAME_WIDTH - 1, 0, 1, GAME_HEIGHT);
    }
}

// Start game when DOM loaded
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
