// main.js - Game entry point and main loop (Enhanced)

import { GAME_WIDTH, GAME_HEIGHT } from './utils.js';
import { InputManager } from './input.js';
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
import { ChallengeMode, TimeAttackMode, SurvivalMode } from './challenge.js';
import { WeaponSystem, WEAPON_TYPES } from './weapons.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = GAME_WIDTH;
        this.canvas.height = GAME_HEIGHT;

        this.state = 'menu'; // menu, playing, paused, gameover, levelcomplete, challenge_select, challenge_playing
        this.challengeMode = null; // 'time_attack' or 'survival'
        this.lastTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = 0;

        // Init systems
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager();
        this.background = new Background();
        this.particles = new ParticleSystem();
        this.bullets = new BulletSystem(this.particles);
        this.player = new Player(this.bullets, this.particles, this.audio, this.input);
        this.player.initWeaponSystem();
        this.player.initSkinSystem(); // NEW: Initialize skin system
        this.powerups = new PowerUpSystem(this.particles);
        this.enemySystem = new EnemySystem(this.bullets, this.particles, this.audio, this.powerups);
        this.boss = new Boss(this.bullets, this.particles, this.audio, this.powerups);
        this.levelManager = new LevelManager(this.enemySystem, this.boss, this.audio);
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
            this.challenge
        );

        this.levelCompleteTimer = 0;
        this.pauseCooldown = 0;

        // Track boss state for music switching
        this._wasBossActive = false;

        this._bindUIEvents();
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());

        // Auto-focus canvas for keyboard input
        this.canvas.focus();

        // Start loop
        requestAnimationFrame((t) => this._loop(t));
    }

    _bindUIEvents() {
        // Shared handler: convert page coordinates to canvas-space then dispatch
        // to the right state-specific click target (menu / gameover buttons).
        const handlePointer = (clientX, clientY) => {
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
                } else if (this.ui.isChallengeButtonClicked(x, y)) {
                    this.state = 'challenge_select';
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
                    this._startGame(false);
                } else if (this.ui.isMenuButtonClicked(x, y)) {
                    this.state = 'menu';
                    this.audio.playMenuMusic();
                }
            }
        };

        // Desktop: mouse click
        this.canvas.addEventListener('click', (e) => {
            handlePointer(e.clientX, e.clientY);
        });

        // Mobile: use click event for button detection (touch -> click synthesis).
        // input.js handles touch movement (touchstart/touchmove with preventDefault).
        // We only need to handle button clicks via the existing 'click' listener above.
        // The touchstart/touchmove for detecting swipe vs tap is no longer needed
        // because movement is handled entirely by input.js touch tracking.

        // Handle keyboard start
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Enter' || e.code === 'Space') {
                if (this.state === 'menu') {
                    this.audio.init();
                    this.audio.resume();
                    this._startGame(false);
                }
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

    _startGame(endless) {
        this.state = 'playing';
        this.player.reset();
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

        switch (reward.type) {
            case 'score':
                this.player.score += reward.value;
                break;
            case 'bomb':
                this.player.bombs += reward.value;
                break;
            case 'life':
                this.player.lives += reward.value;
                break;
            case 'shield':
                this.player.shield = Math.min(
                    this.player.shield + reward.value,
                    this.player.maxShield || 100
                );
                break;
            case 'weapon_upgrade':
                if (this.player.weaponLevel < this.player.maxWeaponLevel) {
                    this.player.weaponLevel++;
                }
                break;
        }
    }

    _startChallenge(mode) {
        this.challengeMode = mode;
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

        this.player.reset();
        this.enemySystem.clear();
        this.bullets.clearAll();
        this.powerups.clear();
        this.particles.clear();
        this.combo.reset();
        this.floatingText.clear();

        // Update collision system with challenge reference
        if (this.collision) {
            this.collision.challenge = this.challenge;
        }

        this.audio.startMusic();
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
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        // FPS counter
        this.frameCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 1) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }

        try {
            this._update(dt);
            this._draw();
        } catch (e) {
            console.error('Game loop error:', e);
        }

        requestAnimationFrame((t) => this._loop(t));
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
        this.player.update(dt, this.enemySystem.enemies);
        this.enemySystem.update(dt, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
        this.boss.update(dt, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, this.enemySystem);
        this.bullets.update(dt, this.enemySystem.enemies, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
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

        // Check game over
        if (this.player.lives <= 0 && !this.player.active && !this.player.respawning) {
            this.state = 'gameover';
            this.audio.stopMusic();
            this.ui.saveHighScore(this.player.score);
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
        this.player.update(dt, this.enemySystem.enemies);
        this.enemySystem.update(dt, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
        this.bullets.update(dt, this.enemySystem.enemies, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
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
        if (this.player.lives <= 0 && !this.player.active && !this.player.respawning) {
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
        this.player.draw(ctx);
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
        this.ui.drawHUD(ctx, this.player, this.levelManager);
        this.ui.drawNotifications(ctx);
        this.ui.drawFlash(ctx);

        // Overlays
        if (this.state === 'paused') {
            this.ui.drawPaused(ctx);
        } else if (this.state === 'gameover') {
            this.ui.drawGameOver(ctx, this.player.score);
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
