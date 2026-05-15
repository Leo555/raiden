// js/weapons.js - Weapon System (purely powerup-driven)

/**
 * Weapon type enum
 */
export const WEAPON_TYPES = {
    NORMAL: 'normal',
    LASER: 'laser',
    HOMING: 'homing',
    EXPLOSIVE: 'explosive'
};

/**
 * Weapon display info for HUD
 */
export const WEAPON_INFO = {
    [WEAPON_TYPES.NORMAL]:   { name: 'VULCAN',  color: '#88ccff' },
    [WEAPON_TYPES.LASER]:   { name: 'LASER',   color: '#ff4488' },
    [WEAPON_TYPES.HOMING]:  { name: 'HOMING',  color: '#00ff88' },
    [WEAPON_TYPES.EXPLOSIVE]: { name: 'BLAST',   color: '#ff8800' },
};

const WEAPON_CYCLE = [WEAPON_TYPES.NORMAL, WEAPON_TYPES.LASER, WEAPON_TYPES.HOMING, WEAPON_TYPES.EXPLOSIVE];

/**
 * Weapon system class
 */
export class WeaponSystem {
    constructor(player, bullets, particles, audio) {
        this.player = player;
        this.bullets = bullets;
        this.particles = particles;
        this.audio = audio;
        this.currentWeapon = WEAPON_TYPES.NORMAL;
        this.weapons = new Map();

        // Energy system for laser
        this.energy = 100;
        this.maxEnergy = 100;
        this.energyRegen = 0.5; // per frame
        this.laserCost = 2; // per frame

        this._initWeapons();
    }

    _initWeapons() {
        this.weapons.set(WEAPON_TYPES.NORMAL, {
            type: WEAPON_TYPES.NORMAL,
            damage: 1,
            fireRate: 6,
            fireCooldown: 0,
            level: 1,
            maxLevel: 5
        });

        this.weapons.set(WEAPON_TYPES.LASER, {
            type: WEAPON_TYPES.LASER,
            damagePerSecond: 5,
            damageTimer: 0,
            isFiring: false,
            laserLength: 800,
            laserWidth: 4,
            energyCost: 2
        });

        this.weapons.set(WEAPON_TYPES.HOMING, {
            type: WEAPON_TYPES.HOMING,
            damage: 2,
            fireRate: 15,
            fireCooldown: 0,
            turnSpeed: 0.05,
            bulletSpeed: 5,
            maxHoming: 3
        });

        this.weapons.set(WEAPON_TYPES.EXPLOSIVE, {
            type: WEAPON_TYPES.EXPLOSIVE,
            damage: 3,
            explosionDamage: 2,
            fireRate: 20,
            fireCooldown: 0,
            explosionRadius: 60
        });
    }

    update(dt, playerX, playerY, enemies) {
        // Update cooldowns
        for (const [type, weapon] of this.weapons) {
            if (weapon.fireCooldown > 0) {
                weapon.fireCooldown -= dt * 60;
            }
        }

        // Energy regeneration
        if (this.energy < this.maxEnergy) {
            this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen);
        }

