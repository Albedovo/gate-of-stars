// 《星门》共用画风积木：深蓝黑菱形格 / 奶油云团 / 橙黄圆点 / 四角星 / 蜡笔颗粒
(function () {
  // 降低明度后的调色板：大面积用深色，亮色只留给要强调的东西（可点击处、当前目标、文字）
  //   ink/navy/blue 做背景层次；paper/dust 是大面积的"暗奶油"，不会晃眼；cream/yellow/orange 只用于重点
  const C = { ink: '#06060e', navy: '#0c1658', blue: '#1b3380', sky: '#4a7db0', cream: '#e8dfc7', peach: '#d9bd8a', yellow: '#eeb23a', orange: '#dc6b2c', pink: '#d397a9', paper: '#c9bea1', dust: '#8a8574', deep: '#08103a' };
  const TOK = { orange: C.orange, sky: C.sky, yellow: C.yellow, pink: C.pink };
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

  const star4 = (x, y, r, fill, w = .2, extra = '') => `<path d="M${x} ${y - r}Q${x + r * w} ${y - r * w} ${x + r} ${y}Q${x + r * w} ${y + r * w} ${x} ${y + r}Q${x - r * w} ${y + r * w} ${x - r} ${y}Q${x - r * w} ${y - r * w} ${x} ${y - r}z" fill="${fill}" ${extra}/>`;
  const diamond = (x, y, w, h, fill, extra = '') => `<path d="M${x} ${y - h / 2}L${x + w / 2} ${y}L${x} ${y + h / 2}L${x - w / 2} ${y}z" fill="${fill}" ${extra}/>`;
  const dot = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const tri = (x, y, r, fill, extra = '') => `<path d="M${x} ${y - r}L${x + r * .95} ${y + r * .7}L${x - r * .95} ${y + r * .7}z" fill="${fill}" ${extra}/>`;
  const cross = (x, y, r, fill, extra = '') => `<path d="M${x - r * .3} ${y - r}h${r * .6}v${r * .7}h${r * .7}v${r * .6}h${-r * .7}v${r * .7}h${-r * .6}v${-r * .7}h${-r * .7}v${-r * .6}h${r * .7}z" fill="${fill}" ${extra}/>`;
  const harlequin = (w, h, s, c1, c2) => { let o = `<rect width="${w}" height="${h}" fill="${c2}"/>`; for (let j = -1; j <= 2 * h / s + 1; j++) for (let i = -1; i <= 2 * w / s + 1; i++) if (((i + j) % 2 + 2) % 2 === 0 && ((i % 2) + 2) % 2 === 0) { const x = i * s / 2, y = j * s / 2; o += `<path d="M${x} ${y - s / 2}L${x + s / 2} ${y}L${x} ${y + s / 2}L${x - s / 2} ${y}z" fill="${c1}"/>`; } return o; };
  const wisp = (x, y, sx, sy, fill, op = 1) => `<path transform="translate(${x},${y}) scale(${sx},${sy})" d="M0 60C60 8 140 6 200 38C240 58 280 36 330 70C262 104 200 82 140 102C80 124 30 104 0 60z" fill="${fill}" opacity="${op}"/>`;
  const cloud = (x, y, s, fill) => `<path transform="translate(${x},${y}) scale(${s})" d="M0 120C-10 62 50 22 110 42C140 2 220 2 250 52C300 42 340 82 320 120C280 150 60 150 0 120z" fill="${fill}"/>`;
  const scatter = (n, w, h, fills, r0, r1, kind = 'dot') => { let o = ''; for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = r0 + rnd() * (r1 - r0), f = fills[Math.floor(rnd() * fills.length)]; o += kind === 'star' ? star4(x, y, r, f, .18) : dot(x, y, r, f); } return o; };
  const strokes = list => list.map(([x1, y1, x2, y2, w, c, o]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" opacity="${o}" stroke-linecap="round"/>`).join('');
  const txt = (x, y, s, t, fill, o = {}) => `<text x="${x}" y="${y}" font-size="${s}" fill="${fill}" text-anchor="${o.a || 'middle'}" font-weight="${o.w || 700}" letter-spacing="${o.ls || 0}" ${o.f === false ? '' : 'filter="url(#rough)"'}>${t}</text>`;
  const pill = (x, y, w, h, fill, stroke, sw = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" filter="url(#rough)"/>`;
  const reseed = n => { seed = n; };

  // ---------- 游戏元素 ----------
  // 星点 token：形状 × 颜色，ink 描边，保证在深浅底色上都清晰
  const token = (shape, color, x, y, r) => {
    const f = TOK[color] || C.orange, st = `stroke="${C.ink}" stroke-width="${Math.max(2, r * .13)}" stroke-linejoin="round"`;
    if (shape === 'star') return star4(x, y, r * 1.25, f, .26, st);
    if (shape === 'dot') return dot(x, y, r * .82, f, st);
    if (shape === 'diamond') return diamond(x, y, r * 1.7, r * 1.9, f, st);
    return tri(x, y, r * 1.1, f, st);
  };
  // 星环符号（6 种）：0 星 1 点 2 菱形 3 三角 4 十字 5 新月
  const glyph = (g, x, y, r, fill, extra = '') => [
    () => star4(x, y, r * 1.2, fill, .24, extra), () => dot(x, y, r * .8, fill, extra), () => diamond(x, y, r * 1.6, r * 1.8, fill, extra),
    () => tri(x, y, r * 1.05, fill, extra), () => cross(x, y, r * .95, fill, extra),
    () => `<path d="M${x + r * .2} ${y - r}A${r} ${r} 0 1 0 ${x + r * .2} ${y + r}A${r * .72} ${r * .8} 0 1 1 ${x + r * .2} ${y - r}z" fill="${fill}" ${extra}/>`,
  ][g]();
  // 月相：0 新月 1 右娥眉 2 上弦 3 盈凸 4 满月 5 左残月
  const moon = (p, x, y, r, lit = C.cream, dark = C.ink) => {
    const ring = `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark}" stroke="#f5eedd77" stroke-width="2"/>`;
    if (p === 0) return ring;
    if (p === 4) return `<circle cx="${x}" cy="${y}" r="${r}" fill="${lit}" stroke="#f5eedd77" stroke-width="2"/>`;
    const t = { 1: .55, 2: 0, 3: -.55, 5: .55 }[p], rx = Math.abs(t) * r, sweep = t >= 0 ? 0 : 1;
    const path = `<path d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}A${rx} ${r} 0 0 ${sweep} ${x} ${y - r}z" fill="${lit}"/>`;
    return ring + (p === 5 ? `<g transform="translate(${2 * x},0) scale(-1,1)">${path}</g>` : path);
  };
  // 对称瓷片：0 ↖ 1 ↗ 2 ↘ 3 ↙
  const DIRS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const comet = (d, x, y, s, locked) => {
    const [dx, dy] = DIRS[d], ex = x + dx * s * .3, ey = y + dy * s * .3;
    return `${diamond(x, y, s, s, C.ink, `stroke="${locked ? C.orange : C.cream}" stroke-width="${locked ? 5 : 3}"`)}
      <path d="M${x} ${y}L${ex} ${ey}" stroke="${C.orange}" stroke-width="${s * .07}" stroke-linecap="round"/>${star4(ex, ey, s * .2, C.yellow, .22)}${dot(x, y, s * .05, C.cream)}
      ${locked ? `<g transform="translate(${x},${y + s * .27})"><rect x="-8" y="-3" width="16" height="12" rx="2" fill="${C.orange}"/><path d="M-5 -3V-8a5 5 0 0 1 10 0V-3" fill="none" stroke="${C.orange}" stroke-width="3"/></g>` : ''}`;
  };

  // ---------- 名称（双语） ----------
  const N = {
    color: c => ({ orange: L('橙', 'Orange'), sky: L('天蓝', 'Sky'), yellow: L('黄', 'Yellow'), pink: L('粉', 'Pink') })[c],
    shape: s => ({ star: L('四角星', 'star'), dot: L('圆点', 'dot'), diamond: L('菱形', 'diamond'), tri: L('三角', 'triangle') })[s],
    phase: p => [L('新月', 'New moon'), L('右娥眉', 'Right crescent'), L('上弦（半月）', 'Half moon'), L('盈凸（大半）', 'Gibbous'), L('满月', 'Full moon'), L('左残月', 'Left crescent')][p],
    glyph: g => [L('星', 'Star'), L('点', 'Dot'), L('菱形', 'Diamond'), L('三角', 'Triangle'), L('十字', 'Cross'), L('新月', 'Crescent')][g],
    ctrlH: i => [L('北斗', 'Dipper'), L('参宿', 'Orion'), L('织女', 'Vega'), L('天狼', 'Sirius')][i],
    ctrlF: i => [L('昴宿', 'Pleiades'), L('心宿', 'Antares'), L('河鼓', 'Altair'), L('北极', 'Polaris')][i],
    // 总部的台子 ↔ 手机上的房间：两边用同一套对应关系
    station: i => [L('星图桌', 'Star Table'), L('对称碑', 'Mirror Steles'), L('星环仪', 'Orrery'), L('调频台', 'Tuning Console'), L('星令台', 'Order Console'), L('祭仪卷轴', 'Ritual Scroll')][i],
    room: i =>[L('星座廊', 'Gallery'), L('镜厅', 'Mirror Hall'), L('月室', 'Moon Chamber'), L('星门', 'The Gate'), L('星令殿', 'Order Hall'), L('祭坛', 'Altar')][i],
    stage: i =>['', L('描星', 'Trace'), L('对称门', 'Mirror'), L('星环月相', 'Moon Rings'), L('调频校准', 'Tuning'), L('星令传递', 'Orders'), L('祭仪', 'Ritual')][i],
  };

  // ---------- 蜡笔滤镜（页面里放一份，所有 SVG 共用） ----------
  function install() {
    if (document.getElementById('kitDefs')) return;
    document.body.insertAdjacentHTML('afterbegin', `<svg id="kitDefs" width="0" height="0" style="position:absolute"><defs>
      <filter id="rough" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
      <filter id="crayon" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" result="d"/>
        <feTurbulence type="fractalNoise" baseFrequency=".34" numOctaves="2" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  7 0 0 0 -.8" result="ga"/><feComposite in="d" in2="ga" operator="in"/></filter>
    </defs></svg>`);
  }

  // ---------- 开场过场：交代故事背景（两边同步各自讲述自己的角色，可点击跳过）----------
  function intro(role, onDone) {
    const hq = role === 'hq', W = hq ? 960 : 360, H = hq ? 600 : 740, cx = W / 2, cy = hq ? 270 : 330, gh = hq ? 250 : 270, gw = hq ? 150 : 130;
    const lines = [
      [L('很久以前，天空里有一扇门。', 'Long ago, there was a gate in the sky.')],
      [L('每个黎明它只开一次，让迷路的星星回家。', 'Once each dawn it opened, to let lost stars find their way home.')],
      [L('今夜，门被封死了。', 'Tonight, the gate is sealed.'), L('它的两位看守，被隔在门的两侧。', 'Its two keepers are parted on either side.')],
      hq ? [L('你是星象师。', 'You are the Stargazer.'), L('你站在观星台，读得懂整片星空，却看不见门里发生了什么。', 'From the observatory you can read the whole sky, but not what happens inside the gate.')]
         : [L('你是旅人。', 'You are the Wanderer.'), L('你被困在星门厅里，看得见一切，却读不懂星图。', 'Trapped in the gate hall, you see everything — but cannot read the stars.')],
      [L('只有你们的声音，能穿过这道门。', 'Only your voices can cross the gate.')],
      [L('黎明将至。', 'Dawn is coming.')],
    ];
    const STEP = 3.1, TOTAL = 1.2 + lines.length * STEP + 1.2;
    K_reseed(77);
    const art = `<g filter="url(#crayon)">${harlequin(W, H, hq ? 110 : 96, '#05050c', '#080d33')}</g>
      ${scatter(hq ? 60 : 34, W, H, [C.cream, C.yellow, C.peach], 1.2, 3.4)}${scatter(hq ? 9 : 6, W, H, [C.yellow, C.cream], 5, 12, 'star')}
      <circle class="ig-core" cx="${cx}" cy="${cy}" r="${gh * .62}" fill="${C.yellow}" opacity="0"/>
      <g class="ig-core2" style="transform-origin:${cx}px ${cy}px">${star4(cx, cy, gh * .7, '#fff1c0', .1)}</g>
      <g class="ig-l" style="--dx:-1">${`<path d="M${cx} ${cy - gh} L${cx - gw} ${cy} L${cx} ${cy + gh} Z" fill="${C.navy}" stroke="${C.dust}" stroke-width="4"/><path d="M${cx} ${cy - gh * .72} L${cx - gw * .68} ${cy} L${cx} ${cy + gh * .72} Z" fill="${C.ink}"/>`}</g>
      <g class="ig-r" style="--dx:1">${`<path d="M${cx} ${cy - gh} L${cx + gw} ${cy} L${cx} ${cy + gh} Z" fill="${C.navy}" stroke="${C.dust}" stroke-width="4"/><path d="M${cx} ${cy - gh * .72} L${cx + gw * .68} ${cy} L${cx} ${cy + gh * .72} Z" fill="${C.ink}"/>`}</g>`;
    const el = document.createElement('div');
    el.id = 'intro'; el.style.cssText = 'position:fixed;inset:0;z-index:95;background:#05050c;overflow:hidden;cursor:pointer;opacity:0;transition:opacity 1s;font-family:"PingFang SC",Futura,"Noto Sans SC",sans-serif';
    el.innerHTML = `<style>
        #intro svg{position:absolute;inset:0;width:100%;height:100%}
        #intro .ig-l,#intro .ig-r{animation:igPart ${TOTAL}s ease-in forwards}
        @keyframes igPart{0%,55%{transform:translateX(0)}100%{transform:translateX(calc(var(--dx)*${hq ? 70 : 52}px))}}
        #intro .ig-core{animation:igCore ${TOTAL}s ease-in forwards}
        @keyframes igCore{0%,50%{opacity:0}100%{opacity:.5}}
        #intro .ig-core2{opacity:0;animation:igCore2 ${TOTAL}s ease-in forwards}
        @keyframes igCore2{0%,48%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:scale(1)}}
        #intro .itxt{position:absolute;left:0;right:0;bottom:${hq ? 70 : 150}px;text-align:center;padding:0 ${hq ? 120 : 28}px;color:#e8dfc7;font-size:${hq ? 28 : 21}px;line-height:1.75;letter-spacing:.14em;font-weight:600;text-shadow:0 2px 14px #000}
        #intro .itxt p{margin:.15em 0;opacity:0;transition:opacity 1.2s;text-wrap:balance;word-break:keep-all;overflow-wrap:anywhere}#intro .itxt p.on{opacity:1}#intro .itxt p.big{color:#eeb23a;font-weight:800}
        #intro .iskip{position:absolute;right:20px;top:18px;color:#d9bd8a;font-size:13px;letter-spacing:.1em;opacity:.8;border:2px solid #d9bd8a66;border-radius:16px;padding:3px 12px}
        #intro .ibar{position:absolute;left:0;bottom:0;height:4px;background:#dc6b2c;width:0;animation:igBar ${TOTAL}s linear forwards}@keyframes igBar{to{width:100%}}
      </style><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${art}</svg><div class="itxt"></div><div class="iskip">${L('点击跳过', 'tap to skip')}</div><div class="ibar"></div>`;
    document.body.appendChild(el); requestAnimationFrame(() => { el.style.opacity = 1; });
    const box = el.querySelector('.itxt'), timers = []; let done = false;
    const finish = () => { if (done) return; done = true; timers.forEach(clearTimeout); el.style.opacity = 0; setTimeout(() => { el.remove(); if (onDone) onDone(); }, 1000); };
    lines.forEach((ls, i) => {
      timers.push(setTimeout(() => { box.innerHTML = ls.map((t, j) => `<p class="${i === 3 && j === 0 ? 'big' : ''}">${t}</p>`).join(''); [...box.children].forEach((p, j) => setTimeout(() => p.classList.add('on'), 60 + j * 900)); }, (1.2 + i * STEP) * 1000));
      timers.push(setTimeout(() => { [...box.children].forEach(p => p.classList.remove('on')); }, (1.2 + i * STEP + STEP - 0.7) * 1000));
    });
    timers.push(setTimeout(finish, TOTAL * 1000));
    el.addEventListener('click', finish);
    return { el, finish };
  }
  const K_reseed = reseed;

  window.KIT = { C, TOK, star4, diamond, dot, tri, cross, harlequin, wisp, cloud, scatter, strokes, txt, pill, reseed, token, glyph, moon, comet, N, install, intro, rnd: () => rnd() };
})();
