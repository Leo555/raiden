// bullets.js - Bullet system for player and enemies (upgraded with boss bullet types)

import { GAME_WIDTH, GAME_HEIGHT, ObjectPool, angleBetween } from './utils.js';

class Bullet {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.width = 4;
        this.height = 10;
        this.damage = 1;
        this.active = false;
        this.isPlayerBullet = true;
        this.type = 'normal'; // normal, missile, laser, enemy, homing, wave, split, beam, accel, ring, petal
        this.color = '#88ccff';
        this.radius = 3;
        this.target = null;
        this.turnSpeed = 0;
        this.life = 999;
        this.trailTimer = 0;
        // New properties for fancy bullets
        this.age = 0;
        this.waveAmplitude = 0;
        this.waveFrequency = 0;
        this.baseAngle = 0;
        this.accelRate = 0;
        this.splitCount = 0;
        this.splitDone = false;
        this.rotAngle = 0;
        this.rotSpeed = 0;
        this.pulsePhase = 0;
        this.glowSize = 0;
        this.homingTarget = null;
        this.homingStrength = 0;
        this.delayFrames = 0;
        this.originalSpeed = 0;
    }
}

export class BulletSystem {
    constructor(particles) {
        this.playerBullets = [];
        this.enemyBullets = [];
        this.particles = particles;
        this.pool = new ObjectPool(
            () => new Bullet(),
            (b) => b.reset(),
            500
        );
        // Pre-rendered sprite cache for hot-path bullets (per color).
        // Drawing 30+ small bullets per frame with `ctx.shadowBlur` is one
        // of the biggest performance hits in the canvas pipeline. We bake
        // the glow once into an offscreen canvas and blit it with
        // `drawImage`, which is dramatically cheaper.
        this._normalBulletSprites = new Map(); // color -> HTMLCanvasElement
        // Keyed by `${kind}|${color}|${radius}` so different shapes /
        // sizes don't collide.
        this._enemyBulletSprites = new Map();
        // Adaptive cap on simultaneous enemy bullets. PerformanceManager
        // tightens this on weak devices; the default is generous enough
        // for normal play.
        this._enemyBulletCap = 220;
    }

    /**
     * Build (or fetch from cache) a tiny offscreen canvas containing a
     * pre-rendered "normal" player bullet with its glow already baked in.
     * Sprite layout (size 12x18, centered):
     *   - outer glow (shadowBlur)
     *   - 3x10 colored core
     *   - 1x8 white-hot inner streak
     */
    _getNormalBulletSprite(color) {
        let s = this._normalBulletSprites.get(color);
        if (s) return s;
        const W = 12, H = 18;
        s = document.createElement('canvas');
        s.width = W;
        s.height = H;
        const sctx = s.getContext('2d');
        sctx.shadowBlur = 6;
        sctx.shadowColor = color;
        sctx.fillStyle = color;
        // 3x10 core, centered: (W-3)/2 = 4.5 -> 4, (H-10)/2 = 4
        sctx.fillRect(W / 2 - 1.5, H / 2 - 5, 3, 10);
        sctx.shadowBlur = 0;
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(W / 2 - 0.5, H / 2 - 4, 1, 8);
        this._normalBulletSprites.set(color, s);
        return s;
    }

