# 星门 · Gate of Stars

双人协作解谜：一人用**手机**（旅人），一人用**电脑**（星象师），靠说话配合，在黎明前打开星门。
A two-player co-op puzzle: one on a **phone** (Wanderer), one on a **laptop** (Stargazer). Talk to each other and open the gate before dawn.

不需要任何额外硬件，没有摄像头，没有外部依赖。 No extra hardware, no camera, no external dependencies.

## 在线体验 / Try it online

无需安装：打开 `hq.html?demo`（部署在 GitHub Pages 上时自动进入展示模式），即可单人体验星象师视角，旅人由程序模拟。`index.html` 是作品集案例页。
No install: open `hq.html?demo` (demo mode starts automatically on GitHub Pages) to try the Stargazer view solo — the Wanderer is simulated. `index.html` is the portfolio case study.

## 运行 / Run

只需要 Python 3（标准库）。 Python 3 only (standard library).

```bash
python3 server.py            # 默认端口 8000，可用 PORT=9000 修改
```

- 电脑 / Laptop：`http://localhost:8000/hq.html`（星象师 Stargazer）
- 手机 / Phone：`http://<电脑的局域网 IP>:8000/phone.html`（旅人 Wanderer）
  - 手机和电脑要在同一个 Wi-Fi；查 IP：`ipconfig getifaddr en0`（macOS）
  - 学校 / 公共 Wi-Fi 可能禁止设备互访，可以让电脑连手机热点
- 两边都点「准备好了」后开始，先播放约 21 秒的开场过场（可点击跳过），之后才开始 13 分钟倒计时
- 两边都有 `EN / 中文` 切换，右上角 `♪` 可静音

## 六道关卡 / Six trials

| 关 | 旅人（手机） | 星象师（电脑） |
|---|---|---|
| 1 描星 | 星座廊：擦去壁画上的灰，描述被点亮的星 | 星图桌：按口述点中对应的星 |
| 2 对称门 | 镜厅：拖火种点灯，转自己的瓷片 | 对称碑：转自己的瓷片，拼成镜像 |
| 3 星环月相 | 月室：在黑暗中找到月盘，描述三个月相（没有名字） | 星环仪：查星图册的月相对照表，转动星环 |
| 4 调频校准 | 星门：看星漂移并反馈 | 调频台：转旋钮；风暴来时按住护盾 |
| 5 星令传递 | 星令殿：摇曲柄通电后，互相喊对方面板上的星名 | 星令台：同上 |
| 6 祭仪 | 祭坛：画圈、长按、摇铃、倾倒 | 祭仪卷轴：念出步骤，♪ 步骤要按住「吟唱」 |

规则由服务器统一裁决，每一方只能收到属于自己的信息（星象师收不到旅人的秘密，反之亦然）。
All rules are decided on the server; each side only receives its own secrets.

## 文件 / Files

| 文件 | 作用 |
|---|---|
| `server.py` | 静态文件 + 实时同步（SSE）+ 游戏状态与规则 |
| `phone.html` | 旅人：多场景探索、场景谜题、祭坛手势 |
| `index.html` | 作品集案例页（AI 协作过程 + 参考） |
| `play.html` | 双人游玩说明 |
| `demo.js` | 展示模式：浏览器内模拟服务器 + 旅人 |
| `hq.html` | 星象师：第一人称 360° 全景观星台、各台特写、星图册 |
| `kit.js` | 共用画风积木、双语名称、开场过场 |
| `net.js` | 双语、联网、音效、程序生成的背景音乐 |
| `design/ui-mockups.html` | 早期 UI 概念稿 |

## 备注 / Notes

- 手机传感器（陀螺仪）需要 HTTPS；局域网 http 下 iPhone 和新版 Chrome 会拒绝，所以祭坛以**触摸手势**为主，传感器仅作为可选增强。
- 测试用环境变量 `GATE_FAST=1` 会缩短风暴 / 星令 / 开场的时间。
- 尚未在真实手机上做过完整试玩。 Not yet fully playtested on a real phone.
