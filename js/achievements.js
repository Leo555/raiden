// js/achievements.js - Achievement System (T05 Complete)

import { GAME_WIDTH, GAME_HEIGHT } from './utils.js';

/**
 * Achievement definitions (T05: 8 achievements)
 */
const ACHIEVEMENT_DEFS = {
    FIRST_BLOOD: {
        id: 'FIRST_BLOOD',
        title: '初次见血',
        description: '击破第一架敌机',
        icon: '🎯',
        category: 'kill',
        condition: { type: 'total_kills', value: 1 },
        reward: { type: 'score', value: 100 },
        hidden: false
    },
    BOSS_HUNTER: {
        id: 'BOSS_HUNTER',
        title: 'Boss 猎人',
        description: '击破 3 个 Boss',
        icon: '👹',
        category: 'kill',
        condition: { type: 'total_boss_kills', value: 3 },
        reward: { type: 'life', value: 1 },
        hidden: false
    },
    COMBO_20: {
        id: 'COMBO_20',
        title: '连击大师',
        description: '达成 20 连击',
        icon: '⚡',
        category: 'combo',
        condition: { type: 'max_combo', value: 20 },
        reward: { type: 'score', value: 500 },
        hidden: false
    },
    SURVIVOR: {
        id: 'SURVIVOR',
        title: '生存专家',
        description: '单次游戏生存 5 分钟',
        icon: '🏱️',
        category: 'survival',
        condition: { type: 'survival_time', value: 300 },
        reward: { type: 'shield', value: 1 },
        hidden: false
    },
    SHARPSHOOTER: {
        id: 'SHARPSHOOTER',
        title: '神射手',
        description: '命中率达到 80%（至少 100 发）',
        icon: '🎯',
        category: 'accuracy',
        condition: { type: 'accuracy', value: 80 },
        reward: { type: 'weapon_upgrade', value: 1 },
        hidden: false
    },
    COLLECTOR: {
        id: 'COLLECTOR',
        title: '收集达人',
        description: '收集 20 个道具',
        icon: '🎁',
        category: 'collection',
        condition: { type: 'powerups_collected', value: 20 },
        reward: { type: 'bomb', value: 1 },
        hidden: false
    },
    WAR_MACHINE: {
        id: 'WAR_MACHINE',
        title: '战争机器',
        description: '使用每种武器击杀至少 10 个敌人',
        icon: '🔫',
        category: 'versatility',
        condition: { type: 'weapon_kills', value: 10 },
        reward: { type: 'score', value: 2000 },
        hidden: false
    },
    LEGENDARY: {
        id: 'LEGENDARY',
        title: '传奇飞行员',
        description: '单局得分超过 50,000',
        icon: '👑',
        category: 'score',
        condition: { type: 'single_game_score', value: 50000 },
        reward: { type: 'life', value: 1 },
        hidden: false
    }
};

/**
 * Achievement status class
 */
export class AchievementStatus {
    constructor(id, def) {
        this.id = id;
        this.def = def;
        this.unlocked = false;
        this.unlockTime = 0;
        this.progress = 0;
        this.progressMax = def.condition.value || 0;
        this.notified = false;
    }

    updateProgress(value) {
        if (this.unlocked) return false;
        this.progress = Math.max(this.progress, value);
        return this.checkComplete();
    }

    checkComplete() {
        if (this.unlocked) return false;
        const completed = this.progress >= this.progressMax;
        if (completed) {
            this.unlocked = true;
            this.unlockTime = Date.now();
        }
        return completed;
    }

    getProgressRatio() {
        if (this.progressMax === 0) return 1;
        return Math.min(1, this.progress / this.progressMax);
    }

    toJSON() {
        return {
            id: this.id,
            unlocked: this.unlocked,
            unlockTime: this.unlockTime,
            progress: this.progress
        };
    }

    fromJSON(data) {
        this.unlocked = data.unlocked || false;
        this.unlockTime = data.unlockTime || 0;
        this.progress = data.progress || 0;
    }
}

/**
 * Player statistics
 */
export class PlayerStats {
    constructor() {
        this.reset();
        this.totalGames = 0;
        this.totalPlayTime = 0;
        this.totalKills = 0;
        this.totalBossKills = 0;
        this.maxComboEver = 0;
        this.maxScoreEver = 0;
        // T05: new stats
        this.totalShots = 0;
        this.totalHits = 0;
        this.powerupsCollected = 0;
        this.weaponKills = { normal: 0, laser: 0, homing: 0, explosive: 0 };
    }

    reset() {
        this.currentGameKills = 0;
        this.currentGameBossKills = 0;
        this.currentGameScore = 0;
        this.currentGameStartTime = Date.now();
        this.currentGameLevel = 0;
        this.noDamageTimer = 0;
        this.lastDamageTime = Date.now();
        // T05: reset per-game stats
        this.currentShots = 0;
        this.currentHits = 0;
        this.currentPowerupsCollected = 0;
        this.currentWeaponKills = { normal: 0, laser: 0, homing: 0, explosive: 0 };
    }

