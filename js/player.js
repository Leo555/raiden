// player.js - Player ship system with Weapon Integration

import { GAME_WIDTH, GAME_HEIGHT, clamp } from './utils.js';
import { WeaponSystem, WEAPON_TYPES } from './weapons.js';

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

        // Shield duration
        this.shieldDuration = 0;
        this.shieldHitsLeft = 0;
        this.rapidFireDuration = 0;

        this.engineFlicker = 0;

        // Weapon system
        this.weaponSystem = null;
        this.currentWeaponType = WEAPON_TYPES.NORMAL;
    }

    initWeaponSystem() {
        this.weaponSystem = new WeaponSystem(this, this.bullets, this.particles, this.audio);
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
        this.currentWeaponType = WEAPON_TYPES.NORMAL;
        if (this.weaponSystem) {
            this.weaponSystem.switchWeapon(WEAPON_TYPES.NORMAL);
        }
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

        // Weapon switching (keys 1-4)
        this._handleWeaponSwitch();

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

        // Auto shoot with weapon system
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

        // Update weapon system
        if (this.weaponSystem) {
            this.weaponSystem.update(dt, this.x, this.y, enemies);
        }
    }

    _handleWeaponSwitch() {
        if (this.input.isKeyDown('Digit1') || this.input.isKeyDown('Numpad1')) {
            this._switchWeapon(WEAPON_TYPES.NORMAL);
            this.input.clearKey('Digit1');
            this.input.clearKey('Numpad1');
        }
        if (this.input.isKeyDown('Digit2') || this.input.isKeyDown('Numpad2')) {
            this._switchWeapon(WEAPON_TYPES.LASER);
            this.input.clearKey('Digit2');
            this.input.clearKey('Numpad2');
        }
        if (this.input.isKeyDown('Digit3') || this.input.isKeyDown('Numpad3')) {
            this._switchWeapon(WEAPON_TYPES.HOMING);
            this.input.clearKey('Digit3');
            this.input.clearKey('Numpad3');
        }
        if (this.input.isKeyDown('Digit4') || this.input.isKeyDown('Numpad4')) {
            this._switchWeapon(WEAPON_TYPES.EXPLOSIVE);
            this.input.clearKey('Digit4');
            this.input.clearKey('Numpad4');
        }
    }

    _switchWeapon(type) {
        this.currentWeaponType = type;
        if (this.weaponSystem) {
            this.weaponSystem.switchWeapon(type);
        }
        this.audio.playPowerup();
    }

    _shoot(enemies) {
        if (!this.weaponSystem) {
            // Fallback to default shooting
            this._defaultShoot();
            return;
        }

        const cx = this.x + this.width / 2;
        const cy = this.y;

        // Use weapon system to fire
        this.weaponSystem.fire(this.x, cy, enemies);

        // Draw laser if firing
        if (this.currentWeaponType === WEAPON_TYPES.LASER) {
            const weapon = this.weaponSystem.weapons.get(WEAPON_TYPES.LASER);
            if (weapon && weapon.isFiring) {
                this.weaponSystem.drawLaser ? this.weaponSystem.drawLaser : null;
            }
        }
    }

    _defaultShoot() {
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
                for (let i = -3; i <= 3; i++) {
                    this.bullets.firePlayerBullet(cx + i * 6, cy, i * 0.8, -10, 1, 'normal', '#88ffcc');
                }
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

    // Activate duration-based shield (absorbs 3 hits over 10 seconds)
    activateShield(duration, hits) {
        this.shieldDuration = duration;
        this.shieldHitsLeft = hits;
        this.audio.playPowerup();
    }

    // Activate rapid fire (fire rate x2 for 8 seconds)
    activateRapidFire(duration) {
        this.rapidFireDuration = duration;
        this.shootCooldown = Math.max(3, this.shootCooldown / 2);
        this.audio.playPowerup();
    }

    // Restore health (30% of max shield/life)
    restoreHealth(percentage) {
        const restoreAmount = Math.ceil(this.maxShield * percentage);
        this.shield = Math.min(this.maxShield, this.shield + restoreAmount);
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

        // Draw laser if active
        if (this.weaponSystem && this.currentWeaponType === WEAPON_TYPES.LASER) {
            const weapon = this.weaponSystem.weapons.get(WEAPON_TYPES.LASER);
            if (weapon && weapon.isFiring) {
                this._drawLaserBeam(ctx, cx, cy);
            }
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    _drawLaserBeam(ctx, cx, cy) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.globalAlpha = 0.8;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, 0);
        ctx.stroke();

        // Laser glow
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, 0);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    getWeaponInfo() {
        if (this.weaponSystem) {
            return {
                type: this.currentWeaponType,
                info: this.weaponSystem.getWeaponInfo(),
                energy: this.weaponSystem.getEnergy(),
                maxEnergy: this.weaponSystem.getMaxEnergy()
            };
        }
        return null;
    }
}
