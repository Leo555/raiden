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
    HEALTH: 'H',      // Health restore (instant, 30% HP)
    WEAPON: 'W',      // Switch to next weapon type (instant)
    NUKE: 'N',        // One-shot heavy AOE nuke charge (rare)
    SUPER_SHIELD: 'X' // Super shield: full damage immunity for 10s (rare)
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
        // Balanced distribution: common buffs cover 70%, special buffs 18%, rare 12%
        // Each rare item is now 4-6%, much more discoverable than before.
        const rand = Math.random();
        if (rand < 0.18) return POWERUP_TYPES.POWER;        // 18% - weapon level up
        if (rand < 0.30) return POWERUP_TYPES.BOMB;          // 12% - extra bomb
        if (rand < 0.42) return POWERUP_TYPES.SHIELD;        // 12% - 3-hit shield
        if (rand < 0.54) return POWERUP_TYPES.COIN;          // 12% - +500 score
        if (rand < 0.62) return POWERUP_TYPES.MISSILE;       // 8%  - temp missile
        if (rand < 0.70) return POWERUP_TYPES.RAPID_FIRE;    // 8%  - rapid fire
        if (rand < 0.76) return POWERUP_TYPES.HEALTH;        // 6%  - +30% HP
        if (rand < 0.82) return POWERUP_TYPES.SUPER_SHIELD;  // 6%  - 10s immunity
        if (rand < 0.88) return POWERUP_TYPES.NUKE;          // 6%  - screen-clear nuke
        if (rand < 0.94) return POWERUP_TYPES.WEAPON;        // 6%  - weapon switch
        return POWERUP_TYPES.LIFE;                            // 6%  - extra life
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
            case POWERUP_TYPES.WEAPON:
                // Switch to next weapon type
                if (player.weaponSystem) {
                    const nextType = player.weaponSystem.switchToNextWeapon();
                    if (nextType) {
                        player.currentWeaponType = nextType;
                    }
                }
                break;
            case POWERUP_TYPES.NUKE:
                // Add a one-shot nuke charge
                player.addNukeCharge();
                break;
            case POWERUP_TYPES.SUPER_SHIELD:
                // Full damage immunity for 10 seconds
                player.activateSuperShield(600);
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
            case POWERUP_TYPES.WEAPON: return '#ff00ff';  // Purple for weapon switch
            case POWERUP_TYPES.NUKE: return '#ff2299';    // Hot pink for nuke
            case POWERUP_TYPES.SUPER_SHIELD: return '#ffee44'; // Gold for super shield
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

        // Active effect indicators are now rendered by UISystem.drawHUD
        // to avoid HUD layout conflicts. See ui.js for the buff stack.
    }

    /**
     * Draw the active power-up effect labels onto the HUD buff stack.
     * Called by UISystem.drawHUD with a starting Y for the next slot.
     * Returns the Y of the slot AFTER all buffs were drawn (for chaining).
     */
    drawActiveEffectsOn(ctx, startY, lineH) {
        let y = startY;
        if (this.activeEffects.shield.active) {
            ctx.fillStyle = '#4488ff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`SHIELD: ${this.activeEffects.shield.hitsLeft} HITS`, 10, y);
            y -= lineH;
        }
        if (this.activeEffects.rapidFire.active) {
            const timeLeft = Math.ceil(this.activeEffects.rapidFire.duration / 60);
            ctx.fillStyle = '#ffff00';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`RAPID FIRE: ${timeLeft}S`, 10, y);
            y -= lineH;
        }
        return y;
    }

    _drawActiveEffects(ctx) {
        // Deprecated: replaced by drawActiveEffectsOn for unified HUD layout.
    }

    clear() {
        this.powerups = [];
        this.activeEffects.shield.active = false;
        this.activeEffects.rapidFire.active = false;
    }
}
