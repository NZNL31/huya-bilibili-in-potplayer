#!/usr/bin/env node
/**
 * 虎牙直播 - PotPlayer 交互式启动器
 *
 * 交互逻辑全部放在 Node 里，bat 只负责拉起本文件。
 * 这样可以彻底避开 cmd 的 GBK 编码、CRLF 换行、变量展开等一堆坑。
 */
'use strict';

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

/** 房间输入归一化：825803 / dank1ng / https://www.huya.com/825803 都支持 */
function normalizeRoom(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/huya\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  return s.split(/[?#]/)[0].trim();
}

const LINE = '==========================================';
const lastFile = path.join(__dirname, 'last-room.txt');

async function main() {
  console.log(LINE);
  console.log('        虎牙直播  -  PotPlayer');
  console.log(LINE);
  console.log('');

  // 环境自检：Node 版本过低会直接影响 fetch/文件 API
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor < 16) {
    console.log(`  [警告] Node.js 版本偏低（当前 ${process.versions.node}），建议升级到 16 或更高。`);
    console.log('');
  }

  console.log('  请输入直播间，支持三种写法：');
  console.log('');
  console.log('    房间号      825803');
  console.log('    房间名      dank1ng');
  console.log('    完整链接    https://www.huya.com/825803');
  console.log('');

  let lastRoom = '';
  try { lastRoom = fs.readFileSync(lastFile, 'utf8').trim(); } catch (_) {}

  if (lastRoom) {
    console.log(`  上次使用: ${lastRoom}   （直接回车沿用）`);
    console.log('');
  }

  const input = await ask('  请输入房间: ');
  const room = normalizeRoom(input) || lastRoom;

  if (!room) {
    console.log('');
    console.log('  [错误] 没有输入房间，退出。');
    prompt.close();
    process.exitCode = 1;
    return;
  }

  try { fs.writeFileSync(lastFile, room, 'utf8'); } catch (_) {}

  // ---------- 画质 ----------
  console.log('');
  console.log(LINE);
  console.log('        画质选择');
  console.log(LINE);
  console.log('');
  console.log('  [1] 蓝光8M   1080p60 原画质   推荐');
  console.log('  [2] 蓝光4M   1080p30          省带宽');
  console.log('  [3] 超清2M   弱网备用');
  console.log('');
  console.log('  直接回车 = 蓝光8M');
  console.log('');
  const q = await ask('  请选择 [1-3]: ');

  let bitrate = 8000;
  if (q === '2') bitrate = 4000;
  else if (q === '3') bitrate = 2000;

  // ---------- 模式 ----------
  console.log('');
  console.log(LINE);
  console.log('        播放模式');
  console.log(LINE);
  console.log('');
  console.log('  [1] 原画直通   画质 100% 无损    推荐');
  console.log('  [2] 流畅优先   重编码，绝对不掉帧');
  console.log('  [3] 低延迟     FLV 直连，延迟低约 3 秒');
  console.log('');
  console.log('  直接回车 = 原画直通');
  console.log('');
  const m = await ask('  请选择 [1-3]: ');

  const args = [room, '--bitrate', String(bitrate), '--open'];
  if (m === '2') args.push('--transcode');
  else if (m === '3') args.push('--flv');

  prompt.close();

  console.log('');
  console.log(LINE);
  console.log(`  房间: ${room}   画质: ${bitrate / 1000}M   模式: ${
    m === '2' ? '流畅优先' : m === '3' ? '低延迟' : '原画直通'
  }`);
  console.log('  正在启动中继...');
  console.log(LINE);
  console.log('');
  console.log('  首次启动约需 10 秒缓冲，PotPlayer 会自动打开。');
  console.log('  关闭本窗口即可停止播放。');
  console.log('');

  const relay = spawn(process.execPath, [path.join(__dirname, 'huya-relay.js'), ...args], {
    stdio: 'inherit',
    cwd: __dirname,
  });

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
      console.log('');
      process.exitCode = code;
    }
  });
}

main().catch(e => {
  console.error('');
  console.error('  启动失败:', e.message);
  process.exitCode = 1;
});
