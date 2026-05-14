// particles.js - Particle effects system (Enhanced with graze/combo effects)

import { GAME_WIDTH, GAME_HEIGHT, randRange, ObjectPool } from './utils.js';

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
        this.maxLife = 0;
        this.size = 0;
        this.color = '#fff';
        this.alpha = 1;
        this.gravity = 0;
        this.shrink = true;
        this.active = false;
        this.type = 'circle'; // circle, spark, smoke, arc
    }
}

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.pool = new ObjectPool(
            () => new Particle(),
            (p) => p.reset(),
            200
        );
    }

    emit(x, y, count, options = {}) {
        for (let i = 0; i < count; i++) {
            const p = this.pool.get();
            p.x = x + (options.spreadX || 0) * (Math.random() - 0.5);
            p.y = y + (options.spreadY || 0) * (Math.random() - 0.5);
            const speed = options.speed || randRange(1, 4);
            const angle = options.angle !== undefined ?
                options.angle + (options.angleSpread || Math.PI * 2) * (Math.random() - 0.5) :
                Math.random() * Math.PI * 2;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.life = options.life || randRange(20, 60);
            p.maxLife = p.life;
            p.size = options.size || randRange(2, 5);
            p.color = options.color || '#ffaa00';
            p.gravity = options.gravity || 0;
            p.shrink = options.shrink !== undefined ? options.shrink : true;
            p.type = options.type || 'circle';
            p.active = true;
            this.particles.push(p);
        }
    }

    // Explosion effect
    explode(x, y, size = 1, color = null) {
        const colors = color ? [color] : ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'];
        const count = Math.floor(15 * size);

        // Core particles
        this.emit(x, y, count, {
            speed: randRange(2, 5) * size,
            size: randRange(2, 4) * size,
            life: randRange(20, 40),
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity: 0.05
        });

        // Sparks
        this.emit(x, y, Math.floor(count * 0.5), {
            speed: randRange(3, 7) * size,
            size: randRange(1, 2),
            life: randRange(15, 30),
            color: '#ffff88',
            type: 'spark'
        });

        // Smoke
        this.emit(x, y, Math.floor(count * 0.3), {
            speed: randRange(0.5, 1.5),
            size: randRange(5, 10) * size,
            life: randRange(30, 60),
            color: '#444444',
            type: 'smoke',
            gravity: -0.02
        });
    }

    // Player death explosion
    playerDeath(x, y) {
        this.explode(x, y, 2.5, null);
        // Extra ring of particles
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            this.emit(x, y, 1, {
                angle: angle,
                angleSpread: 0.1,
                speed: 5,
                size: 3,
                life: 40,
                color: '#00aaff'
            });
        }
    }

    // Bullet trail
    trail(x, y, color = '#88ccff') {
        this.emit(x, y, 1, {
            speed: 0.3,
            size: randRange(1, 2.5),
            life: 8,
            color: color,
            shrink: true,
            gravity: 0
        });
    }

    // Powerup collect flash
    collectFlash(x, y, color = '#00ff88') {
        this.emit(x, y, 12, {
            speed: randRange(2, 5),
            size: randRange(2, 4),
            life: 20,
            color: color,
        });
        // Ring
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            this.emit(x, y, 1, {
                angle: angle,
                angleSpread: 0,
                speed: 3,
                size: 2,
                life: 15,
                color: '#ffffff'
            });
        }
    }

    /**
     * Combo level-up burst effect - expanding ring of colored particles.
     * @param {number} x
     * @param {number} y
     * @param {string} color - The combo level color
     */
    comboLevelUp(x, y, color = '#44ff44') {
        // Expanding ring
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            this.emit(x, y, 1, {
                angle: angle,
                angleSpread: 0.1,
                speed: 4,
                size: 3,
                life: 25,
                color: color,
                type: 'spark'
            });
        }
        // Center burst
        this.emit(x, y, 8, {
            speed: randRange(1, 3),
            size: randRange(2, 4),
            life: 20,
            color: '#ffffff'
        });
    }

    /**
     * Graze arc effect - white arc sparks near the player.
     * @param {number} x - Bullet x
     * @param {number} y - Bullet y
     * @param {number} px - Player center x
     * @param {number} py - Player center y
     */
    grazeEffect(x, y, px, py) {
        const angle = Math.atan2(y - py, x - px);
        // Arc sparks
        for (let i = 0; i < 5; i++) {
            this.emit(x, y, 1, {
                angle: angle + Math.PI + (i - 2) * 0.3,
                angleSpread: 0.15,
                speed: 2.5 + Math.random() * 1.5,
                size: 1.5,
                life: 12,
                color: '#ffffff',
                type: 'spark'
            });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vy += p.gravity;
            p.life -= dt * 60;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                this.pool.release(p);
            }
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            const lifeRatio = p.maxLife > 0 ? Math.max(0, Math.min(1, p.life / p.maxLife)) : 0;
            const alpha = lifeRatio;
            const size = p.shrink ? p.size * lifeRatio : p.size;

            // Skip degenerate particles (avoid sub-pixel rendering artifacts)
            if (alpha <= 0 || size <= 0) continue;

            ctx.globalAlpha = alpha;

            if (p.type === 'spark') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
                ctx.stroke();
            } else if (p.type === 'smoke') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    clear() {
        this.particles.forEach(p => this.pool.release(p));
        this.particles = [];
    }
}
