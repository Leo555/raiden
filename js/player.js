// js/player.js - Player ship system with Weapon + Skin Integration

import { GAME_WIDTH, GAME_HEIGHT, clamp } from './utils.js';
import { WeaponSystem, WEAPON_TYPES } from './weapons.js';
import { SkinSystem } from './skins.js';

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
        this._originalFireRate = {}; // Store original fireRate for each weapon

        // Super shield: full damage immunity for a duration (frames)
        this.superShieldTimer = 0;

        this.engineFlicker = 0;

        // Weapon system
        this.weaponSystem = null;
        this.currentWeaponType = WEAPON_TYPES.NORMAL;
        
        // Skin system (NEW)
        this.skinSystem = null;
    }

    initWeaponSystem() {
        this.weaponSystem = new WeaponSystem(this, this.bullets, this.particles, this.audio);
    }

    // NEW: Initialize skin system
    initSkinSystem() {
        this.skinSystem = new SkinSystem();
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
        this._originalFireRate = {};
        this.rapidFireDuration = 0;
        this.superShieldTimer = 0;
        if (this.weaponSystem) {
            this.weaponSystem.reset();
        }
    }

    update(dt, enemies) {
        if (!this.active && !this.respawning) return;

        // Respawn timer
        if (this.respawning) {
            this.respawnTimer -= dt * 60;
            if (this.respawnTimer <= 0) {
                this.respawning = false;
                this.active = true;
                this.invincible = true;
                this.invincibleTimer = this.invincibleDuration;
            }
            return;
        }

        // Movement - Keyboard, Mouse, or Touch
        let dx = 0, dy = 0;
        
        // Touch control (mobile): follow touch position
        if (this.input.touch && this.input.touch.active) {
            const targetX = this.input.touch.x - this.width / 2;
            const targetY = this.input.touch.y - this.height / 2;
            const diffX = targetX - this.x;
            const diffY = targetY - this.y;

            // Move towards touch position with smoothing (frame-rate independent)
            const smooth = 0.15 * 60 * dt;
            this.x += diffX * smooth;
            this.y += diffY * smooth;
        }
        // Mouse control (desktop): only when mouse button is pressed
        else if (this.input.mouse.down) {
            const targetX = this.input.mouse.x - this.width / 2;
            const targetY = this.input.mouse.y - this.height / 2;
            const diffX = targetX - this.x;
            const diffY = targetY - this.y;

            // Move towards mouse position with smoothing (frame-rate independent)
            const smooth = 0.15 * 60 * dt;
            this.x += diffX * smooth;
            this.y += diffY * smooth;
        } else {
            // Keyboard control
            if (this.input.isLeft()) dx -= 1;
            if (this.input.isRight()) dx += 1;
            if (this.input.isUp()) dy -= 1;
            if (this.input.isDown()) dy += 1;

            // Normalize diagonal movement
            if (dx !== 0 && dy !== 0) {
                dx *= 0.707; // 1/Math.sqrt(2)
                dy *= 0.707;
            }

            this.x += dx * this.speed * dt * 60;
            this.y += dy * this.speed * dt * 60;
        }

        // Clamp position
        this.x = clamp(this.x, 0, GAME_WIDTH - this.width);
        this.y = clamp(this.y, 0, GAME_HEIGHT - this.height);

        // Weapon switch (keyboard 1-4)
        this._handleWeaponSwitch();

        // Rapid fire duration countdown
        if (this.rapidFireDuration > 0) {
            this.rapidFireDuration -= dt * 60;
            if (this.rapidFireDuration <= 0) {
                this.rapidFireDuration = 0;
                // Restore original fireRate for all weapons
                if (this.weaponSystem && this._originalFireRate) {
                    for (const [type, rate] of Object.entries(this._originalFireRate)) {
                        const weapon = this.weaponSystem.weapons.get(type);
                        if (weapon) weapon.fireRate = rate;
                    }
                    this._originalFireRate = {};
                }
            }
        }

        // Invincibility
        if (this.invincible) {
            this.invincibleTimer -= dt * 60;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        // Super shield (full damage immunity)
        if (this.superShieldTimer > 0) {
            this.superShieldTimer -= dt * 60;
            if (this.superShieldTimer < 0) this.superShieldTimer = 0;
        }

        // Auto shoot with weapon system (let WeaponSystem handle cooldown internally)
        this._shoot(enemies);

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
            this._switchWeapon(WEAPON_TYPES.HOMING);
            this.input.clearKey('Digit2');
            this.input.clearKey('Numpad2');
        }
        if (this.input.isKeyDown('Digit3') || this.input.isKeyDown('Numpad3')) {
            this._switchWeapon(WEAPON_TYPES.EXPLOSIVE);
            this.input.clearKey('Digit3');
            this.input.clearKey('Numpad3');
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
            this._defaultShoot();
            return;
        }

        // Safety: ensure currentWeaponType and weaponSystem.currentWeapon are in sync
        if (this.currentWeaponType !== this.weaponSystem.currentWeapon) {
            // Trust weaponSystem as source of truth, sync player
            this.currentWeaponType = this.weaponSystem.currentWeapon;
        }

        // Safety: if current weapon is invalid, fallback to NORMAL
        if (!this.weaponSystem.weapons.has(this.currentWeaponType)) {
            this.currentWeaponType = WEAPON_TYPES.NORMAL;
            this.weaponSystem.currentWeapon = WEAPON_TYPES.NORMAL;
        }

        const cx = this.x + this.width / 2;
        const cy = this.y;

        // Use weapon system to fire
        this.weaponSystem.fire(cx, cy, enemies);
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

        // Super shield: full immunity, just visual feedback
        if (this.superShieldTimer > 0) {
            this.particles.emit(this.x + this.width / 2, this.y + this.height / 2, 6, {
                speed: 3,
                size: 2,
                life: 12,
                color: '#ffff44'
            });
            return;
        }

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
                if (this.weaponLevel > 1) {
                    this.weaponLevel--;
                    // Sync NORMAL weapon level in weaponSystem
                    if (this.weaponSystem) {
                        const normalWeapon = this.weaponSystem.weapons.get(WEAPON_TYPES.NORMAL);
                        if (normalWeapon && normalWeapon.level > 1) {
                            normalWeapon.level--;
                        }
                    }
                }
            }
        }
    }

    powerUp() {
        // Upgrade current weapon via weapon system (powerup-driven)
        if (this.weaponSystem) {
            const upgraded = this.weaponSystem.upgradeCurrentWeapon();
            if (upgraded) {
                this.weaponLevel = this.weaponSystem.weapons.get(this.weaponSystem.currentWeapon).level;
                this.audio.playLevelUp();
            } else {
                this.audio.playPowerup();
            }
        } else {
            // Fallback: upgrade weaponLevel directly
            if (this.weaponLevel < this.maxWeaponLevel) {
                this.weaponLevel++;
                this.audio.playLevelUp();
            } else {
                this.audio.playPowerup();
            }
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

    /**
     * Pick up a NUKE charge - immediately fire a single heavy AOE projectile.
     * On hit (or when reaching upper screen), it triggers a massive explosion.
     */
    addNukeCharge() {
        if (this.bullets && this.bullets.fireNuke) {
            this.bullets.fireNuke(this.x + this.width / 2, this.y);
        }
        // Heavier audio cue than a normal pickup
        if (this.audio.playBomb) {
            this.audio.playBomb();
        } else {
            this.audio.playPowerup();
        }
    }

    /**
     * Activate the super shield: full damage immunity for the given duration (frames).
     * Multiple pickups extend rather than overwrite (max stack at 30s).
     */
    activateSuperShield(durationFrames) {
        const maxStack = 30 * 60; // 30 seconds cap
        this.superShieldTimer = Math.min(maxStack, this.superShieldTimer + durationFrames);
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
        // Safety: ensure _originalFireRate is an object
        if (!this._originalFireRate) {
            this._originalFireRate = {};
        }
        // Halve fireRate for all weapons in WeaponSystem (only store original once)
        if (this.weaponSystem) {
            for (const [type, weapon] of this.weaponSystem.weapons) {
                if (weapon.fireRate) {
                    // Only store original if not already stored (prevent overwriting on multiple pickups)
                    if (!this._originalFireRate[type]) {
                        this._originalFireRate[type] = weapon.fireRate;
                    }
                    weapon.fireRate = Math.max(3, weapon.fireRate / 2);
                }
            }
        }
        this.audio.playPowerup();
    }

    // Restore health (30% of max shield/life)
    restoreHealth(percentage) {
        const restoreAmount = Math.ceil(this.maxShield * percentage);
        this.shield = Math.min(this.maxShield, this.shield + restoreAmount);
        this.audio.playPowerup();
    }

    getWeaponInfo() {
        if (!this.weaponSystem) return null;
        return {
            type: this.currentWeaponType
        };
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

        // Ship body (use skin color)
        const skinColor = this.skinSystem ? this.skinSystem.getCurrentSkin().color : '#2266cc';
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.moveTo(cx, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height * 0.7);
        ctx.lineTo(this.x + this.width - 4, this.y + this.height);
        ctx.lineTo(this.x + 4, this.y + this.height);
        ctx.lineTo(cx, this.y + this.height * 0.7);
        ctx.closePath();
        ctx.fill();

        // Wings (use secondary skin color)
        const secondaryColor = this.skinSystem ? this.skinSystem.getCurrentSkin().secondaryColor : '#3388ee';
        ctx.fillStyle = secondaryColor;
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

        // Cockpit (use skin color with transparency)
        ctx.fillStyle = skinColor;
        ctx.globalAlpha *= 0.7;
        ctx.beginPath();
        ctx.ellipse(cx, this.y + 14, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha /= 0.7;

        // Shield indicator
        if (this.shield > 0) {
            ctx.strokeStyle = `rgba(68, 136, 255, ${0.3 + Math.sin(this.engineFlicker * 0.1) * 0.1})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 22, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Super shield indicator - large hi-tech energy bubble
        if (this.superShieldTimer > 0) {
            const remainingSec = this.superShieldTimer / 60;
            // Flicker faster when about to expire (last 2 sec)
            const isExpiring = remainingSec < 2;
            const flickerSkip = isExpiring && Math.floor(this.engineFlicker * 0.5) % 2 === 0;

            if (!flickerSkip) {
                ctx.save();
                const pulse = 1 + Math.sin(this.engineFlicker * 0.12) * 0.06;
                const baseR = 45;
                const radius = baseR * pulse;

                // -------- Layer 1: Soft outer aura (fills the bubble) --------
                const grad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
                grad.addColorStop(0, 'rgba(120, 220, 255, 0.0)');
                grad.addColorStop(0.7, 'rgba(120, 220, 255, 0.12)');
                grad.addColorStop(1, 'rgba(255, 220, 80, 0.25)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();

                // -------- Layer 2: Outer hex ring (rotating clockwise) --------
                const rotCW = this.engineFlicker * 0.04;
                ctx.strokeStyle = `rgba(255, 220, 80, ${0.85 + Math.sin(this.engineFlicker * 0.15) * 0.15})`;
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 18;
                ctx.shadowColor = '#ffee44';
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                    const a = rotCW + (i / 6) * Math.PI * 2;
                    const px = cx + Math.cos(a) * radius;
                    const py = cy + Math.sin(a) * radius;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();

                // -------- Layer 3: Inner hex ring (rotating counter-clockwise) --------
                const rotCCW = -this.engineFlicker * 0.06;
                const innerR = radius - 7;
                ctx.strokeStyle = `rgba(150, 230, 255, ${0.7 + Math.sin(this.engineFlicker * 0.2) * 0.2})`;
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#88ccff';
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                    const a = rotCCW + (i / 6) * Math.PI * 2 + Math.PI / 6;
                    const px = cx + Math.cos(a) * innerR;
                    const py = cy + Math.sin(a) * innerR;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();

                // -------- Layer 4: Energy spokes connecting the two rings --------
                ctx.strokeStyle = `rgba(255, 255, 200, ${0.5 + Math.sin(this.engineFlicker * 0.25) * 0.3})`;
                ctx.lineWidth = 1;
                ctx.shadowBlur = 6;
                for (let i = 0; i < 6; i++) {
                    const a = rotCW + (i / 6) * Math.PI * 2;
                    const x1 = cx + Math.cos(a) * radius;
                    const y1 = cy + Math.sin(a) * radius;
                    const x2 = cx + Math.cos(a + Math.PI / 6) * innerR;
                    const y2 = cy + Math.sin(a + Math.PI / 6) * innerR;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                // -------- Layer 5: Bright corner nodes on outer hex --------
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#ffffff';
                for (let i = 0; i < 6; i++) {
                    const a = rotCW + (i / 6) * Math.PI * 2;
                    const px = cx + Math.cos(a) * radius;
                    const py = cy + Math.sin(a) * radius;
                    ctx.beginPath();
                    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // -------- Layer 6: Orbiting energy particles (3 particles around the shield) --------
                ctx.fillStyle = '#ffff88';
                ctx.shadowBlur = 14;
                ctx.shadowColor = '#ffee44';
                for (let i = 0; i < 3; i++) {
                    const a = this.engineFlicker * 0.08 + (i / 3) * Math.PI * 2;
                    const orbitR = radius + 8 + Math.sin(this.engineFlicker * 0.15 + i) * 3;
                    const px = cx + Math.cos(a) * orbitR;
                    const py = cy + Math.sin(a) * orbitR;
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // -------- Layer 7: Reactive arc segments (rotates with the inner ring) --------
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 16;
                ctx.shadowColor = '#ffffff';
                const arcRot = this.engineFlicker * 0.03;
                for (let i = 0; i < 4; i++) {
                    const startA = arcRot + (i / 4) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius + 4, startA, startA + Math.PI * 0.18);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }
}