        // Laser continuous damage
        if (this.currentWeapon === WEAPON_TYPES.LASER) {
            this._updateLaser(dt, playerX, playerY, enemies);
        }
    }

    fire(x, y, enemies) {
        const weapon = this.weapons.get(this.currentWeapon);
        if (!weapon || weapon.fireCooldown > 0) return;

        switch (this.currentWeapon) {
            case WEAPON_TYPES.NORMAL:
                this._fireNormal(x, y);
                weapon.fireCooldown = weapon.fireRate;
                break;
            case WEAPON_TYPES.LASER:
                this._fireLaser(x, y);
                break;
            case WEAPON_TYPES.HOMING:
                this._fireHoming(x, y, enemies);
                weapon.fireCooldown = weapon.fireRate;
                break;
            case WEAPON_TYPES.EXPLOSIVE:
                this._fireExplosive(x, y);
                weapon.fireCooldown = weapon.fireRate;
                break;
        }
    }

    _fireNormal(x, y) {
        if (this.bullets && this.bullets.firePlayerBullet) {
            const cx = x + this.player.width / 2;
            this.bullets.firePlayerBullet(cx, y - 10, 0, -10, 1);
            this.audio.playShoot();
        }
    }

    _fireLaser(x, y) {
        const weapon = this.weapons.get(WEAPON_TYPES.LASER);
        if (this.energy >= weapon.energyCost) {
            weapon.isFiring = true;
            this.audio.playShoot();
        }
    }

    _updateLaser(dt, playerX, playerY, enemies) {
        const weapon = this.weapons.get(WEAPON_TYPES.LASER);
        if (!weapon.isFiring || this.energy < weapon.energyCost) {
            weapon.isFiring = false;
            return;
        }

        // Consume energy
        this.energy = Math.max(0, this.energy - weapon.energyCost);
        weapon.damageTimer += dt * 60;

        // Apply damage to enemies in line
        if (enemies && weapon.damageTimer >= 12) { // damage every 12 frames
            weapon.damageTimer = 0;
            const cx = playerX + this.player.width / 2;
            const cy = playerY;

            for (const enemy of enemies) {
                if (!enemy.active) continue;

                // Simple line collision detection
                const enemyCX = enemy.x + enemy.width / 2;
                const enemyCY = enemy.y + enemy.height / 2;

                if (Math.abs(enemyCX - cx) < enemy.width / 2 + weapon.laserWidth / 2 &&
                    enemyCY < cy && enemyCY > cy - weapon.laserLength) {
                    if (enemy.hit) {
                        enemy.hit(weapon.damagePerSecond / 5);
                    } else {
                        enemy.hp -= weapon.damagePerSecond / 5;
                    }
                }
            }
        }

        // Stop firing if out of energy
        if (this.energy <= 0) {
            weapon.isFiring = false;
        }
    }

    _fireHoming(x, y, enemies) {
        if (!enemies || enemies.length === 0) return;

        const weapon = this.weapons.get(WEAPON_TYPES.HOMING);
        const cx = x + this.player.width / 2;

        // Find nearest enemy
        let nearest = null;
        let nearestDist = Infinity;

        for (const enemy of enemies) {
            if (!enemy.active) continue;
            const dx = enemy.x + enemy.width / 2 - cx;
            const dy = enemy.y + enemy.height / 2 - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        if (nearest && this.bullets.fireHomingBullet) {
            // fireHomingBullet(x, y, speed, color, homingStrength)
            this.bullets.fireHomingBullet(cx, y, 5, '#00ff00', 0.05);
            this.audio.playShoot();
        }
    }

    _fireExplosive(x, y) {
        const cx = x + this.player.width / 2;
        if (this.bullets && this.bullets.firePlayerBullet) {
            // Fire an explosive bullet (type='explosive')
            this.bullets.firePlayerBullet(cx, y - 10, 0, -10, 3, 'explosive', '#ff8800');
            this.audio.playShoot();
        }
    }

    switchWeapon(type) {
        if (this.weapons.has(type)) {
            this.currentWeapon = type;
            // Stop laser if switching away
            if (type !== WEAPON_TYPES.LASER) {
                const laser = this.weapons.get(WEAPON_TYPES.LASER);
                if (laser) laser.isFiring = false;
            }
        }
    }

    getCurrentWeapon() {
        return this.currentWeapon;
    }

    getWeaponInfo() {
        return this.weapons.get(this.currentWeapon);
    }

    getEnergy() {
        return this.energy;
    }

    getMaxEnergy() {
        return this.maxEnergy;
    }

    // Kill energy restore
    onKill() {
        this.energy = Math.min(this.maxEnergy, this.energy + 10);
    }

    drawLaser(ctx, playerX, playerY) {
        const weapon = this.weapons.get(WEAPON_TYPES.LASER);
        if (!weapon.isFiring) return;

        const cx = playerX + this.player.width / 2;

        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = weapon.laserWidth;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.globalAlpha = 0.8;

        ctx.beginPath();
        ctx.moveTo(cx, playerY);
        ctx.lineTo(cx, playerY - weapon.laserLength);
        ctx.stroke();

        // Laser glow
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = weapon.laserWidth / 2;
        ctx.beginPath();
        ctx.moveTo(cx, playerY);
        ctx.lineTo(cx, playerY - weapon.laserLength);
        ctx.stroke();

        ctx.restore();
    }
}