    /**
     * Pre-render an enemy bullet variant (default orb, wave diamond,
     * homing arrowhead, ring/donut). The returned canvas is sized so the
     * sprite center is at (W/2, H/2) and includes the soft glow.
     *
     * Caller is responsible for any rotation/translation - we always
     * blit centered at the bullet's (x, y).
     */
    _getEnemyBulletSprite(kind, color, radius) {
        const r = Math.max(2, Math.round(radius));
        const key = `${kind}|${color}|${r}`;
        let s = this._enemyBulletSprites.get(key);
        if (s) return s;

        const pad = 8; // glow padding
        const W = r * 4 + pad * 2;
        const H = r * 4 + pad * 2;
        s = document.createElement('canvas');
        s.width = W;
        s.height = H;
        const sctx = s.getContext('2d');
        const cx = W / 2;
        const cy = H / 2;

        sctx.shadowColor = color;
        sctx.fillStyle = color;

        switch (kind) {
            case 'wave': {
                // Elongated diamond (oriented vertically; rotation done at blit time)
                sctx.shadowBlur = 8;
                sctx.beginPath();
                sctx.moveTo(cx, cy - r);
                sctx.lineTo(cx - r * 0.5, cy);
                sctx.lineTo(cx, cy + r);
                sctx.lineTo(cx + r * 0.5, cy);
                sctx.closePath();
                sctx.fill();
                sctx.shadowBlur = 0;
                sctx.fillStyle = '#ffffff';
                sctx.globalAlpha = 0.7;
                sctx.beginPath();
                sctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
                sctx.fill();
                break;
            }
            case 'homing': {
                // Arrowhead pointing up (caller rotates to velocity)
                sctx.shadowBlur = 12;
                sctx.beginPath();
                sctx.moveTo(cx, cy - r * 1.2);
                sctx.lineTo(cx - r * 0.6, cy + r * 0.8);
                sctx.lineTo(cx, cy + r * 0.4);
                sctx.lineTo(cx + r * 0.6, cy + r * 0.8);
                sctx.closePath();
                sctx.fill();
                sctx.shadowBlur = 0;
                sctx.fillStyle = '#ffffff';
                sctx.globalAlpha = 0.8;
                sctx.beginPath();
                sctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
                sctx.fill();
                break;
            }
            case 'ring': {
                // Donut ring with 4 inner dots (caller rotates)
                sctx.shadowBlur = 8;
                sctx.strokeStyle = color;
                sctx.lineWidth = 2.5;
                sctx.beginPath();
                sctx.arc(cx, cy, r, 0, Math.PI * 2);
                sctx.stroke();
                sctx.shadowBlur = 0;
                sctx.fillStyle = '#ffffff';
                sctx.globalAlpha = 0.8;
                for (let d = 0; d < 4; d++) {
                    const da = (d / 4) * Math.PI * 2;
                    sctx.beginPath();
                    sctx.arc(cx + Math.cos(da) * r * 0.5, cy + Math.sin(da) * r * 0.5, 1.5, 0, Math.PI * 2);
                    sctx.fill();
                }
                break;
            }
            case 'orb':
            default: {
                // Standard glowing orb
                sctx.shadowBlur = 4;
                sctx.beginPath();
                sctx.arc(cx, cy, r, 0, Math.PI * 2);
                sctx.fill();
                sctx.shadowBlur = 0;
                sctx.fillStyle = '#ffffff';
                sctx.globalAlpha = 0.6;
                sctx.beginPath();
                sctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
                sctx.fill();
                break;
            }
        }
        this._enemyBulletSprites.set(key, s);
        return s;
    }

    firePlayerBullet(x, y, vx, vy, damage = 1, type = 'normal', color = '#88ccff') {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.damage = damage;
        b.active = true;
        b.isPlayerBullet = true;
        b.type = type;
        b.color = color;
        b.width = type === 'missile' ? 6 : 4;
        b.height = type === 'missile' ? 12 : 10;
        b.radius = type === 'missile' ? 5 : 3;
        b.life = 999;
        this.playerBullets.push(b);
    }

