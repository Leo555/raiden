// levels.js - Level configuration and wave spawning

import { GAME_WIDTH, GAME_HEIGHT, randRange, randInt } from './utils.js';
import { ENEMY_TYPES } from './enemies.js';

const LEVEL_CONFIGS = [
    // Level 1: Introduction
    {
        name: 'SECTOR 1',
        subtitle: 'OUTER PERIMETER',
        waves: [
            { time: 30, enemies: [{ type: ENEMY_TYPES.SMALL, count: 5, pattern: 'straight', spacing: 30, startX: 100 }] },
            { time: 120, enemies: [{ type: ENEMY_TYPES.SMALL, count: 5, pattern: 'straight', spacing: 30, startX: 300 }] },
            { time: 220, enemies: [{ type: ENEMY_TYPES.SMALL, count: 3, pattern: 'zigzag', spacing: 40, startX: 150 }] },
            { time: 320, enemies: [
                { type: ENEMY_TYPES.SMALL, count: 4, pattern: 'straight', spacing: 25, startX: 80 },
                { type: ENEMY_TYPES.SMALL, count: 4, pattern: 'straight', spacing: 25, startX: 320 }
            ]},
            { time: 440, enemies: [{ type: ENEMY_TYPES.MEDIUM, count: 2, pattern: 'hover', spacing: 60, startX: 150 }] },
            { time: 560, enemies: [
                { type: ENEMY_TYPES.SMALL, count: 6, pattern: 'zigzag', spacing: 20, startX: 200 },
                { type: ENEMY_TYPES.MEDIUM, count: 1, pattern: 'hover', spacing: 0, startX: 220 }
            ]},
            { time: 700, enemies: [{ type: ENEMY_TYPES.ELITE, count: 1, pattern: 'sine', spacing: 0, startX: 230 }] },
        ],
        bossType: 1,
        bossTime: 900
    },
    // Level 2: Ramping up
    {
        name: 'SECTOR 2',
        subtitle: 'ASTEROID BELT',
        waves: [
            { time: 60, enemies: [{ type: ENEMY_TYPES.SMALL, count: 8, pattern: 'straight', spacing: 20, startX: 60 }] },
            { time: 180, enemies: [{ type: ENEMY_TYPES.MEDIUM, count: 3, pattern: 'zigzag', spacing: 50, startX: 100 }] },
            { time: 320, enemies: [
                { type: ENEMY_TYPES.SMALL, count: 5, pattern: 'dive', spacing: 15, startX: 50 },
                { type: ENEMY_TYPES.SMALL, count: 5, pattern: 'dive', spacing: 15, startX: 350 }
            ]},
            { time: 460, enemies: [{ type: ENEMY_TYPES.LARGE, count: 1, pattern: 'hover', spacing: 0, startX: 200 }] },
            { time: 580, enemies: [
                { type: ENEMY_TYPES.MEDIUM, count: 4, pattern: 'sine', spacing: 40, startX: 120 },
                { type: ENEMY_TYPES.SMALL, count: 6, pattern: 'straight', spacing: 25, startX: 200 }
            ]},
            { time: 740, enemies: [
                { type: ENEMY_TYPES.ELITE, count: 2, pattern: 'swoop', spacing: 60, startX: 150 },
                { type: ENEMY_TYPES.MEDIUM, count: 2, pattern: 'hover', spacing: 80, startX: 180 }
            ]},
            { time: 900, enemies: [{ type: ENEMY_TYPES.LARGE, count: 2, pattern: 'hover', spacing: 100, startX: 120 }] },
        ],
        bossType: 1,
        bossTime: 1150
    },
    // Level 3: Mid difficulty
    {
        name: 'SECTOR 3',
        subtitle: 'ENEMY TERRITORY',
        waves: [
            { time: 60, enemies: [
                { type: ENEMY_TYPES.MEDIUM, count: 4, pattern: 'zigzag', spacing: 30, startX: 80 },
                { type: ENEMY_TYPES.SMALL, count: 8, pattern: 'straight', spacing: 15, startX: 200 }
            ]},
            { time: 200, enemies: [{ type: ENEMY_TYPES.LARGE, count: 2, pattern: 'hover', spacing: 120, startX: 100 }] },
            { time: 350, enemies: [
                { type: ENEMY_TYPES.SMALL, count: 10, pattern: 'dive', spacing: 12, startX: 100 },
                { type: ENEMY_TYPES.ELITE, count: 1, pattern: 'sine', spacing: 0, startX: 240 }
            ]},
            { time: 500, enemies: [{ type: ENEMY_TYPES.MEDIUM, count: 5, pattern: 'swoop', spacing: 40, startX: 80 }] },
            { time: 650, enemies: [
                { type: ENEMY_TYPES.LARGE, count: 1, pattern: 'hover', spacing: 0, startX: 120 },
                { type: ENEMY_TYPES.LARGE, count: 1, pattern: 'hover', spacing: 0, startX: 280 },
                { type: ENEMY_TYPES.ELITE, count: 2, pattern: 'zigzag', spacing: 60, startX: 180 }
            ]},
            { time: 840, enemies: [
                { type: ENEMY_TYPES.MEDIUM, count: 6, pattern: 'sine', spacing: 25, startX: 80 },
                { type: ENEMY_TYPES.SMALL, count: 10, pattern: 'straight', spacing: 10, startX: 250 }
            ]},
        ],
        bossType: 2,
        bossTime: 1100
    },
    // Level 4: Hard
    {
        name: 'SECTOR 4',
        subtitle: 'CORE DEFENSES',
        waves: [
            { time: 60, enemies: [
                { type: ENEMY_TYPES.MEDIUM, count: 6, pattern: 'zigzag', spacing: 25, startX: 60 },
                { type: ENEMY_TYPES.LARGE, count: 1, pattern: 'hover', spacing: 0, startX: 200 }
            ]},
            { time: 220, enemies: [
                { type: ENEMY_TYPES.ELITE, count: 3, pattern: 'swoop', spacing: 50, startX: 120 },
                { type: ENEMY_TYPES.SMALL, count: 12, pattern: 'dive', spacing: 10, startX: 60 }
            ]},
            { time: 400, enemies: [{ type: ENEMY_TYPES.LARGE, count: 3, pattern: 'hover', spacing: 80, startX: 80 }] },
            { time: 560, enemies: [
                { type: ENEMY_TYPES.MEDIUM, count: 8, pattern: 'sine', spacing: 20, startX: 60 },
                { type: ENEMY_TYPES.ELITE, count: 2, pattern: 'hover', spacing: 80, startX: 150 }
            ]},
            { time: 740, enemies: [
                { type: ENEMY_TYPES.LARGE, count: 2, pattern: 'hover', spacing: 100, startX: 100 },
                { type: ENEMY_TYPES.MEDIUM, count: 5, pattern: 'zigzag', spacing: 30, startX: 150 },
                { type: ENEMY_TYPES.ELITE, count: 1, pattern: 'sine', spacing: 0, startX: 240 }
            ]},
        ],
        bossType: 2,
        bossTime: 1000
    },
    // Level 5: Final
    {
        name: 'SECTOR 5',
        subtitle: 'FINAL ASSAULT',
        waves: [
            { time: 60, enemies: [
                { type: ENEMY_TYPES.LARGE, count: 2, pattern: 'hover', spacing: 100, startX: 80 },
                { type: ENEMY_TYPES.MEDIUM, count: 6, pattern: 'zigzag', spacing: 25, startX: 100 },
                { type: ENEMY_TYPES.SMALL, count: 10, pattern: 'dive', spacing: 12, startX: 200 }
            ]},
            { time: 250, enemies: [
                { type: ENEMY_TYPES.ELITE, count: 3, pattern: 'swoop', spacing: 40, startX: 100 },
                { type: ENEMY_TYPES.LARGE, count: 2, pattern: 'sine', spacing: 80, startX: 150 }
            ]},
            { time: 450, enemies: [
                { type: ENEMY_TYPES.MEDIUM, count: 10, pattern: 'straight', spacing: 15, startX: 50 },
                { type: ENEMY_TYPES.MEDIUM, count: 10, pattern: 'straight', spacing: 15, startX: 300 }
            ]},
            { time: 650, enemies: [
                { type: ENEMY_TYPES.LARGE, count: 3, pattern: 'hover', spacing: 70, startX: 80 },
                { type: ENEMY_TYPES.ELITE, count: 3, pattern: 'sine', spacing: 50, startX: 130 }
            ]},
            { time: 850, enemies: [
                { type: ENEMY_TYPES.LARGE, count: 4, pattern: 'hover', spacing: 60, startX: 60 },
                { type: ENEMY_TYPES.ELITE, count: 2, pattern: 'swoop', spacing: 80, startX: 150 },
                { type: ENEMY_TYPES.MEDIUM, count: 8, pattern: 'dive', spacing: 15, startX: 150 }
            ]},
        ],
        bossType: 3,
        bossTime: 1100
    }
];

