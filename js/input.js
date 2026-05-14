// input.js - Input handling (keyboard, mouse, touch)

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

        // Mouse
        this.canvas.addEventListener('mousemove', (e) => {
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
        this.canvas.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const t = e.touches[0];
            this.touch.x = (t.clientX - rect.left) * scaleX;
            this.touch.y = (t.clientY - rect.top) * scaleY;
            this.touch.active = true;
            this.usingMouse = false;
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const t = e.touches[0];
            this.touch.x = (t.clientX - rect.left) * scaleX;
            this.touch.y = (t.clientY - rect.top) * scaleY;
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touch.active = false;
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
}
