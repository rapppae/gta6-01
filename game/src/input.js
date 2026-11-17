// SOLMAR — input.js
// Keyboard and mouse state, plus pointer lock. The game reads from one Input
// object every frame; nothing else touches the DOM events directly.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // one-frame click flag, consumed by combat
    this.pointerLocked = false;
    this.enabled = true;
    this.shotMode = false; // staged screenshots never take pointer lock
    this.onPauseKey = null; // set by main.js
    this.onInteractKey = null;
    this.onReloadKey = null;
    this.onMuteKey = null;
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyP' && this.onPauseKey) this.onPauseKey();
      if (e.code === 'Escape' && this.onPauseKey) this.onPauseKey();
      if (e.code === 'KeyE' && this.onInteractKey) this.onInteractKey();
      if (e.code === 'KeyR' && this.onReloadKey) this.onReloadKey();
      if (e.code === 'KeyM' && this.onMuteKey) this.onMuteKey();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.lookDX += e.movementX || 0;
      this.lookDY += e.movementY || 0;
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      // Losing the lock mid-game used to fling the camera on the next lock:
      // drop any look accumulated while unlocked.
      if (!this.pointerLocked) {
        this.lookDX = 0;
        this.lookDY = 0;
      }
    });
    this.canvas.addEventListener('click', () => this.requestLock());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Movement keys as a -1..1 pair, relative to the camera.
  moveAxes() {
    let f = 0;
    let s = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) f += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) f -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) s += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) s -= 1;
    return { f, s };
  }

  sprinting() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  // Mouse look accumulated since the last frame; calling this clears it.
  consumeLook() {
    const dx = this.lookDX;
    const dy = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { dx, dy };
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  requestLock() {
    if (this.shotMode) return;
    if (this.pointerLocked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // Headless or denied: the game still plays with keyboard only.
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
