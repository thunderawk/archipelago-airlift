// Keyboard + mouse input. The stick is the mouse, held down: press and
// drag to steer, wheel for throttle. The keyboard is the full cockpit:
// arrows / WASD fly, Q/E rudder, G gear, F flaps, P pause. Both feed one
// shared control state, so the pilot can mix them without fighting either.
// The mouse never steers on its own — a pointer resting at the screen edge
// must not command full deflection.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, // -1 pull up .. +1 push down (stick)
    roll: 0, // -1 left .. +1 right
    rudder: 0,
    throttleDelta: 0, // -1 / +1 while held
    throttleSet: null, // absolute throttle from the wheel, 0..1
    gearPressed: false,
    flapsPressed: false,
    pausePressed: false,
    anyKey: false,
    mouseActive: false,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
  };

  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.code);
    state.anyKey = true;
    if (e.code === 'KeyG') state.gearPressed = true;
    if (e.code === 'KeyF') state.flapsPressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') state.pausePressed = true;
  };
  const up = (e) => keys.delete(e.code);

  const mouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    state.mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    state.mouseActive = true;
  };
  const wheel = (e) => {
    e.preventDefault();
    state.throttleSet = null; // recomputed by the plane from its own throttle
    state.throttleDelta = e.deltaY < 0 ? 1 : -1;
    state.wheelStamp = performance.now();
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) state.mouseDown = true;
    state.mouseActive = true;
    state.anyKey = true;
  });
  window.addEventListener('mouseup', () => {
    state.mouseDown = false;
  });

  // Read the live control state. Mouse steering engages only while the
  // button is held; keys always win a fight.
  function poll() {
    const k = keys;
    const keyPitch = (k.has('ArrowUp') || k.has('KeyW') ? -1 : 0) + (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    const keyRoll = (k.has('ArrowLeft') || k.has('KeyA') ? -1 : 0) + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0);
    const keyRudder = (k.has('KeyQ') ? -1 : 0) + (k.has('KeyE') ? 1 : 0);
    const keyThrottle = (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0) + (k.has('ControlLeft') || k.has('ControlRight') ? -1 : 0);

    let pitch = keyPitch;
    let roll = keyRoll;
    if (state.mouseDown && keyPitch === 0 && keyRoll === 0) {
      // Mouse stick: up is pull, left is bank left. Gentle near centre.
      pitch = clamp2(state.mouseY * 2.4, -1, 1);
      roll = clamp2(state.mouseX * 2.4, -1, 1);
    }
    state.pitch = pitch;
    state.roll = roll;
    state.rudder = keyRudder;
    state.throttleDelta = keyThrottle;
    return state;
  }

  function clamp2(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Edge-triggered buttons: consumed once by the game loop.
  function consume(name) {
    const v = state[name];
    state[name] = false;
    return v;
  }

  return { state, poll, consume, keys };
}