    toJSON() {
        return {
            totalGames: this.totalGames,
            totalPlayTime: this.totalPlayTime,
            totalKills: this.totalKills,
            totalBossKills: this.totalBossKills,
            maxComboEver: this.maxComboEver,
            maxScoreEver: this.maxScoreEver,
            totalShots: this.totalShots,
            totalHits: this.totalHits,
            powerupsCollected: this.powerupsCollected
        };
    }

    fromJSON(data) {
        this.totalGames = data.totalGames || 0;
        this.totalPlayTime = data.totalPlayTime || 0;
        this.totalKills = data.totalKills || 0;
        this.totalBossKills = data.totalBossKills || 0;
        this.maxComboEver = data.maxComboEver || 0;
        this.maxScoreEver = data.maxScoreEver || 0;
        this.totalShots = data.totalShots || 0;
        this.totalHits = data.totalHits || 0;
        this.powerupsCollected = data.powerupsCollected || 0;
    }
}

/**
 * Achievement notification animation
 */
class AchievementNotification {
    constructor(id, title, icon) {
        this.id = id;
        this.title = title;
        this.icon = icon;
        this.timer = 0;
        this.maxTimer = 180;
        this.y = -60;
        this.targetY = 80;
        this.active = true;
        this.alpha = 0;
        this.scale = 0.5;
    }

    update(dt) {
        this.timer += dt * 60;

        if (this.timer < 30) {
            const t = this.timer / 30;
            this.y = -60 + (this.targetY + 60) * t;
            this.alpha = t;
            this.scale = 0.5 + 0.5 * t;
        } else if (this.timer < 120) {
            this.y = this.targetY;
            this.alpha = 1;
            this.scale = 1;
        } else if (this.timer < 150) {
            const t = (this.timer - 120) / 30;
            this.y = this.targetY;
            this.alpha = 1 - t;
            this.scale = 1 + 0.2 * t;
        } else {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active || this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
        ctx.translate(GAME_WIDTH / 2, this.y);
        ctx.scale(this.scale, this.scale);

        const width = 280;
        const height = 50;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this._roundedRect(ctx, -width/2, -height/2, width, height, 10);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        this._roundedRect(ctx, -width/2, -height/2, width, height, 10);
        ctx.stroke();

        // Icon
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, -width/2 + 12, 0);

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('成就解锁!', -width/2 + 45, -8);

        // Achievement name
        ctx.fillStyle = '#ffd700';
        ctx.font = '12px monospace';
        ctx.fillText(this.title, -width/2 + 45, 10);

        ctx.restore();
    }

    _roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

/**
 * Main achievement system class
 */
export class AchievementSystem {
    constructor(audio) {
        this.audio = audio;
        this.definitions = ACHIEVEMENT_DEFS;
        this.achievements = new Map();
        this.stats = new PlayerStats();
        this.notificationQueue = [];
        this.maxNotifications = 3;

        this._initAchievements();
        this.load();
    }

    _initAchievements() {
        for (const [id, def] of Object.entries(this.definitions)) {
            this.achievements.set(id, new AchievementStatus(id, def));
        }
    }

    // Event hooks
    onEnemyKill(score, enemyType, weaponType) {
        this.stats.currentGameKills++;
        this.stats.totalKills++;
        this.stats.currentWeaponKills[weaponType]++;
        this._checkKillAchievements();
    }

    onBossKill() {
        this.stats.currentGameBossKills++;
        this.stats.totalBossKills++;
        this._tryUnlock('BOSS_HUNTER');
    }

    onScoreChange(score) {
        this.stats.currentGameScore = score;
        this.stats.maxScoreEver = Math.max(this.stats.maxScoreEver, score);
        this._checkScoreAchievements(score);
    }

    onComboChange(combo) {
        this.stats.maxComboEver = Math.max(this.stats.maxComboEver, combo);
        this._checkComboAchievements(combo);
    }

    onDamage() {
        this.stats.noDamageTimer = 0;
        this.stats.lastDamageTime = Date.now();
    }

    onShot() {
        this.stats.totalShots++;
        this.stats.currentShots++;
    }

    onHit() {
        this.stats.totalHits++;
        this.stats.currentHits++;
    }

    onPowerupCollect() {
        this.stats.powerupsCollected++;
        this.stats.currentPowerupsCollected++;
        this._checkCollectionAchievements();
    }

