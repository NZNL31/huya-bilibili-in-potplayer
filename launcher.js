#!/usr/bin/env node
/**
 * play-huya&bili —— 虎牙 / 哔哩哔哩直播 -> PotPlayer 交互式启动器
 *
 * 交互逻辑全部放在 Node 里，bat 只负责拉起本文件。
 * 这样可以彻底避开 cmd 的 GBK 编码、CRLF 换行、变量展开等一堆坑。
 *
 * 两种运行方式：
 *   默认        问完房间/画质/模式就把中继丢到后台，本窗口自己关掉（不留黑窗口）
 *   --console   老行为：本窗口就是中继，关窗口 = 停止播放
 */
'use strict';

const readline = require('readline');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8765;                 // 必须和 relay.js 的默认端口一致
const LOG_NAME = 'relay.log';      // 后台运行时的日志，出问题看它
const HIDE = !process.argv.includes('--console');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 行队列式输入。
 * 不用 rl.question：它在管道/重定向输入下会丢行（一次 question 吞掉全部缓冲）。
 * 这里改成统一监听 'line' 事件，先进先出排队，TTY 和管道两种场景都可靠。
 */
class Prompt {
  constructor() {
    this.buffer = [];
    this.waiters = [];
    this.closed = false;
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.on('line', line => {
      if (this.waiters.length) this.waiters.shift()(line);
      else this.buffer.push(line);
    });
    this.rl.on('close', () => {
      this.closed = true;
      while (this.waiters.length) this.waiters.shift()('');
    });
  }

  ask(question) {
    process.stdout.write(question);
    if (this.buffer.length) return Promise.resolve(String(this.buffer.shift()).trim());
    if (this.closed) return Promise.resolve('');
    return new Promise(resolve => {
      this.waiters.push(line => resolve(String(line).trim()));
    });
  }

  close() { try { this.rl.close(); } catch (_) {} }
}

const prompt = new Prompt();
const ask = q => prompt.ask(q);

/**
 * 把用户输入拆成 { platform, room }。规则与 relay.js 里的 parseTarget 保持一致，
 * 两边必须同源，否则启动器存进 last-room.txt 的东西中继会认不出来。
 *   825803 / dank1ng                       虎牙（默认）
 *   https://www.huya.com/825803            虎牙链接
 *   https://live.bilibili.com/6            B 站链接
 *   bili:6 / b站:6 / bl:6                  B 站显式写法
 */
