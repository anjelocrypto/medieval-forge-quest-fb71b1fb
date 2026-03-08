// Shared input state — singleton store readable from any component/system
// No React context needed; direct mutable reads for game-loop performance

const inputState = {
  keys: new Set<string>(),
  mouseButtons: new Set<number>(),
  // Edge-triggered actions (consumed on read)
  _justPressed: new Set<string>(),
  _justClicked: new Set<number>(),
};

// Initialization (call once)
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

  // Clear state on blur to avoid stuck keys
  window.addEventListener('blur', () => {
    inputState.keys.clear();
    inputState.mouseButtons.clear();
  });
}

// Read helpers
export function isKeyDown(code: string): boolean {
  return inputState.keys.has(code);
}

export function wasKeyJustPressed(code: string): boolean {
  return inputState._justPressed.has(code);
}

export function wasMouseJustClicked(button: number): boolean {
  return inputState._justClicked.has(button);
}

export function isMouseDown(button: number): boolean {
  return inputState.mouseButtons.has(button);
}

// Call once per frame to clear edge-triggered state
export function flushInput() {
  inputState._justPressed.clear();
  inputState._justClicked.clear();
}

// Movement helpers
export function getMovementInput() {
  const w = isKeyDown('KeyW') || isKeyDown('ArrowUp');
  const s = isKeyDown('KeyS') || isKeyDown('ArrowDown');
  const a = isKeyDown('KeyA') || isKeyDown('ArrowLeft');
  const d = isKeyDown('KeyD') || isKeyDown('ArrowRight');
  const run = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
  const jump = wasKeyJustPressed('Space');
  const interact = wasKeyJustPressed('KeyE');
  const attack = wasMouseJustClicked(0); // left click
  return { w, s, a, d, run, jump, interact, attack };
}
