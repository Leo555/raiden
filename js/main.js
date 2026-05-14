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

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = GAME_WIDTH;
        this.canvas.height = GAME_HEIGHT;

        this.state = 'menu'; // menu, playing, paused, gameover, levelcomplete
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
        this.enemySystem = new EnemySystem(this.bullets, this.particles, this.audio);
        this.boss = new Boss(this.bullets, this.particles, this.audio);
        this.powerups = new PowerUpSystem(this.particles);
        this.levelManager = new LevelManager(this.enemySystem, this.boss, this.audio);
        this.ui = new UISystem();

        // New systems
        this.combo = new ComboSystem(this.audio);
        this.floatingText = new FloatingTextSystem();

        // Pass combo and floatingText to collision
        this.collision = new CollisionSystem(
            this.player, this.bullets, this.enemySystem,
            this.boss, this.powerups, this.particles,
            this.combo, this.floatingText, this.audio
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
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            // Re-focus canvas after click to ensure keyboard works
            this.canvas.focus();

            this.audio.init();
            this.audio.resume();

            if (this.state === 'menu') {
                // Start menu music on first interaction if not playing
                if (!this.audio.musicPlaying) {
                    this.audio.playMenuMusic();
                }
                if (this.ui.isStartButtonClicked(x, y)) {
                    this._startGame(false);
                } else if (this.ui.isEndlessButtonClicked(x, y)) {
                    this._startGame(true);
                }
            } else if (this.state === 'gameover') {
                if (this.ui.isRestartButtonClicked(x, y)) {
                    this._startGame(false);
                } else if (this.ui.isMenuButtonClicked(x, y)) {
                    this.state = 'menu';
                    this.audio.playMenuMusic();
                }
            }
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

    _resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;
        const gameRatio = GAME_WIDTH / GAME_HEIGHT;
        const windowRatio = windowW / windowH;

        let displayW, displayH;
        if (windowRatio > gameRatio) {
            displayH = windowH;
            displayW = displayH * gameRatio;
        } else {
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

        if (this.state === 'paused' || this.state === 'menu' || this.state === 'gameover') {
            this.background.update(dt);
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

    _draw() {
        const ctx = this.ctx;

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
    }
}

// Start game when DOM loaded
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
