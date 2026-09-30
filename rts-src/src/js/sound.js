'use strict';
// ===================================================================
//  효과음 — WebAudio 합성 (외부 파일 없음)
// ===================================================================
const SND = (() => {
  let ac = null, master = null, noiseBuf = null;
  let enabled = true, vol = 0.35;
  const last = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noise(dur, freq, q, peak, type, sweep) {
    const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ac.createGain(); env(g, t, 0.004, dur, peak);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function tone(dur, f0, f1, peak, type) {
    const t = ac.currentTime, o = ac.createOscillator(); o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.005, dur, peak);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const LIB = {
    gun: () => { noise(0.06, 2400, 1.5, 0.5); noise(0.05, 900, 1, 0.3); },
    melee: () => noise(0.08, 1800, 2, 0.35, 'bandpass', 600),
    flame: () => noise(0.25, 700, 0.7, 0.35, 'lowpass', 300),
    spine: () => noise(0.08, 3000, 3, 0.25, 'bandpass', 1500),
    spit: () => { noise(0.1, 1200, 2, 0.3, 'bandpass', 500); },
    grenade: () => { noise(0.12, 500, 1, 0.5, 'lowpass', 200); },
    shell: () => { noise(0.15, 400, 1, 0.6, 'lowpass', 120); tone(0.08, 180, 60, 0.2); },
    siege: () => { noise(0.35, 300, 0.8, 0.8, 'lowpass', 60); tone(0.2, 120, 40, 0.35, 'sawtooth'); },
    missile: () => noise(0.2, 2500, 1, 0.3, 'highpass', 800),
    laser: () => tone(0.1, 1800, 400, 0.15, 'sawtooth'),
    glaive: () => { noise(0.12, 900, 3, 0.3); tone(0.1, 500, 200, 0.1, 'triangle'); },
    plasma: () => tone(0.14, 900, 300, 0.18, 'sine'),
    particle: () => tone(0.1, 1200, 600, 0.12, 'sine'),
    tentacle: () => noise(0.2, 250, 1.5, 0.5, 'lowpass', 90),
    spore: () => noise(0.12, 1400, 2, 0.3),
    neutron: () => tone(0.12, 1500, 500, 0.12, 'triangle'),
    interceptor: () => tone(0.05, 2000, 1500, 0.06, 'square'),
    yamato: () => { tone(0.6, 80, 400, 0.4, 'sawtooth'); noise(0.6, 400, 0.5, 0.4, 'lowpass', 2000); },
    lock: () => tone(0.3, 300, 1200, 0.2, 'sine'),
    boom: () => { noise(0.4, 400, 0.7, 0.7, 'lowpass', 60); },
    bigboom: () => { noise(0.9, 300, 0.6, 0.9, 'lowpass', 40); tone(0.5, 80, 30, 0.4, 'sawtooth'); },
    splat: () => { noise(0.25, 600, 1, 0.5, 'lowpass', 150); tone(0.15, 200, 60, 0.15, 'sine'); },
    die: () => { tone(0.25, 400, 120, 0.2, 'sawtooth'); noise(0.1, 800, 1, 0.2); },
    build: () => { for (let k = 0; k < 3; k++) setTimeout(() => ac && noise(0.05, 3000, 4, 0.2), k * 90); },
    load: () => tone(0.15, 300, 600, 0.15, 'triangle'),
    zmorph: () => noise(0.35, 300, 2, 0.35, 'bandpass', 900),
    storm: () => { noise(1.2, 3000, 0.5, 0.3, 'highpass', 900); },
    scan: () => tone(0.5, 600, 1800, 0.18, 'sine'),
    err: () => tone(0.12, 220, 180, 0.2, 'square'),
    click: () => tone(0.03, 1200, 1000, 0.08, 'square'),
    ready: () => { tone(0.08, 660, 0, 0.15, 'triangle'); setTimeout(() => ac && tone(0.12, 990, 0, 0.15, 'triangle'), 90); },
    alert: () => { tone(0.18, 880, 0, 0.25, 'square'); setTimeout(() => ac && tone(0.18, 660, 0, 0.25, 'square'), 200); },
    gunbig: () => { noise(0.1, 800, 1, 0.5, 'lowpass'); },
    done: () => { tone(0.1, 520, 0, 0.15, 'triangle'); setTimeout(() => ac && tone(0.16, 780, 0, 0.15, 'triangle'), 110); },
  };
  function play(name, x, y) {
    if (!enabled || !ac || ac.state !== 'running') return;
    let fn = LIB[name];
    if (!fn) { if (name === 'fx' || !name) return; fn = LIB.melee; }
    if (x !== undefined && typeof VIEW !== 'undefined') {
      const m = 200;
      if (x < VIEW.x - m || x > VIEW.x + VIEW.w + m || y < VIEW.y - m || y > VIEW.y + VIEW.h + m) return;
    }
    const now = performance.now();
    if (last[name] && now - last[name] < 60) return;
    last[name] = now;
    try { fn(); } catch (e) { /* ignore */ }
  }
  return { init, play, get enabled() { return enabled; }, set enabled(v) { enabled = v; }, setVolume(v) { vol = v; if (master) master.gain.value = v; } };
})();
