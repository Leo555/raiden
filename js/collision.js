// collision.js - Collision detection system (Enhanced with Combo & Graze)

import { circleCollision, rectCollision, distance } from './utils.js';

export class CollisionSystem {
    constructor(player, bullets, enemySystem, boss, powerups, particles, combo, floatingText, audio) {
        this.player = player;
        this.bullets = bullets;
        this.enemySystem = enemySystem;
        this.boss = boss;
        this.powerups = powerups;
        this.particles = particles;
        this.combo = combo;
        this.floatingText = floatingText;
        this.audio = audio;

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

        this._playerBulletsVsEnemies();
        this._playerBulletsVsBoss();
        this._enemyBulletsVsPlayer();
        this._grazeDetection();
        this._enemiesVsPlayer();
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

    _playerBulletsVsEnemies() {
        const bullets = this.bullets.playerBullets;
        const enemies = this.enemySystem.enemies;

        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const e = enemies[ei];
                if (!e.active) continue;

                if (rectCollision(
                    { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 },
                    { x: e.x, y: e.y, width: e.width, height: e.height }
                )) {
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
                    if (this.floatingText) {
                        this.floatingText.spawnScore(
                            this.boss.x + this.boss.width / 2,
                            this.boss.y + this.boss.height / 2,
                            bossScore
                        );
                    }
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
