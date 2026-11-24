// 展示模式：不需要服务器，也不需要另一个人。
// 在浏览器里本地模拟"服务器 + 旅人"，让观众可以单人体验星象师的视角（全部台子都可以玩）。
// 用法：hq.html?demo，或部署在 *.github.io 上时自动启用。
(function () {
  const cfg = { limit: 780, maxAlarm: 4, traceLen: 5, ringN: 6, stable: 3.0, thr: 0.18, stormFirst: 12, stormEvery: 22, stormWarn: 7, shieldTtl: 2.0, orderTime: 40, orderGoal: 3, ritualN: 3, intro: 0, stages: 6 };
  const SHAPES = ['star', 'dot', 'diamond', 'tri'], COLORS = ['orange', 'sky', 'yellow', 'pink'];
  const R = n => Math.floor(Math.random() * n), rf = (a, b) => a + Math.random() * (b - a), pick = a => a[R(a.length)];
  const shuf = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const now = () => Date.now() / 1000;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let g, handlers = [], connHandlers = [];

  function layout() { const slots = shuf([.17, .5, .83].flatMap(x => [.17, .5, .83].map(y => [x, y]))); return slots.slice(0, 7).map(([x, y]) => [+(x + rf(-.05, .05)).toFixed(3), +(y + rf(-.05, .05)).toFixed(3)]); }
  function ritual() {
    const steps = shuf(['moon', 'lamp', 'bell', 'bowl']).slice(0, 3).map(o => o === 'moon' ? { obj: o, g: 'circle', dir: pick(['cw', 'ccw']), n: pick([1, 2]) } : o === 'lamp' ? { obj: o, g: 'hold', sec: pick([2, 3, 4]) } : o === 'bell' ? { obj: o, g: 'shake', n: pick([3, 4, 5]) } : { obj: o, g: 'pour', dir: pick(['L', 'R']) });
    steps.forEach(s => s.chant = false); shuf([0, 1, 2]).slice(0, 2).forEach(i => steps[i].chant = true); return steps;
  }
  function newTrace() { g.path = shuf([0, 1, 2, 3, 4, 5, 6]).slice(0, cfg.traceLen); g.traceIdx = 0; g.hqPos = layout(); }
  function newTiles() { g.tilesL = [R(4), R(4), R(4), R(4)]; g.tilesR = [R(4), R(4), R(4), R(4)]; if (symCount() === 4) g.tilesR[0] = (g.tilesR[0] + 1) % 4; }
  function newRings() { g.phases = shuf([0, 1, 2, 3, 4, 5]).slice(0, 3); g.cipher = shuf([0, 1, 2, 3, 4, 5]); g.ringOrder = [0, 1, 2].map(() => shuf([0, 1, 2, 3, 4, 5])); g.ringRot = [R(6), R(6), R(6)]; if (ringCount() === 3) g.ringRot[0] = (g.ringRot[0] + 1) % 6; }
  function newStar() { do { g.a0 = rf(.2, .8); g.b0 = rf(.2, .8); } while (Math.hypot(g.a0 - g.a, g.b0 - g.b) < .3); g.theta = pick([-1, 1]) * rf(.5, 1); g.flipx = pick([-1, 1]); g.stableSince = null; }
  function newOrderF() { const i = R(4); g.orderF = { idx: i, target: !g.ctrlH[i], deadline: now() + cfg.orderTime }; }
  function newOrderH() { const i = R(4); g.orderH = { idx: i, target: !g.ctrlF[i], deadline: now() + cfg.orderTime, at: now() + rf(5, 8) }; }
  function fresh() {
    const combos = shuf(SHAPES.flatMap(s => COLORS.map(c => [s, c]))).slice(0, 7);
    g = { tokens: combos.map(([s, c], i) => ({ id: i, shape: s, color: c })), lockedL: [true, false, true, false], lockedR: [false, true, false, true], a: .5, b: .5, alarm: 0, events: [], loc: 'hall', hqView: -1, shield: false, shieldAt: 0, chant: false, chantAt: 0,
      ctrlH: [R(2) === 1, R(2) === 1, R(2) === 1, R(2) === 1], ctrlF: [R(2) === 1, R(2) === 1, R(2) === 1, R(2) === 1], okF: 0, okH: 0, nextHit: now() + cfg.stormFirst, ritual: ritual(), ritIdx: 0 };
    newTrace(); newTiles(); newRings(); newStar(); newOrderF(); newOrderH();
  }
  const ev = (k, p) => { g.events.push({ t: now(), k, p: p || {} }); g.events = g.events.slice(-40); };
  const symCount = () => [0, 1, 2, 3].filter(i => g.tilesR[i] === (g.tilesL[i] ^ 1)).length;
  const ringCount = () => [0, 1, 2].filter(i => g.ringOrder[i][g.ringRot[i]] === g.cipher[g.phases[i]]).length;
  const shieldOn = () => g.shield && now() - g.shieldAt <= cfg.shieldTtl;
  const chantOn = () => g.chant && now() - g.chantAt <= 2.0;
  function starPos() { const dx = g.a - g.a0, dy = g.b - g.b0, c = Math.cos(g.theta), s = Math.sin(g.theta); return [(dx * c - dy * s) * 2.2 * g.flipx, (dx * s + dy * c) * 2.2]; }
  function addAlarm(k, p) { g.alarm++; ev(k, p); if (g.alarm >= cfg.maxAlarm) g.alarm = 0; }

  function pub() {
    const sp = starPos();
    return JSON.parse(JSON.stringify({
      demo: true, now: now(), phase: 'playing', ready: { phone: true, hq: true }, present: { phone: true, hq: true }, stage: 0, alarm: g.alarm, startAt: now() - 120, endAt: null, why: null, loc: g.loc, events: g.events.slice(-30),
      tokens: g.tokens, traceIdx: g.traceIdx, traceLen: cfg.traceLen, sym: symCount(), rings: ringCount(), stableSince: g.stableSince, nextHit: g.nextHit, shield: shieldOn(), okF: g.okF, okH: g.okH, armed: true, hqView: g.hqView, ritIdx: g.ritIdx, ritTotal: 3,
      mine: { pos: g.hqPos, tiles: g.tilesR, locked: g.lockedR, knob: [g.a, g.b], done: g.path.slice(0, g.traceIdx), cipher: g.cipher, ringOrder: g.ringOrder, ringRot: g.ringRot, ctrl: g.ctrlH, order: g.orderH, ritual: g.ritual },
      info: { nextToken: g.path[g.traceIdx], tilesL: g.tilesL, lockedL: g.lockedL, phases: g.phases, star: sp, orderF: g.orderF },
    }));
  }
  const push = () => { const s = pub(); handlers.forEach(f => f(s)); };

  // ---------- 动作（与真实服务器的规则一致，旅人由程序模拟） ----------
  function act(name, d) {
    d = d || {}; const i = d.i;
    if (name === 'view') g.hqView = i;
    else if (name === 'tap') {
      if (d.id === g.path[g.traceIdx]) { g.traceIdx++; if (g.traceIdx >= cfg.traceLen) { ev('traceOK'); setTimeout(() => { newTrace(); push(); }, 1600); } }
      else { addAlarm('traceBad'); g.traceIdx = 0; }
    } else if (name === 'traceReset') g.traceIdx = 0;
    else if (name === 'tile' && isFinite(i) && !g.lockedR[i]) { g.tilesR[i] = (g.tilesR[i] + 1) % 4; if (symCount() === 4) { ev('symOK'); setTimeout(() => { newTiles(); push(); }, 1800); } }
    else if (name === 'ring' && isFinite(i)) { g.ringRot[i] = (g.ringRot[i] + d.d + 6) % 6; if (ringCount() === 3) { ev('ringsOK'); setTimeout(() => { newRings(); push(); }, 1800); } }
    else if (name === 'knob' && !shieldOn()) { g.a = clamp(d.a, 0, 1); g.b = clamp(d.b, 0, 1); }
    else if (name === 'shield') { g.shield = !!d.on; if (g.shield) g.shieldAt = now(); }
    else if (name === 'chant') { g.chant = !!d.on; if (g.chant) g.chantAt = now(); }
    else if (name === 'ctrl' && isFinite(i)) {
      g.ctrlH[i] = !g.ctrlH[i]; ev('toggle', { side: 'hq', idx: i, on: g.ctrlH[i] });
      if (g.orderF && g.orderF.idx === i && g.ctrlH[i] === g.orderF.target) { g.okF++; ev('orderOK', { side: 'phone', idx: i }); newOrderF(); }
    }
    push();
  }

  // ---------- 旅人 / 服务器的节拍 ----------
  function tick() {
    // 稳定计时：星对准并保持 3 秒
    const [x, y] = starPos();
    if (Math.hypot(x, y) < cfg.thr) { if (g.stableSince === null) g.stableSince = now(); else if (now() - g.stableSince >= cfg.stable) { ev('tuneOK'); newStar(); } } else g.stableSince = null;
    // 风暴
    if (now() >= g.nextHit) { g.nextHit = now() + cfg.stormEvery; if (shieldOn()) ev('shielded'); else { g.a0 = clamp(g.a0 + pick([-1, 1]) * rf(.18, .3), .12, .88); g.b0 = clamp(g.b0 + pick([-1, 1]) * rf(.18, .3), .12, .88); g.stableSince = null; addAlarm('stormHit'); } }
    // 虚拟旅人：替总部完成他的星令
    if (g.orderH && now() >= g.orderH.at) { const o = g.orderH; g.ctrlF[o.idx] = o.target; ev('toggle', { side: 'phone', idx: o.idx, on: o.target }); g.okH++; ev('orderOK', { side: 'hq', idx: o.idx }); newOrderH(); }
    if (g.orderF && now() > g.orderF.deadline) newOrderF();
    push();
  }
  function wanderer() { g.loc = pick(['hall', 'gallery', 'mirror', 'moon', 'star', 'orders', 'altar'].filter(l => l !== g.loc)); push(); }
  function rite() {   // 虚拟旅人在祭坛上做手势；需要吟唱的步骤，总部没按住就"沉默"
    if (g.ritIdx >= g.ritual.length) { ev('ritualWin'); g.ritIdx = 0; g.ritual = ritual(); return push(); }
    const st = g.ritual[g.ritIdx]; if (st.chant && !chantOn()) { ev('ritNoChant'); return push(); }
    g.ritIdx++; ev('ritOK'); push();
  }

  // ---------- 与 NET 同接口 ----------
  window.NET = {
    async init() {
      fresh(); setInterval(tick, 700); setInterval(wanderer, 7000); setInterval(rite, 6000);
      ev('start'); setTimeout(() => { connHandlers.forEach(f => f(true)); push(); }, 50);
      setTimeout(() => { try { if (!sessionStorage.getItem('demo-intro')) { sessionStorage.setItem('demo-intro', '1'); KIT.intro('hq', () => {}); } } catch (_) {} }, 400);
      return cfg;
    },
    onState(f) { handlers.push(f); if (g) f(pub()); }, onConn(f) { connHandlers.push(f); },
    act(name, data) { try { act(name, data); } catch (e) { console.error(e); } return Promise.resolve(); },
    now, get state() { return pub(); }, get cfg() { return cfg; }, get connected() { return true; },
  };

  // 顶部横幅
  const bar = document.createElement('div'); bar.id = 'demoBar';
  bar.innerHTML = `<b>DEMO</b> ${L('星象师视角 · 完整游戏需要两个人（手机 + 电脑）', 'Stargazer view · the full game needs two players (phone + laptop)')} <a href="index.html" target="_top">${L('案例介绍', 'Case study')}</a><a href="https://github.com/Albedovo/gate-of-stars" target="_blank" rel="noopener">GitHub</a>`;
  const st = document.createElement('style'); st.textContent = `#demoBar{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:20;background:#06060ee8;border:2.5px solid #eeb23a;color:#e8dfc7;border-radius:22px;padding:6px 8px 6px 16px;font:600 12.5px "PingFang SC",Futura,sans-serif;white-space:nowrap;display:flex;gap:12px;align-items:center}#demoBar b{color:#eeb23a;letter-spacing:.12em}#demoBar a{color:#06060e;background:#eeb23a;border-radius:14px;padding:3px 12px;text-decoration:none;font-weight:800}.demonote{margin:0 0 8px;padding:6px 12px;border:3px dashed #06060e66;border-radius:14px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.demonote:empty{display:none}.demonote small{font-weight:900;color:#b8501c;letter-spacing:.1em}body:has(#focus:not([hidden])) #demoBar,body:has(#book:not([hidden])) #demoBar{display:none}@media(max-width:700px){#demoBar{bottom:78px;font-size:11px;padding:5px 6px 5px 10px;gap:8px}}`;
  document.head.appendChild(st); if (window.top === window) document.body.appendChild(bar);
  document.addEventListener('langchange', () => { bar.innerHTML = `<b>DEMO</b> ${L('星象师视角 · 完整游戏需要两个人（手机 + 电脑）', 'Stargazer view · the full game needs two players (phone + laptop)')} <a href="index.html" target="_top">${L('案例介绍', 'Case study')}</a><a href="https://github.com/Albedovo/gate-of-stars" target="_blank" rel="noopener">GitHub</a>`; });
})();
