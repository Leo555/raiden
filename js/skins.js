// js/skins.js - Skin System (P1 - PM Review Requirement)

import { GAME_WIDTH, GAME_HEIGHT } from './utils.js';

/**
 * Skin definitions
 */
const SKIN_DEFS = {
    default: {
        id: 'default',
        name: '默认',
        description: '标准绿色涂装',
        color: '#44ff44',
        secondaryColor: '#22cc22',
        unlocked: true,
        price: 0
    },
    red: {
        id: 'red',
        name: '赤红烈焰',
        description: '红色火焰涂装',
        color: '#ff4444',
        secondaryColor: '#cc2222',
        unlocked: false,
        price: 1000
    },
    blue: {
        id: 'blue',
        name: '深蓝海洋',
        description: '蓝色海洋涂装',
        color: '#4444ff',
        secondaryColor: '#2222cc',
        unlocked: false,
        price: 1000
    },
    gold: {
        id: 'gold',
        name: '黄金传奇',
        description: '黄金传奇涂装',
        color: '#ffd700',
        secondaryColor: '#ffaa00',
        unlocked: false,
        price: 5000
    },
    rainbow: {
        id: 'rainbow',
        name: '彩虹幻影',
        description: '彩虹特效涂装（隐藏）',
        color: '#ff44ff',
        secondaryColor: '#44ffff',
        unlocked: false,
        price: 0,
        hidden: true,
        unlockCondition: 'Unlock all other skins'
    }
};

export class SkinSystem {
    constructor() {
        this.skins = SKIN_DEFS;
        this.currentSkin = 'default';
        this.load();
    }

    /**
     * Get current skin
     */
    getCurrentSkin() {
        return this.skins[this.currentSkin];
    }

    /**
     * Get skin by ID
     */
    getSkin(id) {
        return this.skins[id] || this.skins.default;
    }

    /**
     * Switch to a skin (if unlocked)
     */
    switchSkin(id) {
        if (!this.skins[id]) {
            console.warn(`Skin ${id} does not exist`);
            return false;
        }
        if (!this.skins[id].unlocked) {
            console.warn(`Skin ${id} is locked`);
            return false;
        }
        this.currentSkin = id;
        this.save();
        return true;
    }

    /**
     * Unlock a skin
     */
    unlock(id) {
        if (this.skins[id]) {
            this.skins[id].unlocked = true;
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Get all unlocked skins
     */
    getUnlockedSkins() {
        return Object.values(this.skins).filter(skin => skin.unlocked);
    }

    /**
     * Get all skins (for UI display)
     */
    getAllSkins() {
        return Object.values(this.skins);
    }

    /**
     * Check if skin is unlocked
     */
    isUnlocked(id) {
        return this.skins[id] && this.skins[id].unlocked;
    }

    /**
     * Save to LocalStorage
     */
    save() {
        try {
            const data = {
                currentSkin: this.currentSkin,
                unlocked: {}
            };
            for (const [id, skin] of Object.entries(this.skins)) {
                if (skin.unlocked) {
                    data.unlocked[id] = true;
                }
            }
            localStorage.setItem('raiden_skins', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save skins:', e);
        }
    }

    /**
     * Load from LocalStorage
     */
    load() {
        try {
            const raw = localStorage.getItem('raiden_skins');
            if (!raw) return;

            const data = JSON.parse(raw);
            if (data.currentSkin) {
                this.currentSkin = data.currentSkin;
            }
            if (data.unlocked) {
                for (const id of Object.keys(data.unlocked)) {
                    if (this.skins[id]) {
                        this.skins[id].unlocked = true;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load skins:', e);
        }
    }

    /**
     * Draw skin preview (for UI)
     */
    drawPreview(ctx, skinId, x, y, size = 30) {
        const skin = this.getSkin(skinId);
        
        ctx.save();
        ctx.translate(x, y);
        
        // Draw ship shape with skin color
        ctx.fillStyle = skin.color;
        ctx.strokeStyle = skin.secondaryColor;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.6, size * 0.8);
        ctx.lineTo(0, size * 0.4);
        ctx.lineTo(size * 0.6, size * 0.8);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        
        // Draw engine glow
        ctx.fillStyle = 'rgba(255, 170, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(-size * 0.3, size * 0.8, size * 0.2, 0, Math.PI * 2);
        ctx.arc(size * 0.3, size * 0.8, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}
