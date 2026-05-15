// enemies.js - Enemy system

import { GAME_WIDTH, GAME_HEIGHT, randRange, randInt, angleBetween } from './utils.js';

export const ENEMY_TYPES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    ELITE: 'elite',
    SPEEDY: 'speedy',
    ROTATING: 'rotating',
    SUICIDE: 'suicide'
};

export class Enemy {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.width = 24;
        this.height = 24;
        this.hp = 1;
        this.maxHp = 1;
        this.speed = 2;
        this.type = ENEMY_TYPES.SMALL;
        this.active = false;
        this.vx = 0;
        this.vy = 1;
        this.shootTimer = 0;
        this.shootCooldown = 120;
        this.score = 100;
        this.movePattern = 'straight';
        this.moveTimer = 0;
        this.startX = 0;
        this.dropPowerup = false;
        this.color = '#ff4444';
        this.flashTimer = 0;
    }
}

// == SpeedyEnemy - High speed dash enemy ==
export class SpeedyEnemy {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
        this.width = 28;
        this.height = 28;
        this.hp = 1;
        this.maxHp = 1;
        this.speed = 3;
        this.dashSpeed = 8;
        this.dashCooldown = 120; // 2 seconds
        this.dashTimer = 0;
        this.isDashing = false;
        this.dashDuration = 20;
        this.dashDurationTimer = 0;
        this.active = true;
        this.score = 100;
        this.flashTimer = 0;

        // Movement pattern
        this.movePattern = 'linear';
        this.moveTimer = 0;
    }

    update(dt, playerX, playerY) {
        this.moveTimer += dt * 60;
        this.flashTimer = Math.max(0, this.flashTimer - dt * 60);

        // Dash logic
        if (!this.isDashing) {
            this.dashTimer -= dt * 60;
            if (this.dashTimer <= 0) {
                this.isDashing = true;
                this.dashDurationTimer = this.dashDuration;
                this.flashTimer = 5;
            }
        } else {
            this.dashDurationTimer -= dt * 60;
            if (this.dashDurationTimer <= 0) {
                this.isDashing = false;
                this.dashTimer = this.dashCooldown;
            }
        }

        // Movement
        const speed = this.isDashing ? this.dashSpeed : this.speed;
        this.y += speed * dt * 60;

        // Remove if off screen
        if (this.y > GAME_HEIGHT + 50) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Flash when dashing
        if (this.isDashing || this.flashTimer > 0) {
            ctx.fillStyle = '#ffaa00';
        } else {
            ctx.fillStyle = '#ff4444';
        }

        // Draw speedy enemy (arrow shape)
        ctx.beginPath();
        ctx.moveTo(cx, this.y); // Top
        ctx.lineTo(this.x + this.width, cy); // Right
        ctx.lineTo(cx, this.y + this.height); // Bottom
        ctx.lineTo(this.x, cy); // Left
        ctx.closePath();
        ctx.fill();

        // Engine glow
        ctx.fillStyle = this.isDashing ? '#ffff00' : '#ff8800';
        ctx.beginPath();
        ctx.moveTo(cx - 4, this.y + this.height);
        ctx.lineTo(cx, this.y + this.height + 8);
        ctx.lineTo(cx + 4, this.y + this.height);
        ctx.fill();
    }

    hit(damage = 1) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false;
            return true; // Destroyed
        }
        return false;
    }

    reset() {
        this.active = false;
    }
}

// == RotatingEnemy - Fires rotating bullets ==
export class RotatingEnemy {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
        this.width = 32;
        this.height = 32;
        this.hp = 2;
        this.maxHp = 2;
        this.speed = 1.5;
        this.rotationAngle = 0;
        this.rotationSpeed = 0.05;
        this.fireCooldown = 60;
        this.fireTimer = 0;
        this.active = true;
        this.score = 150;
        this.flashTimer = 0;
    }

    update(dt, playerX, playerY) {
        this.y += this.speed * dt * 60;
        this.rotationAngle += this.rotationSpeed;
        this.fireTimer -= dt * 60;

        // Fire rotating bullets
        if (this.fireTimer <= 0) {
            this.fireTimer = this.fireCooldown;
        }

        // Remove if off screen
        if (this.y > GAME_HEIGHT + 50) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.rotationAngle);

        // Draw rotating enemy (cross shape)
        ctx.fillStyle = '#44ff44';
        ctx.fillRect(-this.width / 2, -4, this.width, 8);
        ctx.fillRect(-4, -this.height / 2, 8, this.height);

        // Center circle
        ctx.fillStyle = '#88ff88';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    hit(damage = 1) {
        this.hp -= damage;
        this.flashTimer = 5;
        if (this.hp <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }

    reset() {
        this.active = false;
    }
}

