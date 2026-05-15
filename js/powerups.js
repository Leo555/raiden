// powerups.js - Power-up / item system (Enhanced with duration-based power-ups)

import { GAME_WIDTH, GAME_HEIGHT, randRange } from './utils.js';

export const POWERUP_TYPES = {
    POWER: 'P',      // Weapon power-up (instant)
    BOMB: 'B',       // Bomb (instant)
    SHIELD: 'S',      // Shield (duration-based, absorbs 3 hits)
    MISSILE: 'M',     // Temp missile (instant)
    COIN: '$',        // Coin (instant score)
    LIFE: '1UP',     // Extra life (instant)
    RAPID_FIRE: 'F',  // Rapid fire (duration-based, fire rate x2)
    HEALTH: 'H'       // Health restore (instant, 30% HP)
};

class PowerUp {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.width = 20;
        this.height = 20;
        this.type = POWERUP_TYPES.POWER;
        this.active = false;
        this.vy = 1.5;
        this.timer = 0;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.duration = 0; // For duration-based power-ups
        this.maxDuration = 0;
    }
}

export class PowerUpSystem {
    constructor(particles) {
        this.particles = particles;
        this.powerups = [];
        this.activeEffects = {
            shield: { active: false, duration: 0, hitsLeft: 0 },
            rapidFire: { active: false, duration: 0 }
        };
    }

    spawn(x, y, type) {
        const p = new PowerUp();
        p.x = x - 10;
        p.y = y;
        p.type = type || this._randomType();
        p.active = true;
        p.vy = 1.2;
        this.powerups.push(p);
    }

    spawnRandom(x, y) {
        this.spawn(x, y, this._randomType());
    }

    _randomType() {
        const rand = Math.random();
        if (rand < 0.25) return POWERUP_TYPES.POWER;
        if (rand < 0.40) return POWERUP_TYPES.BOMB;
        if (rand < 0.55) return POWERUP_TYPES.SHIELD;
        if (rand < 0.65) return POWERUP_TYPES.MISSILE;
        if (rand < 0.80) return POWERUP_TYPES.COIN;
        if (rand < 0.90) return POWERUP_TYPES.RAPID_FIRE;
        if (rand < 0.95) return POWERUP_TYPES.HEALTH;
        return POWERUP_TYPES.LIFE;
    }

    update(dt) {
        // Update power-up drops
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += p.vy * dt * 60;
            p.timer += dt * 60;

            if (p.y > GAME_HEIGHT + 30) {
                this.powerups.splice(i, 1);
            }
        }

        // Update duration-based effects
        if (this.activeEffects.shield.active) {
            this.activeEffects.shield.duration -= dt * 60;
            if (this.activeEffects.shield.duration <= 0) {
                this.activeEffects.shield.active = false;
            }
        }

        if (this.activeEffects.rapidFire.active) {
            this.activeEffects.rapidFire.duration -= dt * 60;
            if (this.activeEffects.rapidFire.duration <= 0) {
                this.activeEffects.rapidFire.active = false;
            }
        }
    }

    collect(powerup, player) {
        powerup.active = false;
        this.particles.collectFlash(
            powerup.x + powerup.width / 2,
            powerup.y + powerup.height / 2,
            this._getColor(powerup.type)
        );

        switch (powerup.type) {
            case POWERUP_TYPES.POWER:
                player.powerUp();
                break;
            case POWERUP_TYPES.BOMB:
                player.addBomb();
                break;
            case POWERUP_TYPES.SHIELD:
                // Duration-based shield: absorbs 3 hits, lasts 10 seconds
                this.activeEffects.shield.active = true;
                this.activeEffects.shield.duration = 600; // 10 seconds
                this.activeEffects.shield.hitsLeft = 3;
                player.activateShield(600, 3);
                break;
            case POWERUP_TYPES.MISSILE:
                player.addTempMissile();
                break;
            case POWERUP_TYPES.COIN:
                player.score += 500;
                player.audio.playCoin();
                break;
            case POWERUP_TYPES.LIFE:
                player.addLife();
                break;
            case POWERUP_TYPES.RAPID_FIRE:
                // Rapid fire: fire rate x2 for 8 seconds
                this.activeEffects.rapidFire.active = true;
                this.activeEffects.rapidFire.duration = 480; // 8 seconds
                player.activateRapidFire(480);
                break;
            case POWERUP_TYPES.HEALTH:
                // Restore 30% HP
                player.restoreHealth(0.3);
                break;
        }

        // Remove from array
        const idx = this.powerups.indexOf(powerup);
        if (idx !== -1) this.powerups.splice(idx, 1);
    }

    // Check if shield is active and absorb hit
    checkShield() {
        if (this.activeEffects.shield.active && this.activeEffects.shield.hitsLeft > 0) {
            this.activeEffects.shield.hitsLeft--;
            if (this.activeEffects.shield.hitsLeft <= 0) {
                this.activeEffects.shield.active = false;
            }
            return true; // Hit absorbed
        }
        return false; // Hit not absorbed
    }

    // Check if rapid fire is active
    isRapidFire() {
        return this.activeEffects.rapidFire.active;
    }

    _getColor(type) {
        switch (type) {
            case POWERUP_TYPES.POWER: return '#ff4444';
            case POWERUP_TYPES.BOMB: return '#ffaa00';
            case POWERUP_TYPES.SHIELD: return '#4488ff';
            case POWERUP_TYPES.MISSILE: return '#ff8800';
            case POWERUP_TYPES.COIN: return '#ffdd00';
            case POWERUP_TYPES.LIFE: return '#44ff44';
            case POWERUP_TYPES.RAPID_FIRE: return '#ffff00';
            case POWERUP_TYPES.HEALTH: return '#00ff88';
            default: return '#ffffff';
        }
    }

    draw(ctx) {
        for (const p of this.powerups) {
            if (!p.active) continue;

            const cx = p.x + p.width / 2;
            const cy = p.y + p.height / 2;
            const bob = Math.sin(p.timer * 0.1 + p.bobOffset) * 2;

            ctx.save();
            ctx.translate(cx, cy + bob);

            // Glow
            const color = this._getColor(p.type);
            ctx.shadowBlur = 8;
            ctx.shadowColor = color;

            // Background circle
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.fill();

            // Border
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();

            // Label
            ctx.fillStyle = color;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.type, 0, 0);

            ctx.restore();
        }

        // Draw active effect indicators
        this._drawActiveEffects(ctx);
    }

    _drawActiveEffects(ctx) {
        let yOffset = GAME_HEIGHT - 95;

        if (this.activeEffects.shield.active) {
            const remaining = this.activeEffects.shield.hitsLeft;
            ctx.fillStyle = '#4488ff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`SHIELD: ${remaining} HITS`, 10, yOffset);
            yOffset += 15;
        }

        if (this.activeEffects.rapidFire.active) {
            const timeLeft = Math.ceil(this.activeEffects.rapidFire.duration / 60);
            ctx.fillStyle = '#ffff00';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`RAPID FIRE: ${timeLeft}S`, 10, yOffset);
        }
    }

    clear() {
        this.powerups = [];
        this.activeEffects.shield.active = false;
        this.activeEffects.rapidFire.active = false;
    }
}
