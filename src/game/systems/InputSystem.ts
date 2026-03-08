// Shared input state — singleton store readable from any component/system

const inputState = {
  keys: new Set<string>(),
  mouseButtons: new Set<number>(),
  _justPressed: new Set<string>(),
  _justClicked: new Set<number>(),
  pointerJustLocked: false,
};

let initialized = false;

export function initInput() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('keydown', (e) => {
    if (!inputState.keys.has(e.code)) {
      inputState._justPressed.add(e.code);
    }
    inputState.keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    inputState.keys.delete(e.code);
  });

  window.addEventListener('mousedown', (e) => {
    if (!inputState.mouseButtons.has(e.button)) {
      inputState._justClicked.add(e.button);
    }
    inputState.mouseButtons.add(e.button);
  });

  window.addEventListener('mouseup', (e) => {
    inputState.mouseButtons.delete(e.button);
  });

  // Track pointer lock to suppress attack on lock-acquisition click
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      inputState.pointerJustLocked = true;
    }
  });

  window.addEventListener('blur', () => {
    inputState.keys.clear();
    inputState.mouseButtons.clear();
  });
}

export function isKeyDown(code: string): boolean {
  return inputState.keys.has(code);
}

// These do NOT consume — they just check. flushInput clears at end of frame.
export function wasKeyJustPressed(code: string): boolean {
  return inputState._justPressed.has(code);
}

export function wasMouseJustClicked(button: number): boolean {
  // Suppress left-click attack on the frame pointer lock was acquired
  if (button === 0 && inputState.pointerJustLocked) return false;
  return inputState._justClicked.has(button);
}

export function isMouseDown(button: number): boolean {
  return inputState.mouseButtons.has(button);
}

export function flushInput() {
  inputState._justPressed.clear();
  inputState._justClicked.clear();
  inputState.pointerJustLocked = false;
}

export function getMovementInput() {
  return {
    w: isKeyDown('KeyW') || isKeyDown('ArrowUp'),
    s: isKeyDown('KeyS') || isKeyDown('ArrowDown'),
    a: isKeyDown('KeyA') || isKeyDown('ArrowLeft'),
    d: isKeyDown('KeyD') || isKeyDown('ArrowRight'),
    run: isKeyDown('ShiftLeft') || isKeyDown('ShiftRight'),
    jump: wasKeyJustPressed('Space'),
    interact: wasKeyJustPressed('KeyE'),
    attack: wasMouseJustClicked(0),
    buildToggle: wasKeyJustPressed('KeyB'),
    buildPlace: wasMouseJustClicked(0),
    buildCancel: wasKeyJustPressed('Escape') || wasMouseJustClicked(2),
    buildNext: wasKeyJustPressed('KeyQ'),
    buildPrev: wasKeyJustPressed('KeyR'),
  };
}
