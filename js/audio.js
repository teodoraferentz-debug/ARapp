/* Efecte sonore generate cu WebAudio (fără fișiere audio externe) */
window.Sfx = (function () {
  let ctx = null;
  let on = true;

  function ensure() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!on || !ensure()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol) {
    if (!on || !ensure()) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol || 0.2;
    src.buffer = buf;
    src.connect(g).connect(ctx.destination);
    src.start();
  }

  return {
    unlock: ensure,
    isOn: () => on,
    toggle() { on = !on; return on; },
    tap()   { tone(660, 0.08, 'triangle', 0.12); },
    good()  { tone(523, 0.12, 'sine', 0.16); tone(784, 0.2, 'sine', 0.16, null, 0.11); },
    bad()   { tone(200, 0.3, 'sawtooth', 0.1, 90); },
    boom()  { noise(0.3, 0.22); tone(140, 0.25, 'square', 0.08, 40); },
    hurt()  { tone(110, 0.4, 'sawtooth', 0.16, 50); noise(0.25, 0.25); },
    power() { tone(440, 0.1, 'sine', 0.14); tone(660, 0.1, 'sine', 0.14, null, 0.09); tone(990, 0.2, 'sine', 0.14, null, 0.18); },
    level() { tone(392, 0.1, 'triangle', 0.14); tone(523, 0.1, 'triangle', 0.14, null, 0.1); tone(659, 0.18, 'triangle', 0.14, null, 0.2); },
    over()  { tone(330, 0.25, 'triangle', 0.16, 220); tone(220, 0.4, 'triangle', 0.16, 110, 0.25); }
  };
})();
