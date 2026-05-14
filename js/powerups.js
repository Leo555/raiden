// powerups.js - Power-up / item system

import { GAME_WIDTH, GAME_HEIGHT, randRange } from './utils.js';

export const POWERUP_TYPES = {
    POWER: 'P',
    BOMB: 'B',
    SHIELD: 'S',
    MISSILE: 'M',
    COIN: '$',
    LIFE: '1UP'
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
    }
}

export class PowerUpSystem {
    constructor(particles) {
        this.particles = particles;
        this.powerups = [];
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
        if (rand < 0.35) return POWERUP_TYPES.POWER;
        if (rand < 0.55) return POWERUP_TYPES.BOMB;
        if (rand < 0.70) return POWERUP_TYPES.SHIELD;
        if (rand < 0.80) return POWERUP_TYPES.MISSILE;
        if (rand < 0.95) return POWERUP_TYPES.COIN;
        return POWERUP_TYPES.LIFE;
    }

    update(dt) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += p.vy * dt * 60;
            p.timer += dt * 60;

            if (p.y > GAME_HEIGHT + 30) {
                this.powerups.splice(i, 1);
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
                player.restoreShield();
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
        }

        // Remove from array
        const idx = this.powerups.indexOf(powerup);
        if (idx !== -1) this.powerups.splice(idx, 1);
    }

    _getColor(type) {
        switch (type) {
            case POWERUP_TYPES.POWER: return '#ff4444';
            case POWERUP_TYPES.BOMB: return '#ffaa00';
            case POWERUP_TYPES.SHIELD: return '#4488ff';
            case POWERUP_TYPES.MISSILE: return '#ff8800';
            case POWERUP_TYPES.COIN: return '#ffdd00';
            case POWERUP_TYPES.LIFE: return '#44ff44';
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
    }

    clear() {
        this.powerups = [];
    }
}
