// Sound, synthesized live with WebAudio — no audio files, nothing to
// download. Engine drone follows throttle, wind follows speed, and the
// chimes, thuds and bangs mark the moments that matter.

export function createAudio() {
  return {
    ctx: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    windFilter: null,
    started: false,
    muted: false,
  };
}

// Must be called from a user gesture (click / keypress).
export function startAudio(audio) {
  if (audio.started) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.ctx = ctx;

    // Engine: two detuned saws through a low-pass, pitch follows throttle.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 52;
    audio.engineOsc2 = ctx.createOscillator();
    audio.engineOsc2.type = 'sawtooth';
    audio.engineOsc2.frequency.value = 78;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    audio.engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(ctx.destination);
    audio.engineOsc.start();
    audio.engineOsc2.start();

    // Wind: looped noise through a band-pass, gain follows airspeed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSrc = ctx.createBufferSource();
    audio.windSrc.buffer = buffer;
    audio.windSrc.loop = true;
    audio.windFilter = ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 700;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSrc.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(ctx.destination);
    audio.windSrc.start();

    audio.started = true;
  } catch {
    audio.started = false;
  }
}

// Call every frame with the plane's live state.
export function updateAudio(audio, plane, dt) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const throttle = plane.throttle;
  const speed = plane.speed / 92;
  const targetEngine = plane.onGround && throttle < 0.05 ? 0.015 : 0.02 + throttle * 0.075;
  audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : targetEngine, t, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 64 + speed * 22, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(72 + throttle * 96 + speed * 30, t, 0.1);
  audio.windGain.gain.setTargetAtTime(audio.muted ? 0 : speed * speed * 0.12, t, 0.15);
  audio.windFilter.frequency.setTargetAtTime(500 + speed * 900, t, 0.2);
}

function blip(audio, freq, dur, type, gain, when = 0) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function chimeRing(audio) {
  blip(audio, 880, 0.5, 'sine', 0.16);
  blip(audio, 1318, 0.6, 'sine', 0.12, 0.07);
}

export function thudLanding(audio) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g);
  g.connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);
}

export function bangCrash(audio) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const len = audio.ctx.sampleRate * 0.7;
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const g = audio.ctx.createGain();
  g.gain.value = 0.5;
  src.connect(g);
  g.connect(audio.ctx.destination);
  src.start(t);
}

export function clickUi(audio) {
  blip(audio, 660, 0.08, 'square', 0.05);
}