// == SuicideEnemy - Self-destruct enemy ==
export class SuicideEnemy {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
        this.width = 30;
        this.height = 30;
        this.hp = 1;
        this.maxHp = 1;
        this.speed = 2;
        this.armingDistance = 150; // Distance to arm explosion
        this.explosionRadius = 80;
        this.isArmed = false;
        this.active = true;
        this.score = 200;
        this.flashTimer = 0;
        this.warningTimer = 0;
    }

    update(dt, playerX, playerY) {
        // Move towards player
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const dx = playerX - centerX;
        const dy = playerY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt * 60;
            this.y += (dy / dist) * this.speed * dt * 60;
        }

        // Check if within arming distance
        if (dist <= this.armingDistance) {
            this.isArmed = true;
            this.warningTimer += dt * 60;
            this.flashTimer = 3;
        }

        // Remove if off screen
        if (this.y > GAME_HEIGHT + 50 || this.x < -50 || this.x > GAME_WIDTH + 50) {
            this.active = false;
        }
    }

    explode() {
        this.active = false;
        // Explosion handled in collision.js
    }

    draw(ctx) {
        if (!this.active) return;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Warning flash when armed
        if (this.isArmed) {
            ctx.fillStyle = this.warningTimer % 10 < 5 ? '#ff0000' : '#ff8800';
        } else {
            ctx.fillStyle = '#aa44ff';
        }

        // Draw suicide enemy (diamond shape)
        ctx.beginPath();
        ctx.moveTo(cx, this.y); // Top
        ctx.lineTo(cx + this.width / 2, cy); // Right
        ctx.lineTo(cx, this.y + this.height); // Bottom
        ctx.lineTo(cx - this.width / 2, cy); // Left
        ctx.closePath();
        ctx.fill();

        // Skull icon
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠', cx, cy);

        // Explosion radius indicator (when armed)
        if (this.isArmed) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, this.explosionRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    hit(damage = 1) {
        // Suicide enemies explode when hit
        this.explode();
        this.active = false;
        return true;
    }

    reset() {
        this.active = false;
    }
}

export class EnemySystem {
    constructor(bullets, particles, audio, powerups) {
        this.bullets = bullets;
        this.particles = particles;
        this.audio = audio;
        this.powerups = powerups || null;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 60;
        this.difficulty = 1;
    }

    spawnEnemy(type, x, y, pattern = 'straight', options = {}) {
        const e = new Enemy();
        e.type = type;
        e.x = x !== undefined ? x : randRange(30, GAME_WIDTH - 60);
        e.y = y !== undefined ? y : -40;
        e.startX = e.x;
        e.movePattern = pattern;
        e.active = true;

        switch (type) {
            case ENEMY_TYPES.SMALL:
                e.width = 22;
                e.height = 22;
                e.hp = 1;
                e.maxHp = 1;
                e.speed = 2 + this.difficulty * 0.2;
                e.score = 100;
                e.color = '#ee5544';
                e.shootCooldown = 999;
                break;
            case ENEMY_TYPES.MEDIUM:
                e.width = 30;
                e.height = 28;
                e.hp = 3 + Math.floor(this.difficulty * 0.5);
                e.maxHp = e.hp;
                e.speed = 1.5 + this.difficulty * 0.1;
                e.score = 300;
                e.color = '#cc44aa';
                e.shootCooldown = 80 - this.difficulty * 5;
                e.shootTimer = randRange(30, 60);
                break;
            case ENEMY_TYPES.LARGE:
                e.width = 40;
                e.height = 36;
                e.hp = 8 + Math.floor(this.difficulty);
                e.maxHp = e.hp;
                e.speed = 1 + this.difficulty * 0.05;
                e.score = 500;
                e.color = '#8844cc';
                e.shootCooldown = 50 - this.difficulty * 3;
                e.shootTimer = randRange(20, 40);
                break;
            case ENEMY_TYPES.ELITE:
                e.width = 28;
                e.height = 28;
                e.hp = 5 + Math.floor(this.difficulty * 0.5);
                e.maxHp = e.hp;
                e.speed = 2.5 + this.difficulty * 0.15;
                e.score = 800;
                e.color = '#ffaa00';
                e.shootCooldown = 60;
                e.shootTimer = randRange(20, 40);
                e.dropPowerup = true;
                break;
        }

        if (options.hp) e.hp = options.hp, e.maxHp = options.hp;
        if (options.speed) e.speed = options.speed;

        e.vy = e.speed;
        this.enemies.push(e);
        return e;
    }