export class LevelManager {
    constructor(enemySystem, boss, audio) {
        this.enemySystem = enemySystem;
        this.boss = boss;
        this.audio = audio;

        this.currentLevel = 0;
        this.levelTimer = 0;
        this.waveIndex = 0;
        this.levelConfig = null;
        this.state = 'playing'; // playing, boss, transition, complete
        this.transitionTimer = 0;
        this.bossSpawned = false;
        this.endlessMode = false;
        this.endlessDifficulty = 1;
        this.endlessSpawnTimer = 0;
    }

    startLevel(level) {
        this.currentLevel = level;
        this.levelTimer = 0;
        this.waveIndex = 0;
        this.state = 'transition';
        this.transitionTimer = 90;
        this.bossSpawned = false;

        if (level < LEVEL_CONFIGS.length) {
            this.levelConfig = LEVEL_CONFIGS[level];
            this.enemySystem.difficulty = level + 1;
        } else {
            this.endlessMode = true;
            this.endlessDifficulty = level - LEVEL_CONFIGS.length + 5;
            this.enemySystem.difficulty = this.endlessDifficulty;
        }
    }

    update(dt) {
        if (this.state === 'transition') {
            this.transitionTimer -= dt * 60;
            if (this.transitionTimer <= 0) {
                this.state = 'playing';
            }
            return;
        }

        if (this.state === 'complete') return;

        this.levelTimer += dt * 60;

        if (this.endlessMode) {
            this._updateEndless(dt);
            return;
        }

        if (!this.levelConfig) return;

        // Spawn waves
        while (this.waveIndex < this.levelConfig.waves.length) {
            const wave = this.levelConfig.waves[this.waveIndex];
            if (this.levelTimer >= wave.time) {
                this._spawnWave(wave);
                this.waveIndex++;
            } else {
                break;
            }
        }

        // Boss spawn
        if (!this.bossSpawned && this.levelTimer >= this.levelConfig.bossTime) {
            if (this.enemySystem.enemies.length === 0) {
                this.boss.spawn(this.levelConfig.bossType, this.currentLevel);
                this.bossSpawned = true;
                this.state = 'boss';
            }
        }

        // Check boss defeated
        if (this.state === 'boss' && !this.boss.active && this.bossSpawned) {
            this.state = 'complete';
        }
    }

