// boss.js - Boss system (upgraded with spectacular attacks and visuals)

import { GAME_WIDTH, GAME_HEIGHT, randRange, angleBetween } from './utils.js';

export class Boss {
    constructor(bullets, particles, audio, powerups) {
        this.bullets = bullets;
        this.particles = particles;
        this.audio = audio;
        this.powerups = powerups || null;

        this.x = 0;
        this.y = -100;
        this.width = 80;
        this.height = 60;
        this.hp = 100;
        this.maxHp = 100;
        this.active = false;
        this.entering = false;
        this.phase = 0;
        this.bossType = 1;
        this.timer = 0;
        this.attackTimer = 0;
        this.attackPattern = 0;
        this.moveTimer = 0;
        this.targetX = GAME_WIDTH / 2;
        this.targetY = 50;
        this.flashTimer = 0;
        this.speed = 1.5;
        this.defeated = false;
        this.defeatTimer = 0;
        this.color = '#cc2222';
        this.summonTimer = 0;

        // New visual properties
        this.auraAngle = 0;
        this.chargeTimer = 0;
        this.isCharging = false;
        this.chargeTarget = { x: 0, y: 0 };
        this.shakeAmount = 0;
        this.wingAngle = 0;
        this.enginePulse = 0;
        this.orbitalAngle = 0;
        this.shieldAngle = 0;
        this.dashTrail = [];
        this.specialTimer = 0;
        this.patternCount = 0;
        this.spiralOffset = 0;
    }

    spawn(type, level) {
        this.bossType = type;
        this.active = true;
        this.entering = true;
        this.defeated = false;
        this.phase = 0;
        this.timer = 0;
        this.attackTimer = 0;
        this.y = -120;
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.shakeAmount = 0;
        this.patternCount = 0;
        this.spiralOffset = 0;
        this.dashTrail = [];

        // Difficulty tier: progressive ramp by level
        // tier 0 = rookie (Lv.1), 1 = normal (Lv.2~3), 2 = hard (Lv.4+), 3 = endless
        // level=1 is the very first encounter, must be gentle to onboard the player.
        if (level <= 1) this.difficultyTier = 0;
        else if (level <= 3) this.difficultyTier = 1;
        else if (level <= 5) this.difficultyTier = 2;
        else this.difficultyTier = 3;

        // Restrict attack patterns for early bosses (each boss has 7 patterns: 0~6)
        // tier 0: only patterns 0,1,2,3 (basic) | tier 1: 0~5 | tier 2+: all 0~6
        this.maxPattern = this.difficultyTier === 0 ? 4
                        : this.difficultyTier === 1 ? 6 : 7;

        switch (type) {
            case 1: // INFERNO GUARDIAN - fire themed
                this.width = 90;
                this.height = 65;
                // tier 0 has reduced HP for a forgiving first encounter
                this.hp = this.difficultyTier === 0
                    ? 70
                    : 100 + level * 25;
                this.maxHp = this.hp;
                this.speed = this.difficultyTier === 0 ? 1.4 : 1.8;
                this.color = '#ff3300';
                break;
            case 2: // PHANTOM STRIKER - speed/tech themed
                this.width = 75;
                this.height = 55;
                this.hp = 120 + level * 30;
                this.maxHp = this.hp;
                this.speed = 3;
                this.color = '#00ccff';
                this.summonTimer = 150;
                break;
            case 3: // VOID OVERLORD - dark magic themed
                this.width = 110;
                this.height = 80;
                this.hp = 180 + level * 35;
                this.maxHp = this.hp;
                this.speed = 2;
                this.color = '#9900ff';
                break;
            case 4: // FROST TYRANT - ice themed, slow controller
                this.width = 100;
                this.height = 75;
                this.hp = 160 + level * 30;
                this.maxHp = this.hp;
                this.speed = 1.2;
                this.color = '#88ddff';
                break;
            case 5: // LIGHTNING SOVEREIGN - high speed, teleporting
                this.width = 70;
                this.height = 60;
                this.hp = 140 + level * 28;
                this.maxHp = this.hp;
                this.speed = 3.5;
                this.color = '#ffee44';
                this.teleportTimer = 0;
                this.teleportFlash = 0;
                break;
            case 6: // NEXUS COLOSSUS - mecha titan, drones
                this.width = 130;
                this.height = 90;
                this.hp = 220 + level * 40;
                this.maxHp = this.hp;
                this.speed = 1.5;
                this.color = '#cccccc';
                this.summonTimer = 120;
                break;
        }

        this.audio.playBossAlert();
    }

    update(dt, playerX, playerY, enemySystem) {
        if (!this.active) return;

        this.timer += dt * 60;
        this.auraAngle += dt * 2;
        this.orbitalAngle += dt * 3;
        this.shieldAngle += dt * 1.5;
        this.enginePulse = Math.sin(this.timer * 0.1) * 0.5 + 0.5;
        this.wingAngle = Math.sin(this.timer * 0.03) * 0.1;

        // Decay shake
        if (this.shakeAmount > 0) this.shakeAmount *= 0.92;

        if (this.defeated) {
            this.defeatTimer += dt * 60;
            // Visual: small chained explosions all over the boss
            if (this.defeatTimer % 6 < 1) {
                const ex = this.x + randRange(0, this.width);
                const ey = this.y + randRange(0, this.height);
                this.particles.explode(ex, ey, 1);
            }
            // Audio: heavier boss-specific chained explosions, less often than visuals
            // (every 12 frames ≈ 5 per second to avoid overlapping/muddy sound)
            if (this.defeatTimer % 12 < 1) {
                this.audio.playBossSmallExplosion();
            }
            if (this.defeatTimer > 100) {
                // Final epic explosion
                this.particles.explode(this.x + this.width / 2, this.y + this.height / 2, 4);
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    const ex = this.x + this.width / 2 + Math.cos(a) * 30;
                    const ey = this.y + this.height / 2 + Math.sin(a) * 30;
                    this.particles.explode(ex, ey, 1.5);
                }
                // Cinematic boss defeat sound (descending roar + impact + victory chord)
                this.audio.playBossDefeat();

                // 100% power-up drop on boss defeat
                if (this.powerups) {
                    this.powerups.spawnRandom(
                        this.x + this.width / 2,
                        this.y + this.height / 2
                    );
                }

                this.active = false;
            }
            return;
        }

        // Entry animation
        if (this.entering) {
            this.y += 1.5 * dt * 60;
            if (this.y >= 50) {
                this.y = 50;
                this.entering = false;
                this.shakeAmount = 5;
            }
            return;
        }

        if (this.flashTimer > 0) this.flashTimer -= dt * 60;

        // Phase change based on HP
        // tier 0 (Lv.1): no Phase 2 rage, gentler Phase 1 trigger
        const hpRatio = this.hp / this.maxHp;
        // Updated: Phase 1 at 70% HP (speed +20%), Phase 2 at 40% HP (attack +50%)
        if (this.difficultyTier > 0 && hpRatio < 0.4 && this.phase < 2) {
            this.phase = 2;
            this.shakeAmount = 8;
            this.speed *= 1.2; // Speed +20% in phase 2
            this.particles.explode(this.x + this.width / 2, this.y + this.height / 2, 2);
            // Phase change bullet clear and rage burst
            this._rageBurst();
        } else if (hpRatio < 0.7 && this.phase < 1) {
            this.phase = 1;
            this.shakeAmount = 5;
            this.speed *= 1.2; // Speed +20% in phase 1
            this.particles.explode(this.x + this.width / 2, this.y + this.height / 2, 1.5);
        }

