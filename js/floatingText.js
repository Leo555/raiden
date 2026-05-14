// floatingText.js - Floating damage/score numbers

import { GAME_WIDTH, GAME_HEIGHT } from './utils.js';

/**
 * A single floating text entry.
 */
class FloatingEntry {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.text = '';
        this.color = '#ffffff';
        this.size = 12;
        this.life = 0;
        this.maxLife = 0;
        this.vy = -1.5;
        this.vx = 0;
        this.active = false;
        this.scale = 1.0;
        this.bold = false;
    }
}

/**
 * Manages floating text numbers (damage, score, combo bonuses).
 * Uses a pool with a maximum count to maintain performance.
 */
export class FloatingTextSystem {
    constructor() {
        this.entries = [];
        this.maxEntries = 40; // Performance cap
        this.pool = [];

        // Pre-allocate pool
        for (let i = 0; i < this.maxEntries; i++) {
            this.pool.push(new FloatingEntry());
        }
    }

    /**
     * Spawn a floating damage number (white, small).
     * @param {number} x
     * @param {number} y
     * @param {number} damage
     */
    spawnDamage(x, y, damage) {
        this._spawn(x, y, `${damage}`, '#ffffff', 10, 30, false);
    }

    /**
     * Spawn a floating score number (gold, medium).
     * @param {number} x
     * @param {number} y
     * @param {number} score
     */
    spawnScore(x, y, score) {
        this._spawn(x, y, `+${score}`, '#ffdd44', 13, 45, true);
    }

    /**
     * Spawn a combo bonus number (green, shows extra points).
     * @param {number} x
     * @param {number} y
     * @param {number} bonus
     */
    spawnComboBonus(x, y, bonus) {
        this._spawn(x, y, `+${bonus}`, '#44ff88', 11, 40, false);
    }

    /**
     * Spawn a graze score (light blue, small).
     * @param {number} x
     * @param {number} y
     * @param {number} points
     */
    spawnGraze(x, y, points) {
        this._spawn(x, y, `+${points}`, '#88ddff', 9, 25, false);
    }

    /**
     * Spawn a critical/boss hit number (large, red-orange).
     * @param {number} x
     * @param {number} y
     * @param {number} damage
     */
    spawnCritical(x, y, damage) {
        this._spawn(x, y, `${damage}!`, '#ff6644', 16, 40, true);
    }

    /**
     * Internal spawn method.
     */
    _spawn(x, y, text, color, size, life, bold) {
        let entry = null;

        // Try to get from pool
        if (this.pool.length > 0) {
            entry = this.pool.pop();
        } else if (this.entries.length >= this.maxEntries) {
            // Remove the oldest entry and reuse
            entry = this.entries.shift();
        } else {
            entry = new FloatingEntry();
        }

        entry.x = x + (Math.random() - 0.5) * 10;
        entry.y = y;
        entry.text = text;
        entry.color = color;
        entry.size = size;
        entry.life = life;
        entry.maxLife = life;
        entry.vy = -1.5 - Math.random() * 0.5;
        entry.vx = (Math.random() - 0.5) * 0.5;
        entry.active = true;
        entry.scale = bold ? 1.3 : 1.0;
        entry.bold = bold;

        this.entries.push(entry);
    }

    /**
     * Update all floating text entries.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        for (let i = this.entries.length - 1; i >= 0; i--) {
            const e = this.entries[i];
            e.x += e.vx * dt * 60;
            e.y += e.vy * dt * 60;
            e.life -= dt * 60;

            // Scale down from initial pop
            if (e.scale > 1.0) {
                e.scale -= dt * 3;
                if (e.scale < 1.0) e.scale = 1.0;
            }

            if (e.life <= 0) {
                e.active = false;
                this.entries.splice(i, 1);
                e.reset();
                this.pool.push(e);
            }
        }
    }

    /**
     * Draw all floating text entries.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const e of this.entries) {
            if (!e.active) continue;

            const lifeRatio = e.life / e.maxLife;
            const alpha = lifeRatio > 0.3 ? 1.0 : lifeRatio / 0.3;

            ctx.globalAlpha = alpha;
            ctx.font = `${e.bold ? 'bold ' : ''}${Math.round(e.size * e.scale)}px monospace`;
            ctx.fillStyle = e.color;

            // Shadow for readability
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            ctx.fillText(e.text, e.x, e.y);
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.restore();
    }

    /**
     * Clear all floating text entries.
     */
    clear() {
        for (const e of this.entries) {
            e.reset();
            this.pool.push(e);
        }
        this.entries = [];
    }
}