    _spawnWave(wave) {
        for (const group of wave.enemies) {
            for (let i = 0; i < group.count; i++) {
                const x = group.startX + i * (group.spacing || 40);
                const delay = i * 10;
                setTimeout(() => {
                    if (this.state !== 'complete') {
                        this.enemySystem.spawnEnemy(group.type, x, -30 - i * 20, group.pattern);
                    }
                }, delay * 16);
            }
        }
    }

    _updateEndless(dt) {
        this.endlessSpawnTimer -= dt * 60;
        if (this.endlessSpawnTimer <= 0) {
            const spawnInterval = Math.max(20, 80 - this.endlessDifficulty * 5);
            this.endlessSpawnTimer = spawnInterval;

            const rand = Math.random();
            let type;
            if (rand < 0.4) type = ENEMY_TYPES.SMALL;
            else if (rand < 0.65) type = ENEMY_TYPES.MEDIUM;
            else if (rand < 0.8) type = ENEMY_TYPES.LARGE;
            else type = ENEMY_TYPES.ELITE;

            const patterns = ['straight', 'zigzag', 'sine', 'swoop', 'dive'];
            const pattern = patterns[randInt(0, patterns.length - 1)];
            const x = randRange(30, GAME_WIDTH - 60);
            this.enemySystem.spawnEnemy(type, x, -30, pattern);
        }

        // Spawn boss periodically in endless
        if (this.levelTimer > 1500 && !this.boss.active && Math.random() < 0.001) {
            const bossType = randInt(1, 3);
            this.boss.spawn(bossType, this.endlessDifficulty);
            this.state = 'boss';
        }

        // Increase difficulty over time
        if (this.levelTimer % 600 < 1) {
            this.endlessDifficulty += 0.5;
            this.enemySystem.difficulty = this.endlessDifficulty;
        }
    }

    getLevelName() {
        if (this.endlessMode) return 'ENDLESS MODE';
        if (this.levelConfig) return this.levelConfig.name;
        return '';
    }

    getLevelSubtitle() {
        if (this.endlessMode) return 'SURVIVE AS LONG AS YOU CAN';
        if (this.levelConfig) return this.levelConfig.subtitle;
        return '';
    }

    isTransitioning() {
        return this.state === 'transition';
    }

    isComplete() {
        return this.state === 'complete';
    }

    getTotalLevels() {
        return LEVEL_CONFIGS.length;
    }

    drawTransition(ctx) {
        if (this.state !== 'transition') return;

        const alpha = Math.min(1, this.transitionTimer / 50);
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.getLevelName(), GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

        ctx.font = '14px monospace';
        ctx.fillStyle = `rgba(180,180,255,${alpha})`;
        ctx.fillText(this.getLevelSubtitle(), GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15);

        ctx.textAlign = 'left';
    }

    reset() {
        this.currentLevel = 0;
        this.levelTimer = 0;
        this.waveIndex = 0;
        this.state = 'playing';
        this.bossSpawned = false;
        this.endlessMode = false;
        this.endlessDifficulty = 1;
    }
}
