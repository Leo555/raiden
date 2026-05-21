// collision.js - Collision detection system (Enhanced with Combo & Graze)

import { rectCollision, distance, GAME_WIDTH, GAME_HEIGHT } from './utils.js';
import { SuicideEnemy } from './enemies.js';

export class CollisionSystem {
    constructor(player, bullets, enemySystem, boss, powerups, particles, combo, floatingText, audio, challenge = null, ui = null) {
        this.player = player;
        this.bullets = bullets;
        this.enemySystem = enemySystem;
        this.boss = boss;
        this.powerups = powerups;
        this.particles = particles;
        this.combo = combo;
        this.floatingText = floatingText;
        this.audio = audio;
        this.challenge = challenge;
        this.ui = ui;

        // Graze settings
        this.grazeDistance = 20; // Outer graze radius
        this.grazeInner = 5;    // Inner (too close) threshold - not used for exclusion, just min
        this.grazedBullets = new Set(); // Track which bullets have already triggered graze
        this.grazeBaseScore = 50;
        this.grazeConsecutive = 0;
        this.grazeConsecutiveTimer = 0;
    }

    update(dt) {
        if (!this.player.active) return;

        // Check if any nuke bullets have reached the upper third of the screen
        // and auto-detonate (so a nuke is never wasted on an empty screen).
        this._checkNukeAutoDetonate();

        this._playerBulletsVsEnemies();
        this._playerBulletsVsBoss();
        this._enemyBulletsVsPlayer();
        this._grazeDetection();
        this._enemiesVsPlayer();
        this._checkSuicideExplosions();
        this._playerVsPowerups();
        this._playerVsBomb();

        // Update graze consecutive timer
        if (this.grazeConsecutiveTimer > 0) {
            this.grazeConsecutiveTimer -= dt;
            if (this.grazeConsecutiveTimer <= 0) {
                this.grazeConsecutive = 0;
            }
        }
    }

