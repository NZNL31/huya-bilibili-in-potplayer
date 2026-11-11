#!/usr/bin/env node
/**
 * 一键清理播放缓存（分片）。
 *
 * 正常退出时 relay.js 自己会删干净，这个脚本是给下面几种情况兜底的：
 *   · 窗口被强行关掉 / 任务管理器结束进程 / 断电，缓存目录留下来了
 *   · 播放器还占着 .ts 文件，退出时那一刻删不掉
 *   · 旧版本（v2.8 及以前）把分片写在 %TEMP%\huya-hls-<端口>，从来没删过
 *
 * 用法（双击 clean-cache.bat 也行）：
 *   node clean-cache.js                 清理本目录 .cache 和 %TEMP% 里的旧残留
 *   node clean-cache.js --stop          先结束后台正在跑的中继，再清缓存
 *   node clean-cache.js --dry-run       只看会清掉多少，不真删
 *   node clean-cache.js --keep-recent   保留「一分钟内还在写」的目录（正在播时用）
 *   node clean-cache.js --cache-dir D:\x  清指定目录（和 relay.js --cache-dir 对应）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const KEEP_RECENT = argv.includes('--keep-recent');
const STOP = argv.includes('--stop');
const customIdx = argv.indexOf('--cache-dir');
const CACHE_ROOT = customIdx >= 0 && argv[customIdx + 1]
  ? path.resolve(argv[customIdx + 1])
  : path.join(__dirname, '.cache');

/** 同步睡一会儿：刚杀掉的进程要一点时间放掉文件句柄 */
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {}
}

/** 统计目录大小（字节） */
function dirSize(dir) {
  let total = 0;
  let files = 0;
  try {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const sub = dirSize(p);
        total += sub.bytes; files += sub.files;
      } else {
        try { total += fs.statSync(p).size; files++; } catch (_) {}
      }
    }
  } catch (_) {}
  return { bytes: total, files };
}

