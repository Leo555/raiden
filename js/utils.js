// utils.js - Utility functions and constants

// Logical playfield size. The height is fixed; the width is a *live binding*
// so every module that imports GAME_WIDTH sees the current value each time
// it reads it. On desktop the width follows the window's aspect ratio (see
// Game._syncFieldWidth in main.js); everywhere else it stays BASE_WIDTH.
export const BASE_WIDTH = 540;
export const MAX_WIDTH = 1920;
export let GAME_WIDTH = BASE_WIDTH;
export const GAME_HEIGHT = 960;

export function setGameWidth(w) {
    GAME_WIDTH = w;
}

/**
 * True unless this is a touch-first device (phone / tablet), i.e. whose
 * primary pointer is coarse AND cannot hover. Deliberately a *negative* test:
 * desktop browsers, embedded IDE browsers and hybrid laptops report all sorts
 * of hover / pointer combinations, and requiring "hover + fine" wrongly
 * excluded some of them. Shared by the wide-field layout and the 2-player
 * menu entry so the two can never disagree.
 */
export function isDesktopPointer() {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/**
 * How many 540-wide "lanes" of enemies a wide field gets. Wave layouts were
 * authored for a 540 field; on wider fields each wave is replicated into this
 * many scaled copies so the extra width is populated without cramming every
 * enemy into the middle.
 */
export function getLaneCount() {
    return Math.max(1, Math.round(GAME_WIDTH / 720));
}

/**
 * Movement speed multiplier for a wide field: a ship that needs ~2s to cross
 * 540px should not need ~6s to cross 1700px. Grows at 40% of the width ratio.
 */
export function getSpeedScale() {
    return 1 + (GAME_WIDTH / BASE_WIDTH - 1) * 0.4;
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function randInt(min, max) {
    return Math.floor(randRange(min, max + 1));
}

export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Object Pool for performance
export class ObjectPool {
    constructor(factory, reset, initialSize = 50) {
        this.factory = factory;
        this.reset = reset;
        this.pool = [];
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    get() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.factory();
    }

    release(obj) {
        this.reset(obj);
        this.pool.push(obj);
    }
}

// Simple AABB collision
export function rectCollision(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

// Circle collision
export function circleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = dx * dx + dy * dy;
    const radii = r1 + r2;
    return dist < radii * radii;
}

// Draw rounded rect
export function drawRoundedRect(ctx, x, y, w, h, r) {
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
