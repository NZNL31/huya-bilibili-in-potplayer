#!/usr/bin/env node
/**
 * 虎牙直播间 -> 本地连续 FLV/HLS 中继（给 PotPlayer / VLC / mpv 用）
 * v2.0 抗卡顿版
 *
 * 相比 v1 的改进：
 *   1. 默认码率 4000（蓝光4M），网络不足时自动降档到 2000/1000
 *   2. CDN 节点启动时自动测速，选最快的；播放中失败自动换节点
 *   3. 预缓冲加大到 3~5 秒，抵抗上游抖动
 *   4. 修复 GOP 截断：不再主动 stop，让上游给完整个 GOP
 *   5. 上游静默判定放宽到 6 秒，避免正常间隙被误判导致断流
 *   6. 时间戳连续化处理，防止播放器认为文件结束
 *
 * 用法:
 *   node huya-relay.js                          # 默认房间 dank1ng，监听 127.0.0.1:8765
 *   node huya-relay.js 660115                   # 指定房间
 *   node huya-relay.js --room dank1ng --open    # 启动后自动拉起 PotPlayer
 *   node huya-relay.js --bitrate 2000 --open    # 指定码率档
 *   node huya-relay.js --auto-bitrate           # 开启自动降码率(默认开)
 *
 * 播放器里打开:  http://127.0.0.1:8765/live.flv  或  http://127.0.0.1:8765/live.m3u8
 */
'use strict';

const http = require('http');
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ---------------- 参数 ----------------
const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n && !n.startsWith('--')) { flags[k] = n; i++; } else flags[k] = true;
  } else pos.push(a);
}
/**
 * 把用户输入统一成房间标识。支持四种写法：
 *   825803                              纯房间号
 *   dank1ng                             英文房间名
 *   https://www.huya.com/825803         完整链接
 *   https://www.huya.com/dank1ng?x=1    带参数的链接
 */
