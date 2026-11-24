#!/usr/bin/env python3
"""星门 / Gate of Stars — 静态文件 + 实时同步 (SSE) + 服务器权威游戏状态。

六关：1 描星  2 对称门  3 星环月相  4 调频校准(+风暴)  5 星令传递  6 祭仪
Run:  python3 server.py        (默认端口 8000，可用 PORT=9000 覆盖)
Phone: http://<LAN-IP>:8000/phone.html     HQ: http://localhost:8000/hq.html
"""
import json, math, os, queue, random, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT', 8000))

SHAPES = ['star', 'dot', 'diamond', 'tri']
COLORS = ['orange', 'sky', 'yellow', 'pink']
CONFIG = {
    'limit': 780,         # 总时限（秒）= 黎明（13 分钟，试玩反馈：原来太紧）
    'maxAlarm': 4,
    'traceLen': 5,        # 1 描星：路径长度
    'ringN': 6,           # 3 星环：每圈符号数
    'stable': 3.0,        # 4 调频：星要稳定多少秒
    'thr': 0.16,          # 4 调频：判定"对准"的距离阈值
    'stormFirst': 35,     # 4 第一次风暴在进入本关多少秒后
    'stormEvery': 26,     # 4 风暴间隔（秒）
    'stormWarn': 7,       # 4 风暴预警（秒）
    'shieldTtl': 2.0,     # 4 护盾心跳有效期
    'orderTime': 32,      # 5 每条星令的时限（秒）
    'orderGoal': 3,       # 5 双方各需完成几条
    'ritualN': 3,         # 6 祭仪步骤数
    'intro': 21,          # 开场过场秒数：期间游戏计时不走
    'stages': 6,
}
if os.environ.get('GATE_FAST'):   # 仅用于自动化测试：缩短风暴 / 星令时间
    CONFIG.update(stormFirst=5, stormEvery=7, stormWarn=3, orderTime=8, intro=0.3)
LOCS = ('hall', 'gallery', 'mirror', 'moon', 'star', 'orders', 'altar')
RIT_OBJ = ['moon', 'lamp', 'bell', 'bowl']

LOCK = threading.RLock()
CLIENTS = []
G = None


def now():
    return time.time()


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def layout():
    slots = [(x, y) for x in (.17, .5, .83) for y in (.17, .5, .83)]
    random.shuffle(slots)
    return [[round(x + random.uniform(-.05, .05), 3), round(y + random.uniform(-.05, .05), 3)] for x, y in slots[:7]]


def make_ritual():
    steps = []
    for o in random.sample(RIT_OBJ, CONFIG['ritualN']):
        if o == 'moon':
            st = {'obj': o, 'g': 'circle', 'dir': random.choice(['cw', 'ccw']), 'n': random.choice([1, 2])}
        elif o == 'lamp':
            st = {'obj': o, 'g': 'hold', 'sec': random.choice([2, 3, 4])}
        elif o == 'bell':
            st = {'obj': o, 'g': 'shake', 'n': random.choice([3, 4, 5])}
        else:
            st = {'obj': o, 'g': 'pour', 'dir': random.choice(['L', 'R'])}
        st['chant'] = False
        steps.append(st)
    for i in random.sample(range(len(steps)), 2):   # 其中两步需要星象师同时吟唱
        steps[i]['chant'] = True
    return steps


def fresh():
    combos = [(s, c) for s in SHAPES for c in COLORS]
    random.shuffle(combos)
    tokens = [{'id': i, 'shape': s, 'color': c} for i, (s, c) in enumerate(combos[:7])]
    L = [random.randrange(4) for _ in range(4)]
    R = [random.randrange(4) for _ in range(4)]
    while all(R[i] == L[i] ^ 1 for i in range(4)):
        R[0] = (R[0] + 1) % 4
    while True:
        a0, b0 = random.uniform(.2, .8), random.uniform(.2, .8)
        if math.hypot(a0 - .5, b0 - .5) > .28:
            break
    phases = random.sample(range(6), 3)
    cipher = random.sample(range(6), 6)                       # cipher[月相] = 符号
    ring_order = [random.sample(range(6), 6) for _ in range(3)]
    ring_rot = [random.randrange(6) for _ in range(3)]
    while all(ring_order[i][ring_rot[i]] == cipher[phases[i]] for i in range(3)):
        ring_rot[0] = (ring_rot[0] + 1) % 6
    return {
        'phase': 'lobby', 'ready': {'phone': False, 'hq': False},
        'stage': 0, 'alarm': 0, 'startAt': None, 'endAt': None, 'why': None, 'events': [],
        'loc': 'hall', 'hqView': -1,
        # 1 描星
        'tokens': tokens, 'path': random.sample(range(7), CONFIG['traceLen']),
        'fieldPos': layout(), 'hqPos': layout(), 'traceIdx': 0,
        # 2 对称门（每个瓷片 0..3 = ↖ ↗ ↘ ↙，镜像 = 异或 1）
        'tilesL': L, 'tilesR': R, 'lockedL': [True, False, True, False], 'lockedR': [False, True, False, True],
        # 3 星环月相
        'phases': phases, 'cipher': cipher, 'ringOrder': ring_order, 'ringRot': ring_rot,
        # 4 调频
        'a': .5, 'b': .5, 'a0': a0, 'b0': b0, 'theta': random.choice([-1, 1]) * random.uniform(.5, 1.0), 'flipx': random.choice([-1, 1]),
        'stableSince': None, 'shield': False, 'shieldAt': 0, 'nextHit': 0,
        # 5 星令传递
        'ctrlH': [False] * 4, 'ctrlF': [False] * 4, 'orderF': None, 'orderH': None, 'okF': 0, 'okH': 0, 'armed': False,
        # 6 祭仪
        'ritual': make_ritual(), 'ritIdx': 0, 'chant': False, 'chantAt': 0,
    }


