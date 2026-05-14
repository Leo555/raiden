// player.js - Player ship system

import { GAME_WIDTH, GAME_HEIGHT, clamp } from './utils.js';

export class Player {
    constructor(bullets, particles, audio, input) {
        this.bullets = bullets;
        this.particles = particles;
        this.audio = audio;
        this.input = input;

        this.width = 32;
        this.height = 36;
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.y = GAME_HEIGHT - 80;
        this.speed = 5;

        this.lives = 3;
        this.shield = 3;
        this.maxShield = 3;
        this.bombs = 3;
        this.weaponLevel = 1;
        this.maxWeaponLevel = 5;
        this.score = 0;

        this.invincible = false;
        this.invincibleTimer = 0;
        this.invincibleDuration = 120; // frames

        this.shootTimer = 0;
        this.shootCooldown = 8;
        this.missileTimer = 0;
        this.missileCooldown = 40;
        this.hasTempMissile = false;
        this.tempMissileTimer = 0;

        this.active = true;
        this.respawning = false;
        this.respawnTimer = 0;

        this.bombActive = false;
        this.bombTimer = 0;
        this.bombCooldown = 0;

        this.engineFlicker = 0;
    }

    reset() {
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.y = GAME_HEIGHT - 80;
        this.lives = 3;
        this.shield = 3;
        this.bombs = 3;
        this.weaponLevel = 1;
        this.score = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.active = true;
        this.respawning = false;
        this.hasTempMissile = false;
    }

