// bullets.js - Bullet system for player and enemies (upgraded with boss bullet types)

import { GAME_WIDTH, GAME_HEIGHT, ObjectPool, angleBetween, randRange } from './utils.js';

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

    fireEnemyBullet(x, y, vx, vy, type = 'enemy', color = '#ff4444') {
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
                }
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
            } else {
                ctx.fillStyle = b.color;
                ctx.shadowBlur = 6;
                ctx.shadowColor = b.color;
                ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(b.x - 0.5, b.y - 4, 1, 8);
            }
            ctx.restore();
        }

        // Draw enemy bullets (enhanced rendering)
        for (const b of this.enemyBullets) {
            ctx.save();

            switch (b.type) {
                case 'wave':
                    // Elongated diamond shape
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.baseAngle + Math.PI / 2);
                    ctx.fillStyle = b.color;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = b.color;
                    ctx.beginPath();
                    ctx.moveTo(0, -b.radius);
                    ctx.lineTo(-b.radius * 0.5, 0);
                    ctx.lineTo(0, b.radius);
                    ctx.lineTo(b.radius * 0.5, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'homing':
                    // Glowing arrowhead with trail
                    ctx.translate(b.x, b.y);
                    const homingAngle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
                    ctx.rotate(homingAngle);
                    ctx.fillStyle = b.color;
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = b.color;
                    ctx.beginPath();
                    ctx.moveTo(0, -b.radius * 1.2);
                    ctx.lineTo(-b.radius * 0.6, b.radius * 0.8);
                    ctx.lineTo(0, b.radius * 0.4);
                    ctx.lineTo(b.radius * 0.6, b.radius * 0.8);
                    ctx.closePath();
                    ctx.fill();
                    // Inner glow
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    break;

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

                case 'ring':
                    // Rotating ring/donut
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.rotAngle);
                    ctx.strokeStyle = b.color;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = b.color;
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    // Inner dots
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.8;
                    for (let d = 0; d < 4; d++) {
                        const da = (d / 4) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.arc(Math.cos(da) * b.radius * 0.5, Math.sin(da) * b.radius * 0.5, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
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

                default:
                    // Standard enemy bullet - glowing orb
                    ctx.fillStyle = b.color;
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = b.color;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.6;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                    break;
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
