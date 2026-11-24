// 公共库：双语 L()、实时联网 NET、音效 SFX、空灵的宇宙感背景音乐 MUSIC
(function () {
  // ---------- 双语 ----------
  let lang = localStorage.getItem('lang') || 'en';
  window.LANG = {
    get: () => lang,
    set(l) { lang = l; localStorage.setItem('lang', l); document.documentElement.lang = l; document.dispatchEvent(new Event('langchange')); },
    toggle() { this.set(lang === 'zh' ? 'en' : 'zh'); },
  };
  window.L = (zh, en) => (lang === 'zh' ? zh : en);
  document.documentElement.lang = lang;

  // ---------- 联网（SSE 接收 + POST 发送） ----------
  let role, cfg = null, state = null, offset = 0, connected = false;
  const sh = [], ch = [];
  window.NET = {
    async init(r) {
      role = r;
      cfg = await (await fetch('/api/config')).json();
      const es = new EventSource('/events?role=' + role);
      es.onopen = () => { connected = true; ch.forEach(f => f(true)); };
      es.onerror = () => { connected = false; ch.forEach(f => f(false)); };
      es.onmessage = e => { state = JSON.parse(e.data); offset = state.now * 1000 - Date.now(); sh.forEach(f => f(state)); };
      return cfg;
    },
    onState(f) { sh.push(f); if (state) f(state); },
    onConn(f) { ch.push(f); },
    act(name, data) {
      return fetch('/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, act: name, data: data || {} }) }).catch(() => {});
    },
    now: () => (Date.now() + offset) / 1000,   // 与服务器对齐的当前时间（秒）
    get state() { return state; },
    get cfg() { return cfg; },
    get connected() { return connected; },
  };

  // ---------- 音效：柔和的合成音（正弦 / 三角波，带一点回响感），不抢背景音乐 ----------
  let ctx;
  const ac = () => { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  function tone(f, d, type = 'sine', v = 0.1, at = 0, f2) {
    try {
      const x = ac(), o = x.createOscillator(), g = x.createGain(), t0 = x.currentTime + at;
      o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g).connect(x.destination); o.start(t0); o.stop(t0 + d + 0.05);
    } catch (_) {}
  }
  const NOTE = { R: 262, B: 330, Y: 392, G: 523 };
  const PENTA = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];   // A 小调五声
  window.SFX = {
    unlock() { try { ac(); } catch (_) {} if (window.MUSIC) MUSIC.kick(); },
    click() { tone(420, 0.09, 'sine', 0.08); tone(630, 0.12, 'sine', 0.05, 0.03); },
    ok() { tone(392, 0.5, 'sine', 0.09); tone(523, 0.6, 'sine', 0.08, 0.12); tone(659, 0.9, 'sine', 0.07, 0.24); },
    bad() { tone(196, 0.6, 'sine', 0.12, 0, 130); tone(98, 0.7, 'triangle', 0.08); },
    siren() { tone(330, 0.9, 'sine', 0.04, 0, 392); },
    note(k) { tone(NOTE[k] || 300, 0.6, 'triangle', 0.1); },
    thud() { tone(80, 0.35, 'sine', 0.16, 0, 45); },
    pitch(i) { tone(PENTA[((i % 8) + 8) % 8] * 2, 0.9, 'sine', 0.09); tone(PENTA[((i % 8) + 8) % 8] * 4, 0.6, 'sine', 0.03, 0.02); },
    tick() { tone(880, 0.12, 'sine', 0.04); },
    whoosh() { tone(180, 0.7, 'sine', 0.04, 0, 520); },
  };

  // ---------- 背景音乐：空灵 / 宇宙感（程序生成，无需音频文件） ----------
  // 低沉的持续音 + 缓慢呼吸的和弦垫底 + 稀疏的钟音（A 小调五声）+ 长回响。
  // 'tense' 情绪：节奏更密，加入低频脉动。
  window.MUSIC = (function () {
    let c, master, bus, started = false, role = 'hq', mood = 'calm', muted = localStorage.getItem('mute') === '1', chordIdx = 0, pulse;
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    const CHORDS = [[45, 52, 57, 60, 64, 67], [41, 48, 57, 60, 64], [48, 55, 59, 64, 67], [43, 50, 59, 62, 66]];   // Am9 · Fmaj7 · Cmaj7 · G6
    function reverb(x) {
      const len = Math.floor(x.sampleRate * 4.2), buf = x.createBuffer(2, len, x.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      const cv = x.createConvolver(); cv.buffer = buf; return cv;
    }
    function init() {
      c = ac(); master = c.createGain(); master.gain.value = muted ? 0 : (role === 'phone' ? 0.5 : 0.7); master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 4; comp.connect(master);
      bus = c.createGain(); bus.connect(comp);
      const rv = reverb(c), wet = c.createGain(); wet.gain.value = 0.85; rv.connect(wet); wet.connect(comp);
      const dl = c.createDelay(2); dl.delayTime.value = 0.62; const fb = c.createGain(); fb.gain.value = 0.42; const dlf = c.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2600;
      dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(wet);
      MUSIC._send = c.createGain(); MUSIC._send.connect(rv); MUSIC._send.connect(dl);   // 送往回响与延迟
      // 持续的低音 + 一点点空洞的五度
      [[110, 0.07], [164.8, 0.035], [55, 0.06]].forEach(([f, v], i) => {
        const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
        o.type = 'sine'; o.frequency.value = f; g.gain.value = v; l.frequency.value = 0.05 + i * 0.03; lg.gain.value = v * 0.6; l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(bus); g.connect(MUSIC._send); o.start(); l.start();
      });
      // 低频脉动（紧张时才有）
      const po = c.createOscillator(), pg = c.createGain(), pl = c.createOscillator(), pa = c.createGain(); po.frequency.value = 49; pg.gain.value = 0; pl.frequency.value = 1.3; pa.gain.value = 0.05; pl.connect(pa); pa.connect(pg.gain); po.connect(pg); pg.connect(bus); po.start(); pl.start(); pulse = pg;
      chord(); sparkle();
    }
    function voice(freq, dur, vol, type, lp) {
      const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), t0 = c.currentTime;
      o.type = type; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 1.003; f.type = 'lowpass'; f.frequency.value = lp;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.38); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(bus); g.connect(MUSIC._send); o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
    }
    function chord() {
      if (!started) return; const ch = CHORDS[chordIdx++ % CHORDS.length], tense = mood === 'tense', dur = tense ? 7 : 11;
      ch.forEach((n, i) => voice(midi(n + (role === 'phone' ? 12 : 0)), dur, (role === 'phone' ? 0.022 : 0.03) / (1 + i * 0.15), i % 2 ? 'triangle' : 'sine', tense ? 1500 : 900));
      setTimeout(chord, dur * 800);
    }
    function sparkle() {
      if (!started) return; const tense = mood === 'tense', f = PENTA[Math.floor(Math.random() * PENTA.length)] * (Math.random() < .5 ? 2 : 4);
      const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime; o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(role === 'phone' ? 0.05 : 0.035, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3);
      o.connect(g); g.connect(MUSIC._send); g.connect(bus); o.start(t0); o.stop(t0 + 3.2);
      setTimeout(sparkle, (tense ? 900 : 2200) + Math.random() * (tense ? 1400 : 3600));
    }
    return {
      role: r => { role = r; },
      kick() { if (started || !window.AudioContext && !window.webkitAudioContext) return; started = true; try { init(); } catch (e) { started = false; } },
      setMood(m) { if (m === mood) return; mood = m; if (pulse) pulse.gain.linearRampToValueAtTime(m === 'tense' ? 0.9 : 0, c.currentTime + 2.5); },
      toggle() { muted = !muted; localStorage.setItem('mute', muted ? '1' : '0'); if (master) master.gain.linearRampToValueAtTime(muted ? 0 : (role === 'phone' ? 0.5 : 0.7), c.currentTime + 0.6); if (!muted) this.kick(); return muted; },
      get muted() { return muted; },
    };
  })();
})();
