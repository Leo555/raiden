// utils.js - Utility functions and constants

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;

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
