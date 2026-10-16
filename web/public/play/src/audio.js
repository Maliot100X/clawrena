// Tiny WebAudio synth. No asset files — sfx described in data/audio-config.json.

let ctx = null;
let cfg = null;

export function initAudio(config) {
  cfg = config;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { ctx = null; }
}

export function playSfx(name) {
  if (!ctx || !cfg) return;
  const s = cfg.sfx?.[name];
  if (!s) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = s.type || 'square';
  osc.frequency.setValueAtTime(s.freq, t);
  if (s.slide) osc.frequency.exponentialRampToValueAtTime(
    Math.max(20, s.freq + s.slide), t + s.dur);
  const vol = (s.gain ?? 0.15) * (cfg.master ?? 0.35);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + s.dur + 0.02);
}