    update(dt, enemies) {
        if (!this.active) {
            if (this.respawning) {
                this.respawnTimer -= dt * 60;
                if (this.respawnTimer <= 0) {
                    this.active = true;
                    this.respawning = false;
                    this.invincible = true;
                    this.invincibleTimer = this.invincibleDuration;
                    this.x = GAME_WIDTH / 2 - this.width / 2;
                    this.y = GAME_HEIGHT - 80;
                }
            }
            return;
        }

        // Movement
        let dx = 0, dy = 0;
        if (this.input.isLeft()) dx -= 1;
        if (this.input.isRight()) dx += 1;
        if (this.input.isUp()) dy -= 1;
        if (this.input.isDown()) dy += 1;

        // Mouse/touch control
        if (this.input.touch.active) {
            const tx = this.input.touch.x - this.width / 2;
            const ty = this.input.touch.y - this.height / 2;
            dx = (tx - this.x) * 0.15;
            dy = (ty - this.y) * 0.15;
            this.x += dx;
            this.y += dy;
        } else if (this.input.mouse.down && this.input.usingMouse) {
            const tx = this.input.mouse.x - this.width / 2;
            const ty = this.input.mouse.y - this.height / 2;
            dx = (tx - this.x) * 0.12;
            dy = (ty - this.y) * 0.12;
            this.x += dx;
            this.y += dy;
        } else {
            // Normalize diagonal
            if (dx !== 0 && dy !== 0) {
                dx *= 0.707;
                dy *= 0.707;
            }
            this.x += dx * this.speed * dt * 60;
            this.y += dy * this.speed * dt * 60;
        }

        // Clamp position
        this.x = clamp(this.x, 0, GAME_WIDTH - this.width);
        this.y = clamp(this.y, 0, GAME_HEIGHT - this.height);

        // Invincibility
        if (this.invincible) {
            this.invincibleTimer -= dt * 60;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        // Auto shoot
        this.shootTimer -= dt * 60;
        if (this.shootTimer <= 0) {
            this._shoot(enemies);
            this.shootTimer = this.shootCooldown;
        }

        // Missile shooting
        if (this.weaponLevel >= 4 || this.hasTempMissile) {
            this.missileTimer -= dt * 60;
            if (this.missileTimer <= 0 && enemies.length > 0) {
                const target = this._findTarget(enemies);
                if (target) {
                    this.bullets.fireMissile(this.x + this.width / 2, this.y, target);
                    this.missileTimer = this.missileCooldown;
                }
            }
        }

        // Temp missile timer
        if (this.hasTempMissile) {
            this.tempMissileTimer -= dt * 60;
            if (this.tempMissileTimer <= 0) {
                this.hasTempMissile = false;
            }
        }

        // Bomb
        if (this.bombCooldown > 0) this.bombCooldown -= dt * 60;
        if (this.input.isBomb() && this.bombs > 0 && this.bombCooldown <= 0) {
            this.useBomb();
            this.input.clearKey('Space');
        }

        if (this.bombActive) {
            this.bombTimer -= dt * 60;
            if (this.bombTimer <= 0) {
                this.bombActive = false;
            }
        }

        this.engineFlicker += dt * 60;
    }

    _shoot(enemies) {
        const cx = this.x + this.width / 2;
        const cy = this.y;

        this.audio.playShoot();

        switch (this.weaponLevel) {
            case 1:
                this.bullets.firePlayerBullet(cx, cy, 0, -10, 1);
                break;
            case 2:
                this.bullets.firePlayerBullet(cx - 5, cy, 0, -10, 1);
                this.bullets.firePlayerBullet(cx + 5, cy, 0, -10, 1);
                break;
            case 3:
                this.bullets.firePlayerBullet(cx, cy, 0, -10, 1);
                this.bullets.firePlayerBullet(cx - 5, cy, -1.5, -9.5, 1);
                this.bullets.firePlayerBullet(cx + 5, cy, 1.5, -9.5, 1);
                break;
            case 4:
                this.bullets.firePlayerBullet(cx, cy, 0, -10, 1);
                this.bullets.firePlayerBullet(cx - 5, cy, -1.2, -9.5, 1);
                this.bullets.firePlayerBullet(cx + 5, cy, 1.2, -9.5, 1);
                this.bullets.firePlayerBullet(cx - 10, cy, -2.5, -9, 1);
                this.bullets.firePlayerBullet(cx + 10, cy, 2.5, -9, 1);
                break;
            case 5:
                // Wide spread + faster fire
                for (let i = -3; i <= 3; i++) {
                    this.bullets.firePlayerBullet(cx + i * 6, cy, i * 0.8, -10, 1, 'normal', '#88ffcc');
                }
                // Laser effect (rapid thin bullets)
                this.bullets.firePlayerBullet(cx, cy - 10, 0, -14, 2, 'normal', '#ffffff');
                break;
        }
    }

    _findTarget(enemies) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const e of enemies) {
            if (!e.active || e.hp <= 0) continue;
            const dx = e.x + e.width / 2 - (this.x + this.width / 2);
            const dy = e.y + e.height / 2 - this.y;
            const dist = dx * dx + dy * dy;
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = e;
            }
        }
        return nearest;
    }

    useBomb() {
        if (this.bombs <= 0 || this.bombCooldown > 0) return;
        this.bombs--;
        this.bombActive = true;
        this.bombTimer = 30;
        this.bombCooldown = 60;
        this.audio.playBomb();

        // Visual: screen-wide particles
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * GAME_WIDTH;
            const y = Math.random() * GAME_HEIGHT;
            this.particles.emit(x, y, 3, {
                speed: 1,
                size: 4,
                life: 30,
                color: '#ffffff'
            });
        }
    }

    hit() {
        if (this.invincible || !this.active) return;

        this.audio.playHit();

        if (this.shield > 0) {
            this.shield--;
            this.invincible = true;
            this.invincibleTimer = 60;
            this.particles.emit(this.x + this.width / 2, this.y + this.height / 2, 8, {
                speed: 2,
                size: 3,
                life: 15,
                color: '#4488ff'
            });
        } else {
            this.lives--;
            this.active = false;
            this.particles.playerDeath(this.x + this.width / 2, this.y + this.height / 2);
            this.audio.playExplosion(2);

            if (this.lives > 0) {
                this.respawning = true;
                this.respawnTimer = 90;
                this.shield = this.maxShield;
                if (this.weaponLevel > 1) this.weaponLevel--;
            }
        }
    }

    powerUp() {
        if (this.weaponLevel < this.maxWeaponLevel) {
            this.weaponLevel++;
            this.audio.playLevelUp();
        } else {
            this.audio.playPowerup();
        }
    }

    addBomb() {
        this.bombs++;
        this.audio.playPowerup();
    }

    restoreShield() {
        this.shield = Math.min(this.shield + 1, this.maxShield);
        this.audio.playPowerup();
    }

    addLife() {
        this.lives++;
        this.audio.playPowerup();
    }

    addTempMissile() {
        this.hasTempMissile = true;
        this.tempMissileTimer = 600; // 10 seconds
        this.audio.playPowerup();
    }

    draw(ctx) {
        if (!this.active) return;

        // Invincibility flicker
        if (this.invincible && Math.floor(this.invincibleTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.save();

        // Engine glow
        const engineY = this.y + this.height;
        const flicker = Math.sin(this.engineFlicker * 0.5) * 2;
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.moveTo(cx - 5, engineY);
        ctx.lineTo(cx, engineY + 10 + flicker);
        ctx.lineTo(cx + 5, engineY);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(cx - 3, engineY);
        ctx.lineTo(cx, engineY + 6 + flicker * 0.5);
        ctx.lineTo(cx + 3, engineY);
        ctx.fill();

        // Ship body
        ctx.fillStyle = '#2266cc';
        ctx.beginPath();
        ctx.moveTo(cx, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height * 0.7);
        ctx.lineTo(this.x + this.width - 4, this.y + this.height);
        ctx.lineTo(this.x + 4, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height * 0.7);
        ctx.closePath();
        ctx.fill();

        // Wings
        ctx.fillStyle = '#3388ee';
        ctx.beginPath();
        ctx.moveTo(cx - 4, this.y + 10);
        ctx.lineTo(this.x - 2, this.y + this.height - 5);
        ctx.lineTo(this.x + 6, this.y + this.height - 5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 4, this.y + 10);
        ctx.lineTo(this.x + this.width + 2, this.y + this.height - 5);
        ctx.lineTo(this.x + this.width - 6, this.y + this.height - 5);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#66ccff';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + 14, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield indicator
        if (this.shield > 0) {
            ctx.strokeStyle = `rgba(68, 136, 255, ${0.3 + Math.sin(this.engineFlicker * 0.1) * 0.1})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 22, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }
}
