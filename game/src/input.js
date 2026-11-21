// Keyboard and pointer input with crisp one-shot action flags, clickable UI hitboxes, and slider dragging.

export const ACT_CONFIRM = 1 << 0;
export const ACT_RESTART = 1 << 1;
export const ACT_FREEROAM = 1 << 2;
export const ACT_PAUSE = 1 << 3;
export const ACT_MAP = 1 << 4;
export const ACT_MUSIC = 1 << 5;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const HANDBRAKE = new Set(['Space', 'ShiftLeft', 'ShiftRight']);

export function createInput(canvas, onFirstGesture, toLogicalPoint) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let handbrake = false;
  let actions = 0;
  let pointerX = -1;
  let pointerY = -1;
  let pointerDown = false;
  let pendingClick = null;

  function clearHeld() {
    up = false;
    down = false;
    left = false;
    right = false;
    handbrake = false;
    pointerDown = false;
  }

  window.addEventListener('keydown', (event) => {
    if (onFirstGesture) onFirstGesture();
    const code = event.code;
    if (UP.has(code)) up = true;
    else if (DOWN.has(code)) down = true;
    else if (LEFT.has(code)) left = true;
    else if (RIGHT.has(code)) right = true;
    else if (HANDBRAKE.has(code)) {
      handbrake = true;
      if (code === 'Space' && !event.repeat) actions |= ACT_CONFIRM;
    } else if (code === 'Enter') {
      if (!event.repeat) actions |= ACT_CONFIRM;
    } else if (code === 'KeyR') {
      if (!event.repeat) actions |= ACT_RESTART;
    } else if (code === 'KeyF') {
      if (!event.repeat) actions |= ACT_FREEROAM;
    } else if (code === 'KeyP' || code === 'Escape') {
      if (!event.repeat) actions |= ACT_PAUSE;
    } else if (code === 'KeyM' || code === 'Tab') {
      if (!event.repeat) actions |= ACT_MAP;
    } else if (code === 'KeyN') {
      if (!event.repeat) actions |= ACT_MUSIC;
    } else {
      return;
    }
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    const code = event.code;
    if (UP.has(code)) up = false;
    else if (DOWN.has(code)) down = false;
    else if (LEFT.has(code)) left = false;
    else if (RIGHT.has(code)) right = false;
    else if (HANDBRAKE.has(code)) handbrake = false;
  });

  window.addEventListener('blur', clearHeld);

  canvas.addEventListener('pointermove', (event) => {
    const pt = toLogicalPoint(event.clientX, event.clientY);
    pointerX = pt.x;
    pointerY = pt.y;
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (onFirstGesture) onFirstGesture();
    const pt = toLogicalPoint(event.clientX, event.clientY);
    pointerX = pt.x;
    pointerY = pt.y;
    pointerDown = true;
    pendingClick = { x: pt.x, y: pt.y };
  });

  canvas.addEventListener('click', () => {
    if (onFirstGesture) onFirstGesture();
  });

  canvas.addEventListener('touchend', () => {
    if (onFirstGesture) onFirstGesture();
  }, { passive: true });

  window.addEventListener('pointerup', () => {
    if (onFirstGesture) onFirstGesture();
    pointerDown = false;
  });

  return {
    controls() {
      return {
        throttle: up ? 1 : 0,
        brake: down ? 1 : 0,
        steer: (right ? 1 : 0) - (left ? 1 : 0),
        handbrake,
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const c = pendingClick;
      pendingClick = null;
      return c;
    },
    pointer() {
      return { x: pointerX, y: pointerY, down: pointerDown };
    },
  };
}