    fireMissile(x, y, target) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = 0;
        b.vy = -3;
        b.damage = 3;
        b.active = true;
        b.isPlayerBullet = true;
        b.type = 'missile';
        b.color = '#ff8800';
        b.width = 6;
        b.height = 14;
        b.radius = 5;
        b.target = target;
        b.turnSpeed = 0.08;
        b.life = 180;
        this.playerBullets.push(b);
    }

    /**
     * Fire a heavy nuke bullet (one-shot AOE charge from picking up the N power-up).
     * Slow, large, glowing pink bullet that triggers a massive AOE explosion on hit
     * (or when reaching the upper part of the screen).
     */
    fireNuke(x, y) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = 0;
        b.vy = -4;          // slow
        b.damage = 8;       // heavy direct damage
        b.active = true;
        b.isPlayerBullet = true;
        b.type = 'nuke';    // recognized in collision.js → triggers big AOE
        b.color = '#ff2299';
        b.width = 16;
        b.height = 16;
        b.radius = 9;
        b.life = 240;
        b.age = 0;
        b.pulsePhase = 0;
        this.playerBullets.push(b);
    }

    fireEnemyBullet(x, y, vx, vy, type = 'enemy', color = '#ff4444') {
        // Hard cap on simultaneous enemy bullets to keep collision /
        // graze / draw loops bounded on low-end devices. The cap is
        // tightened in 'potato' / 'reduced' quality modes (set by
        // PerformanceManager via this._enemyBulletCap).
        const cap = this._enemyBulletCap || 220;
        if (this.enemyBullets.length >= cap) return null;

        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.damage = 1;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = type;
        b.color = color;
        b.width = 6;
        b.height = 6;
        b.radius = 4;
        b.life = 300;
        this.enemyBullets.push(b);
    }

    // New: Wave bullet - oscillates perpendicular to travel direction
    fireWaveBullet(x, y, vx, vy, color = '#ff44ff', amplitude = 30, frequency = 0.1) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.damage = 1;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = 'wave';
        b.color = color;
        b.radius = 5;
        b.width = 10;
        b.height = 10;
        b.life = 300;
        b.waveAmplitude = amplitude;
        b.waveFrequency = frequency;
        b.baseAngle = Math.atan2(vy, vx);
        b.age = 0;
        b.originalSpeed = Math.sqrt(vx * vx + vy * vy);
        this.enemyBullets.push(b);
    }

    // New: Homing bullet - slowly tracks player
    fireHomingBullet(x, y, speed, color = '#ff8844', homingStrength = 0.03) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = 0;
        b.vy = speed;
        b.damage = 1;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = 'homing';
        b.color = color;
        b.radius = 5;
        b.width = 10;
        b.height = 10;
        b.life = 240;
        b.homingStrength = homingStrength;
        b.originalSpeed = speed;
        b.age = 0;
        this.enemyBullets.push(b);
    }

    // New: Split bullet - splits into multiple after a delay
    fireSplitBullet(x, y, vx, vy, color = '#ffcc00', splitCount = 5, splitDelay = 40) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.damage = 1;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = 'split';
        b.color = color;
        b.radius = 7;
        b.width = 14;
        b.height = 14;
        b.life = 300;
        b.splitCount = splitCount;
        b.splitDone = false;
        b.delayFrames = splitDelay;
        b.age = 0;
        this.enemyBullets.push(b);
    }

    // New: Accelerating bullet - starts slow, gets faster
    fireAccelBullet(x, y, vx, vy, color = '#44ff88', accelRate = 0.05) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.damage = 1;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = 'accel';
        b.color = color;
        b.radius = 4;
        b.width = 8;
        b.height = 8;
        b.life = 300;
        b.accelRate = accelRate;
        b.age = 0;
        this.enemyBullets.push(b);
    }

    // New: Beam/Laser line
    fireBeamBullet(x, y, vx, vy, color = '#00ffff', length = 30) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.damage = 2;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = 'beam';
        b.color = color;
        b.radius = 3;
        b.width = 6;
        b.height = length;
        b.life = 200;
        b.age = 0;
        b.rotAngle = Math.atan2(vy, vx);
        this.enemyBullets.push(b);
    }

    // New: Ring bullet (expands outward in a ring pattern)
    fireRingBullet(x, y, angle, speed, color = '#ff66aa', rotSpeed = 0.02) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.damage = 1;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = 'ring';
        b.color = color;
        b.radius = 6;
        b.width = 12;
        b.height = 12;
        b.life = 250;
        b.rotAngle = 0;
        b.rotSpeed = rotSpeed;
        b.age = 0;
        this.enemyBullets.push(b);
    }

    // New: Petal bullet (follows a curved/flower-like path)
    firePetalBullet(x, y, angle, speed, color = '#ff88cc', petalFreq = 0.05) {
        const b = this.pool.get();
        b.x = x;
        b.y = y;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.damage = 1;
        b.active = true;
        b.isPlayerBullet = false;
        b.type = 'petal';
        b.color = color;
        b.radius = 5;
        b.width = 10;
        b.height = 10;
        b.life = 280;
        b.baseAngle = angle;
        b.waveFrequency = petalFreq;
        b.originalSpeed = speed;
        b.age = 0;
        this.enemyBullets.push(b);
    }

    update(dt, enemies, playerX, playerY) {
        // Update player bullets
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i];
            b.life -= dt * 60;

            if (b.type === 'missile' && b.target) {
                if (b.target.active && b.target.hp > 0) {
                    const angle = angleBetween(b.x, b.y, b.target.x + b.target.width / 2, b.target.y + b.target.height / 2);
                    const currentAngle = Math.atan2(b.vy, b.vx);
                    let diff = angle - currentAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const newAngle = currentAngle + Math.sign(diff) * Math.min(Math.abs(diff), b.turnSpeed);
                    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    b.vx = Math.cos(newAngle) * (speed + 0.05);
                    b.vy = Math.sin(newAngle) * (speed + 0.05);
                } else {
                    b.target = this._findNearestEnemy(b, enemies);
                }
            }

            b.x += b.vx * dt * 60;
            b.y += b.vy * dt * 60;

            // Trail effect
            b.trailTimer += dt * 60;
            if (b.trailTimer > 2) {
                b.trailTimer = 0;
                if (b.type === 'missile') {
                    this.particles.trail(b.x, b.y + 5, '#ff6600');
                } else if (b.type === 'nuke') {
                    this.particles.trail(b.x, b.y + 8, '#ff44aa');
                    this.particles.trail(b.x + (Math.random() - 0.5) * 6, b.y + 5, '#ff88cc');
                }
            }

            // Nuke pulsing animation
            if (b.type === 'nuke') {
                b.age = (b.age || 0) + dt * 60;
                b.pulsePhase = b.age * 0.2;
            }

            if (b.y < -20 || b.y > GAME_HEIGHT + 20 || b.x < -20 || b.x > GAME_WIDTH + 20 || b.life <= 0) {
                this.playerBullets.splice(i, 1);
                this.pool.release(b);
            }
        }

        // Update enemy bullets (enhanced with new types)
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.age += dt * 60;
            b.life -= dt * 60;

            switch (b.type) {
                case 'wave':
                    // Oscillate perpendicular to travel direction
                    const perpAngle = b.baseAngle + Math.PI / 2;
                    const wave = Math.sin(b.age * b.waveFrequency) * b.waveAmplitude * 0.05;
                    b.x += (b.vx + Math.cos(perpAngle) * wave) * dt * 60;
                    b.y += (b.vy + Math.sin(perpAngle) * wave) * dt * 60;
                    break;

                case 'homing':
                    if (playerX !== undefined && playerY !== undefined && b.age > 15) {
                        const targetAngle = angleBetween(b.x, b.y, playerX, playerY);
                        const curAngle = Math.atan2(b.vy, b.vx);
                        let angleDiff = targetAngle - curAngle;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                        const newAngle = curAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), b.homingStrength);
                        const speed = b.originalSpeed;
                        b.vx = Math.cos(newAngle) * speed;
                        b.vy = Math.sin(newAngle) * speed;
                    }
                    b.x += b.vx * dt * 60;
                    b.y += b.vy * dt * 60;
                    // Homing trail
                    if (b.age % 3 < 1) {
                        this.particles.trail(b.x, b.y, b.color);
                    }
                    break;

                case 'split':
                    b.x += b.vx * dt * 60;
                    b.y += b.vy * dt * 60;
                    // Split after delay
                    if (!b.splitDone && b.age >= b.delayFrames) {
                        b.splitDone = true;
                        const splitAngleBase = Math.atan2(b.vy, b.vx);
                        for (let s = 0; s < b.splitCount; s++) {
                            const sa = splitAngleBase + ((s / b.splitCount) - 0.5) * Math.PI * 0.8;
                            this.fireEnemyBullet(b.x, b.y,
                                Math.cos(sa) * 3, Math.sin(sa) * 3, 'enemy', b.color);
                        }
                        // Flash on split
                        this.particles.emit(b.x, b.y, 6, {
                            speed: 2, size: 3, life: 15, color: b.color
                        });
                        // Kill the parent
                        b.life = 0;
                    }
                    // Pulse before splitting
                    b.pulsePhase = b.age / b.delayFrames;
                    break;

                case 'accel':
                    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    const angle = Math.atan2(b.vy, b.vx);
                    const newSpeed = speed + b.accelRate;
                    b.vx = Math.cos(angle) * newSpeed;
                    b.vy = Math.sin(angle) * newSpeed;
                    b.x += b.vx * dt * 60;
                    b.y += b.vy * dt * 60;
                    break;

                case 'beam':
                    b.x += b.vx * dt * 60;
                    b.y += b.vy * dt * 60;
                    b.rotAngle = Math.atan2(b.vy, b.vx);
                    break;

                case 'ring':
                    b.rotAngle += b.rotSpeed * dt * 60;
                    b.x += b.vx * dt * 60;
                    b.y += b.vy * dt * 60;
                    break;

                case 'petal':
                    // Curved petal path
                    const petalOffset = Math.sin(b.age * b.waveFrequency) * 2;
                    const baseDir = Math.atan2(b.vy, b.vx);
                    b.x += (b.vx + Math.cos(baseDir + Math.PI / 2) * petalOffset) * dt * 60;
                    b.y += (b.vy + Math.sin(baseDir + Math.PI / 2) * petalOffset) * dt * 60;
                    break;

                default:
                    b.x += b.vx * dt * 60;
                    b.y += b.vy * dt * 60;
                    break;
            }

            if (b.y < -20 || b.y > GAME_HEIGHT + 20 || b.x < -20 || b.x > GAME_WIDTH + 20 || b.life <= 0) {
                this.enemyBullets.splice(i, 1);
                this.pool.release(b);
            }
        }
    }

    _findNearestEnemy(bullet, enemies) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const e of enemies) {
            if (!e.active || e.hp <= 0) continue;
            const dx = e.x - bullet.x;
            const dy = e.y - bullet.y;
            const dist = dx * dx + dy * dy;
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = e;
            }
        }
        return nearest;
    }

    draw(ctx) {
        // Draw player bullets
        for (const b of this.playerBullets) {
            // Hot path: plain straight bullets and explosive shells are
            // both rendered as offscreen sprites and blitted with
            // drawImage (no shadowBlur per bullet).
            if (b.type !== 'missile' && b.type !== 'nuke') {
                const sprite = this._getNormalBulletSprite(b.color || '#88ccff');
                ctx.drawImage(sprite, b.x - sprite.width / 2, b.y - sprite.height / 2);
                continue;
            }

            ctx.save();
            if (b.type === 'missile') {
                ctx.fillStyle = '#ff8800';
                ctx.translate(b.x, b.y);
                const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, -7);
                ctx.lineTo(-3, 5);
                ctx.lineTo(3, 5);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(-1, 3, 2, 4);
            } else if (b.type === 'nuke') {
                // Pulsing outer aura
                const pulse = 1 + Math.sin(b.pulsePhase || 0) * 0.25;
                const outerR = b.radius * 2.2 * pulse;

                // Outer glow ring
                ctx.fillStyle = 'rgba(255, 34, 153, 0.18)';
                ctx.shadowBlur = 25;
                ctx.shadowColor = '#ff2299';
                ctx.beginPath();
                ctx.arc(b.x, b.y, outerR, 0, Math.PI * 2);
                ctx.fill();

                // Mid ring
                ctx.fillStyle = 'rgba(255, 102, 187, 0.45)';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius * 1.4 * pulse, 0, Math.PI * 2);
                ctx.fill();

                // Main body
                ctx.fillStyle = b.color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fill();

                // Rotating spike shell (4 spikes)
                ctx.strokeStyle = '#ffffff';
                ctx.shadowBlur = 4;
                ctx.shadowColor = '#ffffff';
                ctx.lineWidth = 1.5;
                const rot = b.pulsePhase || 0;
                for (let i = 0; i < 4; i++) {
                    const a = rot + (i / 4) * Math.PI * 2;
                    const x1 = b.x + Math.cos(a) * b.radius * 0.6;
                    const y1 = b.y + Math.sin(a) * b.radius * 0.6;
                    const x2 = b.x + Math.cos(a) * b.radius * 1.5;
                    const y2 = b.y + Math.sin(a) * b.radius * 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                // White-hot core
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
            // Note: 'normal' / default bullets are handled above via the
            // sprite cache and `continue`, so they never reach this block.
            ctx.restore();
        }

        // Draw enemy bullets (enhanced rendering)
        for (const b of this.enemyBullets) {
            // Hot path: most enemy bullets are static-shape glowing
            // sprites. We blit them with drawImage and only spin up
            // ctx.save() + the slower path for animated variants.
            if (b.type === 'wave' || b.type === 'homing') {
                const sprite = this._getEnemyBulletSprite(b.type, b.color, b.radius);
                const angle = b.type === 'wave'
                    ? b.baseAngle + Math.PI / 2
                    : Math.atan2(b.vy, b.vx) + Math.PI / 2;
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(angle);
                ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
                ctx.restore();
                continue;
            }
            if (b.type === 'ring') {
                const sprite = this._getEnemyBulletSprite('ring', b.color, b.radius);
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(b.rotAngle);
                ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
                ctx.restore();
                continue;
            }
            if (b.type === undefined || b.type === 'enemy') {
                // Standard glowing orb (default branch in the old switch).
                // No rotation needed.
                const sprite = this._getEnemyBulletSprite('orb', b.color, b.radius);
                ctx.drawImage(sprite, b.x - sprite.width / 2, b.y - sprite.height / 2);
                continue;
            }

            ctx.save();

            switch (b.type) {
                case 'split':
                    // Pulsing large orb that grows before splitting
                    const pulse = 1 + Math.sin(b.age * 0.3) * 0.3 * b.pulsePhase;
                    ctx.fillStyle = b.color;
                    ctx.shadowBlur = 15 * pulse;
                    ctx.shadowColor = b.color;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius * pulse, 0, Math.PI * 2);
                    ctx.fill();
                    // Warning ring
                    ctx.strokeStyle = b.color;
                    ctx.globalAlpha = 0.4 + b.pulsePhase * 0.4;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius * pulse * 1.5, 0, Math.PI * 2);
                    ctx.stroke();
                    // Core
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.9;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'accel':
                    // Stretched bullet that elongates as it accelerates
                    const aSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    const stretch = Math.min(aSpeed / 3, 2.5);
                    ctx.translate(b.x, b.y);
                    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
                    ctx.fillStyle = b.color;
                    ctx.shadowBlur = 6 + aSpeed;
                    ctx.shadowColor = b.color;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, b.radius * 0.6, b.radius * stretch, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.ellipse(0, -b.radius * 0.3, b.radius * 0.2, b.radius * 0.4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'beam':
                    // Laser line bullet
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.rotAngle + Math.PI / 2);
                    const beamLen = b.height;
                    // Outer glow
                    ctx.strokeStyle = b.color;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = b.color;
                    ctx.lineWidth = 4;
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(0, -beamLen / 2);
                    ctx.lineTo(0, beamLen / 2);
                    ctx.stroke();
                    // Core
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.9;
                    ctx.beginPath();
                    ctx.moveTo(0, -beamLen / 2);
                    ctx.lineTo(0, beamLen / 2);
                    ctx.stroke();
                    break;

                case 'petal':
                    // Petal/flower shape
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.age * 0.05);
                    ctx.fillStyle = b.color;
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = b.color;
                    // Draw a 4-petal flower
                    for (let p = 0; p < 4; p++) {
                        const pa = (p / 4) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.ellipse(
                            Math.cos(pa) * b.radius * 0.4,
                            Math.sin(pa) * b.radius * 0.4,
                            b.radius * 0.4, b.radius * 0.2,
                            pa, 0, Math.PI * 2
                        );
                        ctx.fill();
                    }
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius * 0.25, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                // 'wave' / 'homing' / 'ring' / standard orb are drawn
                // via _getEnemyBulletSprite above and never reach this
                // switch.
            }

            ctx.restore();
        }
    }

    clearEnemyBullets() {
        this.enemyBullets.forEach(b => this.pool.release(b));
        this.enemyBullets = [];
    }

    clearAll() {
        this.playerBullets.forEach(b => this.pool.release(b));
        this.enemyBullets.forEach(b => this.pool.release(b));
        this.playerBullets = [];
        this.enemyBullets = [];
    }
}