function normalizeRoomInput(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/huya\.com\/([^/?#\s]+)/i);   // 从链接里抠出房间段
  if (m) s = m[1];
  return s.split(/[?#]/)[0].trim();
}

const ROOM = normalizeRoomInput(flags.room || pos[0]) || 'dank1ng';
const PORT = parseInt(flags.port, 10) || 8765;
const OPEN = !!flags.open;

// ---------------- 外部程序自动探测 ----------------
/**
 * 依次尝试候选路径，返回第一个存在的。
 * 不写死盘符，别人 clone 到任意目录、或装在 C 盘都能直接用。
 */
function findFirst(cands) {
  for (const p of cands) {
    if (!p) continue;
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

/** 探测 PotPlayer：参数 > 环境变量 > 脚本附近 > 常见安装位置 */
function detectPlayer() {
  if (flags.player) return flags.player;
  if (process.env.POTPLAYER_PATH) return process.env.POTPLAYER_PATH;

  const here = __dirname;
  const parent = path.dirname(here);
  const grand = path.dirname(parent);
  const names = ['PotPlayerMini64.exe', 'PotPlayerMini.exe'];

  const dirs = [
    here,                                   // 脚本同目录
    parent,                                 // 上一级（PotPlayer 主目录）
    grand,                                  // 上两级
    path.join(parent, 'PotPlayer'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'DAUM', 'PotPlayer'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'DAUM', 'PotPlayer'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'PotPlayer'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'PotPlayer'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'DAUM', 'PotPlayer'),
  ].filter(Boolean);

  const cands = [];
  for (const d of dirs) for (const n of names) cands.push(path.join(d, n));
  return findFirst(cands);
}

/** 探测 ffmpeg：参数 > 环境变量 > 脚本附近 > PotPlayer 自带 > 系统 PATH */
function detectFfmpeg() {
  if (flags.ffmpeg) return flags.ffmpeg;
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  const here = __dirname;
  const parent = path.dirname(here);

  const cands = [
    path.join(here, 'ffmpeg.exe'),                    // 脚本同目录
    path.join(here, 'bin', 'ffmpeg.exe'),             // 脚本 bin 子目录
    path.join(here, 'ffmpeg', 'bin', 'ffmpeg.exe'),   // 脚本内解压的完整包
    path.join(parent, 'Engine', 'ffmpeg.exe'),        // PotPlayer 自带的 Engine 目录
    path.join(parent, 'ffmpeg.exe'),
    path.join(parent, 'bin', 'ffmpeg.exe'),
  ];

  const found = findFirst(cands);
  if (found) return found;
  return 'ffmpeg';   // 兜底：交给系统 PATH，找不到时 spawn 会报错并给出提示
}

const PLAYER = detectPlayer();

// 码率档位：8000=蓝光8M 4000=蓝光4M 2000=超清 1000=高清 500=流畅
const BITRATE_LADDER = [8000, 4000, 2000, 1000, 500];
let bitrateIdx = BITRATE_LADDER.indexOf(parseInt(flags.bitrate, 10));
if (bitrateIdx < 0) bitrateIdx = 0;               // 默认蓝光8M（原画质：1080p60 / High profile）
let BITRATE = BITRATE_LADDER[bitrateIdx];
const AUTO_BITRATE = !flags['no-auto-bitrate'];   // 默认开启自动降码率

// 预缓冲：本地回环连接抖动很小，2 秒足够；原来 4 秒会让 ffmpeg 等太久而超时退出
const PREROLL_MS = 2000;
const PREROLL_BYTES = 2 * 1024 * 1024;
const IDLE_ROTATE_MS = 6000;        // 上游静默 6 秒才轮换（原2500太激进，正常间隙被误杀）
const POLL_GAP = 100;               // 上一条结束后稍等再开下一条，给系统喘息

const log = (...a) =>
  console.log(new Date().toLocaleTimeString('zh-CN', { hour12: false }), ...a);

// ---------------- HTTP 工具 ----------------
function httpsBuf(url, headers, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: Object.assign({ 'user-agent': UA }, headers) }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let b = Buffer.concat(chunks);
        const enc = String(res.headers['content-encoding'] || '').toLowerCase();
        try {
          if (enc === 'gzip') b = zlib.gunzipSync(b);
          else if (enc === 'deflate') b = zlib.inflateSync(b);
          else if (enc === 'br') b = zlib.brotliDecompressSync(b);
        } catch (_) {}
        resolve({ status: res.statusCode, body: b });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

// ---------------- 房间与流地址 ----------------
let cachedRoomId = null;
let cachedUrl = null;
let urlFetchedAt = 0;
let cdnOrder = ['HS', 'TX', 'AL'];   // 会被测速结果重排

async function resolveRoomId() {
  if (cachedRoomId) return cachedRoomId;
  if (/^\d+$/.test(ROOM)) { cachedRoomId = ROOM; return cachedRoomId; }
  const r = await httpsBuf(`https://www.huya.com/${encodeURIComponent(ROOM)}`);
  const m = r.body.toString('utf8').match(/"profileRoom":(\d+)/);
  if (!m) throw new Error('页面里找不到 profileRoom（房间不存在？）');
  cachedRoomId = m[1];
  return cachedRoomId;
}

async function getStreamUrl(force) {
  // 签名有效期约 5 分钟，超过 3 分钟就换新的
  if (!force && cachedUrl && Date.now() - urlFetchedAt < 180000) return cachedUrl;

  const roomId = await resolveRoomId();
  const r = await httpsBuf(`https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid=${roomId}`);
  let j;
  try { j = JSON.parse(r.body.toString('utf8')); }
  catch (_) { throw new Error('API 返回非 JSON'); }
  if (j.status !== 200 || !j.data || !j.data.stream) throw new Error(`API 失败: ${j.message || j.status}`);

  const d = j.data;
  if (String(d.liveStatus).toUpperCase() !== 'ON' && d.liveStatus !== 1) {
    throw new Error('主播当前未开播 (liveStatus=' + d.liveStatus + ')');
  }

  const lines = (d.stream.flv && d.stream.flv.multiLine) || [];
  if (!lines.length) throw new Error('API 没给出 FLV 地址');

  // 按测速结果排序，最快的排前面
  lines.sort((a, b) => {
    const ia = cdnOrder.indexOf(a.cdnType), ib = cdnOrder.indexOf(b.cdnType);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
  });
  const picked = lines[0];

  cachedUrl = {
    url: picked.url.replace(/^http:/, 'https:'),
    cdn: picked.cdnType,
    title: d.liveData && d.liveData.title,
    nickname: d.liveData && d.liveData.nickname,
  };
  urlFetchedAt = Date.now();
  return cachedUrl;
}

/**
 * CDN 测速：给每个节点发一个小请求，测首字节时间，选最快的。
 * 在服务启动后后台跑一次，结果重排 cdnOrder。
 */
async function probeCdnSpeed() {
  try {
    const roomId = await resolveRoomId();
    const r = await httpsBuf(`https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid=${roomId}`);
    const j = JSON.parse(r.body.toString('utf8'));
    const lines = (j.data && j.data.stream && j.data.stream.flv && j.data.stream.flv.multiLine) || [];
    if (lines.length < 2) return;   // 单节点没必要测

    const results = [];
    await Promise.all(lines.map(line => new Promise(resolve => {
      const u = withRatio(line.url.replace(/^http:/, 'https:'), BITRATE) + '&_=' + Date.now().toString(36);
      const t0 = Date.now();
      const req = https.get(u, { headers: { 'user-agent': UA, accept: '*/*' } }, res => {
        res.once('data', () => { results.push({ cdn: line.cdnType, ms: Date.now() - t0 }); res.destroy(); resolve(); });
        res.on('error', () => resolve());
      });
      req.on('error', () => resolve());
      req.setTimeout(6000, () => { req.destroy(); resolve(); });
    })));

    if (results.length) {
      results.sort((a, b) => a.ms - b.ms);
      cdnOrder = results.map(r => r.cdn);
      log(`CDN 测速完成: ${results.map(r => `${r.cdn}=${r.ms}ms`).join(' ')}，优先使用 ${cdnOrder[0]}`);
    }
  } catch (_) { /* 测速失败就用默认顺序，不影响主流程 */ }
}

/**
 * 关键：给直链补上 ratio 参数。
 * 实测带 ratio 时 CDN 一次返回 6~8 秒完整内容，且连续请求能稳定推进；
 * 不带 ratio 时只给 2~3 秒碎块，拼起来必然卡顿。
 */
function withRatio(url, ratio) {
  let u = url;
  if (!/[?&]ratio=/.test(u)) u += (u.includes('?') ? '&' : '?') + 'ratio=' + ratio;
  return u;
}

// ---------------- 拉取一个块 ----------------
/**
 * 流式读取一条上游连接：边下边解析 tag，遇到「比进度新的关键帧」就立刻回调。
 * 不等整块下完，这样延迟最低。
 * onTag(tagObj) 返回 'stop' 表示主动断开（v2 已基本不用，让上游自然结束）。
 */
function streamUpstream(url, onTag, onEnd) {
  let stopped = false;
  let buf = Buffer.alloc(0);
  let headerDone = false;
  let idleTimer = null;
  let lastDataAt = Date.now();

  const finish = err => {
    if (stopped) return;
    stopped = true;
    if (idleTimer) clearInterval(idleTimer);
    try { req.destroy(); } catch (_) {}
    onEnd(err);
  };

  const req = https.get(url, { headers: { 'user-agent': UA, accept: '*/*' } }, res => {
    if (res.statusCode !== 200) {
      res.resume();
      return finish(new Error('HTTP ' + res.statusCode));
    }
    // 不主动断开：让上游自己给完、自己断。它给的这一段是连续完整的，
    // 主动掐断反而会截断 GOP、造成播放器卡住。
    // 只在长时间完全没数据时才兜底轮转（v2 放宽到 6 秒）。
    idleTimer = setInterval(() => {
      if (stopped) return;
      if (Date.now() - lastDataAt > IDLE_ROTATE_MS) finish(null);
    }, 500);

    res.on('data', chunk => {
      if (stopped) return;
      lastDataAt = Date.now();
      buf = Buffer.concat([buf, chunk]);

      if (!headerDone) {
        if (buf.length < 13) return;
        if (buf.toString('ascii', 0, 3) !== 'FLV') {
          buf = Buffer.alloc(0);
          return onEnd(new Error('不是 FLV'));
        }
        headerDone = true;
        onTag({ header: buf.slice(0, 13) });
        buf = buf.slice(13);
      }

      let p = 0;
      while (p + 11 <= buf.length) {
        const size = buf.readUIntBE(p + 1, 3);
        const total = 11 + size + 4;
        if (p + total > buf.length) break;
        const type = buf[p];
        const ts = buf.readUIntBE(p + 4, 3) | (buf[p + 7] << 24);
        const tag = buf.slice(p, p + total);
        let isKey = false, isSeq = false, isASeq = false;
        if (type === 9 && size > 1) {
          isSeq = (tag[11] & 0x0f) === 7 && tag[12] === 0;
          isKey = (tag[11] >> 4) === 1 && tag[12] === 1;
        }
        // ★ 音频 AAC sequence header（AudioSpecificConfig）
        // SoundFormat 高 4 位 = 10 表示 AAC，AACPacketType = 0 表示配置头。
        // 之前漏掉了这个，导致 FLV→TS 转封装时 ffmpeg 拿不到采样率/声道数，
        // 只能瞎猜（实测猜成 mono + AAC-LTP），播放器解不出声音。
        if (type === 8 && size > 1) {
          isASeq = (tag[11] >> 4) === 10 && tag[12] === 0;
        }
        p += total;
        const r = onTag({ type, ts, buf: tag, isKey, isSeq, isASeq });
        if (r === 'stop') { finish(null); return; }
      }
      buf = p > 0 ? buf.slice(p) : buf;
    });
    res.on('end', () => finish(null));
    res.on('error', e => finish(e));
  });
  req.on('error', e => finish(e));
  req.setTimeout(30000, () => finish(new Error('timeout')));

  return { close() { finish(null); } };
}

// ---------------- 共享上游拉流器 ----------------
const subscribers = new Set();   // { onTag(tag) }

let pullerStarted = false;
let pullerTimer = null;
let lastTs = -1;
let lastAudioTs = -1;
let tsBase = -1;
let sentSeq = false;
let seqHeader = null;
let sentASeq = false;          // 音频 AAC 配置头是否已发送
let audioSeqHeader = null;     // 音频 AAC 配置头（缺了它转 TS 就没声音）
let accepting = false;
let consecutiveFails = 0;        // 连续失败次数，用于自动降码率
let lastKeyframeAt = Date.now();
let lastProgressAt = Date.now(); // 上次时间戳推进的时刻，用于卡死检测
let statBytes = 0;               // 统计窗口内输出字节
let statStart = Date.now();

// 每 5 秒打印一次实际输出码率，可直接看出是否存在重复发送
setInterval(() => {
  const dt = (Date.now() - statStart) / 1000;
  if (dt < 5) return;
  const mbps = (statBytes * 8 / dt / 1e6).toFixed(2);
  log(`输出速率 ${mbps} Mbps | 已播进度 ${(Math.max(0, lastTs - tsBase) / 1000).toFixed(1)}s | 订阅者 ${subscribers.size}`);
  statBytes = 0;
  statStart = Date.now();
}, 5000).unref();

// 看门狗 + 动态补拉
// 不同房间/码率档的 CDN 分块长度差异很大（实测 8M 档一块只有 2.4 秒，
// 4M 档有 8 秒）。固定并发数在碎块房间会供不上内容 → 播放断续。
// 这里改成：一旦发现 1.5 秒没新内容就立刻追加连接（临时放宽上限），
// 只有真正长时间断流才重置同步状态。
setInterval(() => {
  const gap = Date.now() - lastProgressAt;
  if (gap > 1500 && activePulls < maxPulls() + 2) {
    pullOnce();
  }
  if (gap > 8000) {
    log(`检测到 ${(gap / 1000).toFixed(0)} 秒无新内容，强制重新同步`);
    accepting = false;
    lastProgressAt = Date.now();
  }
}, 1000).unref();

function broadcast(item) {
  if (item.buf) statBytes += item.buf.length;
  for (const s of subscribers) {
    try { s.onTag(item); } catch (_) {}
  }
}

// ★ v2.2 并发预读拉流
// 串行拉流（一条断才开下一条）存在致命缺陷：每次重连都有网络延迟，
// 而 CDN 的直播内容在持续前进，导致块与块之间出现 1~2 秒的空隙。
// 实测串行模式下 30fps 的流只剩 24.7fps（丢 18.5% 的帧）→ 画面明显掉帧。
// 改成每 2 秒发起一条新连接、最多 4 条并发，任意时刻都有连接覆盖当前直播进度，
// 块间空隙被后续连接补齐，帧率恢复完整。
const PULL_INTERVAL_MS = 2000;   // 每 2 秒发起一条新连接
// 并发数按码率自适应：8M 档开 4 条会吃掉 30Mbps+，普通宽带扛不住；
// 低码率时多开几条能更好地补齐块间空隙。
function maxPulls() {
  return BITRATE >= 8000 ? 2 : BITRATE >= 4000 ? 3 : 4;
}
let activePulls = 0;

function startPuller() {
  if (pullerStarted) return;
  pullerStarted = true;
  pullOnce();                                    // 立刻开一条
  pullerTimer = setInterval(() => {              // 之后持续补充
    if (activePulls < maxPulls()) pullOnce();
  }, PULL_INTERVAL_MS);
}

function pullOnce() {
  if (activePulls >= maxPulls()) return;
  activePulls++;

  let released = false;
  const release = err => {
    if (released) return;
    released = true;
    activePulls--;
    if (err && /403|401/.test(err.message)) { cachedUrl = null; urlFetchedAt = 0; }
    if (err && !/403|401|HTTP 4|timeout|ECONNRESET|aborted/.test(err.message)) {
      consecutiveFails++;
      maybeDowngrade();
    }
  };

  getStreamUrl(false)
    .then(info => {
      consecutiveFails = 0;
      // 每条连接带独立随机参数，强制 CDN 回源，
      // 否则同一 URL 会被 CDN 缓存成固定快照，多条连接拿到完全相同的内容。
      const u = withRatio(info.url, BITRATE) +
        '&_=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      streamUpstream(u, onPullerTag, release);
    })
    .catch(e => {
      log(`取流失败: ${e.message}`);
      release(e);
    });
}

/** 自动降码率：连续失败 3 次就降一档，减少卡顿 */
function maybeDowngrade() {
  if (!AUTO_BITRATE) return;
  if (consecutiveFails >= 3 && bitrateIdx < BITRATE_LADDER.length - 1) {
    bitrateIdx++;
    BITRATE = BITRATE_LADDER[bitrateIdx];
    consecutiveFails = 0;
    cachedUrl = null;   // 强制重新取流，让新码率生效
    log(`网络不稳定，自动降码率到 ${BITRATE / 1000}M`);
  }
}

function onPullerTag(item) {
  if (item.header) return;                 // FLV 头由各输出自己处理

  const t = item;
  if (tsBase < 0 && t.ts >= 0) tsBase = t.ts;

  if (t.isSeq) {
    if (!sentSeq) {
      sentSeq = true;
      seqHeader = rewriteTs(t.buf, t.ts);   // 配置头也要归零，否则首帧时间戳异常
      broadcast({ kind: 'seq', buf: seqHeader });
      log('已捕获视频 AVC 配置头');
    }
    return;
  }

  // 音频 AAC 配置头：必须单独转发，否则下游（尤其 -c copy 转 TS）拿不到
  // 采样率/声道数，会把 44.1kHz stereo 猜成 mono，直接导致没声音
  if (t.isASeq) {
    if (!sentASeq) {
      sentASeq = true;
      audioSeqHeader = rewriteTs(t.buf, t.ts);
      broadcast({ kind: 'aseq', buf: audioSeqHeader });
      log('已捕获音频 AAC 配置头');
    }
    return;
  }

  if (t.isKey) {
    lastKeyframeAt = Date.now();
    if (t.ts > lastTs) {
      accepting = true;
      lastTs = t.ts;
      lastProgressAt = Date.now();
      broadcast({ kind: 'video', key: true, ts: relTs(t.ts), buf: rewriteTs(t.buf, t.ts) });
      return;
    }
    // v2 修复：不再返回 'stop' 主动截断。旧关键帧直接丢弃即可，
    // 让这条连接自然结束，避免截断 GOP 导致播放器卡住。
    return;
  }

  // 音频：独立按自己的时间戳去重，不受视频关键帧门控
  if (t.type === 8) {
    if (t.ts > lastAudioTs) {
      lastAudioTs = t.ts;
      broadcast({ kind: 'audio', key: false, ts: relTs(t.ts), buf: rewriteTs(t.buf, t.ts) });
    }
    return;
  }

  if (!accepting) return;
  // ★ v2.1 关键修复：必须丢弃时间戳不新的帧。
  // 旧代码只更新 lastTs 却照发不误，导致 CDN 返回的重叠块被整段重复广播：
  //   → 下游 DTS 非单调（时间戳倒退）
  //   → H.264 参考链错乱（co located POCs unavailable / mmco: unref short failure）
  //   → 播放器持续掉帧，且带宽被放大数倍（实测 4M 码率被放大到 39Mbps）
  if (t.ts <= lastTs) return;
  lastTs = t.ts;
  lastProgressAt = Date.now();
  broadcast({
    kind: 'video',
    key: false,
    ts: relTs(t.ts),
    buf: rewriteTs(t.buf, t.ts),
  });
}

function relTs(ts) {
  return tsBase < 0 ? 0 : Math.max(0, ts - tsBase);
}

/**
 * 把 FLV tag 的时间戳改写成「从 0 开始」的相对时间。
 * 虎牙原始时间戳是开播至今的毫秒数（可能几百万），
 * 直接透传会让播放器把它当成点播文件、一开播就跳到末尾导致卡住。
 */
function rewriteTs(tag, ts) {
  if (tsBase < 0) return tag;
  const rel = Math.max(0, ts - tsBase);
  const out = Buffer.from(tag);
  out[4] = (rel >> 16) & 0xff;
  out[5] = (rel >> 8) & 0xff;
  out[6] = rel & 0xff;
  out[7] = (rel >> 24) & 0xff;
  return out;
}

// ---------------- FLV 客户端输出 ----------------
function handleClient(client) {
  let closed = false;
  let bytes = 0;
  let sentHeader = false;
  let pending = [];
  let pendingBytes = 0;
  let firstDataAt = 0;

  client.writeHead(200, {
    'content-type': 'video/x-flv',
    'cache-control': 'no-cache, no-store',
    'pragma': 'no-cache',
    'connection': 'keep-alive',
    'access-control-allow-origin': '*',
  });
  client.socket && client.socket.setNoDelay(true);

  function emit(buf) {
    if (closed || !buf || !buf.length) return;
    if (sentHeader) { bytes += buf.length; client.write(buf); return; }
    pending.push(buf);
    pendingBytes += buf.length;
    if (pendingBytes >= PREROLL_BYTES || (firstDataAt && Date.now() - firstDataAt >= PREROLL_MS)) flush();
  }

  function flush() {
    if (closed || sentHeader || !pending.length) return;
    sentHeader = true;
    const blob = Buffer.concat(pending);
    pending = [];
    pendingBytes = 0;
    bytes += blob.length;
    client.write(blob);
    log(`FLV 客户端开始输出，预缓冲 ${(blob.length / 1048576).toFixed(2)}MB`);
  }

  // FLV 头：固定 9 字节头 + 音视频标志
  const flvHeader = Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]);
  emit(flvHeader);
  if (seqHeader) emit(seqHeader);
  if (audioSeqHeader) emit(audioSeqHeader);   // 音频配置头必须紧跟视频头

  const prerollTimer = setInterval(() => {
    if (closed) { clearInterval(prerollTimer); return; }
    if (!sentHeader && pending.length && firstDataAt && Date.now() - firstDataAt >= PREROLL_MS) {
      flush();
      clearInterval(prerollTimer);
    }
  }, 200);

  const sub = {
    onTag(item) {
      if (closed) return;
      if (item.kind === 'seq' || item.kind === 'aseq') { emit(item.buf); return; }
      if (!firstDataAt) firstDataAt = Date.now();
      emit(item.buf);
    },
  };
  subscribers.add(sub);

  const stop = () => {
    if (closed) return;
    closed = true;
    subscribers.delete(sub);
    clearInterval(prerollTimer);
    try { client.end(); } catch (_) {}
    log(`FLV 客户端断开 (已发 ${(bytes / 1048576).toFixed(1)}MB)`);
  };
  client.on('close', stop);
  client.on('error', stop);
}

// ---------------- HTTP 服务 ----------------
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname === '/live.flv' || u.pathname === '/' || u.pathname === '/live') {
    log(`FLV 客户端接入 ${req.socket.remoteAddress}${u.pathname}`);
    return handleClient(res);
  }
  if (u.pathname === '/live.m3u8') {
    return serveHlsPlaylist(res);
  }
  if (u.pathname.startsWith('/hls/')) {
    return serveHlsSegment(res, u.pathname.slice('/hls/'.length));
  }
  if (u.pathname === '/url') {
    getStreamUrl(true).then(
      r => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(r, null, 1)); },
      e => { res.writeHead(500); res.end(e.message); }
    );
    return;
  }
  res.writeHead(404); res.end('try /live.flv or /live.m3u8');
});

