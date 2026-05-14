// background.js - Parallax scrolling background (Enhanced with combo speed)

import { GAME_WIDTH, GAME_HEIGHT, randRange, randInt } from './utils.js';

class Star {
    constructor(layer) {
        this.reset(layer);
        this.y = randRange(0, GAME_HEIGHT);
    }

    reset(layer) {
        this.x = randRange(0, GAME_WIDTH);
        this.y = -2;
        this.layer = layer;
        this.speed = (layer + 1) * 0.5;
        this.size = (layer + 1) * 0.5 + Math.random() * 0.5;
        this.brightness = 0.3 + layer * 0.2 + Math.random() * 0.3;
    }

    update(dt, speedMultiplier) {
        this.y += this.speed * speedMultiplier * dt * 60;
        if (this.y > GAME_HEIGHT + 5) {
            this.reset(this.layer);
        }
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class CloudLayer {
    constructor(layer) {
        this.layer = layer;
        this.speed = (layer + 1) * 0.3;
        this.clouds = [];
        for (let i = 0; i < 3 + layer; i++) {
            this.clouds.push({
                x: randRange(0, GAME_WIDTH),
                y: randRange(0, GAME_HEIGHT),
                width: randRange(80, 200),
                height: randRange(30, 60),
                alpha: 0.02 + layer * 0.01
            });
        }
    }

    update(dt, speedMultiplier) {
        this.clouds.forEach(c => {
            c.y += this.speed * speedMultiplier * dt * 60;
            if (c.y > GAME_HEIGHT + 70) {
                c.y = -c.height - 20;
                c.x = randRange(-50, GAME_WIDTH);
            }
        });
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(100, 150, 255, 0.03)`;
        this.clouds.forEach(c => {
            ctx.globalAlpha = c.alpha;
            ctx.beginPath();
            ctx.ellipse(c.x + c.width / 2, c.y + c.height / 2,
                       c.width / 2, c.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
}

export class Background {
    constructor() {
        this.stars = [];
        this.clouds = [];
        this.speedMultiplier = 1.0;
        this.targetSpeedMultiplier = 1.0;

        // Create 3 layers of stars
        for (let layer = 0; layer < 3; layer++) {
            const count = 20 + layer * 15;
            for (let i = 0; i < count; i++) {
                this.stars.push(new Star(layer));
            }
        }

        // Create cloud layers
        for (let i = 0; i < 2; i++) {
            this.clouds.push(new CloudLayer(i));
        }

        // Nebula effect
        this.nebulaOffset = 0;
    }

    /**
     * Set the background speed multiplier based on combo level.
     * @param {number} comboMultiplier - The current combo multiplier (1-5)
     */
    setComboSpeed(comboMultiplier) {
        // Speed ranges from 1.0 (no combo) to 2.0 (max combo)
        this.targetSpeedMultiplier = 1.0 + (comboMultiplier - 1) * 0.25;
    }

    update(dt) {
        // Smooth interpolation towards target speed
        const lerpRate = dt * 3;
        this.speedMultiplier += (this.targetSpeedMultiplier - this.speedMultiplier) * lerpRate;

        this.stars.forEach(s => s.update(dt, this.speedMultiplier));
        this.clouds.forEach(c => c.update(dt, this.speedMultiplier));
        this.nebulaOffset += dt * 10;
    }

    draw(ctx) {
        // Dark space background
        const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(0.5, '#0d0d2b');
        gradient.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Nebula glow
        const nebulaGrad = ctx.createRadialGradient(
            GAME_WIDTH / 2 + Math.sin(this.nebulaOffset * 0.01) * 50,
            GAME_HEIGHT / 3 + Math.cos(this.nebulaOffset * 0.008) * 30,
            0,
            GAME_WIDTH / 2, GAME_HEIGHT / 3, GAME_WIDTH * 0.6
        );
        nebulaGrad.addColorStop(0, 'rgba(30, 0, 60, 0.15)');
        nebulaGrad.addColorStop(0.5, 'rgba(10, 0, 40, 0.08)');
        nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebulaGrad;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Draw clouds (behind stars)
        this.clouds.forEach(c => c.draw(ctx));

        // Draw stars
        this.stars.forEach(s => s.draw(ctx));
    }
}
