// Alarm tone generation via Web Audio API (no asset files needed).
let audioCtx = null;
let osc = null;
let gain = null;
let intervalId = null;

function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function startAlarm(type = "ALERT") {
  const ctx = ensureCtx();
  stopAlarm();
  const freqs = type === "SOS" ? [880, 660] : [740, 560];
  let i = 0;
  const playBeep = () => {
    if (osc) {
      try { osc.stop(); } catch {}
    }
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freqs[i % freqs.length];
    gain.gain.value = 0.14;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    i++;
  };
  playBeep();
  intervalId = setInterval(playBeep, 480);
}

export function stopAlarm() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (osc) {
    try { osc.stop(); } catch {}
    osc = null;
  }
  if (gain) {
    try { gain.disconnect(); } catch {}
    gain = null;
  }
}