// ---------------- HLS 输出 ----------------
/**
 * PotPlayer 播放「无限长的 FLV」时会卡住（它按有限文件处理）。
 * 所以额外提供 HLS：自己把 FLV 重新封装成 TS 分片，播 m3u8 就正常了。
 * 分片直接由 ffmpeg 从本地 /live.flv 转出，写到临时目录。
 */
const HLS_DIR = path.join(os.tmpdir(), 'huya-hls-' + PORT);
let hlsProc = null;
let hlsRestartTimer = null;   // 自动重启定时器
let hlsRestarts = 0;          // 连续重启次数，用于退避和熔断

function startHlsPackager() {
  if (hlsProc) return;
  try { fs.rmSync(HLS_DIR, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(HLS_DIR, { recursive: true });

  const ff = detectFfmpeg();
  if (!ff) { log('没找到 ffmpeg，HLS 模式不可用（FLV 模式仍可）'); return; }

  // ★ v2.2 重编码 + CFR
  // 上游块拼接不可避免会留下少量缺口（实测 27.8fps，缺 8%），
  // 直接 -c copy 转封装会把这些缺口原样传给播放器 → 画面顿一下。
  // 这里改用 NVENC 重编码并强制 CFR 30fps：缺口由重复帧补齐，
  // 播放器拿到的是时间轴完全均匀的流，不会再掉帧。
  // 显卡不支持时自动退回 libx264；实在不行退回 -c copy。
  // 默认原画直通（-c copy，画质 100% 无损）；加 --transcode 才启用重编码。
  // 仍兼容旧的 --no-transcode 写法。
  const TRANSCODE = flags.transcode ? true : (flags['no-transcode'] ? false : false);
  // 帧率跟随源流：主播推 60fps 就按 60fps 出，不要无故砍半
  const FPS = parseInt(flags.fps, 10) || (BITRATE >= 8000 ? 60 : 30);

  let args;
  if (TRANSCODE) {
    args = [
      '-hide_banner', '-loglevel', 'error',
      // 本地回环也加重连：中继重启/预缓冲期间 ffmpeg 不会因短暂无数据而退出
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '3',
      '-fflags', '+genpts+discardcorrupt+igndts',
      '-i', `http://127.0.0.1:${PORT}/live.flv`,
      '-c:v', 'h264_nvenc',
      // ★ 画质优先：p1 是最快档、画质最差，改成 p5；
      // 同时显式指定 High profile（NVENC 默认输出 Main，压缩效率低 10~15%）
      '-preset', 'p5',
      '-tune', 'hq',
      '-profile:v', 'high',
      // VBR + 目标质量：静态画面自动省码率，动态画面才拉高，整体观感比 CBR 好
      '-rc', 'vbr',
      '-cq', '20',
      '-b:v', `${BITRATE}k`,
      '-maxrate', `${Math.round(BITRATE * 1.25)}k`,
      '-bufsize', `${BITRATE * 2}k`,
      '-g', String(FPS * 2),
      '-fps_mode', 'cfr',
      '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '128k',
      '-f', 'hls',
      '-hls_time', '1',
      '-hls_list_size', '8',
      '-hls_flags', 'delete_segments+omit_endlist',
      '-hls_segment_filename', path.join(HLS_DIR, 'seg%05d.ts'),
      path.join(HLS_DIR, 'live.m3u8'),
    ];
  } else {
    args = [
      '-hide_banner', '-loglevel', 'error',
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '3',
      '-fflags', '+genpts+discardcorrupt+igndts',
      '-i', `http://127.0.0.1:${PORT}/live.flv`,
      '-c', 'copy',
      '-f', 'hls',
      '-hls_time', '1',
      '-hls_list_size', '8',
      '-hls_flags', 'delete_segments+omit_endlist',
      '-hls_segment_filename', path.join(HLS_DIR, 'seg%05d.ts'),
      path.join(HLS_DIR, 'live.m3u8'),
    ];
  }
  log(`HLS 分片器启动: ${ff}${TRANSCODE ? `（NVENC 重编码 ${FPS}fps CFR）` : '（直接转封装）'}`);
  hlsProc = spawn(ff, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  // 捕获 ffmpeg 的 stderr：正常时不输出，出错时把原因打进日志便于排查
  let errLines = 0;
  hlsProc.stderr.on('data', d => {
    if (errLines >= 5) return;
    const msg = String(d).trim();
    if (!msg) return;
    errLines++;
    log(`[ffmpeg] ${msg.split('\n').slice(0, 2).join(' | ').slice(0, 240)}`);
  });
  // 稳定跑满 30 秒就把失败计数清零，避免历史失败累积导致误熔断
  setTimeout(() => { if (hlsProc) hlsRestarts = 0; }, 30000).unref();
  hlsProc.on('error', e => { log(`HLS 分片器启动失败: ${e.message}`); hlsProc = null; });
  hlsProc.on('exit', code => {
    hlsProc = null;
    // ffmpeg 偶发退出（上游短暂断流、目录竞争等）不应让播放永久中断，
    // 只要还有人在看就 2 秒后自动重启，连续失败则退避。
    if (code === 0 || hlsRestartTimer) return;
    hlsRestarts++;
    if (hlsRestarts > 20) {
      log(`HLS 分片器连续退出 ${hlsRestarts} 次，停止自动重启`);
      return;
    }
    const delay = Math.min(2000 * Math.min(hlsRestarts, 5), 10000);
    log(`HLS 分片器退出 (code ${code})，${delay / 1000} 秒后自动重启`);
    hlsRestartTimer = setTimeout(() => {
      hlsRestartTimer = null;
      if (subscribers.size > 0 || OPEN) startHlsPackager();
    }, delay);
  });
}

function serveHlsPlaylist(res) {
  startHlsPackager();
  const f = path.join(HLS_DIR, 'live.m3u8');
  if (!fs.existsSync(f)) { res.writeHead(503); return res.end('HLS 还在准备，请稍候重试'); }
  const body = fs.readFileSync(f, 'utf8')
    .replace(/^(seg\d+\.ts)$/gm, '/hls/$1');
  res.writeHead(200, {
    'content-type': 'application/vnd.apple.mpegurl',
    'cache-control': 'no-cache',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

function serveHlsSegment(res, name) {
  if (!/^seg\d+\.ts$/.test(name)) { res.writeHead(400); return res.end('bad'); }
  const f = path.join(HLS_DIR, name);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('gone'); }
  res.writeHead(200, { 'content-type': 'video/mp2t', 'cache-control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}

// ---------------- 启动 ----------------
const USE_FLV = !!flags.flv;   // --flv: 低延迟模式，直接播 FLV，不重编码

server.listen(PORT, '127.0.0.1', async () => {
  log(`中继已启动 (v2.3)`);
  log(`  播放器: ${PLAYER || '未找到（可用 --player 指定，或设置 POTPLAYER_PATH）'}`);
  log(`  ffmpeg: ${detectFfmpeg()}`);
  log(`  HLS 播放地址（推荐，零掉帧）: http://127.0.0.1:${PORT}/live.m3u8`);
  log(`  FLV 播放地址（低延迟备用）: http://127.0.0.1:${PORT}/live.flv`);
  startPuller();
  try {
    const info = await getStreamUrl(true);
    log(`房间 ${ROOM} -> 房间号 ${cachedRoomId}，节点 [${info.cdn}]，码率档 ${BITRATE / 1000}M`);
    if (info.nickname) log(`主播: ${info.nickname}`);
    if (info.title) log(`标题: ${info.title}`);
  } catch (e) {
    log(`预检失败: ${e.message}（仍会持续重试）`);
  }

  // 后台测速，选最快 CDN（不阻塞启动）
  setTimeout(probeCdnSpeed, 1000);

  if (OPEN) {
    if (!USE_FLV) {
      startHlsPackager();
      setTimeout(openPlayer, 10000);   // 重编码需要更久预热，等 10 秒
    } else {
      setTimeout(openPlayer, 5000);
    }
  }
});

function openPlayer() {
  if (!PLAYER) {
    const url = USE_FLV
      ? `http://127.0.0.1:${PORT}/live.flv`
      : `http://127.0.0.1:${PORT}/live.m3u8`;
    log('未找到 PotPlayer，无法自动拉起播放器。');
    log('  解决办法（任选其一）：');
    log('    1. 安装 PotPlayer：https://potplayer.daum.net/');
    log('    2. 指定路径：node huya-relay.js <房间> --player "D:\\...\\PotPlayerMini64.exe"');
    log('    3. 设置环境变量 POTPLAYER_PATH 指向 PotPlayerMini64.exe');
    log(`  或者手动用任意播放器打开：${url}`);
    return;
  }
  const url = USE_FLV
    ? `http://127.0.0.1:${PORT}/live.flv`
    : `http://127.0.0.1:${PORT}/live.m3u8`;
  log(`启动播放器: ${PLAYER}`);
  log(`播放地址: ${url}`);
  spawn(PLAYER, [url], { detached: true, stdio: 'ignore' }).unref();
}

function probeExisting(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/url`, { timeout: 4000 }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (_) { reject(new Error('不是本中继')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
  });
}

// 端口被占用：多半是上次的中继没关干净。
server.on('error', err => {
  if (err.code !== 'EADDRINUSE') {
    console.error('中继启动失败:', err.message);
    process.exit(1);
  }
  log(`端口 ${PORT} 已被占用，检测是否已有中继在运行...`);
  probeExisting(PORT)
    .then(info => {
      log(`发现正在运行的中继（节点 [${info.cdn || '?'}]），直接复用它。`);
      log(`播放地址: http://127.0.0.1:${PORT}/${USE_FLV ? 'live.flv' : 'live.m3u8'}`);
      if (OPEN) openPlayer();
      setTimeout(() => process.exit(0), OPEN ? 2500 : 0);
    })
    .catch(() => {
      console.error(`端口 ${PORT} 被其他程序占用，且不像是本中继。`);
      console.error(`换个端口重试，例如:  node huya-relay.js --port 8766 --open`);
      process.exit(2);
    });
});

process.on('SIGINT', () => { log('退出'); server.close(); process.exit(0); });
