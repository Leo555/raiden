// js/weapons.js - Weapon System (purely powerup-driven)

/**
 * Weapon type enum
 */
export const WEAPON_TYPES = {
    NORMAL: 'normal',
    HOMING: 'homing',
    EXPLOSIVE: 'explosive'
};

/**
 * Weapon display info for HUD
 */
export const WEAPON_INFO = {
    [WEAPON_TYPES.NORMAL]:    { name: 'VULCAN',  color: '#88ccff' },
    [WEAPON_TYPES.HOMING]:    { name: 'HOMING',  color: '#00ff88' },
    [WEAPON_TYPES.EXPLOSIVE]: { name: 'BLAST',   color: '#ff8800' },
};

const WEAPON_CYCLE = [WEAPON_TYPES.NORMAL, WEAPON_TYPES.HOMING, WEAPON_TYPES.EXPLOSIVE];

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

        // Safety: frames since last successful fire (prevents cooldown stuck)
        this._lastFired = 0;
        this._forceFireThreshold = 120; // force fire after 120 frames of no fire

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

        this.weapons.set(WEAPON_TYPES.HOMING, {
            type: WEAPON_TYPES.HOMING,
            damage: 2,
            fireRate: 15,
            fireCooldown: 0,
            turnSpeed: 0.05,
            bulletSpeed: 5,
            maxHoming: 3,
            level: 1,
            maxLevel: 5
        });

        this.weapons.set(WEAPON_TYPES.EXPLOSIVE, {
            type: WEAPON_TYPES.EXPLOSIVE,
            damage: 3,
            explosionDamage: 2,
            fireRate: 20,
            fireCooldown: 0,
            explosionRadius: 60,
            level: 1,
            maxLevel: 5
        });
    }

    update(dt, playerX, playerY, enemies) {
        // Increment frames-since-last-fire timer (mobile safety net)
        this._lastFired += dt * 60;

        // Update cooldowns
        for (const [type, weapon] of this.weapons) {
            if (typeof weapon.fireCooldown !== 'number' || isNaN(weapon.fireCooldown) || weapon.fireCooldown === Infinity) {
                weapon.fireCooldown = 0;
            }
            if (weapon.fireCooldown > 0) {
                weapon.fireCooldown -= dt * 60;
                if (weapon.fireCooldown < 0) weapon.fireCooldown = 0;
            }
        }
    }

    fire(x, y, enemies) {
        const weapon = this.weapons.get(this.currentWeapon);

        // Safety: if weapon config missing, fallback to NORMAL
        if (!weapon) {
            this.currentWeapon = WEAPON_TYPES.NORMAL;
            return this.fire(x, y, enemies);
        }

        // Safety: force fire if cooldown stuck too long (mobile background fix)
        if (this._lastFired > this._forceFireThreshold) {
            weapon.fireCooldown = 0;
            this._lastFired = 0;
        }

        if (weapon.fireCooldown > 0) return;

        // Safety: ensure fireRate is valid
        if (typeof weapon.fireRate !== 'number' || weapon.fireRate <= 0) {
            weapon.fireRate = 6;
        }

        switch (this.currentWeapon) {
            case WEAPON_TYPES.NORMAL:
                this._fireNormal(x, y);
                weapon.fireCooldown = weapon.fireRate;
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

        // Reset safety timer on successful fire
        this._lastFired = 0;
    }

    _fireNormal(x, y) {
        if (!this.bullets || !this.bullets.firePlayerBullet) return;
        
        const weapon = this.weapons.get(WEAPON_TYPES.NORMAL);
        const level = weapon ? weapon.level : 1;
        
        // Fire bullets based on weapon level (similar to _defaultShoot)
        switch (level) {
            case 1:
                this.bullets.firePlayerBullet(x, y - 10, 0, -10, 1);
                break;
            case 2:
                this.bullets.firePlayerBullet(x - 5, y - 10, 0, -10, 1);
                this.bullets.firePlayerBullet(x + 5, y - 10, 0, -10, 1);
                break;
            case 3:
                this.bullets.firePlayerBullet(x, y - 10, 0, -10, 1);
                this.bullets.firePlayerBullet(x - 5, y - 10, -1.5, -9.5, 1);
                this.bullets.firePlayerBullet(x + 5, y - 10, 1.5, -9.5, 1);
                break;
            case 4:
                this.bullets.firePlayerBullet(x, y - 10, 0, -10, 1);
                this.bullets.firePlayerBullet(x - 5, y - 10, -1.2, -9.5, 1);
                this.bullets.firePlayerBullet(x + 5, y - 10, 1.2, -9.5, 1);
                this.bullets.firePlayerBullet(x - 10, y - 10, -2.5, -9, 1);
                this.bullets.firePlayerBullet(x + 10, y - 10, 2.5, -9, 1);
                break;
            case 5:
                for (let i = -3; i <= 3; i++) {
                    this.bullets.firePlayerBullet(x + i * 6, y - 10, i * 0.8, -10, 1, 'normal', '#88ffcc');
                }
                this.bullets.firePlayerBullet(x, y - 20, 0, -14, 2, 'normal', '#ffffff');
                break;
        }
        
        this.audio.playShoot();
    }

    /**
     * Boss reference setter (kept as a no-op for backward compatibility
     * with main.js. The laser weapon previously used this hook.)
     */
    setBossRef(_boss) {
        // no-op
    }

    _fireHoming(x, y, enemies) {
        if (!this.bullets || !this.bullets.fireMissile) return;

        // Find nearest enemy (if any)
        let nearest = null;
        if (enemies && enemies.length > 0) {
            let nearestDist = Infinity;
            for (const enemy of enemies) {
                if (!enemy.active) continue;
                const dx = enemy.x + enemy.width / 2 - x;
                const dy = enemy.y + enemy.height / 2 - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = enemy;
                }
            }
        }

        // Always fire a homing missile (player bullet, not enemy bullet)
        // If no target, missile flies straight up and will find target later
        this.bullets.fireMissile(x, y - 10, nearest);
        this.audio.playShoot();
    }

    _fireExplosive(x, y) {
        // x is already center of player
        if (this.bullets && this.bullets.firePlayerBullet) {
            // Fire an explosive bullet (type='explosive')
            this.bullets.firePlayerBullet(x, y - 10, 0, -10, 3, 'explosive', '#ff8800');
            this.audio.playShoot();
        }
    }

    switchWeapon(type) {
        if (this.weapons.has(type)) {
            this.currentWeapon = type;
            // Reset fire cooldown on switch so the new weapon can fire immediately
            const weapon = this.weapons.get(type);
            if (weapon) weapon.fireCooldown = 0;
        }
    }

    reset() {
        this.currentWeapon = WEAPON_TYPES.NORMAL;
        this._initWeapons();
    }

    getCurrentWeapon() {
        return this.currentWeapon;
    }

    getWeaponInfo() {
        return this.weapons.get(this.currentWeapon);
    }

    /**
     * Upgrade current weapon level (called when collecting P powerup)
     */
    upgradeCurrentWeapon() {
        const weapon = this.weapons.get(this.currentWeapon);
        if (weapon && weapon.level < weapon.maxLevel) {
            weapon.level++;
            return true;
        }
        return false;
    }

    /**
     * Switch to next weapon in cycle (called when collecting W powerup)
     */
    switchToNextWeapon() {
        const currentIndex = WEAPON_CYCLE.indexOf(this.currentWeapon);
        const nextIndex = (currentIndex + 1) % WEAPON_CYCLE.length;
        this.switchWeapon(WEAPON_CYCLE[nextIndex]);
        return WEAPON_CYCLE[nextIndex];
    }

    // Kill callback hook (kept for parity; energy system removed)
    onKill() {
        // no-op
    }
}