function parseTarget(v) {
  const s = String(v || '').trim();
  if (!s) return { platform: null, room: '' };

  // B 站链接（含 h5 分享链接 live.bilibili.com/h5/6）
  let m = s.match(/live\.bilibili\.com\/(?:h5\/)?(\d+)/i);
  if (m) return { platform: 'bilibili', room: m[1] };

  // B 站显式前缀
  m = s.match(/^(?:bili|bilibili|b站|bl)\s*[:：]\s*(.+)$/i);
  if (m) return { platform: 'bilibili', room: m[1].trim().split(/[?#]/)[0] };

  // 虎牙链接
  m = s.match(/huya\.com\/([^/?#\s]+)/i);
  if (m) return { platform: 'huya', room: m[1].split(/[?#]/)[0].trim() };

  // 裸房间号 / 房间名
  return { platform: null, room: s.split(/[?#]/)[0].trim() };
}

/**
 * 把 { platform, room } 还原成可再次解析、也方便人看的字符串。
 * 存进 last-room.txt 的就是它 —— 带平台信息，下次直接回车还能认出是 B 站。
 */
function labelOf(t) {
  if (!t.room) return '';
  return t.platform === 'bilibili' ? `https://live.bilibili.com/${t.room}` : t.room;
}

// B 站画质档位（qn）。匿名请求会被压到 250，配了 Cookie 才能到 10000。
const BILI_QN_NAMES = {
  30000: '杜比', 20000: '4K', 10000: '原画', 400: '蓝光', 250: '超清', 150: '高清',
};

/** 和 relay.js 的 loadBiliCookie 保持一致：环境变量优先，其次本地文件 */
function biliCookieConfigured() {
  if (process.env.BILI_COOKIE && process.env.BILI_COOKIE.trim()) return true;
  try {
    return !!fs.readFileSync(path.join(__dirname, 'bili-cookie.txt'), 'utf8').trim();
  } catch (_) {
    return false;
  }
}

const LINE = '==========================================';
const lastFile = path.join(__dirname, 'last-room.txt');

// 内置默认房间：没输入、也没有历史记录时用它。
// dank1ng 房间号是 10188，这里写房间名，跟虎牙地址栏一致。
const DEFAULT_ROOM = 'dank1ng';
// 24 小时基本都在播的官方赛事频道，拿不准看什么就输这个
const ALWAYS_ON_ROOM = '660000';

async function main() {
  console.log(LINE);
  console.log('     play-huya&bili   虎牙 / 哔哩哔哩直播 -> PotPlayer');
  console.log(LINE);
  console.log('');

  // 环境自检：Node 版本过低会直接影响 fetch/文件 API
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor < 16) {
    console.log(`  [警告] Node.js 版本偏低（当前 ${process.versions.node}），建议升级到 16 或更高。`);
    console.log('');
  }

  console.log('  请输入直播间，支持这些写法：');
  console.log('');
  console.log('    虎牙房间号   ' + ALWAYS_ON_ROOM + '      （24 小时赛事频道）');
  console.log('    虎牙房间名   dank1ng');
  console.log('    虎牙链接     https://www.huya.com/dank1ng');
  console.log('    B 站链接     https://live.bilibili.com/6');
  console.log('    B 站简写     bili:6');
  console.log('');

  let lastRoom = '';
  try { lastRoom = fs.readFileSync(lastFile, 'utf8').trim(); } catch (_) {}

  if (lastRoom) {
    console.log(`  上次使用: ${lastRoom}   （直接回车沿用）`);
  } else {
    console.log(`  直接回车 = ${DEFAULT_ROOM}`);
  }
  console.log('');

  const input = await ask('  请输入房间: ');
  // 存进去的是带平台信息的写法，下次回车还能认出是 B 站
  const roomArg = labelOf(parseTarget(input)) || lastRoom || DEFAULT_ROOM;
  const isBili = parseTarget(roomArg).platform === 'bilibili';

  if (!roomArg) {
    console.log('');
    console.log('  [错误] 没有输入房间，退出。');
    prompt.close();
    process.exitCode = 1;
    return;
  }

  try { fs.writeFileSync(lastFile, roomArg, 'utf8'); } catch (_) {}

  // ---------- 画质 ----------
  let bitrate = 8000;   // 虎牙：码率档
  let qn = 0;           // B 站：画质档

  if (isBili) {
    if (!biliCookieConfigured()) {
      // 免登录的 B 站接口只给到 250，问也没用，直接说清楚
      qn = 250;
      console.log('');
      console.log('  画质: 超清 720p30  （B 站免登录能拿到的最高档）');
      console.log('        想要原画 1080p60：把浏览器里的 SESSDATA=... 存成');
      console.log('        bili-cookie.txt 放在本目录，重开就会多出原画选项。');
    } else {
      console.log('');
      console.log(LINE);
      console.log('        画质选择');
      console.log(LINE);
      console.log('');
      console.log('  [1] 原画    1080p60   推荐');
      console.log('  [2] 蓝光    1080p30   省带宽');
      console.log('  [3] 超清    720p30    弱网备用');
      console.log('');
      console.log('  直接回车 = 原画');
      console.log('');
      const q = await ask('  请选择 [1-3]: ');
      qn = q === '2' ? 400 : q === '3' ? 250 : 10000;
    }
  } else {
    console.log('');
    console.log(LINE);
    console.log('        画质选择');
    console.log(LINE);
    console.log('');
    console.log('  [1] 蓝光8M   1080p60        推荐（多数房间的最高档）');
    console.log('  [2] 蓝光4M   1080p30        省带宽');
    console.log('  [3] 超清2M   弱网备用');
    console.log('  [4] 原画     不转码的源流     房间支持时才是真·最高画质');
    console.log('');
    console.log('  直接回车 = 蓝光8M');
    console.log('');
    const q = await ask('  请选择 [1-4]: ');
    if (q === '2') bitrate = 4000;
    else if (q === '3') bitrate = 2000;
    else if (q === '4') bitrate = 0;   // 0 = ratio=0，向 CDN 要原画
  }

  // ---------- 模式 ----------
  console.log('');
  console.log(LINE);
  console.log('        播放模式');
  console.log(LINE);
  console.log('');
  console.log('  [1] 原画直通   FLV 直连，画质 100% 无损    推荐');
  console.log('  [2] 流畅优先   重编码 + HLS，绝对不掉帧');
  console.log('  [3] HLS 转封装 兼容老用法；个别播放器播它只出声音');
  console.log('');
  console.log('  直接回车 = 原画直通');
  console.log('');
  const m = await ask('  请选择 [1-3]: ');

  // B 站按 qn 选画质，虎牙按码率；两者互斥，别混着传
  const args = [roomArg, '--open'];
  if (isBili) args.push('--qn', String(qn));
  else args.push('--bitrate', String(bitrate));
  if (m === '2') args.push('--transcode');
  else if (m === '3') args.push('--hls');

  prompt.close();

  const relayArgs = [path.join(__dirname, 'relay.js'), ...args, '--log-file', path.join(__dirname, LOG_NAME)];

  console.log('');
  console.log(LINE);
  console.log(`  ${isBili ? 'B站' : '虎牙'}: ${roomArg}   画质: ${
    isBili ? (BILI_QN_NAMES[qn] || ('qn=' + qn)) : (bitrate === 0 ? '原画' : bitrate / 1000 + 'M')
  }   模式: ${m === '2' ? '流畅优先（重编码 + HLS）' : m === '3' ? 'HLS 转封装' : '原画直通（FLV）'}`);
  console.log(LINE);
  console.log('');

  if (!HIDE) {
    // --console：老行为，中继占着这个窗口，日志直接看得见
    console.log('  控制台模式：关掉本窗口即停止播放。');
    console.log('  首次启动约需 5 秒缓冲，PotPlayer 会自动打开。');
    console.log('');
    const relay = spawn(process.execPath, relayArgs, { stdio: 'inherit', cwd: __dirname });
    relay.on('error', e => {
      console.log('');
      console.log(`  [错误] 无法启动中继: ${e.message}`);
      process.exitCode = 1;
    });
    relay.on('exit', code => {
      if (code !== 0) {
        console.log('');
        console.log(`  [错误] 中继退出，代码 ${code}`);
        console.log('');
        console.log('  常见原因：');
        console.log('    1. 房间不存在，或主播当前未开播');
        console.log('    2. 端口 8765 被占用（还有旧中继在后台跑）');
        console.log('    3. 网络异常');
        if (isBili) {
          console.log('    4. B 站临时风控（换个房间或过几分钟再试）');
          console.log('    5. 想看 1080p 原画，需要配置 bili-cookie.txt');
        }
        console.log('');
        process.exitCode = code;
      }
    });
    return;
  }

  // ---------- 默认：后台运行，本窗口稍后自动关掉 ----------
  console.log('  正在把这个窗口收起来，PotPlayer 约 5 秒后自动弹出...');
  const relay = spawn(process.execPath, relayArgs, {
    cwd: __dirname,
    detached: true,          // 脱离本进程，窗口关了也继续跑
    stdio: 'ignore',         // 没有控制台可写，日志都进 relay.log
    windowsHide: true,
  });
  relay.on('error', e => {
    console.log('');
    console.log(`  [错误] 无法启动中继: ${e.message}`);
    process.exitCode = 1;
  });
  relay.unref();

  // 换房间时中继要先接管旧进程（最多十几秒），所以别只等 15 秒就判死
  const up = await waitRelay(PORT, 25000);
  if (!up) {
    console.log('');
    console.log('  [错误] 中继 25 秒内没起来，先别关窗口，看看原因：');
    console.log('');
    dumpLogTail(12);
    console.log('');
    console.log('  常见原因：端口 8765 被别的程序占了、网络不通、房间号不对。');
    process.exitCode = 1;
    return;
  }

  // 端口通了不代表播的就是你要的房间：旧中继还在跑时，新版会去接管它，
  // 接管失败的话端口照样是通的。这里核对一下，别让人以为切换成功了。
  const live = await waitForRoom(PORT, parseTarget(roomArg).room, 12000);
  if (live && live.room && String(live.room).toLowerCase() !== parseTarget(roomArg).room.toLowerCase()) {
    console.log('');
    console.log(`  [警告] 8765 上跑的仍然是 ${live.room}${live.nickname ? '（' + live.nickname + '）' : ''}，不是 ${roomArg}。`);
    console.log('        先关掉正在播放的 PotPlayer（中继会跟着退出），再重新运行本程序。');
    console.log('');
    dumpLogTail(6);
    process.exitCode = 1;
    return;
  }

  console.log(`  ✓ 中继已在后台运行（127.0.0.1:${PORT}）`);
  if (live && live.room) {
    console.log(`  正在播放: ${live.room}${live.nickname ? '（' + live.nickname + '）' : ''}`);
  } else {
    console.log('  [提示] 读不到中继的 /status，没法确认在播哪个房间；有问题看 relay.log。');
  }
  // 只有 HLS 模式（重编码 / 转封装）才会往硬盘写分片，FLV 直连不落盘
  const usesHls = m === '2' || m === '3';
  console.log(usesHls
    ? `  日志: ${LOG_NAME}（出问题看它）    缓存: .cache\\hls-${PORT}（退出自动删）`
    : `  日志: ${LOG_NAME}（出问题看它）    缓存: 不用（FLV 直连，不落盘）`);
  console.log('');
  console.log('  停止播放：直接关掉 PotPlayer 即可，中继和缓存会自动收尾。');
  console.log('  窗口 3 秒后关闭...');
  await sleep(3000);
  process.exitCode = 0;
}

/** 读中继的 /status（新版中继才有这个接口），拿不到返回 null */
function relayStatus(port) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/status', timeout: 2000 }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (_) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * 等到中继确实在播我们要的房间。
 * 接管旧中继那几秒里 /status 可能还回着旧的房间，所以轮询，不能看一眼就下结论。
 */
async function waitForRoom(port, want, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const s = await relayStatus(port);
    if (s && s.room) {
      last = s;
      if (String(s.room).toLowerCase() === String(want).toLowerCase()) return s;
    }
    await sleep(500);
  }
  return last;
}

/**
 * 等中继在端口上应答。
 * 这里只做 TCP 连通性判断，不去读 /url —— 房间没开播时 /url 可能还是空的，
 * 那种情况中继其实活得好好的，不该被当成「没起来」。
 */
function waitRelay(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise(resolve => {
    const tick = () => {
      const sock = net.connect({ host: '127.0.0.1', port });
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        try { sock.destroy(); } catch (_) {}
        if (ok) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(tick, 400);
      };
      sock.setTimeout(1200);
      sock.on('connect', () => finish(true));
      sock.on('error', () => finish(false));
      sock.on('timeout', () => finish(false));
    };
    tick();
  });
}

/** 后台模式起不来时，把 relay.log 的最后几行打出来，别让人干瞪眼 */
function dumpLogTail(lines) {
  try {
    const all = fs.readFileSync(path.join(__dirname, LOG_NAME), 'utf8').trimEnd().split(/\r?\n/);
    for (const line of all.slice(-lines)) console.log('    ' + line);
  } catch (_) {
    console.log('    （还没有 relay.log，可能根本没启动起来）');
  }
}

main().catch(e => {
  console.error('');
  console.error('  启动失败:', e.message);
  process.exitCode = 1;
});