    update(dt, playerX, playerY) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.active) {
                this.enemies.splice(i, 1);
                continue;
            }

            // Handle new enemy types
            if (e instanceof SpeedyEnemy) {
                e.update(dt, playerX, playerY);
                // Check if off screen
                if (e.y > GAME_HEIGHT + 50) {
                    e.active = false;
                    this.enemies.splice(i, 1);
                }
                continue;
            }
            if (e instanceof RotatingEnemy) {
                e.update(dt, playerX, playerY);
                // Check if off screen
                if (e.y > GAME_HEIGHT + 50) {
                    e.active = false;
                    this.enemies.splice(i, 1);
                }
                continue;
            }
            if (e instanceof SuicideEnemy) {
                e.update(dt, playerX, playerY);
                continue;
            }

            // Existing enemy update logic
            e.moveTimer += dt * 60;
            if (e.flashTimer > 0) e.flashTimer -= dt * 60;

            // Movement patterns
            switch (e.movePattern) {
                case 'straight':
                    e.y += e.vy * dt * 60;
                    break;
                case 'zigzag':
                    e.y += e.vy * dt * 60;
                    e.x = e.startX + Math.sin(e.moveTimer * 0.05) * 60;
                    break;
                case 'sine':
                    e.y += e.vy * dt * 60 * 0.7;
                    e.x = e.startX + Math.sin(e.moveTimer * 0.03) * 100;
                    break;
                case 'swoop':
                    if (e.moveTimer < 60) {
                        e.y += e.vy * dt * 60 * 1.5;
                    } else if (e.moveTimer < 120) {
                        e.y -= e.vy * dt * 60 * 0.3;
                        e.x += (e.startX < GAME_WIDTH / 2 ? 1 : -1) * e.speed * dt * 60;
                    } else {
                        e.y += e.vy * dt * 60;
                    }
                    break;
                case 'hover':
                    if (e.y < 100) {
                        e.y += e.vy * dt * 60;
                    } else {
                        e.x += Math.sin(e.moveTimer * 0.02) * 1.5;
                        e.y += Math.cos(e.moveTimer * 0.015) * 0.5;
                    }
                    break;
                case 'dive':
                    e.y += e.vy * dt * 60;
                    e.vy += 0.03;
                    break;
            }

            // Shooting
            if (e.type !== ENEMY_TYPES.SMALL) {
                e.shootTimer -= dt * 60;
                if (e.shootTimer <= 0 && e.y > 0 && e.y < GAME_HEIGHT * 0.7) {
                    this._enemyShoot(e, playerX, playerY);
                    e.shootTimer = e.shootCooldown;
                }
            }

            // Remove if off screen
            if (e.y > GAME_HEIGHT + 50 || e.x < -60 || e.x > GAME_WIDTH + 60) {
                e.active = false;
                this.enemies.splice(i, 1);
            }
        }
    }

    _enemyShoot(enemy, playerX, playerY) {
        const ex = enemy.x + enemy.width / 2;
        const ey = enemy.y + enemy.height;
        const angle = angleBetween(ex, ey, playerX, playerY);

        switch (enemy.type) {
            case ENEMY_TYPES.MEDIUM:
                this.bullets.fireEnemyBullet(ex, ey,
                    Math.cos(angle) * 3, Math.sin(angle) * 3);
                break;
            case ENEMY_TYPES.LARGE:
                // Spread shot
                for (let i = -2; i <= 2; i++) {
                    const a = angle + i * 0.15;
                    this.bullets.fireEnemyBullet(ex, ey,
                        Math.cos(a) * 2.5, Math.sin(a) * 2.5, 'enemy', '#ff66aa');
                }
                break;
            case ENEMY_TYPES.ELITE:
                // Double shot
                this.bullets.fireEnemyBullet(ex - 8, ey,
                    Math.cos(angle) * 4, Math.sin(angle) * 4, 'enemy', '#ffaa00');
                this.bullets.fireEnemyBullet(ex + 8, ey,
                    Math.cos(angle) * 4, Math.sin(angle) * 4, 'enemy', '#ffaa00');
                break;
        }
    }

    damageEnemy(enemy, damage) {
        // Handle new enemy types
        if (enemy instanceof SpeedyEnemy || enemy instanceof RotatingEnemy || enemy instanceof SuicideEnemy) {
            const destroyed = enemy.hit(damage);
            if (destroyed) {
                this.particles.explode(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    1
                );
                this.audio.playExplosion(0.8);

                // Power-up drop for new enemy types (5% chance)
                if (this.powerups && Math.random() < 0.05) {
                    this.powerups.spawnRandom(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2
                    );
                }
            }
            return destroyed;
        }

        // Existing enemy damage logic
        enemy.hp -= damage;
        enemy.flashTimer = 6;
        if (enemy.hp <= 0) {
            enemy.active = false;
            this.particles.explode(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                enemy.type === ENEMY_TYPES.LARGE ? 1.5 : 1
            );
            this.audio.playExplosion(enemy.type === ENEMY_TYPES.LARGE ? 1.5 : 0.8);

            // Power-up drop based on enemy type
            if (this.powerups) {
                let dropChance = 0.05; // Normal: 5%
                if (enemy.type === ENEMY_TYPES.ELITE) dropChance = 0.10; // Elite: 10%

                if (Math.random() < dropChance) {
                    this.powerups.spawnRandom(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2
                    );
                }
            }

            return true; // destroyed
        }
        return false;
    }

    draw(ctx) {
        for (const e of this.enemies) {
            if (!e.active) continue;

            // Handle new enemy types
            if (e instanceof SpeedyEnemy) {
                e.draw(ctx);
                continue;
            }
            if (e instanceof RotatingEnemy) {
                e.draw(ctx);
                continue;
            }
            if (e instanceof SuicideEnemy) {
                e.draw(ctx);
                continue;
            }

            ctx.save();
            const cx = e.x + e.width / 2;
            const cy = e.y + e.height / 2;

            // Flash white on hit
            if (e.flashTimer > 0) {
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.fillStyle = e.color;
            }

            switch (e.type) {
                case ENEMY_TYPES.SMALL:
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y + e.height);
                    ctx.lineTo(e.x, e.y);
                    ctx.lineTo(e.x + e.width, e.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#ff8866';
                    ctx.fillRect(cx - 3, e.y + 4, 6, 6);
                    break;

                case ENEMY_TYPES.MEDIUM:
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y + e.height);
                    ctx.lineTo(e.x - 3, e.y + e.height * 0.4);
                    ctx.lineTo(e.x + 5, e.y);
                    ctx.lineTo(e.x + e.width - 5, e.y);
                    ctx.lineTo(e.x + e.width + 3, e.y + e.height * 0.4);
                    ctx.closePath();
                    ctx.fill();
                    // Cockpit
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#ff88cc';
                    ctx.beginPath();
                    ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case ENEMY_TYPES.LARGE:
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y + e.height + 5);
                    ctx.lineTo(e.x - 5, e.y + e.height * 0.5);
                    ctx.lineTo(e.x, e.y);
                    ctx.lineTo(e.x + e.width, e.y);
                    ctx.lineTo(e.x + e.width + 5, e.y + e.height * 0.5);
                    ctx.closePath();
                    ctx.fill();
                    // Detail
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#aa33aa';
                    ctx.fillRect(e.x + 5, e.y + 5, e.width - 10, e.height - 15);
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#cc66cc';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                    ctx.fill();
                    // HP bar
                    if (e.hp < e.maxHp) {
                        const barW = e.width;
                        const hpRatio = e.hp / e.maxHp;
                        ctx.fillStyle = '#333';
                        ctx.fillRect(e.x, e.y - 6, barW, 3);
                        ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffaa00' : '#ff4444';
                        ctx.fillRect(e.x, e.y - 6, barW * hpRatio, 3);
                    }
                    break;

                case ENEMY_TYPES.ELITE:
                    // Diamond shape
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y);
                    ctx.lineTo(e.x + e.width, cy);
                    ctx.lineTo(cx, e.y + e.height);
                    ctx.lineTo(e.x, cy);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#ffcc00';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                    ctx.fill();
                    // Glow
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ffaa00';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    break;
            }

            ctx.restore();
        }
    }

    clear() {
        this.enemies = [];
    }

    // == Spawn methods for new enemy types ==

    spawnSpeedyEnemy(x, y) {
        const enemy = new SpeedyEnemy(x, y);
        this.enemies.push(enemy);
    }

    spawnRotatingEnemy(x, y) {
        const enemy = new RotatingEnemy(x, y);
        this.enemies.push(enemy);
    }

    spawnSuicideEnemy(x, y) {
        const enemy = new SuicideEnemy(x, y);
        this.enemies.push(enemy);
    }

    // == Update with new enemy type support ==

    update(dt, playerX, playerY) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.active) {
                this.enemies.splice(i, 1);
                continue;
            }

            // Handle new enemy types
            if (e instanceof SpeedyEnemy || e instanceof RotatingEnemy || e instanceof SuicideEnemy) {
                e.update(dt, playerX, playerY);
            } else {
                // Existing enemy update logic
                e.moveTimer += dt * 60;
                if (e.flashTimer > 0) e.flashTimer -= dt * 60;

                // Movement patterns
                switch (e.movePattern) {
                    case 'straight':
                        e.y += e.vy * dt * 60;
                        break;
                    case 'zigzag':
                        e.y += e.vy * dt * 60;
                        e.x = e.startX + Math.sin(e.moveTimer * 0.05) * 60;
                        break;
                    case 'sine':
                        e.y += e.vy * dt * 60 * 0.7;
                        e.x = e.startX + Math.sin(e.moveTimer * 0.03) * 100;
                        break;
                    case 'swoop':
                        if (e.moveTimer < 60) {
                            e.y += e.vy * dt * 60 * 1.5;
                        } else if (e.moveTimer < 120) {
                            e.y -= e.vy * dt * 60 * 0.3;
                            e.x += (e.startX < GAME_WIDTH / 2 ? 1 : -1) * e.speed * dt * 60;
                        } else {
                            e.y += e.vy * dt * 60;
                        }
                        break;
                    case 'hover':
                        if (e.y < 100) {
                            e.y += e.vy * dt * 60;
                        } else {
                            e.x += Math.sin(e.moveTimer * 0.02) * 1.5;
                            e.y += Math.cos(e.moveTimer * 0.015) * 0.5;
                        }
                        break;
                    case 'dive':
                        e.y += e.vy * dt * 60;
                        e.vy += 0.03;
                        break;
                }

                // Shooting
                if (e.type !== ENEMY_TYPES.SMALL) {
                    e.shootTimer -= dt * 60;
                    if (e.shootTimer <= 0 && e.y > 0 && e.y < GAME_HEIGHT * 0.7) {
                        this._enemyShoot(e, playerX, playerY);
                        e.shootTimer = e.shootCooldown;
                    }
                }
            }

            // Remove if off screen (for all enemy types)
            if (e.y > GAME_HEIGHT + 50 || e.x < -60 || e.x > GAME_WIDTH + 60) {
                e.active = false;
                this.enemies.splice(i, 1);
            }
        }
    }

    // == Draw with new enemy type support ==

    draw(ctx) {
        for (const e of this.enemies) {
            if (!e.active) continue;

            // Handle new enemy types
            if (e instanceof SpeedyEnemy) {
                e.draw(ctx);
                continue;
            }
            if (e instanceof RotatingEnemy) {
                e.draw(ctx);
                continue;
            }
            if (e instanceof SuicideEnemy) {
                e.draw(ctx);
                continue;
            }

            // Existing enemy draw logic
            ctx.save();
            const cx = e.x + e.width / 2;
            const cy = e.y + e.height / 2;

            // Flash white on hit
            if (e.flashTimer > 0) {
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.fillStyle = e.color;
            }

            switch (e.type) {
                case ENEMY_TYPES.SMALL:
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y + e.height);
                    ctx.lineTo(e.x, e.y);
                    ctx.lineTo(e.x + e.width, e.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#ff8866';
                    ctx.fillRect(cx - 3, e.y + 4, 6, 6);
                    break;

                case ENEMY_TYPES.MEDIUM:
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y + e.height);
                    ctx.lineTo(e.x - 3, e.y + e.height * 0.4);
                    ctx.lineTo(e.x + 5, e.y);
                    ctx.lineTo(e.x + e.width - 5, e.y);
                    ctx.lineTo(e.x + e.width + 3, e.y + e.height * 0.4);
                    ctx.closePath();
                    ctx.fill();
                    // Cockpit
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#ff88cc';
                    ctx.beginPath();
                    ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case ENEMY_TYPES.LARGE:
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y + e.height + 5);
                    ctx.lineTo(e.x - 5, e.y + e.height * 0.5);
                    ctx.lineTo(e.x, e.y);
                    ctx.lineTo(e.x + e.width, e.y);
                    ctx.lineTo(e.x + e.width + 5, e.y + e.height * 0.5);
                    ctx.closePath();
                    ctx.fill();
                    // Detail
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#aa33aa';
                    ctx.fillRect(e.x + 5, e.y + 5, e.width - 10, e.height - 15);
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#cc66cc';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                    ctx.fill();
                    // HP bar
                    if (e.hp < e.maxHp) {
                        const barW = e.width;
                        const hpRatio = e.hp / e.maxHp;
                        ctx.fillStyle = '#333';
                        ctx.fillRect(e.x, e.y - 6, barW, 3);
                        ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffaa00' : '#ff4444';
                        ctx.fillRect(e.x, e.y - 6, barW * hpRatio, 3);
                    }
                    break;

                case ENEMY_TYPES.ELITE:
                    // Diamond shape
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y);
                    ctx.lineTo(e.x + e.width, cy);
                    ctx.lineTo(cx, e.y + e.height);
                    ctx.lineTo(e.x, cy);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : '#ffcc00';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                    ctx.fill();
                    // Glow
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ffaa00';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    break;
            }

            ctx.restore();
        }
    }

    damageEnemy(enemy, damage) {
        // Handle new enemy types
        if (enemy instanceof SpeedyEnemy || enemy instanceof RotatingEnemy || enemy instanceof SuicideEnemy) {
            const destroyed = enemy.hit(damage);
            if (destroyed) {
                this.particles.explode(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    1
                );
                this.audio.playExplosion(0.8);

                // Power-up drop for new enemy types (5% chance)
                if (this.powerups && Math.random() < 0.05) {
                    this.powerups.spawnRandom(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2
                    );
                }
            }
            return destroyed;
        }

        // Existing enemy damage logic
        enemy.hp -= damage;
        enemy.flashTimer = 6;
        if (enemy.hp <= 0) {
            enemy.active = false;
            this.particles.explode(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                enemy.type === ENEMY_TYPES.LARGE ? 1.5 : 1
            );
            this.audio.playExplosion(enemy.type === ENEMY_TYPES.LARGE ? 1.5 : 0.8);

            // Power-up drop based on enemy type
            if (this.powerups) {
                let dropChance = 0.05; // Normal: 5%
                if (enemy.type === ENEMY_TYPES.ELITE) dropChance = 0.10; // Elite: 10%

                if (Math.random() < dropChance) {
                    this.powerups.spawnRandom(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2
                    );
                }
            }

            return true; // destroyed
        }
        return false;
    }
}
