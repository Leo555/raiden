// enemies.js - Enemy system

import { GAME_WIDTH, GAME_HEIGHT, randRange, randInt, angleBetween } from './utils.js';

export const ENEMY_TYPES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    ELITE: 'elite'
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

export class EnemySystem {
    constructor(bullets, particles, audio) {
        this.bullets = bullets;
        this.particles = particles;
        this.audio = audio;
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
            return true; // destroyed
        }
        return false;
    }

    draw(ctx) {
        for (const e of this.enemies) {
            if (!e.active) continue;

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
}
