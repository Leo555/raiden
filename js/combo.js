// combo.js - Combo kill chain system

import { GAME_WIDTH, GAME_HEIGHT } from './utils.js';

/**
 * Manages combo (kill chain) mechanics.
 * Consecutive kills within a time window build combo count,
 * which multiplies score earned.
 */
export class ComboSystem {
    constructor(audio) {
        this.audio = audio;

        // Combo state
        this.count = 0;
        this.multiplier = 1;
        this.timer = 0;
        this.maxTimer = 2.0; // seconds to maintain combo

        // Visual state
        this.displayScale = 1.0;
        this.displayAlpha = 0;
        this.breakAnimation = 0;
        this.levelUpAnimation = 0;
        this.prevMultiplier = 1;

        // Graze counter (tracked here for UI convenience)
        this.grazeCount = 0;
        this.grazeDisplayTimer = 0;

        // Stats
        this.maxCombo = 0;
        this.totalBonusScore = 0;
    }

    /**
     * Called when an enemy is killed.
     * Returns the multiplied score value.
     * @param {number} baseScore - The base score of the killed enemy
     * @returns {number} The final score after combo multiplier
     */
    addKill(baseScore) {
        this.count++;
        this.timer = this.maxTimer;
        this.displayScale = 1.5;
        this.displayAlpha = 1.0;

        if (this.count > this.maxCombo) {
            this.maxCombo = this.count;
        }

        const oldMultiplier = this.multiplier;
        this.multiplier = this._calcMultiplier(this.count);

        // Check for multiplier level up
        if (this.multiplier > oldMultiplier) {
            this.prevMultiplier = oldMultiplier;
            this.levelUpAnimation = 1.0;
            if (this.audio) {
                this.audio.playComboUp();
            }
        }

        const finalScore = Math.floor(baseScore * this.multiplier);
        const bonusScore = finalScore - baseScore;
        this.totalBonusScore += bonusScore;

        return finalScore;
    }

    /**
     * Called on graze event.
     * @param {number} points - Points awarded for the graze
     */
    addGraze(points) {
        this.grazeCount++;
        this.grazeDisplayTimer = 2.0;
        // Graze also refreshes combo timer slightly
        if (this.count > 0) {
            this.timer = Math.min(this.timer + 0.3, this.maxTimer);
        }
    }

    /**
     * Update combo state each frame.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Combo timer countdown
        if (this.count > 0) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this._breakCombo();
            }
        }

        // Visual animations
        if (this.displayScale > 1.0) {
            this.displayScale -= dt * 4;
            if (this.displayScale < 1.0) this.displayScale = 1.0;
        }

        if (this.displayAlpha > 0 && this.count === 0) {
            this.displayAlpha -= dt * 2;
            if (this.displayAlpha < 0) this.displayAlpha = 0;
        }

        if (this.breakAnimation > 0) {
            this.breakAnimation -= dt * 3;
            if (this.breakAnimation < 0) this.breakAnimation = 0;
        }

        if (this.levelUpAnimation > 0) {
            this.levelUpAnimation -= dt * 2;
            if (this.levelUpAnimation < 0) this.levelUpAnimation = 0;
        }

        if (this.grazeDisplayTimer > 0) {
            this.grazeDisplayTimer -= dt;
        }
    }

    /**
     * Draw combo UI overlay.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (this.count <= 0 && this.displayAlpha <= 0 && this.breakAnimation <= 0) return;

        ctx.save();

        // Combo counter - top right area
        const x = GAME_WIDTH - 20;
        const y = 50;

        // Break animation (red flash)
        if (this.breakAnimation > 0) {
            ctx.globalAlpha = this.breakAnimation * 0.6;
            ctx.fillStyle = '#ff2200';
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('BREAK!', x, y + 30);
            ctx.globalAlpha = 1;
        }

        if (this.count > 0) {
            // Combo count number
            const scale = this.displayScale;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            // Multiplier badge
            ctx.globalAlpha = 1;
            ctx.fillStyle = this._getMultiplierColor();
            ctx.font = 'bold 22px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${this.count}`, 0, 0);

            // "COMBO" label
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '9px monospace';
            ctx.fillText('COMBO', 0, 12);

            // Multiplier
            ctx.fillStyle = this._getMultiplierColor();
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`x${this.multiplier}`, 0, -14);

            ctx.restore();

            // Timer bar
            const barWidth = 50;
            const barHeight = 3;
            const barX = x - barWidth;
            const barY = y + 18;
            const timerRatio = this.timer / this.maxTimer;

            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = timerRatio > 0.3 ? this._getMultiplierColor() : '#ff4444';
            ctx.fillRect(barX, barY, barWidth * timerRatio, barHeight);

            // Level up animation
            if (this.levelUpAnimation > 0) {
                ctx.globalAlpha = this.levelUpAnimation;
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'right';
                const offsetY = (1 - this.levelUpAnimation) * -20;
                ctx.fillText(`x${this.multiplier} MULTIPLIER!`, x, y + 40 + offsetY);
                ctx.globalAlpha = 1;
            }
        }

        // Graze counter
        if (this.grazeCount > 0 && this.grazeDisplayTimer > 0) {
            ctx.globalAlpha = Math.min(1, this.grazeDisplayTimer);
            ctx.fillStyle = '#88ddff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`GRAZE: ${this.grazeCount}`, x, y + 60);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    /**
     * Reset combo system state.
     */
    reset() {
        this.count = 0;
        this.multiplier = 1;
        this.timer = 0;
        this.displayScale = 1.0;
        this.displayAlpha = 0;
        this.breakAnimation = 0;
        this.levelUpAnimation = 0;
        this.grazeCount = 0;
        this.grazeDisplayTimer = 0;
        this.maxCombo = 0;
        this.totalBonusScore = 0;
    }

    /**
     * Calculate multiplier based on current combo count.
     * @param {number} count
     * @returns {number}
     */
    _calcMultiplier(count) {
        if (count >= 50) return 5;
        if (count >= 20) return 4;
        if (count >= 10) return 3;
        if (count >= 5) return 2;
        return 1;
    }

    /**
     * Break the combo chain.
     */
    _breakCombo() {
        if (this.count >= 5 && this.audio) {
            this.audio.playComboBreak();
        }
        this.breakAnimation = 1.0;
        this.count = 0;
        this.multiplier = 1;
        this.timer = 0;
    }

    /**
     * Get color for current multiplier level.
     * @returns {string}
     */
    _getMultiplierColor() {
        switch (this.multiplier) {
            case 1: return '#ffffff';
            case 2: return '#44ff44';
            case 3: return '#44ddff';
            case 4: return '#ffaa00';
            case 5: return '#ff44ff';
            default: return '#ffffff';
        }
    }
}