def log(k, **p):
    G['events'].append({'t': now(), 'k': k, 'p': p})
    del G['events'][:-40]


def star_pos():
    g = G
    dx, dy = g['a'] - g['a0'], g['b'] - g['b0']
    c, s = math.cos(g['theta']), math.sin(g['theta'])
    return (dx * c - dy * s) * 2.2 * g['flipx'], (dx * s + dy * c) * 2.2


def sym_count():
    g = G
    return sum(1 for i in range(4) if g['tilesR'][i] == g['tilesL'][i] ^ 1)


def ring_count():
    g = G
    return sum(1 for i in range(3) if g['ringOrder'][i][g['ringRot'][i]] == g['cipher'][g['phases'][i]])


def shield_on():
    return bool(G['shield']) and now() - G['shieldAt'] <= CONFIG['shieldTtl']


def chant_on():
    return bool(G['chant']) and now() - G['chantAt'] <= 2.0


def public(role):
    g = G
    present = {r: any(c[0] == r for c in CLIENTS) for r in ('phone', 'hq')}
    sx, sy = star_pos()
    s = {
        'now': now(), 'phase': g['phase'], 'ready': g['ready'], 'present': present,
        'stage': g['stage'], 'alarm': g['alarm'], 'startAt': g['startAt'], 'endAt': g['endAt'], 'why': g['why'],
        'loc': g['loc'], 'events': g['events'][-30:],
        'tokens': g['tokens'], 'traceIdx': g['traceIdx'], 'traceLen': CONFIG['traceLen'],
        'sym': sym_count(), 'rings': ring_count(), 'stableSince': g['stableSince'], 'nextHit': g['nextHit'], 'shield': shield_on(),
        'okF': g['okF'], 'okH': g['okH'], 'armed': g['armed'], 'hqView': g['hqView'], 'ritIdx': g['ritIdx'], 'ritTotal': len(g['ritual']),
    }
    if role == 'phone':
        s['secret'] = {'path': g['path'], 'fieldPos': g['fieldPos'], 'tiles': g['tilesL'], 'locked': g['lockedL'],
                       'phases': g['phases'], 'star': [round(sx, 3), round(sy, 3)], 'ctrl': g['ctrlF'], 'order': g['orderF']}
    else:
        s['mine'] = {'pos': g['hqPos'], 'tiles': g['tilesR'], 'locked': g['lockedR'], 'knob': [round(g['a'], 3), round(g['b'], 3)],
                     'done': g['path'][:g['traceIdx']], 'cipher': g['cipher'], 'ringOrder': g['ringOrder'], 'ringRot': g['ringRot'],
                     'ctrl': g['ctrlH'], 'order': g['orderH'], 'ritual': g['ritual']}
    return s


def broadcast():
    for role, q in list(CLIENTS):
        q.put(json.dumps(public(role), ensure_ascii=False))


# ---------- 规则 ----------
def lose(why):
    G.update(phase='lost', why=why, endAt=now()); log('lose', why=why)


def win():
    G.update(phase='won', endAt=now()); log('ritualWin')


def alarm_add(reason, **p):
    G['alarm'] += 1
    log(reason, **p)
    if G['alarm'] >= CONFIG['maxAlarm']:
        lose('alarm')


def tune_update():
    g = G
    sx, sy = star_pos()
    if math.hypot(sx, sy) < CONFIG['thr']:
        if g['stableSince'] is None:
            g['stableSince'] = now()
    else:
        g['stableSince'] = None


