/* Sound: sound effects + generative background music, all synthesized with WebAudio.
 * No audio files needed — works offline and keeps the app tiny.
 *
 *   Sfx.unlock()            call from a tap (browsers block audio until then)
 *   Sfx.setMood('calm'|'quiz'|'game'), Sfx.setLevel(n)   → music follows the mode
 *   Sfx.toggleMusic(), Sfx.toggleSfx()                   → preferences saved in localStorage
 */
window.Sfx = (function () {
  let ctx = null, master = null, sfxBus = null, musicBus = null, delay = null;
  let noiseBuf = null;

  const prefs = (function () {
    try { return Object.assign({ sfx: true, music: true }, JSON.parse(localStorage.getItem('ar_audio') || '{}')); }
    catch (e) { return { sfx: true, music: true }; }
  })();
  const savePrefs = () => { try { localStorage.setItem('ar_audio', JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  /* ---------- audio graph ---------- */
  function ensure() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();       // keeps loud moments from clipping
        master = ctx.createGain(); master.gain.value = 0.9;
        master.connect(comp); comp.connect(ctx.destination);

        sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 1 : 0; sfxBus.connect(master);

        musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? 0.75 : 0; musicBus.connect(master);
        // soft echo gives the music some space
        delay = ctx.createDelay(1); delay.delayTime.value = 0.36;
        const fb = ctx.createGain(); fb.gain.value = 0.35;
        const wet = ctx.createGain(); wet.gain.value = 0.35;
        delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicBus);

        const n = ctx.sampleRate;                           // 1 s of noise, reused for hats / explosions
        noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  }

  /* ---------- sound-effect helpers ---------- */
  function tone(freq, dur, type, vol, slideTo, delaySec, bus) {
    if (!prefs.sfx || !ensure()) return;
    voice(bus || sfxBus, freq, dur, type, vol, slideTo, ctx.currentTime + (delaySec || 0));
  }

  function voice(dest, freq, dur, type, vol, slideTo, t0, attack) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(dest);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
    return g;
  }

  function noise(dur, vol, dest, t0, filterType, filterFreq) {
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = noiseBuf;
    t0 = t0 || ctx.currentTime;
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (filterType) {
      const f = ctx.createBiquadFilter();
      f.type = filterType; f.frequency.value = filterFreq || 1000;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(dest || sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  const SCALE = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];   // pentatonic: every planet has its own note

  /* ---------- generative music ---------- */
  // Am – F – C – G, one chord per bar of eight eighth-notes
  const PROG = [
    { root: 55.0,  pad: [220.0, 261.63, 329.63], arp: [440.0, 523.25, 659.25, 880.0] },
    { root: 43.65, pad: [174.61, 220.0, 261.63], arp: [349.23, 440.0, 523.25, 698.46] },
    { root: 65.41, pad: [196.0, 261.63, 329.63], arp: [392.0, 523.25, 659.25, 784.0] },
    { root: 49.0,  pad: [196.0, 246.94, 293.66], arp: [392.0, 493.88, 587.33, 784.0] }
  ];
  const BPM = { calm: 66, quiz: 94, game: 116 };

  const M = { mood: 'calm', level: 1, timer: null, nextT: 0, step: 0, bar: 0, running: false };

  function bpm() { return BPM[M.mood] + (M.mood === 'game' ? Math.min((M.level - 1) * 5, 30) : 0); }

  function playStep(t) {
    const chord = PROG[M.bar % PROG.length];
    const eighth = 60 / bpm() / 2;
    const s = M.step;
    const mood = M.mood;

    if (s === 0) {                                          // pad: soft chord that swells in and out
      const len = eighth * 8;
      chord.pad.forEach((f, i) => {
        const g = voice(musicBus, f * (mood === 'game' ? 1 : 1), len * 1.15, 'triangle', mood === 'calm' ? 0.07 : 0.045, null, t, len * 0.35);
        g.connect(delay);
      });
    }

    if (mood === 'calm') {                                  // sparse, dreamy bell-like notes
      if ((s === 0 || s === 3 || s === 5 || s === 6) && Math.random() < 0.6) {
        const f = chord.arp[Math.floor(Math.random() * 4)];
        voice(musicBus, f, 1.6, 'sine', 0.05, null, t, 0.02).connect(delay);
      }
      if (s === 0) voice(musicBus, chord.root * 2, eighth * 7, 'sine', 0.07, null, t, 0.4);
    } else if (mood === 'quiz') {                           // light, playful plucks
      const f = chord.arp[[0, 1, 2, 3, 2, 1, 2, 3][s]];
      voice(musicBus, f, 0.28, 'triangle', 0.055, null, t, 0.005).connect(delay);
      if (s === 0 || s === 4) voice(musicBus, chord.root * 2, eighth * 1.6, 'sine', 0.1, null, t, 0.01);
    } else {                                                // game: driving bass, kick, hats, arp
      voice(musicBus, chord.root * 2, eighth * 0.9, 'sawtooth', 0.045, null, t, 0.005);
      if (s % 2 === 0) voice(musicBus, 120, 0.16, 'sine', 0.2, 40, t, 0.003);                  // kick
      else noise(0.05, 0.05, musicBus, t, 'highpass', 7000);                                    // hat
      if (s % 2 === 1) voice(musicBus, chord.arp[[1, 2, 3, 2][(s >> 1) % 4]] * 0.5, 0.2, 'square', 0.022, null, t, 0.005).connect(delay);
    }
  }

  function schedule() {
    if (!ctx || !M.running) return;
    while (M.nextT < ctx.currentTime + 0.35) {
      playStep(Math.max(M.nextT, ctx.currentTime));
      M.nextT += 60 / bpm() / 2;
      M.step++;
      if (M.step >= 8) { M.step = 0; M.bar++; }
    }
  }

  function startMusic() {
    if (!prefs.music || M.running || !ensure()) return;
    M.running = true; M.step = 0; M.bar = 0;
    M.nextT = ctx.currentTime + 0.1;
    M.timer = setInterval(schedule, 100);
    schedule();
  }

  function stopMusic() {
    M.running = false;
    clearInterval(M.timer); M.timer = null;
  }

  document.addEventListener('visibilitychange', () => {       // silence when the tab/app is in the background
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (prefs.sfx || prefs.music) ctx.resume();
  });

  /* ---------- public API ---------- */
  return {
    unlock() { if (ensure()) startMusic(); },
    isSfxOn: () => prefs.sfx,
    isMusicOn: () => prefs.music,
    toggleSfx() {
      prefs.sfx = !prefs.sfx; savePrefs();
      if (sfxBus) sfxBus.gain.value = prefs.sfx ? 1 : 0;
      return prefs.sfx;
    },
    toggleMusic() {
      prefs.music = !prefs.music; savePrefs();
      if (musicBus) musicBus.gain.setTargetAtTime(prefs.music ? 0.75 : 0, ctx.currentTime, 0.15);
      if (prefs.music) startMusic(); else stopMusic();
      return prefs.music;
    },
    setMood(m) { if (BPM[m]) M.mood = m; },
    setLevel(n) { M.level = n; },

    /* effects */
    ui()     { tone(880, 0.05, 'sine', 0.07); },
    tap()    { tone(660, 0.08, 'triangle', 0.12); },
    select(i) { const f = SCALE[(i || 0) % SCALE.length]; tone(f, 0.35, 'sine', 0.16); tone(f * 2, 0.2, 'triangle', 0.05, null, 0.02); },
    place()  { tone(330, 0.12, 'triangle', 0.14); tone(495, 0.12, 'triangle', 0.14, null, 0.08); tone(660, 0.3, 'sine', 0.16, null, 0.16); },
    good()   { tone(523, 0.12, 'sine', 0.16); tone(784, 0.22, 'sine', 0.16, null, 0.11); },
    bad()    { tone(200, 0.3, 'sawtooth', 0.1, 90); },
    miss()   { tone(300, 0.06, 'square', 0.03, 200); },
    zap()    { tone(900, 0.1, 'square', 0.05, 250); },
    boom()   { if (!prefs.sfx || !ensure()) return; noise(0.3, 0.22, sfxBus, 0, 'lowpass', 1800); tone(140, 0.25, 'square', 0.08, 40); },
    hurt()   { if (!prefs.sfx || !ensure()) return; tone(110, 0.4, 'sawtooth', 0.16, 50); noise(0.25, 0.25, sfxBus, 0, 'lowpass', 900); },
    power()  { tone(440, 0.1, 'sine', 0.14); tone(660, 0.1, 'sine', 0.14, null, 0.09); tone(990, 0.2, 'sine', 0.14, null, 0.18); },
    level()  { tone(392, 0.1, 'triangle', 0.14); tone(523, 0.1, 'triangle', 0.14, null, 0.1); tone(659, 0.18, 'triangle', 0.14, null, 0.2); },
    over()   { tone(330, 0.25, 'triangle', 0.16, 220); tone(220, 0.4, 'triangle', 0.16, 110, 0.25); },
    win()    { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, null, i * 0.12)); }
  };
})();