        // Movement - varies by boss type
        this._updateMovement(dt, playerX, playerY);

        // Attack patterns
        this.attackTimer -= dt * 60;
        if (this.attackTimer <= 0) {
            this._attack(playerX, playerY, enemySystem);
            // Longer cooldown for rookie tier
            const tierCDBonus = this.difficultyTier === 0 ? 30
                              : this.difficultyTier === 1 ? 10 : 0;
            const baseCD = Math.max(25, 70 - this.phase * 15) + tierCDBonus;
            this.attackTimer = baseCD;
            this.patternCount++;
            this.attackPattern = (this.attackPattern + 1) % this.maxPattern;
        }

        // Special periodic attacks (disabled for rookie tier)
        if (this.difficultyTier > 0) {
            this.specialTimer += dt * 60;
            if (this.specialTimer > 200 - this.phase * 40) {
                this.specialTimer = 0;
                this._specialAttack(playerX, playerY);
            }
        }

        // Update dash trail
        if (this.dashTrail.length > 0) {
            this.dashTrail = this.dashTrail.filter(t => {
                t.life -= dt * 60;
                return t.life > 0;
            });
        }
    }

    _updateMovement(dt, playerX, playerY) {
        this.moveTimer += dt * 60;

        switch (this.bossType) {
            case 1: // Slow, deliberate movements
                if (this.moveTimer > 100 - this.phase * 20) {
                    this.moveTimer = 0;
                    this.targetX = randRange(30, GAME_WIDTH - this.width - 30);
                    this.targetY = 40 + randRange(0, 30);
                }
                break;
            case 2: // Quick dashes
                if (this.moveTimer > 60 - this.phase * 10) {
                    this.moveTimer = 0;
                    this.targetX = randRange(20, GAME_WIDTH - this.width - 20);
                    this.targetY = 30 + randRange(0, 50);
                    // Dash trail
                    this.dashTrail.push({ x: this.x, y: this.y, life: 15, w: this.width, h: this.height });
                }
                break;
            case 3: // Slow menacing drift
                if (this.moveTimer > 120 - this.phase * 25) {
                    this.moveTimer = 0;
                    this.targetX = randRange(20, GAME_WIDTH - this.width - 20);
                    this.targetY = 35 + randRange(0, 40);
                }
                break;
            case 4: // FROST TYRANT - very slow horizontal sliding
                if (this.moveTimer > 140 - this.phase * 25) {
                    this.moveTimer = 0;
                    this.targetX = randRange(40, GAME_WIDTH - this.width - 40);
                    this.targetY = 50 + randRange(0, 20);
                }
                break;
            case 5: // LIGHTNING SOVEREIGN - teleports between positions
                this.teleportTimer = (this.teleportTimer || 0) + dt * 60;
                if (this.teleportFlash > 0) this.teleportFlash -= dt * 60;
                if (this.teleportTimer > 90 - this.phase * 15) {
                    this.teleportTimer = 0;
                    this.teleportFlash = 12;
                    // Teleport to new location
                    this.particles.explode(this.x + this.width / 2, this.y + this.height / 2, 1.5);
                    this.x = randRange(20, GAME_WIDTH - this.width - 20);
                    this.y = 40 + randRange(0, 60);
                    this.targetX = this.x;
                    this.targetY = this.y;
                    this.particles.explode(this.x + this.width / 2, this.y + this.height / 2, 1.5);
                }
                break;
            case 6: // NEXUS COLOSSUS - heavy slow drift
                if (this.moveTimer > 160 - this.phase * 25) {
                    this.moveTimer = 0;
                    this.targetX = randRange(20, GAME_WIDTH - this.width - 20);
                    this.targetY = 40 + randRange(0, 30);
                }
                break;
        }

        const moveDir = this.targetX - this.x;
        const moveDirY = this.targetY - this.y;
        const moveSpeed = this.speed * (1 + this.phase * 0.3);
        if (Math.abs(moveDir) > 2) {
            this.x += Math.sign(moveDir) * moveSpeed * dt * 60;
        }
        if (Math.abs(moveDirY) > 2) {
            this.y += Math.sign(moveDirY) * moveSpeed * 0.5 * dt * 60;
        }

        // Subtle oscillation
        this.y += Math.sin(this.timer * 0.02) * 0.3;
    }

    _rageBurst() {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        // Rage burst - ring of accelerating bullets
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            this.bullets.fireAccelBullet(cx, cy,
                Math.cos(a) * 1.5, Math.sin(a) * 1.5, '#ff0000', 0.04);
        }
    }

    _laserAimAttack(cx, cy, px, py) {
        // Laser aim attack - fires a powerful beam towards player position
        const angle = Math.atan2(py - cy, px - cx);

        // Fire multiple beam bullets to create a laser effect
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 0.02;
            this.bullets.fireBeamBullet(cx, cy,
                Math.cos(angle + offset) * 5, Math.sin(angle + offset) * 5,
                '#ff00ff', 35);
        }

        // Screen shake for laser firing
        this.shakeAmount = Math.max(this.shakeAmount, 4);
    }

    _attack(playerX, playerY, enemySystem) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;

        switch (this.bossType) {
            case 1: this._attackBoss1(cx, cy, playerX, playerY); break;
            case 2: this._attackBoss2(cx, cy, playerX, playerY, enemySystem); break;
            case 3: this._attackBoss3(cx, cy, playerX, playerY); break;
            case 4: this._attackBoss4(cx, cy, playerX, playerY); break;
            case 5: this._attackBoss5(cx, cy, playerX, playerY); break;
            case 6: this._attackBoss6(cx, cy, playerX, playerY, enemySystem); break;
        }
    }

    _specialAttack(playerX, playerY) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        switch (this.bossType) {
            case 1:
                // INFERNO: Rain of fire split bullets
                for (let i = 0; i < 5; i++) {
                    const sx = randRange(cx - 60, cx + 60);
                    this.bullets.fireSplitBullet(sx, cy, randRange(-0.5, 0.5), 2, '#ff8800', 4, 35);
                }
                break;
            case 2:
                // PHANTOM: Beam sweep
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI + this.timer * 0.02;
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(a) * 3, Math.sin(a) * 3, '#00ffff', 25);
                }
                break;
            case 3:
                // VOID: Massive homing swarm
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    this.bullets.fireHomingBullet(
                        cx + Math.cos(a) * 30, cy + Math.sin(a) * 30,
                        2.5, '#cc44ff', 0.025);
                }
                break;
            case 4:
                // FROST: Slow expanding ice ring (large radius, many bullets)
                for (let i = 0; i < 20; i++) {
                    const a = (i / 20) * Math.PI * 2;
                    this.bullets.fireRingBullet(cx, cy, a, 1.5, '#aaeeff', 0.02);
                }
                break;
            case 5:
                // LIGHTNING: Chain beams in 8 directions
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + this.timer * 0.03;
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(a) * 4.5, Math.sin(a) * 4.5, '#ffff44', 30);
                }
                break;
            case 6:
                // COLOSSUS: Massive aimed split bombardment
                const aim = angleBetween(cx, cy, playerX, playerY);
                for (let i = -2; i <= 2; i++) {
                    this.bullets.fireSplitBullet(
                        cx + i * 25, cy,
                        Math.cos(aim + i * 0.05) * 1.5,
                        Math.sin(aim + i * 0.05) * 1.5,
                        '#ffaa00', 6, 40
                    );
                }
                break;
        }
        this.shakeAmount = 3;
    }

    _attackBoss1(cx, cy, px, py) {
        switch (this.attackPattern) {
            case 0: // Rotating fan spread
                const fanOffset = this.patternCount * 0.15;
                for (let i = -4; i <= 4; i++) {
                    const angle = Math.PI / 2 + i * 0.18 + fanOffset;
                    this.bullets.fireEnemyBullet(cx, cy,
                        Math.cos(angle) * 3.5, Math.sin(angle) * 3.5, 'enemy', '#ff6644');
                }
                break;

            case 1: // Fire wave bullets
                for (let i = -2; i <= 2; i++) {
                    const angle = Math.PI / 2 + i * 0.25;
                    this.bullets.fireWaveBullet(cx, cy,
                        Math.cos(angle) * 2.5, Math.sin(angle) * 2.5,
                        '#ff4400', 25, 0.12);
                }
                break;

            case 2: // Aimed triple shot with accelerating bullets
                const angle = angleBetween(cx, cy, px, py);
                for (let i = -1; i <= 1; i++) {
                    this.bullets.fireAccelBullet(cx, cy,
                        Math.cos(angle + i * 0.15) * 1.5,
                        Math.sin(angle + i * 0.15) * 1.5,
                        '#ffaa22', 0.06);
                }
                break;

            case 3: // Double spiral
                this.spiralOffset += 0.3;
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + this.spiralOffset;
                    this.bullets.fireEnemyBullet(cx, cy,
                        Math.cos(a) * 2.5, Math.sin(a) * 2.5, 'enemy', '#ff8844');
                }
                if (this.phase >= 1) {
                    for (let i = 0; i < 8; i++) {
                        const a = (i / 8) * Math.PI * 2 - this.spiralOffset;
                        this.bullets.fireEnemyBullet(cx, cy,
                            Math.cos(a) * 2, Math.sin(a) * 2, 'enemy', '#ffcc00');
                    }
                }
                break;

            case 4: // Split bomb rain
                if (this.phase >= 1) {
                    for (let i = -1; i <= 1; i++) {
                        this.bullets.fireSplitBullet(cx + i * 30, cy,
                            i * 0.5, 2, '#ff6622', 5, 30);
                    }
                }
                break;

            case 5: // Enrage: Full fire circle + aimed
                if (this.phase >= 2) {
                    for (let i = 0; i < 16; i++) {
                        const a = (i / 16) * Math.PI * 2 + this.timer * 0.03;
                        this.bullets.fireEnemyBullet(cx, cy,
                            Math.cos(a) * 2, Math.sin(a) * 2, 'enemy', '#ff2200');
                    }
                    const aimed = angleBetween(cx, cy, px, py);
                    for (let i = -2; i <= 2; i++) {
                        this.bullets.fireAccelBullet(cx, cy,
                            Math.cos(aimed + i * 0.12) * 2,
                            Math.sin(aimed + i * 0.12) * 2,
                            '#ffffff', 0.05);
                    }
                }
                break;
        }
    }

    _attackBoss2(cx, cy, px, py, enemySystem) {
        switch (this.attackPattern) {
            case 0: // Beam barrage
                for (let i = -2; i <= 2; i++) {
                    const angle = Math.PI / 2 + i * 0.3;
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(angle) * 4, Math.sin(angle) * 4, '#44ddff', 20);
                }
                break;

            case 1: // Homing missiles
                for (let i = 0; i < 3 + this.phase; i++) {
                    const offsetX = (i - 1.5) * 20;
                    this.bullets.fireHomingBullet(cx + offsetX, cy, 2.5, '#00ffcc', 0.035);
                }
                break;

            case 2: // Speed dash + bullet spray
                this.targetX = px - this.width / 2;
                // Side spray
                for (let i = 0; i < 6; i++) {
                    const a = randRange(0.3, Math.PI - 0.3);
                    this.bullets.fireAccelBullet(cx, cy,
                        Math.cos(a) * 2, Math.sin(a) * 2, '#44ffff', 0.04);
                }
                this.dashTrail.push({ x: this.x, y: this.y, life: 20, w: this.width, h: this.height });
                break;

            case 3: // Petal flower pattern
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2 + this.timer * 0.02;
                    this.bullets.firePetalBullet(cx, cy, a, 2.5, '#88ffee', 0.06);
                }
                break;

            case 4: // Summon + wave cover
                if (enemySystem) {
                    this.summonTimer -= 60;
                    if (this.summonTimer <= 0) {
                        enemySystem.spawnEnemy('small', cx - 50, cy, 'dive');
                        enemySystem.spawnEnemy('small', cx + 50, cy, 'dive');
                        if (this.phase >= 1) {
                            enemySystem.spawnEnemy('medium', cx, cy, 'strafe');
                        }
                        this.summonTimer = 150 - this.phase * 30;
                    }
                }
                // Cover fire
                for (let i = -3; i <= 3; i++) {
                    this.bullets.fireWaveBullet(cx, cy,
                        i * 0.8, 2.5, '#00ddaa', 20, 0.08);
                }
                break;

            case 5: // Laser aim attack
                this._laserAimAttack(cx, cy, px, py);
                break;

            case 6: // Ring explosion
                if (this.phase >= 1) {
                    for (let i = 0; i < 16; i++) {
                        const a = (i / 16) * Math.PI * 2;
                        this.bullets.fireRingBullet(cx, cy, a, 2.5, '#00ffff', 0.04);
                    }
                }
                break;
        }
    }

    _attackBoss3(cx, cy, px, py) {
        switch (this.attackPattern) {
            case 0: // Triple rotating spiral
                for (let s = 0; s < 3; s++) {
                    for (let i = 0; i < 5; i++) {
                        const a = (i / 5) * Math.PI * 2 + s * (Math.PI * 2 / 3) + this.spiralOffset;
                        this.bullets.firePetalBullet(cx, cy, a, 2, '#cc44ff', 0.04);
                    }
                }
                this.spiralOffset += 0.2;
                break;

            case 1: // Void bomb: split bullets in cross pattern
                for (let i = 0; i < 4; i++) {
                    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
                    this.bullets.fireSplitBullet(cx, cy,
                        Math.cos(a) * 2, Math.sin(a) * 2, '#9900ff', 6, 45);
                }
                break;

            case 2: // Homing swarm
                if (this.phase >= 0) {
                    for (let i = 0; i < 4 + this.phase * 2; i++) {
                        const a = (i / (4 + this.phase * 2)) * Math.PI * 2;
                        this.bullets.fireHomingBullet(
                            cx + Math.cos(a) * 20, cy + Math.sin(a) * 20,
                            2, '#ff66ff', 0.02 + this.phase * 0.005);
                    }
                }
                break;

            case 3: // Converging beams
                const aimed = angleBetween(cx, cy, px, py);
                for (let i = -3; i <= 3; i++) {
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(aimed + i * 0.15) * 3.5,
                        Math.sin(aimed + i * 0.15) * 3.5,
                        '#dd00ff', 30);
                }
                break;

            case 4: // Petal storm
                if (this.phase >= 1) {
                    for (let i = 0; i < 20; i++) {
                        const a = (i / 20) * Math.PI * 2 + this.timer * 0.05;
                        const speed = 1.5 + (i % 3) * 0.5;
                        this.bullets.firePetalBullet(cx, cy, a, speed, '#ff88ff', 0.07);
                    }
                }
                break;

            case 5: // APOCALYPSE: Full screen barrage
                if (this.phase >= 2) {
                    // Outer ring of accelerating bullets
                    for (let i = 0; i < 24; i++) {
                        const a = (i / 24) * Math.PI * 2;
                        this.bullets.fireAccelBullet(cx, cy,
                            Math.cos(a) * 1, Math.sin(a) * 1, '#ff00ff', 0.06);
                    }
                    // Inner ring of wave bullets
                    for (let i = 0; i < 12; i++) {
                        const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
                        this.bullets.fireWaveBullet(cx, cy,
                            Math.cos(a) * 2, Math.sin(a) * 2, '#cc00cc', 30, 0.1);
                    }
                    // Aimed split bombs
                    const aimAngle = angleBetween(cx, cy, px, py);
                    this.bullets.fireSplitBullet(cx, cy,
                        Math.cos(aimAngle) * 2.5, Math.sin(aimAngle) * 2.5,
                        '#ffffff', 8, 35);
                    this.shakeAmount = 6;
                }
                break;
        }
    }

    _attackBoss4(cx, cy, px, py) {
        // FROST TYRANT - control-themed boss with slow but tricky bullets
        switch (this.attackPattern) {
            case 0: { // Frost cone - aimed slow wide spread
                const angle = angleBetween(cx, cy, px, py);
                for (let i = -3; i <= 3; i++) {
                    this.bullets.fireWaveBullet(cx, cy,
                        Math.cos(angle + i * 0.18) * 2,
                        Math.sin(angle + i * 0.18) * 2,
                        '#aaddff', 18, 0.08);
                }
                break;
            }
            case 1: { // Ice shards - ring of beam bullets
                for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * Math.PI * 2 + this.timer * 0.015;
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(a) * 2.5, Math.sin(a) * 2.5, '#88ddff', 22);
                }
                break;
            }
            case 2: { // Slow-motion ring (very slow bullets that hang in air)
                for (let i = 0; i < 16; i++) {
                    const a = (i / 16) * Math.PI * 2;
                    this.bullets.fireAccelBullet(cx, cy,
                        Math.cos(a) * 0.8, Math.sin(a) * 0.8, '#ccffff', 0.02);
                }
                break;
            }
            case 3: { // Crystal cross - 4 directional split bullets
                for (let i = 0; i < 4; i++) {
                    const a = (i / 4) * Math.PI * 2;
                    this.bullets.fireSplitBullet(cx, cy,
                        Math.cos(a) * 2.2, Math.sin(a) * 2.2,
                        '#aaccff', 5, 40);
                }
                break;
            }
            case 4: { // Glacial bombardment (Phase 1+)
                if (this.phase >= 1) {
                    for (let i = -2; i <= 2; i++) {
                        const sx = cx + i * 35;
                        this.bullets.fireSplitBullet(sx, cy,
                            i * 0.3, 1.8, '#88ccff', 4, 30);
                    }
                }
                break;
            }
            case 5: { // Frost spiral
                this.spiralOffset += 0.18;
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 + this.spiralOffset;
                    this.bullets.firePetalBullet(cx, cy, a, 2, '#aaeeff', 0.05);
                }
                break;
            }
            case 6: { // Blizzard storm (Phase 2)
                if (this.phase >= 2) {
                    for (let i = 0; i < 14; i++) {
                        const a = (i / 14) * Math.PI * 2 + this.timer * 0.04;
                        this.bullets.fireWaveBullet(cx, cy,
                            Math.cos(a) * 1.8, Math.sin(a) * 1.8,
                            '#ffffff', 28, 0.13);
                    }
                    // Secondary aimed split shot
                    const aimed = angleBetween(cx, cy, px, py);
                    this.bullets.fireSplitBullet(cx, cy,
                        Math.cos(aimed) * 2, Math.sin(aimed) * 2,
                        '#ddffff', 6, 35);
                }
                break;
            }
        }
    }

    _attackBoss5(cx, cy, px, py) {
        // LIGHTNING SOVEREIGN - high-speed, chain attacks
        switch (this.attackPattern) {
            case 0: { // Chain lightning - aimed beam triple
                const angle = angleBetween(cx, cy, px, py);
                for (let i = -1; i <= 1; i++) {
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(angle + i * 0.1) * 6,
                        Math.sin(angle + i * 0.1) * 6,
                        '#ffff44', 28);
                }
                break;
            }
            case 1: { // Lightning fork - aimed accel spread
                const angle = angleBetween(cx, cy, px, py);
                for (let i = -2; i <= 2; i++) {
                    this.bullets.fireAccelBullet(cx, cy,
                        Math.cos(angle + i * 0.12) * 1.5,
                        Math.sin(angle + i * 0.12) * 1.5,
                        '#ffee88', 0.08);
                }
                break;
            }
            case 2: { // Star burst - 8-way beam
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + this.timer * 0.04;
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(a) * 4, Math.sin(a) * 4, '#ffff66', 22);
                }
                break;
            }
            case 3: { // Thunder rain (Phase 1+)
                if (this.phase >= 1) {
                    for (let i = 0; i < 6; i++) {
                        const sx = randRange(cx - 80, cx + 80);
                        this.bullets.fireBeamBullet(sx, cy,
                            randRange(-0.5, 0.5), 4, '#ffffaa', 30);
                    }
                }
                break;
            }
            case 4: { // Spiral lightning
                this.spiralOffset += 0.4;
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2 + this.spiralOffset;
                    this.bullets.fireAccelBullet(cx, cy,
                        Math.cos(a) * 2, Math.sin(a) * 2, '#ffff66', 0.06);
                }
                break;
            }
            case 5: { // Homing sparks
                if (this.phase >= 1) {
                    for (let i = 0; i < 4; i++) {
                        const a = (i / 4) * Math.PI * 2;
                        this.bullets.fireHomingBullet(
                            cx + Math.cos(a) * 20, cy + Math.sin(a) * 20,
                            3, '#ffff88', 0.04);
                    }
                }
                break;
            }
            case 6: { // Tempest (Phase 2)
                if (this.phase >= 2) {
                    // Outer fast ring
                    for (let i = 0; i < 18; i++) {
                        const a = (i / 18) * Math.PI * 2;
                        this.bullets.fireBeamBullet(cx, cy,
                            Math.cos(a) * 3.5, Math.sin(a) * 3.5, '#ffff44', 20);
                    }
                    // Aimed lightning bolts
                    const aimed = angleBetween(cx, cy, px, py);
                    for (let i = -1; i <= 1; i++) {
                        this.bullets.fireBeamBullet(cx, cy,
                            Math.cos(aimed + i * 0.08) * 7,
                            Math.sin(aimed + i * 0.08) * 7,
                            '#ffffff', 35);
                    }
                    this.shakeAmount = 4;
                }
                break;
            }
        }
    }

    _attackBoss6(cx, cy, px, py, enemySystem) {
        // NEXUS COLOSSUS - mecha titan, summons drones
        switch (this.attackPattern) {
            case 0: { // Twin cannon barrage
                for (let i = -2; i <= 2; i++) {
                    const angle = Math.PI / 2 + i * 0.12;
                    this.bullets.fireEnemyBullet(cx - 35, cy,
                        Math.cos(angle) * 3, Math.sin(angle) * 3, 'enemy', '#ffaa00');
                    this.bullets.fireEnemyBullet(cx + 35, cy,
                        Math.cos(angle) * 3, Math.sin(angle) * 3, 'enemy', '#ffaa00');
                }
                break;
            }
            case 1: { // Aimed laser cross
                const angle = angleBetween(cx, cy, px, py);
                for (let i = -1; i <= 1; i++) {
                    this.bullets.fireBeamBullet(cx, cy,
                        Math.cos(angle + i * 0.2) * 4,
                        Math.sin(angle + i * 0.2) * 4,
                        '#ff8800', 30);
                }
                break;
            }
            case 2: { // Drone deployment
                if (enemySystem) {
                    this.summonTimer -= 60;
                    if (this.summonTimer <= 0) {
                        enemySystem.spawnEnemy('small', cx - 40, cy, 'dive');
                        enemySystem.spawnEnemy('small', cx + 40, cy, 'dive');
                        if (this.phase >= 1) {
                            enemySystem.spawnEnemy('small', cx, cy, 'strafe');
                        }
                        this.summonTimer = 130 - this.phase * 25;
                    }
                }
                // Suppression fire
                for (let i = -3; i <= 3; i++) {
                    this.bullets.fireEnemyBullet(cx, cy,
                        i * 0.6, 2.5, 'enemy', '#dddddd');
                }
                break;
            }
            case 3: { // Heavy artillery (split bombs)
                for (let i = -1; i <= 1; i++) {
                    this.bullets.fireSplitBullet(cx + i * 40, cy,
                        i * 0.4, 2, '#ff6600', 5, 35);
                }
                break;
            }
            case 4: { // Flak shield - 360 ring
                for (let i = 0; i < 14; i++) {
                    const a = (i / 14) * Math.PI * 2 + this.timer * 0.02;
                    this.bullets.fireEnemyBullet(cx, cy,
                        Math.cos(a) * 2.2, Math.sin(a) * 2.2, 'enemy', '#cccccc');
                }
                break;
            }
            case 5: { // Missile salvo (Phase 1+)
                if (this.phase >= 1) {
                    for (let i = 0; i < 4; i++) {
                        const a = (i / 4) * Math.PI * 2;
                        this.bullets.fireHomingBullet(
                            cx + Math.cos(a) * 25, cy + Math.sin(a) * 25,
                            2, '#ffaa44', 0.03);
                    }
                }
                break;
            }
            case 6: { // ANNIHILATION (Phase 2)
                if (this.phase >= 2) {
                    // Wave of accel bullets
                    for (let i = 0; i < 20; i++) {
                        const a = (i / 20) * Math.PI * 2;
                        this.bullets.fireAccelBullet(cx, cy,
                            Math.cos(a) * 1.2, Math.sin(a) * 1.2, '#ff4400', 0.05);
                    }
                    // Aimed beam barrage
                    const aimed = angleBetween(cx, cy, px, py);
                    for (let i = -2; i <= 2; i++) {
                        this.bullets.fireBeamBullet(cx, cy,
                            Math.cos(aimed + i * 0.1) * 4.5,
                            Math.sin(aimed + i * 0.1) * 4.5,
                            '#ff8800', 32);
                    }
                    this.shakeAmount = 6;
                }
                break;
            }
        }
    }

    damage(amount) {
        if (!this.active || this.entering || this.defeated) return false;
        this.hp -= amount;
        this.flashTimer = 4;
        this.shakeAmount = Math.max(this.shakeAmount, 2);
        if (this.hp <= 0) {
            this.hp = 0;
            this.defeated = true;
            this.defeatTimer = 0;
            return true;
        }
        return false;
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();

        // Screen shake effect
        if (this.shakeAmount > 0.5) {
            ctx.translate(
                (Math.random() - 0.5) * this.shakeAmount,
                (Math.random() - 0.5) * this.shakeAmount
            );
        }

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Draw dash trail (Boss 2)
        if (this.bossType === 2) {
            for (const trail of this.dashTrail) {
                const alpha = trail.life / 20;
                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = this.color;
                ctx.fillRect(trail.x, trail.y, trail.w, trail.h);
            }
            ctx.globalAlpha = 1;
        }

        // Aura/energy field (behind boss)
        if (!this.defeated && !this.entering) {
            this._drawAura(ctx, cx, cy);
        }

        // Flash on hit
        const baseColor = this.flashTimer > 0 ? '#ffffff' : this.color;

        switch (this.bossType) {
            case 1: this._drawBoss1(ctx, cx, cy, baseColor); break;
            case 2: this._drawBoss2(ctx, cx, cy, baseColor); break;
            case 3: this._drawBoss3(ctx, cx, cy, baseColor); break;
            case 4: this._drawBoss4(ctx, cx, cy, baseColor); break;
            case 5: this._drawBoss5(ctx, cx, cy, baseColor); break;
            case 6: this._drawBoss6(ctx, cx, cy, baseColor); break;
        }

        // Phase glow effect
        if (this.phase > 0 && !this.defeated) {
            this._drawPhaseGlow(ctx, cx, cy);
        }

        // Orbital shields/bits
        if (!this.defeated && !this.entering) {
            this._drawOrbitals(ctx, cx, cy);
        }

        ctx.restore();
    }

    _drawAura(ctx, cx, cy) {
        const auraSize = this.width * 0.7 + Math.sin(this.auraAngle) * 5;
        const auraColors = {
            1: 'rgba(255, 60, 0, 0.15)',
            2: 'rgba(0, 200, 255, 0.12)',
            3: 'rgba(150, 0, 255, 0.18)',
            4: 'rgba(150, 220, 255, 0.18)',
            5: 'rgba(255, 240, 80, 0.18)',
            6: 'rgba(220, 220, 220, 0.15)'
        };

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, auraSize, 0, Math.PI * 2);
        ctx.fillStyle = auraColors[this.bossType];
        ctx.fill();

        // Rotating energy ring
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = 0.3 + this.phase * 0.1;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = this.timer * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, auraSize + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    _drawPhaseGlow(ctx, cx, cy) {
        ctx.save();
        const glowSize = this.width * 0.65 + Math.sin(this.timer * 0.08) * 3;

        if (this.phase >= 2) {
            // Danger glow - pulsing red
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.4 + Math.sin(this.timer * 0.15) * 0.2})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
            ctx.stroke();

            // Warning particles
            ctx.strokeStyle = 'rgba(255, 50, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, glowSize + 8, this.auraAngle, this.auraAngle + Math.PI * 1.2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(255, 150, 0, 0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, glowSize, this.auraAngle, this.auraAngle + Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, glowSize, this.auraAngle + Math.PI, this.auraAngle + Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawOrbitals(ctx, cx, cy) {
        const orbCount = 2 + this.phase;
        const orbRadius = this.width * 0.55;

        ctx.save();
        for (let i = 0; i < orbCount; i++) {
            const a = this.orbitalAngle + (i / orbCount) * Math.PI * 2;
            const ox = cx + Math.cos(a) * orbRadius;
            const oy = cy + Math.sin(a) * orbRadius * 0.6;

            ctx.fillStyle = this.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(ox, oy, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(ox, oy, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    _drawBoss1(ctx, cx, cy, color) {
        // INFERNO GUARDIAN - armored fire demon
        ctx.save();

        // Engine exhaust flames
        const flameHeight = 10 + this.enginePulse * 8;
        ctx.fillStyle = '#ff6600';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff4400';
        ctx.beginPath();
        ctx.moveTo(cx - 15, this.y + this.height);
        ctx.lineTo(cx - 20, this.y + this.height + flameHeight);
        ctx.lineTo(cx - 10, this.y + this.height + flameHeight * 0.7);
        ctx.lineTo(cx, this.y + this.height + flameHeight * 1.2);
        ctx.lineTo(cx + 10, this.y + this.height + flameHeight * 0.7);
        ctx.lineTo(cx + 20, this.y + this.height + flameHeight);
        ctx.lineTo(cx + 15, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Main body - angular armor
        ctx.fillStyle = color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(cx, this.y - 10);
        ctx.lineTo(this.x - 10, this.y + this.height * 0.4);
        ctx.lineTo(this.x - 5, this.y + this.height);
        ctx.lineTo(cx - 20, this.y + this.height + 5);
        ctx.lineTo(cx + 20, this.y + this.height + 5);
        ctx.lineTo(this.x + this.width + 5, this.y + this.height);
        ctx.lineTo(this.x + this.width + 10, this.y + this.height * 0.4);
        ctx.closePath();
        ctx.fill();

        // Wing cannons
        const wingFlap = Math.sin(this.wingAngle) * 3;
        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#aa1100';
        ctx.beginPath();
        ctx.moveTo(this.x - 5, cy);
        ctx.lineTo(this.x - 30, this.y + this.height + 5 + wingFlap);
        ctx.lineTo(this.x - 25, cy - 5 + wingFlap);
        ctx.lineTo(this.x - 10, this.y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x + this.width + 5, cy);
        ctx.lineTo(this.x + this.width + 30, this.y + this.height + 5 - wingFlap);
        ctx.lineTo(this.x + this.width + 25, cy - 5 - wingFlap);
        ctx.lineTo(this.x + this.width + 10, this.y + 5);
        ctx.closePath();
        ctx.fill();

        // Armor details
        ctx.fillStyle = '#661100';
        ctx.fillRect(this.x + 15, this.y + 10, this.width - 30, 8);
        ctx.fillRect(this.x + 20, this.y + 25, this.width - 40, 6);

        // Central core - pulsing flame
        const corePulse = 8 + Math.sin(this.timer * 0.15) * 3;
        ctx.fillStyle = '#ff4400';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff4400';
        ctx.beginPath();
        ctx.arc(cx, cy, corePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffcc00';
        ctx.beginPath();
        ctx.arc(cx, cy, corePulse * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        // Cannon tips glow
        ctx.fillStyle = '#ff8800';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ff8800';
        ctx.beginPath();
        ctx.arc(this.x - 27, this.y + this.height + wingFlap, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width + 27, this.y + this.height - wingFlap, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _drawBoss2(ctx, cx, cy, color) {
        // PHANTOM STRIKER - sleek tech fighter
        ctx.save();

        // Afterburner glow
        const burnLength = 15 + this.enginePulse * 12;
        ctx.fillStyle = '#00aaff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00ccff';
        ctx.beginPath();
        ctx.moveTo(cx - 10, this.y + this.height);
        ctx.lineTo(cx - 5, this.y + this.height + burnLength * 0.8);
        ctx.lineTo(cx, this.y + this.height + burnLength);
        ctx.lineTo(cx + 5, this.y + this.height + burnLength * 0.8);
        ctx.lineTo(cx + 10, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Stealth body
        ctx.fillStyle = color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(cx, this.y - 8);
        ctx.lineTo(this.x - 5, cy + 5);
        ctx.lineTo(this.x + 5, this.y + this.height + 3);
        ctx.lineTo(this.x + this.width - 5, this.y + this.height + 3);
        ctx.lineTo(this.x + this.width + 5, cy + 5);
        ctx.closePath();
        ctx.fill();

        // Forward swept wings
        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#006688';
        ctx.beginPath();
        ctx.moveTo(this.x + 10, cy - 5);
        ctx.lineTo(this.x - 25, this.y + 10);
        ctx.lineTo(this.x - 15, cy + 10);
        ctx.lineTo(this.x + 5, cy + 5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x + this.width - 10, cy - 5);
        ctx.lineTo(this.x + this.width + 25, this.y + 10);
        ctx.lineTo(this.x + this.width + 15, cy + 10);
        ctx.lineTo(this.x + this.width - 5, cy + 5);
        ctx.closePath();
        ctx.fill();

        // Tech lines
        ctx.strokeStyle = '#00ffff';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, this.y);
        ctx.lineTo(cx, this.y + this.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.x + 15, cy);
        ctx.lineTo(this.x + this.width - 15, cy);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Side pods
        ctx.fillStyle = '#004455';
        ctx.fillRect(this.x - 15, cy - 8, 12, 16);
        ctx.fillRect(this.x + this.width + 3, cy - 8, 12, 16);

        // Pod glow
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(this.x - 9, cy + 10, 3 + this.enginePulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width + 9, cy + 10, 3 + this.enginePulse * 2, 0, Math.PI * 2);
        ctx.fill();

        // Central eye/core
        const eyePulse = 6 + Math.sin(this.timer * 0.12) * 2;
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(cx, cy - 5, eyePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy - 5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Speed lines when moving fast
        if (this.moveTimer < 10) {
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const ly = this.y + randRange(0, this.height);
                ctx.beginPath();
                ctx.moveTo(this.x - 20, ly);
                ctx.lineTo(this.x - 35 - Math.random() * 10, ly);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x + this.width + 20, ly);
                ctx.lineTo(this.x + this.width + 35 + Math.random() * 10, ly);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    _drawBoss3(ctx, cx, cy, color) {
        // VOID OVERLORD - massive dark entity
        ctx.save();

        // Dark energy tendrils
        ctx.strokeStyle = '#9900ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#9900ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 6; i++) {
            const ta = this.auraAngle * 0.5 + (i / 6) * Math.PI * 2;
            const startX = cx + Math.cos(ta) * 20;
            const startY = cy + Math.sin(ta) * 15;
            const endX = cx + Math.cos(ta) * (45 + Math.sin(this.timer * 0.05 + i) * 10);
            const endY = cy + Math.sin(ta) * (35 + Math.sin(this.timer * 0.07 + i) * 8);
            const cpX = (startX + endX) / 2 + Math.sin(this.timer * 0.1 + i) * 15;
            const cpY = (startY + endY) / 2 + Math.cos(this.timer * 0.1 + i) * 10;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Main body - dark angular fortress
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(cx, this.y - 15);
        ctx.lineTo(this.x - 20, this.y + this.height * 0.3);
        ctx.lineTo(this.x - 15, this.y + this.height * 0.7);
        ctx.lineTo(this.x, this.y + this.height + 10);
        ctx.lineTo(cx - 20, this.y + this.height + 15);
        ctx.lineTo(cx + 20, this.y + this.height + 15);
        ctx.lineTo(this.x + this.width, this.y + this.height + 10);
        ctx.lineTo(this.x + this.width + 15, this.y + this.height * 0.7);
        ctx.lineTo(this.x + this.width + 20, this.y + this.height * 0.3);
        ctx.closePath();
        ctx.fill();

        // Armor segments
        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#440088';
        ctx.beginPath();
        ctx.moveTo(cx, this.y + 5);
        ctx.lineTo(this.x + 15, cy);
        ctx.lineTo(cx, this.y + this.height - 5);
        ctx.lineTo(this.x + this.width - 15, cy);
        ctx.closePath();
        ctx.fill();

        // Shoulder cannons
        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#660099';
        ctx.fillRect(this.x - 25, this.y + 10, 25, 18);
        ctx.fillRect(this.x + this.width, this.y + 10, 25, 18);

        // Cannon barrels
        ctx.fillStyle = '#330066';
        ctx.fillRect(this.x - 28, this.y + 13, 5, 12);
        ctx.fillRect(this.x + this.width + 23, this.y + 13, 5, 12);

        // Cannon glow
        ctx.fillStyle = '#ff44ff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff44ff';
        ctx.beginPath();
        ctx.arc(this.x - 25, this.y + 19, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width + 25, this.y + 19, 4, 0, Math.PI * 2);
        ctx.fill();

        // Central void orb - multi-layered pulsing
        const orbPulse1 = 14 + Math.sin(this.timer * 0.1) * 3;
        const orbPulse2 = 10 + Math.sin(this.timer * 0.15 + 1) * 2;

        // Outer ring
        ctx.strokeStyle = '#ff00ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, orbPulse1 + 4, this.shieldAngle, this.shieldAngle + Math.PI * 1.5);
        ctx.stroke();

        // Main orb
        ctx.fillStyle = '#9900ff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#9900ff';
        ctx.beginPath();
        ctx.arc(cx, cy, orbPulse1, 0, Math.PI * 2);
        ctx.fill();

        // Inner orb
        ctx.fillStyle = '#cc44ff';
        ctx.beginPath();
        ctx.arc(cx, cy, orbPulse2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 5 + Math.sin(this.timer * 0.2) * 1, 0, Math.PI * 2);
        ctx.fill();

        // Phase indicators - eye-like decorations
        if (this.phase >= 1) {
            const eyeGlow = Math.sin(this.timer * 0.12) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ff0000';
            ctx.beginPath();
            ctx.arc(this.x + 25, this.y + 15, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + this.width - 25, this.y + 15, 5, 0, Math.PI * 2);
            ctx.fill();

            // Cracks/energy lines when enraged
            if (this.phase >= 2) {
                ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 4; i++) {
                    const sx = cx + randRange(-20, 20);
                    const sy = cy + randRange(-15, 15);
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(sx + randRange(-10, 10), sy + randRange(-10, 10));
                    ctx.lineTo(sx + randRange(-15, 15), sy + randRange(-15, 15));
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    }

    _drawBoss4(ctx, cx, cy, color) {
        // FROST TYRANT - crystalline ice fortress
        ctx.save();

        // Frost mist beneath
        ctx.fillStyle = 'rgba(180, 230, 255, 0.25)';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#88ddff';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height + 10, this.width * 0.6,
            8 + this.enginePulse * 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hexagonal main body (ice crystal shape)
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#aaeeff';
        ctx.beginPath();
        ctx.moveTo(cx, this.y - 8);
        ctx.lineTo(this.x + this.width, this.y + this.height * 0.3);
        ctx.lineTo(this.x + this.width, this.y + this.height * 0.7);
        ctx.lineTo(cx, this.y + this.height + 8);
        ctx.lineTo(this.x, this.y + this.height * 0.7);
        ctx.lineTo(this.x, this.y + this.height * 0.3);
        ctx.closePath();
        ctx.fill();

        // Inner crystal facets (lighter shade)
        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#ddf2ff';
        ctx.beginPath();
        ctx.moveTo(cx, this.y + 5);
        ctx.lineTo(this.x + this.width - 12, this.y + this.height * 0.5);
        ctx.lineTo(cx, this.y + this.height - 5);
        ctx.lineTo(this.x + 12, this.y + this.height * 0.5);
        ctx.closePath();
        ctx.fill();

        // Side ice spikes
        ctx.fillStyle = '#bbe5ff';
        ctx.beginPath();
        ctx.moveTo(this.x - 8, cy);
        ctx.lineTo(this.x - 22, cy - 6);
        ctx.lineTo(this.x - 22, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x + this.width + 8, cy);
        ctx.lineTo(this.x + this.width + 22, cy - 6);
        ctx.lineTo(this.x + this.width + 22, cy + 6);
        ctx.closePath();
        ctx.fill();

        // Frost cracks/details
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * Math.PI * 2 + this.timer * 0.01;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(ang) * 18, cy + Math.sin(ang) * 14);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Central frozen core
        const corePulse = 7 + Math.sin(this.timer * 0.1) * 2;
        ctx.fillStyle = '#88ddff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#aaffff';
        ctx.beginPath();
        ctx.arc(cx, cy, corePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, corePulse * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _drawBoss5(ctx, cx, cy, color) {
        // LIGHTNING SOVEREIGN - electric energy entity
        ctx.save();

        // Teleport flash effect
        if (this.teleportFlash > 0) {
            const flashAlpha = this.teleportFlash / 12;
            ctx.fillStyle = `rgba(255, 255, 200, ${flashAlpha * 0.6})`;
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ffffaa';
            ctx.beginPath();
            ctx.arc(cx, cy, this.width * (1 - flashAlpha) + 20, 0, Math.PI * 2);
            ctx.fill();
        }

        // Electric arcs around boss
        ctx.strokeStyle = '#ffff66';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffff99';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < 5; i++) {
            const a = this.auraAngle + (i / 5) * Math.PI * 2;
            const r1 = this.width * 0.45;
            const r2 = this.width * 0.65 + Math.sin(this.timer * 0.2 + i) * 5;
            const x1 = cx + Math.cos(a) * r1;
            const y1 = cy + Math.sin(a) * r1;
            const x2 = cx + Math.cos(a) * r2;
            const y2 = cy + Math.sin(a) * r2;
            const midX = (x1 + x2) / 2 + randRange(-6, 6);
            const midY = (y1 + y2) / 2 + randRange(-6, 6);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(midX, midY);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Diamond-shaped body
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff66';
        ctx.beginPath();
        ctx.moveTo(cx, this.y - 5);
        ctx.lineTo(this.x + this.width + 5, cy);
        ctx.lineTo(cx, this.y + this.height + 5);
        ctx.lineTo(this.x - 5, cy);
        ctx.closePath();
        ctx.fill();

        // Inner diamond
        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#ffffaa';
        ctx.beginPath();
        ctx.moveTo(cx, this.y + 8);
        ctx.lineTo(this.x + this.width - 8, cy);
        ctx.lineTo(cx, this.y + this.height - 8);
        ctx.lineTo(this.x + 8, cy);
        ctx.closePath();
        ctx.fill();

        // Wing prongs
        ctx.strokeStyle = '#ffee44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + 5, cy - 8);
        ctx.lineTo(this.x - 12, cy - 14);
        ctx.moveTo(this.x + 5, cy + 8);
        ctx.lineTo(this.x - 12, cy + 14);
        ctx.moveTo(this.x + this.width - 5, cy - 8);
        ctx.lineTo(this.x + this.width + 12, cy - 14);
        ctx.moveTo(this.x + this.width - 5, cy + 8);
        ctx.lineTo(this.x + this.width + 12, cy + 14);
        ctx.stroke();

        // Central plasma core
        const corePulse = 8 + Math.sin(this.timer * 0.18) * 3;
        ctx.fillStyle = '#ffff44';
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, corePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, corePulse * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _drawBoss6(ctx, cx, cy, color) {
        // NEXUS COLOSSUS - massive mecha titan
        ctx.save();

        // Heavy thrusters
        const thrustSize = 12 + this.enginePulse * 6;
        ctx.fillStyle = '#ff6622';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff8844';
        ctx.beginPath();
        ctx.arc(cx - 30, this.y + this.height + 5, thrustSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 30, this.y + this.height + 5, thrustSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffaa44';
        ctx.beginPath();
        ctx.arc(cx - 30, this.y + this.height + 5, thrustSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 30, this.y + this.height + 5, thrustSize * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Massive armored hull (wider rectangle with chamfered edges)
        ctx.fillStyle = color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#888888';
        ctx.beginPath();
        ctx.moveTo(this.x + 15, this.y);
        ctx.lineTo(this.x + this.width - 15, this.y);
        ctx.lineTo(this.x + this.width, this.y + 15);
        ctx.lineTo(this.x + this.width, this.y + this.height - 15);
        ctx.lineTo(this.x + this.width - 15, this.y + this.height);
        ctx.lineTo(this.x + 15, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height - 15);
        ctx.lineTo(this.x, this.y + 15);
        ctx.closePath();
        ctx.fill();

        // Heavy armor plating (darker layer)
        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#666666';
        ctx.fillRect(this.x + 12, this.y + 10, this.width - 24, 14);
        ctx.fillRect(this.x + 12, this.y + this.height - 24, this.width - 24, 14);
        ctx.fillRect(this.x + 18, this.y + 30, this.width - 36, 10);

        // Twin shoulder cannons (huge!)
        ctx.fillStyle = '#444444';
        ctx.fillRect(this.x - 20, this.y + 18, 22, 26);
        ctx.fillRect(this.x + this.width - 2, this.y + 18, 22, 26);

        // Cannon barrels
        ctx.fillStyle = '#222222';
        ctx.fillRect(this.x - 25, this.y + 24, 8, 14);
        ctx.fillRect(this.x + this.width + 17, this.y + 24, 8, 14);

        // Cannon glow
        ctx.fillStyle = '#ff8800';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff8800';
        ctx.beginPath();
        ctx.arc(this.x - 21, this.y + 31, 4 + this.enginePulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width + 21, this.y + 31, 4 + this.enginePulse * 2, 0, Math.PI * 2);
        ctx.fill();

        // Top antenna/sensor array
        ctx.fillStyle = '#aaaaaa';
        ctx.fillRect(cx - 3, this.y - 12, 6, 12);
        ctx.fillStyle = '#ff4444';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff4444';
        ctx.beginPath();
        ctx.arc(cx, this.y - 13, 3 + Math.sin(this.timer * 0.2) * 1, 0, Math.PI * 2);
        ctx.fill();

        // Central energy core (large hexagon)
        const corePulse = 10 + Math.sin(this.timer * 0.1) * 3;
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const px = cx + Math.cos(a) * corePulse;
            const py = cy + Math.sin(a) * corePulse;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, corePulse * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Phase indicators - red lights when enraged
        if (this.phase >= 1) {
            ctx.fillStyle = '#ff2222';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ff2222';
            for (let i = -1; i <= 1; i += 2) {
                ctx.beginPath();
                ctx.arc(cx + i * 18, this.y + 15, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    drawHPBar(ctx) {
        if (!this.active || this.entering) return;

        const barWidth = 220;
        const barHeight = 12;
        const x = GAME_WIDTH / 2 - barWidth / 2;
        const y = 15;
        const hpRatio = this.hp / this.maxHp;

        // Background with frame
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x - 3, y - 3, barWidth + 6, barHeight + 6);

        // HP bar with gradient based on boss type
        const gradient = ctx.createLinearGradient(x, y, x + barWidth * hpRatio, y);
        switch (this.bossType) {
            case 1:
                gradient.addColorStop(0, '#ff2200');
                gradient.addColorStop(0.5, '#ff6600');
                gradient.addColorStop(1, '#ffaa00');
                break;
            case 2:
                gradient.addColorStop(0, '#0066ff');
                gradient.addColorStop(0.5, '#00ccff');
                gradient.addColorStop(1, '#00ffcc');
                break;
            case 3:
                gradient.addColorStop(0, '#6600cc');
                gradient.addColorStop(0.5, '#9900ff');
                gradient.addColorStop(1, '#ff44ff');
                break;
            case 4:
                gradient.addColorStop(0, '#3388cc');
                gradient.addColorStop(0.5, '#88ddff');
                gradient.addColorStop(1, '#ddffff');
                break;
            case 5:
                gradient.addColorStop(0, '#cc8800');
                gradient.addColorStop(0.5, '#ffee44');
                gradient.addColorStop(1, '#ffffaa');
                break;
            case 6:
                gradient.addColorStop(0, '#666666');
                gradient.addColorStop(0.5, '#aaaaaa');
                gradient.addColorStop(1, '#ffaa44');
                break;
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth * hpRatio, barHeight);

        // Damage flash
        if (this.flashTimer > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(x, y, barWidth * hpRatio, barHeight);
        }

        // Border
        ctx.strokeStyle = this.phase >= 2 ? '#ff4444' : '#ffffff';
        ctx.lineWidth = this.phase >= 2 ? 2 : 1;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // Phase markers
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + barWidth * 0.6, y, 1, barHeight);
        ctx.fillRect(x + barWidth * 0.3, y, 1, barHeight);

        // Boss name and title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        // Use plain ASCII markers instead of emojis to avoid color-emoji rendering artifacts on canvas
        const names = ['',
            '[!] INFERNO GUARDIAN',
            '[~] PHANTOM STRIKER',
            '[X] VOID OVERLORD',
            '[*] FROST TYRANT',
            '[#] LIGHTNING SOVEREIGN',
            '[=] NEXUS COLOSSUS'
        ];
        ctx.fillText(names[this.bossType], GAME_WIDTH / 2, y - 4);
        ctx.textAlign = 'left';

        // HP percentage
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.ceil(hpRatio * 100)}%`, x + barWidth - 2, y + barHeight - 2);
        ctx.textAlign = 'left';
    }
}
