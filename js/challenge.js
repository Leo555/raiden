// js/challenge.js - Challenge Mode Complete Implementation

import { GAME_WIDTH, GAME_HEIGHT } from './utils.js';

/**
 * Challenge mode base class
 */
export class ChallengeMode {
    constructor(mode) {
        this.mode = mode; // 'time_attack' or 'survival'
        this.isActive = false;
        this.timer = 0;
        this.score = 0;
        this.startTime = 0;
        this.gameState = 'idle'; // idle, playing, finished
    }

    start() {
        this.isActive = true;
        this.gameState = 'playing';
        this.timer = 0;
        this.score = 0;
        this.startTime = Date.now();
    }

    update(dt) {
        if (!this.isActive || this.gameState !== 'playing') return;
        this.timer += dt * 60;

        if (this.isTimeUp()) {
            this.gameState = 'finished';
            this.saveScore();
        }
    }

    getTimeRemaining() {
        return Math.max(0, Math.ceil((this.getTimeLimit() - this.timer) / 60));
    }

    getTimeLimit() {
        return 3600; // 60 seconds * 60 fps
    }

    isTimeUp() {
        return this.timer >= this.getTimeLimit();
    }

    getScore() {
        return this.score;
    }

    getDisplayInfo() {
        return {
            mode: this.mode,
            timeRemaining: this.getTimeRemaining(),
            score: this.score,
            state: this.gameState
        };
    }

    saveScore() {
        const scores = this.loadLeaderboard();
        scores.push({
            score: this.score,
            time: Date.now(),
            mode: this.mode
        });
        scores.sort((a, b) => b.score - a.score);
        scores.splice(10); // Keep top 10
        
        localStorage.setItem(`raiden_challenge_${this.mode}`, JSON.stringify(scores));
    }

    loadLeaderboard() {
        try {
            const raw = localStorage.getItem(`raiden_challenge_${this.mode}`);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    getBestScore() {
        const leaderboard = this.loadLeaderboard();
        return leaderboard.length > 0 ? leaderboard[0].score : 0;
    }

    stop() {
        this.isActive = false;
        this.gameState = 'finished';
    }

    reset() {
        this.isActive = false;
        this.gameState = 'idle';
        this.timer = 0;
        this.score = 0;
    }
}

/**
 * Time Attack Mode
 */
export class TimeAttackMode extends ChallengeMode {
    constructor() {
        super('time_attack');
        this.enemiesKilled = 0;
    }

    start() {
        super.start();
        this.enemiesKilled = 0;
    }

    onEnemyKill(score) {
        if (!this.isActive || this.gameState !== 'playing') return;
        this.enemiesKilled++;
        this.score += score;
    }

    getTimeLimit() {
        return 3600; // 60 seconds
    }

    getDisplayInfo() {
        const info = super.getDisplayInfo();
        info.enemiesKilled = this.enemiesKilled;
        info.timeLimit = 60;
        return info;
    }
}

/**
 * Survival Mode
 */
export class SurvivalMode extends ChallengeMode {
    constructor() {
        super('survival');
        this.wavesSurvived = 0;
        this.nextWaveTimer = 0;
        this.enemiesKilled = 0;
        this.difficulty = 1;
    }

    start() {
        super.start();
        this.wavesSurvived = 0;
        this.nextWaveTimer = 300; // 5 seconds
        this.enemiesKilled = 0;
        this.difficulty = 1;
    }

    onEnemyKill(score) {
        if (!this.isActive || this.gameState !== 'playing') return;
        this.enemiesKilled++;
        this.score += score;
    }

    update(dt) {
        super.update(dt);
        
        if (!this.isActive || this.gameState !== 'playing') return;
        
        this.nextWaveTimer -= dt * 60;
        if (this.nextWaveTimer <= 0) {
            this.wavesSurvived++;
            this.difficulty = 1 + this.wavesSurvived * 0.2;
            this.nextWaveTimer = Math.max(180, 300 - this.wavesSurvived * 10); // Gradually faster
        }
    }

    getTimeLimit() {
        return Infinity; // Infinite time until death
    }

    isTimeUp() {
        return false; // Survival mode doesn't time out
    }

    getDisplayInfo() {
        const info = super.getDisplayInfo();
        info.wavesSurvived = this.wavesSurvived;
        info.difficulty = this.difficulty.toFixed(1);
        info.timeSurvived = Math.floor((this.timer / 60));
        return info;
    }
}

/**
 * Challenge Mode UI Manager
 */
export class ChallengeUIManager {
    constructor() {
        this.challengeMode = null; // 'time_attack', 'survival', or null
        this.timeAttack = new TimeAttackMode();
        this.survival = new SurvivalMode();
        this.currentMode = null;
        this.transitionAlpha = 0;
        this.transitionTimer = 0;
    }

    selectMode(mode) {
        this.challengeMode = mode;
        this.currentMode = mode === 'time_attack' ? this.timeAttack : this.survival;
        this.currentMode.reset();
        return this.currentMode;
    }

    startChallenge() {
        if (this.currentMode) {
            this.currentMode.start();
            this.transitionAlpha = 1;
            this.transitionTimer = 60;
        }
    }

    update(dt) {
        if (this.currentMode && this.currentMode.isActive) {
            this.currentMode.update(dt);
        }

        // Update transition
        if (this.transitionTimer > 0) {
            this.transitionTimer -= dt * 60;
            this.transitionAlpha = this.transitionTimer / 60;
        }
    }

    drawChallengeHUD(ctx) {
        if (!this.currentMode || !this.currentMode.isActive) return;

        const info = this.currentMode.getDisplayInfo();
        
        ctx.save();
        ctx.font = '12px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        if (info.mode === 'time_attack') {
            // Time Attack: Show countdown
            const minutes = Math.floor(info.timeRemaining / 60);
            const seconds = info.timeRemaining % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            ctx.fillStyle = info.timeRemaining <= 10 ? '#ff4444' : '#ffffff';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(`TIME: ${timeStr}`, GAME_WIDTH - 10, 10);
            
            ctx.fillStyle = '#ffaa00';
            ctx.font = '12px monospace';
            ctx.fillText(`KILLS: ${info.enemiesKilled}`, GAME_WIDTH - 10, 35);
        } else if (info.mode === 'survival') {
            // Survival: Show waves and time
            ctx.fillStyle = '#44ff44';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`WAVE: ${info.wavesSurvived}`, GAME_WIDTH - 10, 10);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`TIME: ${info.timeSurvived}s`, GAME_WIDTH - 10, 30);
            
            ctx.fillStyle = '#ffaa00';
            ctx.fillText(`DIFF: x${info.difficulty}`, GAME_WIDTH - 10, 50);
        }