function mb(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

/**
 * 杀掉和本工具相关、但已经没爹的 ffmpeg。
 * 只认命令行里带缓存目录或本地中继地址的进程，绝不误杀用户自己的转码任务。
 */
function killOrphanFfmpeg() {
  if (process.platform !== 'win32' || DRY) return 0;
  const ps =
    'Get-CimInstance Win32_Process -Filter "Name=\'ffmpeg.exe\'" | ' +
    'Where-Object { $_.CommandLine -match \'hls-\\d+|huya-hls-\\d+|127\\.0\\.0\\.1:\\d+/live\\.flv\' } | ' +
    'ForEach-Object { $_.ProcessId }';
  let ids = [];
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (r && r.stdout) ids = r.stdout.split(/\s+/).filter(s => /^\d+$/.test(s));
  } catch (_) {}

  // 老系统没有 CIM 就退回 wmic
  if (!ids.length) {
    try {
      const r = spawnSync('wmic', ['process', 'where', "name='ffmpeg.exe'", 'get', 'ProcessId,CommandLine', '/format:csv'],
        { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      const out = (r && r.stdout) || '';
      for (const line of out.split(/\r?\n/)) {
        if (!/hls-\d+|huya-hls-\d+|127\.0\.0\.1:\d+\/live\.flv/.test(line)) continue;
        const m = line.match(/(\d+)\s*$/);
        if (m) ids.push(m[1]);
      }
    } catch (_) {}
  }

  let killed = 0;
  for (const id of new Set(ids)) {
    const r = spawnSync('taskkill', ['/PID', String(id), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    if (r && r.status === 0) killed++;
  }
  return killed;
}

/**
 * 结束后台正在跑的中继（关掉播放器时会自动退，这个只是备用手段）。
 * 只找命令行里带 relay.js 的 node 进程，不碰别的 Node 程序。
 */
function stopRelay() {
  if (process.platform !== 'win32' || DRY) return 0;
  let ids = [];
  try {
    const ps =
      'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" | ' +
      'Where-Object { $_.CommandLine -like \'*relay.js*\' } | ' +
      'ForEach-Object { $_.ProcessId }';
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (r && r.stdout) ids = r.stdout.split(/\s+/).filter(s => /^\d+$/.test(s));
  } catch (_) {}

  if (!ids.length) {
    try {
      const r = spawnSync('wmic', ['process', 'where', "name='node.exe'", 'get', 'ProcessId,CommandLine', '/format:csv'],
        { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      for (const line of ((r && r.stdout) || '').split(/\r?\n/)) {
        if (!/relay\.js/.test(line)) continue;
        const m = line.match(/(\d+)\s*$/);
        if (m) ids.push(m[1]);
      }
    } catch (_) {}
  }

  let killed = 0;
  for (const id of new Set(ids)) {
    const r = spawnSync('taskkill', ['/PID', String(id), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    if (r && r.status === 0) killed++;
  }
  return killed;
}

/** 找出要清的目录：本目录 .cache 整体 + %TEMP% 里旧版本留下的 huya-hls-* */
function targets() {
  const list = [];
  if (fs.existsSync(CACHE_ROOT)) {
    let st = null;
    try { st = fs.statSync(CACHE_ROOT); } catch (_) {}
    if (st && st.isDirectory()) list.push(CACHE_ROOT);
  }
  const tmp = os.tmpdir();
  if (path.resolve(tmp) !== path.resolve(CACHE_ROOT)) {
    let names = [];
    try { names = fs.readdirSync(tmp); } catch (_) {}
    for (const name of names) {
      if (!/^huya-hls-\d+$/.test(name)) continue;   // 只认旧版本自己的目录名
      const dir = path.join(tmp, name);
      try { if (fs.statSync(dir).isDirectory()) list.push(dir); } catch (_) {}
    }
  }
  return list;
}

function main() {
  console.log('');
  console.log('  清理播放缓存（HLS 分片）');
  console.log('  ' + '-'.repeat(42));

  if (STOP) {
    if (DRY) {
      console.log('  --dry-run：跳过「结束后台中继」这一步');
    } else {
      const n = stopRelay();
      console.log(n ? `  已结束后台中继（${n} 个进程）` : '  没有正在运行的中继');
      if (n) sleepSync(500);   // 等它放掉分片文件的句柄
    }
  }

  const killed = killOrphanFfmpeg();
  if (killed) console.log(`  已结束 ${killed} 个残留的 ffmpeg 进程`);

  const dirs = targets();
  if (!dirs.length) {
    console.log('  没有需要清理的缓存，很干净。');
    console.log('');
    return 0;
  }

  let total = 0;
  let files = 0;
  let failed = 0;
  for (const dir of dirs) {
    let st = null;
    try { st = fs.statSync(dir); } catch (_) { continue; }
    if (KEEP_RECENT && Date.now() - st.mtimeMs < 60000) {
      console.log(`  跳过（正在写入）: ${dir}`);
      continue;
    }
    const s = dirSize(dir);
    if (DRY) {
      console.log(`  会清理 ${mb(s.bytes)} (${s.files} 个分片): ${dir}`);
      total += s.bytes; files += s.files;
      continue;
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  已清理 ${mb(s.bytes)} (${s.files} 个分片): ${dir}`);
      total += s.bytes; files += s.files;
    } catch (e) {
      failed++;
      console.log(`  删不掉: ${dir}`);
      console.log(`    原因: ${e.message}`);
      if (/EBUSY|EPERM|EACCES/i.test(e.code || e.message)) {
        console.log('    多半是 PotPlayer / 播放器还占着分片文件。先关掉播放器，再运行一次。');
      }
    }
  }

  console.log('  ' + '-'.repeat(42));
  if (DRY) {
    console.log(`  预计可释放 ${mb(total)}（${files} 个文件），加 --dry-run 只是预演，什么都没删。`);
  } else {
    console.log(`  共释放 ${mb(total)}（${files} 个文件）${failed ? `，${failed} 个目录没删掉` : ''}`);
  }
  console.log('');
  return failed ? 1 : 0;
}

process.exitCode = main();
