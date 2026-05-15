// ui.js - UI/HUD system

import { GAME_WIDTH, GAME_HEIGHT, drawRoundedRect } from './utils.js';

export class UISystem {
    constructor() {
        this.screenShake = 0;
        this.shakeIntensity = 0;
        this.flashAlpha = 0;
        this.flashColor = '#ffffff';
        this.notifications = [];
        this.highScores = this._loadHighScores();
    }

    shake(intensity = 5) {
        this.screenShake = 15;
        this.shakeIntensity = intensity;
    }

    flash(color = '#ffffff', alpha = 0.5) {
        this.flashAlpha = alpha;
        this.flashColor = color;
    }

    notify(text, duration = 90) {
        this.notifications.push({ text, timer: duration, maxTimer: duration });
    }

    update(dt) {
        if (this.screenShake > 0) {
            this.screenShake -= dt * 60;
        }
        if (this.flashAlpha > 0) {
            this.flashAlpha -= dt * 2;
        }
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].timer -= dt * 60;
            if (this.notifications[i].timer <= 0) {
                this.notifications.splice(i, 1);
            }
        }
    }

    getShakeOffset() {
        if (this.screenShake <= 0) return { x: 0, y: 0 };
        return {
            x: (Math.random() - 0.5) * this.shakeIntensity,
            y: (Math.random() - 0.5) * this.shakeIntensity
        };
    }

    drawHUD(ctx, player, levelManager) {
        ctx.save();

        // Score
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${player.score.toString().padStart(8, '0')}`, 10, GAME_HEIGHT - 15);

        // Lives
        ctx.fillStyle = '#44ff44';
        ctx.font = '12px monospace';
        let livesText = 'LIVES: ';
        for (let i = 0; i < player.lives; i++) livesText += '\u2665 ';
        ctx.fillText(livesText, 10, GAME_HEIGHT - 35);

        // Shield
        ctx.fillStyle = '#4488ff';
        let shieldText = 'SHIELD: ';
        for (let i = 0; i < player.maxShield; i++) {
            shieldText += i < player.shield ? '\u25a0' : '\u25a1';
        }
        ctx.fillText(shieldText, 10, GAME_HEIGHT - 55);

        // Bombs
        ctx.fillStyle = '#ffaa00';
        let bombText = 'BOMB: ';
        for (let i = 0; i < player.bombs; i++) bombText += '\u25cf ';
        ctx.fillText(bombText, 10, GAME_HEIGHT - 75);

        // Weapon info (enhanced)
        const weaponInfo = player.getWeaponInfo ? player.getWeaponInfo() : null;
        if (weaponInfo) {
            // Show current weapon type
            const weaponNames = {
                'normal': 'NORMAL',
                'laser': 'LASER',
                'homing': 'HOMING',
                'explosive': 'EXPLOSIVE'
            };
            const weaponName = weaponNames[weaponInfo.type] || 'UNKNOWN';
            ctx.fillStyle = '#ff8844';
            ctx.fillText(`WEAPON: ${weaponName}`, GAME_WIDTH - 150, GAME_HEIGHT - 15);

            // Energy bar for laser
            if (weaponInfo.energy !== undefined) {
                const barWidth = 100;
                const barHeight = 6;
                const barX = GAME_WIDTH - 150;
                const barY = GAME_HEIGHT - 30;

                // Background
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                // Energy fill
                const energyRatio = weaponInfo.energy / weaponInfo.maxEnergy;
                const energyColor = energyRatio > 0.5 ? '#00ffff' : energyRatio > 0.25 ? '#ffaa00' : '#ff4444';
                ctx.fillStyle = energyColor;
                ctx.fillRect(barX, barY, barWidth * energyRatio, barHeight);

                // Border
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);

                // Label
                ctx.fillStyle = '#ffffff';
                ctx.font = '9px monospace';
                ctx.fillText('ENERGY', barX, barY - 2);
            }
        } else {
            // Fallback to weapon level display
            ctx.fillStyle = '#ff8844';
            ctx.fillText(`WEAPON: LV${player.weaponLevel}`, GAME_WIDTH - 110, GAME_HEIGHT - 15);
        }

        // Level info
        ctx.fillStyle = '#aaaaff';
        ctx.textAlign = 'right';
        ctx.fillText(`${levelManager.getLevelName()}`, GAME_WIDTH - 10, GAME_HEIGHT - 55);

        // Temp missile indicator
        if (player.hasTempMissile) {
            ctx.fillStyle = '#ff8800';
            ctx.textAlign = 'left';
            ctx.fillText('MISSILE ACTIVE', 10, GAME_HEIGHT - 95);
        }

        ctx.restore();
    }

    drawFlash(ctx) {
        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = this.flashAlpha;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.globalAlpha = 1;
        }
    }

    drawNotifications(ctx) {
        for (let i = 0; i < this.notifications.length; i++) {
            const n = this.notifications[i];
            const alpha = Math.min(1, n.timer / 20);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(n.text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50 + i * 25);
        }
        ctx.textAlign = 'left';
    }

    drawStartScreen(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Title
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4488ff';
        ctx.fillText('RAIDEN', GAME_WIDTH / 2, 180);
        ctx.font = 'bold 18px monospace';
        ctx.shadowColor = '#ff4444';
        ctx.fillText('STORM', GAME_WIDTH / 2, 210);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Instructions
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        const instructions = [
            'WASD / Arrow Keys - Move',
            'Mouse / Touch - Move (hold click)',
            'SPACE - Bomb (clear screen)',
            '1-4 - Switch Weapon',
            'P - Pause',
            '',
            'Destroy enemies, collect power-ups!',
            ''
        ];
        instructions.forEach((line, i) => {
            ctx.fillText(line, GAME_WIDTH / 2, 280 + i * 22);
        });

        // Start button
        const btnY = 480;
        ctx.fillStyle = '#2266cc';
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.fill();
        ctx.strokeStyle = '#4488ff';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('START GAME', GAME_WIDTH / 2, btnY + 25);

        // Challenge mode button
        const chalBtnY = btnY + 55;
        ctx.fillStyle = '#553300';
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, chalBtnY, 160, 40, 8);
        ctx.fill();
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, chalBtnY, 160, 40, 8);
        ctx.stroke();
        ctx.fillStyle = '#ffaa44';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('CHALLENGE', GAME_WIDTH / 2, chalBtnY + 25);

        // Endless mode button
        const endBtnY = chalBtnY + 55;
        ctx.fillStyle = '#333';
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, endBtnY, 160, 35, 8);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, endBtnY, 160, 35, 8);
        ctx.stroke();
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '13px monospace';
        ctx.fillText('ENDLESS MODE', GAME_WIDTH / 2, endBtnY + 22);

        // High scores
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('HIGH SCORES', GAME_WIDTH / 2, endBtnY + 60);
        ctx.font = '11px monospace';
        ctx.fillStyle = '#cccccc';
        for (let i = 0; i < Math.min(3, this.highScores.length); i++) {
            ctx.fillText(
                `${i + 1}. ${this.highScores[i].score.toString().padStart(8, '0')}`,
                GAME_WIDTH / 2, endBtnY + 80 + i * 18
            );
        }

        ctx.textAlign = 'left';
    }

    drawGameOver(ctx, score) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = '18px monospace';
        ctx.fillText(`FINAL SCORE: ${score.toString().padStart(8, '0')}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);

        // Check if high score
        if (this.highScores.length === 0 || score > this.highScores[this.highScores.length - 1]?.score || this.highScores.length < 10) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = '14px monospace';
            ctx.fillText('NEW HIGH SCORE!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25);
        }

        // Restart button
        const btnY = GAME_HEIGHT / 2 + 50;
        ctx.fillStyle = '#2266cc';
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.fill();
        ctx.strokeStyle = '#4488ff';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('PLAY AGAIN', GAME_WIDTH / 2, btnY + 25);

        // Menu button
        const menuBtnY = btnY + 55;
        ctx.fillStyle = '#333';
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, menuBtnY, 160, 35, 8);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, GAME_WIDTH / 2 - 80, menuBtnY, 160, 35, 8);
        ctx.stroke();
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '12px monospace';
        ctx.fillText('MAIN MENU', GAME_WIDTH / 2, menuBtnY + 22);

        ctx.textAlign = 'left';
    }

    drawPaused(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Press P to resume', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25);
        ctx.textAlign = 'left';
    }

    drawLevelComplete(ctx, level) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = '#44ff44';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL COMPLETE!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Next level starting...', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
        ctx.textAlign = 'left';
    }

    saveHighScore(score) {
        this.highScores.push({ score, date: Date.now() });
        this.highScores.sort((a, b) => b.score - a.score);
        this.highScores = this.highScores.slice(0, 10);
        try {
            localStorage.setItem('raiden_highscores', JSON.stringify(this.highScores));
        } catch (e) {}
    }

    _loadHighScores() {
        try {
            const data = localStorage.getItem('raiden_highscores');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    isStartButtonClicked(x, y) {
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= 480 && y <= 520;
    }

    isEndlessButtonClicked(x, y) {
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= 535 && y <= 570;
    }

    isRestartButtonClicked(x, y) {
        const btnY = GAME_HEIGHT / 2 + 50;
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= btnY && y <= btnY + 40;
    }

    isMenuButtonClicked(x, y) {
        const btnY = GAME_HEIGHT / 2 + 105;
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= btnY && y <= btnY + 35;
    }

    isChallengeButtonClicked(x, y) {
        const btnY = 535;
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= btnY && y <= btnY + 40;
    }

    isTimeAttackButtonClicked(x, y) {
        const btnY = GAME_HEIGHT / 2 - 30;
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= btnY && y <= btnY + 40;
    }

    isSurvivalButtonClicked(x, y) {
        const btnY = GAME_HEIGHT / 2 + 30;
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= btnY && y <= btnY + 40;
    }

    isBackButtonClicked(x, y) {
        const btnY = GAME_HEIGHT / 2 + 90;
        return x >= GAME_WIDTH / 2 - 80 && x <= GAME_WIDTH / 2 + 80 && y >= btnY && y <= btnY + 35;
    }

    drawChallengeSelect(ctx) {
        // Background dim
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Title
        ctx.fillStyle = '#ff8800';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CHALLENGE MODE', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80);

        // Time Attack button
        let btnY = GAME_HEIGHT / 2 - 30;
        ctx.fillStyle = '#553300';
        this._roundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.fill();
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        this._roundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.stroke();
        ctx.fillStyle = '#ffaa44';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('TIME ATTACK', GAME_WIDTH / 2, btnY + 25);

        // Survival button
        btnY = GAME_HEIGHT / 2 + 30;
        ctx.fillStyle = '#003355';
        this._roundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.fill();
        ctx.strokeStyle = '#0088ff';
        ctx.lineWidth = 2;
        this._roundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 40, 8);
        ctx.stroke();
        ctx.fillStyle = '#44bbff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('SURVIVAL', GAME_WIDTH / 2, btnY + 25);

        // Back button
        btnY = GAME_HEIGHT / 2 + 90;
        ctx.fillStyle = '#333';
        this._roundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 35, 8);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        this._roundedRect(ctx, GAME_WIDTH / 2 - 80, btnY, 160, 35, 8);
        ctx.stroke();
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '13px monospace';
        ctx.fillText('BACK', GAME_WIDTH / 2, btnY + 22);

        ctx.textAlign = 'left';
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