        // Score (both modes)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`SCORE: ${info.score}`, GAME_WIDTH - 10, 70);

        ctx.restore();
    }

    drawModeSelection(ctx, selectedIndex = 0) {
        ctx.save();
        
        // Title
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CHALLENGE MODE', GAME_WIDTH / 2, 120);

        // Mode options
        const modes = [
            { id: 'time_attack', name: 'TIME ATTACK', desc: '60 seconds - Kill as many as possible!' },
            { id: 'survival', name: 'SURVIVAL', desc: 'Survive as long as possible!' }
        ];

        modes.forEach((mode, index) => {
            const y = 200 + index * 80;
            const isSelected = index === selectedIndex;

            // Background
            ctx.fillStyle = isSelected ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            this._roundedRect(ctx, GAME_WIDTH / 2 - 150, y - 25, 300, 50, 10);
            ctx.fill();

            // Border
            ctx.strokeStyle = isSelected ? '#ffaa00' : '#ffffff';
            ctx.lineWidth = isSelected ? 2 : 1;
            this._roundedRect(ctx, GAME_WIDTH / 2 - 150, y - 25, 300, 50, 10);
            ctx.stroke();

            // Mode name
            ctx.fillStyle = isSelected ? '#ffaa00' : '#ffffff';
            ctx.font = isSelected ? 'bold 16px monospace' : '14px monospace';
            ctx.fillText(mode.name, GAME_WIDTH / 2, y - 5);

            // Description
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '10px monospace';
            ctx.fillText(mode.desc, GAME_WIDTH / 2, y + 12);

            // Best score
            const best = mode.id === 'time_attack' ? this.timeAttack.getBestScore() : this.survival.getBestScore();
            if (best > 0) {
                ctx.fillStyle = '#44ff44';
                ctx.font = '10px monospace';
                ctx.fillText(`Best: ${best}`, GAME_WIDTH / 2, y + 28);
            }
        });

        // Instructions
        ctx.fillStyle = '#888888';
        ctx.font = '12px monospace';
        ctx.fillText('↑↓ to select, ENTER to start, ESC to return', GAME_WIDTH / 2, 400);

        ctx.restore();
    }

    drawChallengeResult(ctx) {
        if (!this.currentMode || this.currentMode.gameState !== 'finished') return;

        const info = this.currentMode.getDisplayInfo();
        const bestScore = this.currentMode.getBestScore();
        const isNewBest = info.score >= bestScore;

        ctx.save();

        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Result panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this._roundedRect(ctx, GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2 - 150, 400, 300, 15);
        ctx.fill();
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        this._roundedRect(ctx, GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2 - 150, 400, 300, 15);
        ctx.stroke();

        // Title
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CHALLENGE COMPLETE', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100);

        // Stats
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        
        let y = GAME_HEIGHT / 2 - 50;
        ctx.fillText(`FINAL SCORE: ${info.score}`, GAME_WIDTH / 2, y);
        y += 30;

        if (info.mode === 'time_attack') {
            ctx.fillText(`ENEMIES KILLED: ${info.enemiesKilled}`, GAME_WIDTH / 2, y);
            y += 30;
            const timeUsed = 60 - info.timeRemaining;
            ctx.fillText(`TIME USED: ${timeUsed}s`, GAME_WIDTH / 2, y);
        } else if (info.mode === 'survival') {
            ctx.fillText(`WAVES SURVIVED: ${info.wavesSurvived}`, GAME_WIDTH / 2, y);
            y += 30;
            ctx.fillText(`TIME SURVIVED: ${info.timeSurvived}s`, GAME_WIDTH / 2, y);
        }

        // New best
        if (isNewBest && info.score > 0) {
            y += 40;
            ctx.fillStyle = '#44ff44';
            ctx.font = 'bold 16px monospace';
            ctx.fillText('★ NEW BEST SCORE! ★', GAME_WIDTH / 2, y);
        }

        // Best score
        y += 30;
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '12px monospace';
        ctx.fillText(`BEST: ${bestScore}`, GAME_WIDTH / 2, y);

        // Instructions
        y += 50;
        ctx.fillStyle = '#888888';
        ctx.font = '12px monospace';
        ctx.fillText('ENTER to retry, ESC to return', GAME_WIDTH / 2, y);

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

    isChallengeActive() {
        return this.currentMode && this.currentMode.isActive && this.currentMode.gameState === 'playing';
    }

    isChallengeFinished() {
        return this.currentMode && this.currentMode.gameState === 'finished';
    }

    stopChallenge() {
        if (this.currentMode) {
            this.currentMode.stop();
        }
    }

    resetAll() {
        this.challengeMode = null;
        this.currentMode = null;
        this.timeAttack.reset();
        this.survival.reset();
    }
}
