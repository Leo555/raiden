// input.js - Input handling (keyboard, mouse, touch)

// Key bindings for the local 2-player (shared keyboard) mode.
// Single-player keeps the legacy behaviour (WASD *and* arrows both work,
// plus mouse / touch), so it does not use these tables.
export const CONTROLS_P1 = {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    bomb: ['Space']
};

export const CONTROLS_P2 = {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    bomb: ['Enter', 'NumpadEnter', 'Numpad0']
};

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = { x: 0, y: 0, active: false };
        this.usingMouse = false;

        this._bindEvents();
    }

    _bindEvents() {
        // Keyboard - bind on both window and canvas for max compatibility
        const handleKeyDown = (e) => {
            this.keys[e.code] = true;
            // Prevent default for game keys to avoid scrolling etc.
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP'].includes(e.code)) {
                e.preventDefault();
            }
        };
        const handleKeyUp = (e) => {
            this.keys[e.code] = false;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP'].includes(e.code)) {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        this.canvas.addEventListener('keydown', handleKeyDown);
        this.canvas.addEventListener('keyup', handleKeyUp);

        // Mouse. move/up are bound on `window` (not the canvas) so the ship
        // keeps following the pointer even outside the canvas (e.g. over the
        // letterbox bars), and a button released outside the canvas is not
        // missed (which used to leave the ship "stuck" following the mouse).
        // Coordinates are mapped into canvas space and clamped by the player.
        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
            this.usingMouse = true;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.usingMouse = true;
        });
        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        // Touch - NO preventDefault here, so click event can fire for button taps.
        // CSS touch-action:none on the canvas handles scroll/zoom prevention.
        this.canvas.addEventListener('touchstart', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const t = e.touches[0];
            this.touch.x = (t.clientX - rect.left) * scaleX;
            this.touch.y = (t.clientY - rect.top) * scaleY;
            this.touch.active = true;
            this.usingMouse = false;
        }, { passive: true });
        this.canvas.addEventListener('touchmove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const t = e.touches[0];
            this.touch.x = (t.clientX - rect.left) * scaleX;
            this.touch.y = (t.clientY - rect.top) * scaleY;
            this.touch.active = true;
        }, { passive: true });
        this.canvas.addEventListener('touchend', (e) => {
            // Keep active briefly so player finishes moving to last position
            setTimeout(() => { this.touch.active = false; }, 100);
        });
    }

    isKeyDown(code) {
        return !!this.keys[code];
    }

    isLeft() {
        return this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA');
    }

    isRight() {
        return this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD');
    }

    isUp() {
        return this.isKeyDown('ArrowUp') || this.isKeyDown('KeyW');
    }

    isDown() {
        return this.isKeyDown('ArrowDown') || this.isKeyDown('KeyS');
    }

    isBomb() {
        return this.isKeyDown('Space');
    }

    isPause() {
        return this.isKeyDown('KeyP');
    }

    clearKey(code) {
        this.keys[code] = false;
    }

    // True if any of the given key codes is currently held.
    anyDown(codes) {
        for (let i = 0; i < codes.length; i++) {
            if (this.keys[codes[i]]) return true;
        }
        return false;
    }

    clearKeys(codes) {
        for (let i = 0; i < codes.length; i++) {
            this.keys[codes[i]] = false;
        }
    }
}
