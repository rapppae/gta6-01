// SOLMAR — keyboard and mouse. Held keys are read every sim step; pressed keys are
// edges that the main loop clears after each step, so a tap fires exactly once.
export function createInput(canvas) {
  const input = {
    forward: false, back: false, left: false, right: false,
    sprint: false, jump: false, handbrake: false,
    interactHeld: false, interactPressed: false,
    shootPressed: false, reloadPressed: false, pausePressed: false,
    mouseDX: 0, mouseDY: 0, pointerLocked: false, anyKey: false,
  };
  const keys = {};
  function updateHeld() {
    input.forward = !!(keys.KeyW || keys.ArrowUp);
    input.back = !!(keys.KeyS || keys.ArrowDown);
    input.left = !!(keys.KeyA || keys.ArrowLeft);
    input.right = !!(keys.KeyD || keys.ArrowRight);
    input.sprint = !!keys.ShiftLeft || !!keys.ShiftRight;
    input.jump = !!keys.Space;
    input.handbrake = !!keys.Space;
    input.interactHeld = !!keys.KeyE;
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    input.anyKey = true;
    if (e.code === 'KeyE') input.interactPressed = true;
    if (e.code === 'KeyR') input.reloadPressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') input.pausePressed = true;
    if (e.code === 'Space') e.preventDefault();
    updateHeld();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    updateHeld();
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    updateHeld();
  });
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (input.pointerLocked) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.shootPressed = true;
  });
  input.requestLock = () => {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock can be refused; mouse still works via drag */ }
  };
  input.clearEdges = () => {
    input.interactPressed = false;
    input.shootPressed = false;
    input.reloadPressed = false;
    input.pausePressed = false;
    input.anyKey = false;
    input.mouseDX = 0;
    input.mouseDY = 0;
  };
  return input;
}