def check_tiles():
    if G['stage'] == 2 and sym_count() == 4:
        G['stage'] = 3; log('symOK')


def check_rings():
    if G['stage'] == 3 and ring_count() == 3:
        G['stage'] = 4; G['nextHit'] = now() + CONFIG['stormFirst']; log('ringsOK')


def order_obj(states, who):
    i = random.randrange(4)
    log('orderNew', who=who, idx=i, target=not states[i])
    return {'idx': i, 'target': not states[i], 'deadline': now() + CONFIG['orderTime']}


def start_orders():
    g = G
    g['ctrlH'] = [random.random() < .5 for _ in range(4)]
    g['ctrlF'] = [random.random() < .5 for _ in range(4)]
    g['orderF'] = order_obj(g['ctrlH'], 'phone')     # 现场看到的星令 → 需要总部去拨
    g['orderH'] = order_obj(g['ctrlF'], 'hq')        # 总部看到的星令 → 需要现场去拨
    g['okF'] = g['okH'] = 0
    stagger()


def stagger():
    """两条星令的时限至少错开 4 秒，避免同时超时一次扣两点警报。"""
    g = G
    a, b = g['orderF'], g['orderH']
    if a and b and abs(a['deadline'] - b['deadline']) < 4:
        (a if a['deadline'] >= b['deadline'] else b)['deadline'] += 4


def check_orders():
    g = G
    if g['okF'] >= CONFIG['orderGoal'] and g['okH'] >= CONFIG['orderGoal']:
        g['stage'] = 6; g['orderF'] = g['orderH'] = None; log('ordersOK')


def ritual_try(d):
    g = G
    ex = g['ritual'][g['ritIdx']]
    obj, gs, v = d.get('obj'), d.get('g'), d.get('v') or {}
    if obj != ex['obj'] or gs != ex['g']:
        return alarm_add('ritBad', obj=obj)
    if gs == 'circle':
        if v.get('dir') != ex['dir']:
            return alarm_add('ritBad', obj=obj)
        ok = (v.get('n') or 0) >= ex['n']
    elif gs == 'hold':
        ok = (v.get('sec') or 0) >= ex['sec'] - 0.25
    elif gs == 'shake':
        ok = (v.get('n') or 0) >= ex['n']
    else:
        if v.get('dir') != ex['dir']:
            return alarm_add('ritBad', obj=obj)
        ok = True
    if not ok:
        return log('ritWeak', obj=obj)
    if ex['chant'] and not chant_on():
        return log('ritNoChant', obj=obj)
    g['ritIdx'] += 1; log('ritOK', obj=obj, idx=g['ritIdx'])
    if g['ritIdx'] >= len(g['ritual']):
        win()


def act(role, name, d):
    global G
    with LOCK:
        g, t = G, now()
        if name == 'reset':
            G = fresh(); broadcast(); return
        if name == 'ready':
            if g['phase'] == 'lobby':
                g['ready'][role] = True
                if all(g['ready'].values()):
                    g.update(phase='playing', stage=1, startAt=t + CONFIG['intro']); log('start')
            broadcast(); return
        if g['phase'] != 'playing':
            return
        st = g['stage']
        i = d.get('i')
        if name == 'loc' and role == 'phone' and d.get('loc') in LOCS:
            g['loc'] = d['loc']
        elif name == 'tile' and st == 2:
            if isinstance(i, int) and 0 <= i < 4:
                key, lk = ('tilesL', 'lockedL') if role == 'phone' else ('tilesR', 'lockedR')
                if not g[lk][i]:
                    g[key][i] = (g[key][i] + 1) % 4
                    check_tiles()
        elif name == 'view' and role == 'hq' and isinstance(i, int) and -1 <= i < 6:
            g['hqView'] = i
        elif name == 'arm' and role == 'phone' and st == 5 and not g['armed']:
            g['armed'] = True; start_orders(); log('armed')
        elif name == 'ctrl' and st == 5 and g['armed'] and isinstance(i, int) and 0 <= i < 4:
            if role == 'phone':
                g['ctrlF'][i] = not g['ctrlF'][i]
                log('toggle', side='phone', idx=i, on=g['ctrlF'][i])
                o = g['orderH']
                if o and o['idx'] == i and g['ctrlF'][i] == o['target']:
                    g['okH'] += 1; log('orderOK', side='hq', idx=i)
                    g['orderH'] = order_obj(g['ctrlF'], 'hq') if g['okH'] < CONFIG['orderGoal'] else None
            else:
                g['ctrlH'][i] = not g['ctrlH'][i]
                log('toggle', side='hq', idx=i, on=g['ctrlH'][i])
                o = g['orderF']
                if o and o['idx'] == i and g['ctrlH'][i] == o['target']:
                    g['okF'] += 1; log('orderOK', side='phone', idx=i)
                    g['orderF'] = order_obj(g['ctrlH'], 'phone') if g['okF'] < CONFIG['orderGoal'] else None
            stagger(); check_orders()
        elif name == 'rit' and role == 'phone' and st == 6:
            ritual_try(d)
        elif role == 'hq':
            if name == 'tap' and st == 1:
                tid = d.get('id')
                if isinstance(tid, int) and 0 <= tid < 7:
                    if tid == g['path'][g['traceIdx']]:
                        g['traceIdx'] += 1
                        if g['traceIdx'] >= CONFIG['traceLen']:
                            g['stage'] = 2; log('traceOK')
                    else:
                        alarm_add('traceBad')
                        if g['phase'] == 'playing':
                            g['traceIdx'] = 0
            elif name == 'traceReset' and st == 1:
                g['traceIdx'] = 0
            elif name == 'ring' and st == 3 and isinstance(i, int) and 0 <= i < 3 and d.get('d') in (-1, 1):
                g['ringRot'][i] = (g['ringRot'][i] + d['d']) % CONFIG['ringN']
                check_rings()
            elif name == 'knob' and st == 4 and not shield_on():
                a, b = d.get('a'), d.get('b')
                if isinstance(a, (int, float)) and isinstance(b, (int, float)):
                    g['a'], g['b'] = clamp(float(a), 0, 1), clamp(float(b), 0, 1)
                    tune_update()
            elif name == 'shield' and st == 4:
                g['shield'] = bool(d.get('on'))
                if g['shield']:
                    g['shieldAt'] = t
            elif name == 'chant' and st == 6:
                g['chant'] = bool(d.get('on'))
                if g['chant']:
                    g['chantAt'] = t
        broadcast()