    update(dt, gameState) {
        // Update no-damage timer
        if (gameState.state === 'playing' && gameState.player && !gameState.player.invincible) {
            this.stats.noDamageTimer += dt;
            this._checkSurvivalAchievements();
        }

        // Update notification animations
        for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
            this.notificationQueue[i].update(dt);
            if (!this.notificationQueue[i].active) {
                this.notificationQueue.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        let offsetY = 0;
        for (const notification of this.notificationQueue) {
            ctx.save();
            ctx.translate(0, offsetY);
            notification.draw(ctx);
            ctx.restore();
            offsetY += 60;
        }
    }

    // Achievement check logic
    _checkKillAchievements() {
        const kills = this.stats.currentGameKills;
        const totalKills = this.stats.totalKills;

        if (totalKills >= 1) this._tryUnlock('FIRST_BLOOD');
        this._updateProgress('MASSACRE', kills);
        this._checkWeaponKills();
    }

    _checkScoreAchievements(score) {
        if (score >= 50000) this._tryUnlock('LEGENDARY');
        if (score >= 10000) this._tryUnlock('SCORE_10K');
    }

    _checkComboAchievements(combo) {
        if (combo >= 20) this._tryUnlock('COMBO_20');
        if (combo >= 10) this._tryUnlock('COMBO_10');
    }

    _checkSurvivalAchievements() {
        const noDamageSec = this.stats.noDamageTimer;
        if (noDamageSec >= 60) this._tryUnlock('NO_HIT_1MIN');

        const survivalTime = (Date.now() - this.stats.currentGameStartTime) / 1000;
        if (survivalTime >= 300) this._tryUnlock('SURVIVOR');
    }

    _checkCollectionAchievements() {
        const collected = this.stats.currentPowerupsCollected;
        if (collected >= 20) this._tryUnlock('COLLECTOR');
    }

    _checkAccuracyAchievements() {
        const totalShots = this.stats.totalShots;
        if (totalShots >= 100) {
            const accuracy = (this.stats.totalHits / totalShots) * 100;
            if (accuracy >= 80) this._tryUnlock('SHARPSHOOTER');
        }
    }

    _checkWeaponKills() {
        const weaponKills = this.stats.currentWeaponKills;
        const allAbove10 = Object.values(weaponKills).every(k => k >= 10);
        if (allAbove10) this._tryUnlock('WAR_MACHINE');
    }

    // Achievement unlock logic
    _tryUnlock(id) {
        const status = this.achievements.get(id);
        if (!status || status.unlocked) return false;

        status.unlocked = true;
        status.unlockTime = Date.now();

        this._showNotification(status.def);
        this._grantReward(status.def.reward);
        this.save();

        if (this.audio) {
            this.audio.playAchievement?.();
        }

        return true;
    }

    _updateProgress(id, value) {
        const status = this.achievements.get(id);
        if (!status || status.unlocked) return;

        status.progress = Math.max(status.progress, value);

        if (status.progress >= status.progressMax) {
            this._tryUnlock(id);
        }

        this.save();
    }

    _showNotification(def) {
        if (this.notificationQueue.length >= this.maxNotifications) {
            this.notificationQueue.shift();
        }
        this.notificationQueue.push(
            new AchievementNotification(def.id, def.title, def.icon)
        );
    }

    _grantReward(reward) {
        if (!reward) return;
        const event = new CustomEvent('achievement-reward', { detail: reward });
        window.dispatchEvent(event);
    }

    // Storage methods
    save() {
        try {
            const data = {
                version: 1,
                unlocked: [],
                progress: {},
                stats: this.stats.toJSON(),
                last_updated: Date.now()
            };

            for (const [id, status] of this.achievements) {
                if (status.unlocked) {
                    data.unlocked.push(id);
                }
                if (status.progress > 0 && !status.unlocked) {
                    data.progress[id] = status.progress;
                }
            }

            localStorage.setItem('raiden_achievements', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save achievements:', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem('raiden_achievements');
            if (!raw) return;

            const data = JSON.parse(raw);

            if (data.unlocked) {
                for (const id of data.unlocked) {
                    const status = this.achievements.get(id);
                    if (status) {
                        status.unlocked = true;
                        status.notified = true;
                    }
                }
            }

            if (data.progress) {
                for (const [id, progress] of Object.entries(data.progress)) {
                    const status = this.achievements.get(id);
                    if (status && !status.unlocked) {
                        status.progress = progress;
                    }
                }
            }

            if (data.stats) {
                this.stats.fromJSON(data.stats);
            }
        } catch (e) {
            console.error('Failed to load achievements:', e);
        }
    }

    // Query interface
    getProgress(id) {
        const status = this.achievements.get(id);
        if (!status) return null;
        return {
            id: status.id,
            title: status.def.title,
            description: status.def.description,
            icon: status.def.icon,
            unlocked: status.unlocked,
            progress: status.progress,
            progressMax: status.progressMax,
            progressRatio: status.getProgressRatio()
        };
    }

    getAllAchievements() {
        const result = [];
        for (const [id, status] of this.achievements) {
            result.push(this.getProgress(id));
        }
        return result;
    }

    getUnlockedCount() {
        let count = 0;
        for (const status of this.achievements.values()) {
            if (status.unlocked) count++;
        }
        return count;
    }

    getTotalCount() {
        return this.achievements.size;
    }

    resetAll() {
        for (const status of this.achievements.values()) {
            status.unlocked = false;
            status.unlockTime = 0;
            status.progress = 0;
            status.notified = false;
        }
        this.stats = new PlayerStats();
        this.save();
    }
}