    _checkNukeAutoDetonate() {
        const detonateY = GAME_HEIGHT * 0.4; // upper-mid area
        const playerBullets = this.bullets.playerBullets;
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const b = playerBullets[i];
            if (b.type === 'nuke' && b.y <= detonateY) {
                this._handleNukeAOE(b);
                playerBullets.splice(i, 1);
                this.bullets.pool.release(b);
            }
        }
    }

    _playerBulletsVsEnemies() {
        const bullets = this.bullets.playerBullets;
        const enemies = this.enemySystem.enemies;

        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            // Pre-compute bullet AABB once, then test against every enemy
            // with an inlined check to avoid allocating two literal objects
            // per (bullet, enemy) pair (used to be the dominant GC source).
            const bL = b.x - b.radius;
            const bR = b.x + b.radius;
            const bT = b.y - b.radius;
            const bB = b.y + b.radius;
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const e = enemies[ei];
                if (!e.active) continue;

                if (
                    bL < e.x + e.width &&
                    bR > e.x &&
                    bT < e.y + e.height &&
                    bB > e.y
                ) {
                    const destroyed = this.enemySystem.damageEnemy(e, b.damage);

                    // Show damage number
                    if (this.floatingText) {
                        this.floatingText.spawnDamage(
                            b.x, b.y, b.damage
                        );
                    }

                    if (destroyed) {
                        // Use combo system for score calculation
                        let finalScore = e.score;
                        if (this.combo) {
                            finalScore = this.combo.addKill(e.score);
                        }
                        this.player.score += finalScore;

                        // Notify challenge mode
                        if (this.challenge && this.challenge.isActive) {
                            this.challenge.onEnemyKill(finalScore);
                        }

                        // Show score floating text
                        if (this.floatingText) {
                            const ex = e.x + e.width / 2;
                            const ey = e.y + e.height / 2;
                            this.floatingText.spawnScore(ex, ey, finalScore);
                            // Show bonus if multiplier > 1
                            const bonus = finalScore - e.score;
                            if (bonus > 0) {
                                this.floatingText.spawnComboBonus(ex, ey - 15, bonus);
                            }
                        }

                        // Drop powerup
                        if (e.dropPowerup || Math.random() < 0.15) {
                            this.powerups.spawnRandom(
                                e.x + e.width / 2,
                                e.y + e.height / 2
                            );
                        }

                        // Handle explosive bullet AOE
                        if (b.type === 'explosive') {
                            this._handleExplosiveAOE(b, e);
                        }
                        // Handle nuke - massive AOE that destroys most enemies on screen
                        if (b.type === 'nuke') {
                            this._handleNukeAOE(b);
                        }
                    }

                    // Remove bullet (unless it's a piercing laser at level 5)
                    if (b.type !== 'laser') {
                        bullets.splice(bi, 1);
                        this.bullets.pool.release(b);
                    }
                    break;
                }
            }
        }
    }

    _handleExplosiveAOE(bullet, hitEnemy) {
        // Apply AOE damage to nearby enemies
        const aoERadius = 60;
        const aoEDamage = 2;
        const bx = bullet.x;
        const by = bullet.y;

        // Create explosion effect
        if (this.particles) {
            this.particles.explode(bx, by, '#ff8800', 15);
            this.particles.explode(bx, by, '#ff4400', 10);
        }

        // Damage nearby enemies
        for (const enemy of this.enemySystem.enemies) {
            if (!enemy.active || enemy === hitEnemy) continue;

            const enemyCX = enemy.x + enemy.width / 2;
            const enemyCY = enemy.y + enemy.height / 2;
            const dx = enemyCX - bx;
            const dy = enemyCY - by;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= aoERadius) {
                this.enemySystem.damageEnemy(enemy, aoEDamage);
            }
        }
    }

    /**
     * NUKE detonation: ULTIMATE WEAPON.
     * - Destroys/heavily damages ALL enemies on screen (no radius limit)
     * - Massive damage to boss
     * - Clears ALL enemy bullets on screen
     * - Full-screen white flash + intense screen shake
     * - Spectacular particle wave radiating across the entire screen
     */
    _handleNukeAOE(bullet) {
        const bx = bullet.x;
        const by = bullet.y;
        const enemyDamage = 999;     // one-shot any normal enemy
        const bossDamage = 50;        // huge chunk of boss HP

        // ---- Soft pink flash (less intense than pure white) ----
        if (this.ui && this.ui.flash) {
            this.ui.flash('#ff88cc', 0.4);
        }

        // ---- Intense screen shake ----
        if (this.ui && this.ui.shake) {
            this.ui.shake(20);
        }

        // ---- Audio ----
        if (this.audio && this.audio.playBomb) {
            this.audio.playBomb();
        }

        // ---- Center explosion (epicenter) ----
        if (this.particles) {
            this.particles.explode(bx, by, '#ffffff', 50);
            this.particles.explode(bx, by, '#ff2299', 40);
            this.particles.explode(bx, by, '#ff66cc', 30);
        }

        // ---- Expanding shockwave: rings of particles spreading outward ----
        if (this.particles) {
            // Inner ring
            for (let i = 0; i < 24; i++) {
                const a = (i / 24) * Math.PI * 2;
                const r = 80;
                this.particles.explode(bx + Math.cos(a) * r, by + Math.sin(a) * r, '#ff44aa', 1.5);
            }
            // Mid ring
            for (let i = 0; i < 32; i++) {
                const a = (i / 32) * Math.PI * 2 + 0.1;
                const r = 180;
                this.particles.explode(bx + Math.cos(a) * r, by + Math.sin(a) * r, '#ff88cc', 1.2);
            }
            // Outer ring
            for (let i = 0; i < 40; i++) {
                const a = (i / 40) * Math.PI * 2 + 0.2;
                const r = 300;
                this.particles.explode(bx + Math.cos(a) * r, by + Math.sin(a) * r, '#ffaadd', 0.8);
            }
            // Random scattered debris across the entire screen
            for (let i = 0; i < 60; i++) {
                const ex = Math.random() * GAME_WIDTH;
                const ey = Math.random() * GAME_HEIGHT;
                const colors = ['#ff2299', '#ff66cc', '#ffaadd', '#ffffff'];
                const color = colors[i % colors.length];
                this.particles.explode(ex, ey, color, 0.6 + Math.random() * 0.6);
            }
        }

        // ---- DESTROY ALL enemies on screen ----
        for (const enemy of this.enemySystem.enemies) {
            if (!enemy.active) continue;
            const enemyCX = enemy.x + enemy.width / 2;
            const enemyCY = enemy.y + enemy.height / 2;

            // Stagger small explosion at each enemy position for visual impact
            if (this.particles) {
                this.particles.explode(enemyCX, enemyCY, '#ff66cc', 1.5);
            }

            const destroyed = this.enemySystem.damageEnemy(enemy, enemyDamage);
            if (destroyed) {
                let finalScore = enemy.score;
                if (this.combo) finalScore = this.combo.addKill(enemy.score);
                this.player.score += finalScore;
                if (this.challenge && this.challenge.isActive) {
                    this.challenge.onEnemyKill(finalScore);
                }
                if (this.floatingText) {
                    this.floatingText.spawnScore(enemyCX, enemyCY, finalScore);
                }
            }
        }

        // ---- Massive damage to boss (anywhere on screen) ----
        if (this.boss.active && !this.boss.entering && !this.boss.defeated) {
            this.boss.damage(bossDamage);
            if (this.floatingText) {
                this.floatingText.spawnCritical(
                    this.boss.x + this.boss.width / 2,
                    this.boss.y + this.boss.height / 2,
                    bossDamage
                );
            }
        }

        // ---- Clear ALL enemy bullets on screen ----
        const enemyBullets = this.bullets.enemyBullets;
        // Spawn small particle puffs where each bullet was, for visual feedback
        if (this.particles) {
            for (const eb of enemyBullets) {
                this.particles.emit(eb.x, eb.y, 2, {
                    speed: 1.5,
                    size: 2,
                    life: 12,
                    color: '#ffaadd'
                });
            }
        }
        // Release all enemy bullets back to the pool
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            this.bullets.pool.release(enemyBullets[i]);
        }
        this.bullets.enemyBullets = [];
    }

    _playerBulletsVsBoss() {
        if (!this.boss.active || this.boss.entering || this.boss.defeated) return;

        const bullets = this.bullets.playerBullets;
        const bossRect = {
            x: this.boss.x,
            y: this.boss.y,
            width: this.boss.width,
            height: this.boss.height
        };

        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            const bulletRect = {
                x: b.x - b.radius,
                y: b.y - b.radius,
                width: b.radius * 2,
                height: b.radius * 2
            };

            if (rectCollision(bulletRect, bossRect)) {
                const defeated = this.boss.damage(b.damage);

                // Show damage number on boss (critical style for big hits)
                if (this.floatingText) {
                    if (b.damage >= 2) {
                        this.floatingText.spawnCritical(b.x, b.y, b.damage);
                    } else {
                        this.floatingText.spawnDamage(b.x, b.y, b.damage);
                    }
                }

                if (defeated) {
                    let bossScore = 5000;
                    if (this.combo) {
                        bossScore = this.combo.addKill(5000);
                    }
                    this.player.score += bossScore;

                    // Notify challenge mode
                    if (this.challenge && this.challenge.isActive) {
                        this.challenge.onEnemyKill(bossScore);
                    }

                    if (this.floatingText) {
                        this.floatingText.spawnScore(
                            this.boss.x + this.boss.width / 2,
                            this.boss.y + this.boss.height / 2,
                            bossScore
                        );
                    }
                }
                // Trigger nuke AOE when a nuke directly hits the boss
                if (b.type === 'nuke') {
                    this._handleNukeAOE(b);
                }
                bullets.splice(bi, 1);
                this.bullets.pool.release(b);
            }
        }
    }

    _enemyBulletsVsPlayer() {
        if (this.player.invincible || !this.player.active) return;

        const bullets = this.bullets.enemyBullets;
        const playerRect = {
            x: this.player.x + 8,
            y: this.player.y + 8,
            width: this.player.width - 16,
            height: this.player.height - 16
        };

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            const bulletRect = {
                x: b.x - b.radius,
                y: b.y - b.radius,
                width: b.radius * 2,
                height: b.radius * 2
            };

            if (rectCollision(bulletRect, playerRect)) {
                this.player.hit();
                bullets.splice(i, 1);
                this.bullets.pool.release(b);

                // Combo breaks on hit
                if (this.combo && this.combo.count > 0) {
                    this.combo._breakCombo();
                }
                break;
            }
        }
    }

    /**
     * Graze detection: check enemy bullets passing near but not hitting player.
     */
    _grazeDetection() {
        if (!this.player.active || this.player.invincible) return;

        const bullets = this.bullets.enemyBullets;
        const playerCX = this.player.x + this.player.width / 2;
        const playerCY = this.player.y + this.player.height / 2;

        for (const b of bullets) {
            // Skip bullets already grazed
            if (this.grazedBullets.has(b)) continue;

            const dist = distance(playerCX, playerCY, b.x, b.y);

            // Within graze range but not hitting (hitting is handled separately)
            if (dist > this.grazeInner + b.radius && dist < this.grazeDistance + b.radius) {
                this.grazedBullets.add(b);
                this._triggerGraze(b.x, b.y, playerCX, playerCY);
            }
        }

        // Clean up grazed bullet references for bullets that no longer exist
        if (this.grazedBullets.size > 100) {
            const activeBullets = new Set(bullets);
            for (const b of this.grazedBullets) {
                if (!activeBullets.has(b)) {
                    this.grazedBullets.delete(b);
                }
            }
        }
    }

    /**
     * Trigger a graze event.
     */
    _triggerGraze(bx, by, px, py) {
        // Consecutive graze bonus
        this.grazeConsecutive++;
        this.grazeConsecutiveTimer = 1.0; // 1 second window for consecutive

        const bonus = Math.min(this.grazeConsecutive, 5); // Max 5x consecutive bonus
        const score = this.grazeBaseScore + (bonus - 1) * 10;

        this.player.score += score;

        // Notify combo system
        if (this.combo) {
            this.combo.addGraze(score);
        }

        // Floating text
        if (this.floatingText) {
            this.floatingText.spawnGraze(bx, by, score);
        }

        // Graze particle effect (white arc/spark)
        if (this.particles) {
            const angle = Math.atan2(by - py, bx - px);
            // White arc sparks
            for (let i = 0; i < 4; i++) {
                this.particles.emit(bx, by, 1, {
                    angle: angle + Math.PI + (i - 1.5) * 0.4,
                    angleSpread: 0.2,
                    speed: 2 + Math.random() * 2,
                    size: 1.5,
                    life: 10,
                    color: '#ffffff',
                    type: 'spark'
                });
            }
            // Faint blue glow
            this.particles.emit(px, py, 2, {
                speed: 0.5,
                size: 3,
                life: 8,
                color: '#88ccff'
            });
        }

        // Play graze sound
        if (this.audio) {
            this.audio.playGraze();
        }
    }

    /**
     * Check suicide enemy explosions (AOE damage).
     */
    _checkSuicideExplosions() {
        if (!this.player.active || this.player.invincible) return;

        const enemies = this.enemySystem.enemies;
        const playerCX = this.player.x + this.player.width / 2;
        const playerCY = this.player.y + this.player.height / 2;

        for (const enemy of enemies) {
            if (!enemy.active || !(enemy instanceof SuicideEnemy)) continue;
            if (!enemy.isArmed) continue;

            // Check distance to player
            const enemyCX = enemy.x + enemy.width / 2;
            const enemyCY = enemy.y + enemy.height / 2;
            const dx = playerCX - enemyCX;
            const dy = playerCY - enemyCY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= enemy.explosionRadius) {
                // Player takes damage
                this.player.hit();

                // Create explosion effect
                this.particles.explode(enemyCX, enemyCY, '#ff4444', 20);
                this.particles.explode(enemyCX, enemyCY, '#ffaa00', 15);

                // Deactivate enemy
                enemy.active = false;

                // Shake screen
                this.ui.shake(8);

                // Break combo
                if (this.combo && this.combo.count > 0) {
                    this.combo._breakCombo();
                }
            }
        }
    }

    _enemiesVsPlayer() {
        if (this.player.invincible || !this.player.active) return;

        const enemies = this.enemySystem.enemies;
        const playerRect = {
            x: this.player.x + 4,
            y: this.player.y + 4,
            width: this.player.width - 8,
            height: this.player.height - 8
        };

        for (const e of enemies) {
            if (!e.active) continue;
            if (rectCollision(playerRect, { x: e.x, y: e.y, width: e.width, height: e.height })) {
                this.player.hit();
                this.enemySystem.damageEnemy(e, 5);
                if (this.combo && this.combo.count > 0) {
                    this.combo._breakCombo();
                }
                break;
            }
        }

        // Boss collision
        if (this.boss.active && !this.boss.entering && !this.boss.defeated) {
            const bossRect = {
                x: this.boss.x,
                y: this.boss.y,
                width: this.boss.width,
                height: this.boss.height
            };
            if (rectCollision(playerRect, bossRect)) {
                this.player.hit();
                if (this.combo && this.combo.count > 0) {
                    this.combo._breakCombo();
                }
            }
        }
    }

    _playerVsPowerups() {
        const playerRect = {
            x: this.player.x - 5,
            y: this.player.y - 5,
            width: this.player.width + 10,
            height: this.player.height + 10
        };

        for (let i = this.powerups.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups.powerups[i];
            if (!p.active) continue;
            if (rectCollision(playerRect, { x: p.x, y: p.y, width: p.width, height: p.height })) {
                this.powerups.collect(p, this.player);
                break;
            }
        }
    }

    _playerVsBomb() {
        if (!this.player.bombActive) return;

        // Damage all enemies on screen
        const enemies = this.enemySystem.enemies;
        for (const e of enemies) {
            if (e.active) {
                const destroyed = this.enemySystem.damageEnemy(e, 10);
                if (destroyed) {
                    let score = e.score;
                    if (this.combo) {
                        score = this.combo.addKill(e.score);
                    }
                    this.player.score += score;
                } else {
                    this.player.score += e.score;
                }
            }
        }

        // Damage boss
        if (this.boss.active && !this.boss.entering && !this.boss.defeated) {
            this.boss.damage(15);
        }

        // Clear enemy bullets
        this.bullets.clearEnemyBullets();
        // Clear grazed references
        this.grazedBullets.clear();

        this.player.bombActive = false;
    }
}