def ticker():
    while True:
        time.sleep(0.25)
        with LOCK:
            g = G
            if g['phase'] != 'playing':
                continue
            t, changed = now(), False
            if t - g['startAt'] >= CONFIG['limit']:
                lose('time'); changed = True
            elif g['stage'] == 4:
                if g['nextHit'] and t >= g['nextHit']:
                    g['nextHit'] = t + CONFIG['stormEvery']
                    if shield_on():
                        log('shielded')
                    else:
                        g['a0'] = clamp(g['a0'] + random.choice([-1, 1]) * random.uniform(.18, .3), .12, .88)
                        g['b0'] = clamp(g['b0'] + random.choice([-1, 1]) * random.uniform(.18, .3), .12, .88)
                        g['stableSince'] = None
                        alarm_add('stormHit')
                    changed = True
                elif g['stableSince'] and t - g['stableSince'] >= CONFIG['stable']:
                    g['stage'] = 5; g['stableSince'] = None; g['shield'] = False; log('tuneOK'); changed = True
            elif g['stage'] == 5:
                for key, states, who in (('orderF', 'ctrlH', 'phone'), ('orderH', 'ctrlF', 'hq')):
                    o = g[key]
                    if o and t > o['deadline']:
                        alarm_add('orderLate', who=who)
                        if g['phase'] != 'playing':
                            break
                        g[key] = order_obj(g[states], who); stagger(); changed = True
            if changed:
                broadcast()


# ---------- HTTP ----------
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/events':
            return self._sse(parse_qs(u.query).get('role', ['phone'])[0])
        if u.path == '/api/config':
            return self._json(CONFIG)
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != '/act':
            return self._json({'ok': False}, 404)
        try:
            n = int(self.headers.get('Content-Length', 0))
            m = json.loads(self.rfile.read(n) or b'{}')
            role = m.get('role') if m.get('role') in ('phone', 'hq') else None
            if not role:
                return self._json({'ok': False}, 400)
            act(role, str(m.get('act', '')), m.get('data') or {})
            return self._json({'ok': True})
        except Exception as e:  # noqa
            return self._json({'ok': False, 'error': str(e)}, 400)

    def _sse(self, role):
        role = role if role in ('phone', 'hq') else 'phone'
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()
        q = queue.Queue()
        with LOCK:
            CLIENTS.append((role, q))
            broadcast()
        try:
            while True:
                try:
                    msg = q.get(timeout=15)
                    self.wfile.write(('data: ' + msg + '\n\n').encode())
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with LOCK:
                CLIENTS[:] = [c for c in CLIENTS if c[1] is not q]
                broadcast()


if __name__ == '__main__':
    G = fresh()
    threading.Thread(target=ticker, daemon=True).start()
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    srv.daemon_threads = True
    print(f'Gate of Stars server on http://0.0.0.0:{PORT}')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
