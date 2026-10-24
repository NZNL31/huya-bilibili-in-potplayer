# 在 PotPlayer 里看虎牙直播

> 把虎牙直播的碎块流拼成连续流，用 PotPlayer / VLC / mpv 播 1080p60 原画。
> **双击即用。不用装 Node.js，不用装 ffmpeg，不用管理员权限。**

---

## 一句话说明

虎牙的直链丢给 PotPlayer 只能播几秒就断，这个程序在你自己电脑上把它拼成连续流，让 PotPlayer 能正常播 1080p60 原画。

> 🤖 **不想自己动手？** [把下面那段话复制给任何 AI](#懒人模式让-ai-帮你装)，它会替你装好、配好、开播。

---

## ⚡ 使用（两步）

### 第 1 步：下载解压

点右上角绿色 **`Code`** → **`Download ZIP`** → 解压到任意文件夹。

> 路径尽量短，比如 `D:\huya`。带空格或很深的路径偶尔会出问题。

### 第 2 步：双击 `play-huya.bat`

**第一次运行会自动准备环境**（下载约 50MB，一两分钟），屏幕上会显示进度条，等着就行。以后每次启动都是秒开。

准备完之后，窗口问你房间号：

```
  请输入直播间，支持三种写法：

    房间号      660000      （24 小时赛事频道）
    房间名      dank1ng
    完整链接    https://www.huya.com/dank1ng

  直接回车 = dank1ng

  请输入房间: _
```

输进去回车 → 问画质 → 问模式 → **一路回车**（默认就是最佳配置）→ PotPlayer 自动打开开始播。

> 🔴 **播放期间别关那个黑窗口。** 关了就是停止播放。

---

## 懒人模式：让 AI 帮你装

把下面**整段**复制，粘给任何能操作电脑的 AI（Codex / DeepSeek / Claude / Cursor / 豆包 / 通义都行），它照着做就行，你不用懂任何技术细节。

````text
帮我在 Windows 上装好并运行一个开源小工具，遇到问题自己想办法解决，不要让我做技术判断。

项目：https://github.com/NZNL31/huya-in-potplayer
作用：把虎牙直播的碎块 CDN 流拼成本地 HLS，用 PotPlayer 播放。

请按顺序做：

1. 用 PowerShell 下载并解压（解压路径别带空格和中文）。
   仓库可能叫 huya-in-potplayer，也可能还是旧名 huya-potplayer-relay，
   两个都试，哪个下载成功就用哪个。整段一次粘进去执行：
   $d="$env:USERPROFILE\huya"; $z="$env:TEMP\h.zip"; $r='huya-in-potplayer'; try { Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing } catch { $r='huya-potplayer-relay'; Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing }; Expand-Archive $z -DestinationPath $d -Force

2. 运行 "$d\$r-main\play-huya.bat"（$r 就是第 1 步下载成功的那个仓库名）
   首次运行会自动下载 Node.js 和 ffmpeg（共约 50MB），等进度条走完。

3. 窗口提示「请输入房间」时直接回车（默认 dank1ng）；想先确认能播，输 660000（24 小时赛事频道）。

4. 接着问画质、问模式，两次都直接回车（默认就是最佳配置）。

5. PotPlayer 会自动打开播放。播放期间不要关闭那个命令行窗口。

注意事项：
- 没装 PotPlayer 的话先装：https://potplayer.daum.net/
- 如果自动下载失败，手动把 node.exe 放进 runtime\ 目录，
  把 ffmpeg.exe 放进项目根目录（和 play-huya.bat 同一层），再双击一次
- 换台就重新双击 play-huya.bat，输入新房间号
````

### 或者自己粘一行命令

开始菜单搜 **PowerShell** 打开，粘这一行回车，剩下的和双击一样：

```powershell
$ProgressPreference='SilentlyContinue'; $d="$env:USERPROFILE\huya"; $z="$env:TEMP\h.zip"; $r='huya-in-potplayer'; try { Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing } catch { $r='huya-potplayer-relay'; Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing }; Expand-Archive $z -DestinationPath $d -Force; & "$d\$r-main\play-huya.bat"
```

> 这行命令做的事：下载 → 解压到 `%USERPROFILE%\huya` → 启动。只有 26KB，秒下。
> 仓库改名过渡期，新旧两个名字都会试一遍，哪个能下用哪个。

---

## 首次运行在干什么？

| 补什么 | 装到哪 | 大小 |
|--------|--------|------|
| Node.js 便携版 | 本文件夹的 `runtime\node.exe` | 约 30MB |
| ffmpeg 便携版 | 本文件夹的 `ffmpeg.exe` | 约 22MB |

- **不写注册表**，不往系统里塞东西，卸载就是删文件夹
- **不需要管理员权限**，不会弹 UAC
- **不用重启**，下完立刻能用
- 如果你电脑上**已经装了** Node.js 或 ffmpeg，程序会自动用你现有的，**不会重复下载**
- **只缺哪个下哪个**——第二次启动发现齐全就直接跳过，不联网

全部文件都在项目文件夹里，你随时可以自己删。删掉 `ffmpeg.exe` 再运行一次，它会重新下载一份。

---

## 房间号怎么找

打开虎牙网页版，进任意直播间，看浏览器地址栏：

```
https://www.huya.com/825803        ← 825803 是房间号
https://www.huya.com/dank1ng      ← dank1ng 是房间名，也能用
```

**整个网址粘进去也行**，程序会自动提取。上次用过的房间会记住，下次直接回车就能沿用。

没记住过的时候，**直接回车默认 `dank1ng`**（房间号 10188）。

### 不知道看什么？试试 24 小时频道

`660000` 是虎牙官方的英雄联盟赛事频道，基本全天在播，适合第一次装上先确认能用：

```
  请输入房间: 660000
```

> 没比赛的时候它会放预告画面，属于正常，能出画面就说明一切正常。

另外 `825803`（完美世界电竞频道三）也是长期轮播的电竞赛事频道。

---

## 画质和模式怎么选

### 画质

| 选项 | 是什么 | 什么时候选 |
|------|--------|-----------|
| `[1]` 蓝光8M | 1080p / 60 帧 | ✅ **默认，直接回车** |
| `[2]` 蓝光4M | 1080p / 30 帧 | 网络一般，或 8M 卡的时候 |
| `[3]` 超清2M | 720p 级别 | 网络很差，只求能看 |

> 8M 档峰值能到 **15Mbps**。家里带宽 20M 以下建议选 4M。

### 模式

| 选项 | 画质 | 流畅度 | 延迟 | 什么时候选 |
|------|------|--------|------|-----------|
| `[1]` 原画直通 | 无损 | 好 | 约 5 秒 | ✅ **默认，直接回车** |
| `[2]` 流畅优先 | 轻微二次编码 | 最好 | 约 7 秒 | 原画模式看着还有点顿的时候 |
| `[3]` 低延迟 | 无损 | 一般 | 约 3 秒 | 看比赛，要跟弹幕同步 |

**一句话**：先全回车用默认。画面有轻微顿挫，再重新运行选 `[2]`。

---

## 常见问题

### 双击后窗口一闪就没了

说明环境准备那一步没跑起来。手动跑一次就能看到真正的原因：

1. 在文件夹空白处**右键 → 在终端中打开**（没有这一项就在地址栏输 `cmd` 回车）
2. 输入 `play-huya.bat` 回车
3. 看它报什么错

最常见的是**杀毒软件拦了 `setup.ps1`**——把这个文件夹加进白名单再试。

### 首次运行卡在下载

网络问题。等它自己换源重试；还不行就手动来：

1. 下载这两个文件（浏览器打开即可）
   - Node.js：`https://npmmirror.com/mirrors/node/v20.18.0/node-v20.18.0-win-x64.zip`
   - ffmpeg：`https://registry.npmmirror.com/@ffmpeg-installer/win32-x64/-/win32-x64-4.1.0.tgz`
2. Node.js 那个 zip 解压，把里面的 `node.exe` 放进本文件夹新建的 `runtime` 文件夹
3. ffmpeg 那个 tgz 用 7-Zip 解开两层，把 `ffmpeg.exe` 放进本文件夹
4. 重新双击 `play-huya.bat`

### 提示「端口 8765 被占用」

上次的中继没退干净。程序一般会自动复用；还是不行就手动清掉：

```bat
netstat -ano | findstr :8765
taskkill /PID 12345 /F
```

（把 `12345` 换成上面查到的最后一列数字）

### 没有声音

按顺序查：

1. **换 VLC 打开同一个地址**，排除播放器问题
2. **看黑窗口里有没有这两行**：
   ```
   已捕获视频 AVC 配置头
   已捕获音频 AAC 配置头
   ```
   少了第二行说明音频配置头没抓到，关掉重开一次
3. **ffmpeg 太旧**：删掉文件夹里的 `ffmpeg.exe`，重新双击 `play-huya.bat` 让它重下

### 画面卡顿 / 掉帧

1. **换模式** → 重新运行，模式选 `[2] 流畅优先`
2. **降码率** → 画质选 `[2] 蓝光4M`
3. **看带宽** → 任务管理器看网络有没有跑满

### 主播没开播

程序会提示并一直重试。**别关窗口**，开播后会自动接上。

---

## 🔧 进阶：命令行

```bat
:: 最简单
node huya-relay.js 825803 --open

:: 指定画质 4M
node huya-relay.js 825803 --bitrate 4000 --open

:: 用完整链接
node huya-relay.js https://www.huya.com/dank1ng --open

:: 流畅优先（NVENC 重编码）
node huya-relay.js 825803 --transcode --open

:: 低延迟（FLV 直出）
node huya-relay.js 825803 --flv --open

:: 换端口
node huya-relay.js 825803 --port 8766 --open
```

如果用的是便携版 Node，把 `node` 换成 `runtime\node.exe`。

### 全部参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `<房间>` | `dank1ng` | 房间号 / 房间名 / 完整链接，可省略 |
| `--room <值>` | — | 同上，显式指定 |
| `--port <端口>` | `8765` | 本地监听端口 |
| `--bitrate <码率>` | `8000` | `8000` 蓝光8M / `4000` 蓝光4M / `2000` 超清 |
| `--open` | 关 | 启动后自动拉起 PotPlayer |
| `--transcode` | 关 | 启用 NVENC 重编码（流畅优先） |
| `--flv` | 关 | 直接输出 FLV（低延迟） |
| `--fps <帧率>` | 跟随码率 | 重编码目标帧率，8M 档默认 60 |
| `--player <路径>` | 自动探测 | 指定 PotPlayer 可执行文件 |
| `--ffmpeg <路径>` | 自动探测 | 指定 ffmpeg 可执行文件 |

环境变量：`POTPLAYER_PATH`、`FFMPEG_PATH`。

### 不用 PotPlayer？

程序会打印地址，自己用 VLC / mpv 打开：

- **HLS（推荐）**：`http://127.0.0.1:8765/live.m3u8`
- **FLV（低延迟）**：`http://127.0.0.1:8765/live.flv`

---

## 📁 文件说明

| 文件 | 作用 | 哪来的 |
|------|------|--------|
| `play-huya.bat` | 双击入口 | 仓库自带 |
| `setup.ps1` | 首次运行检查并补齐环境 | 仓库自带 |
| `huya-launcher.js` | 交互界面：问房间 / 画质 / 模式 | 仓库自带 |
| `huya-relay.js` | 核心中继：拉流、拼接、HLS 输出 | 仓库自带 |
| `runtime\node.exe` | Node.js 便携版 | 首次运行自动下载 |
| `ffmpeg.exe` | ffmpeg 便携版 | 首次运行自动下载 |
| `last-room.txt` | 记住上次的房间 | 运行时自动生成 |

---

## 🧠 技术原理

<details>
<summary>点开看实现细节（不看也完全不影响使用）</summary>

### 三个真实痛点

| 痛点 | 现象 | 做法 |
|------|------|------|
| **分块重叠** | 时间戳倒退 → H.264 参考链断裂 → 花屏 | 严格按时间戳去重，只转发更新的帧 |
| **分块间隙** | 30fps 的流只剩 24.7fps | 并发预读 + 1.5 秒无数据就动态补拉 |
| **配置头丢失** | 转封装后没声音 / 被猜成单声道 | 单独缓存并转发 AAC sequence header |

### 关键设计

1. **并发预读** — 每 2 秒发起一条新连接，最多 2~4 条并发，用重叠覆盖 CDN 块之间的间隙
2. **动态补拉** — 1.5 秒没有新内容立即追加连接，应对碎块房间
3. **严格去重** — `if (t.ts <= lastTs) return;` 这一行消掉了全部 `Non-monotonic DTS` 警告
4. **配置头补发** — AVC / AAC 的 sequence header 单独缓存，在 FLV 头之后立即补发

### 处理链路

```
虎牙 CDN（2~8 秒碎块）
        │  并发拉取，每条带随机参数强制回源
        ▼
  Node 中继（huya-relay.js）
        │  按时间戳去重 → 补发配置头 → 重排为连续 FLV
        ▼
  http://127.0.0.1:8765/live.flv
        │
        ├─ 原画直通：ffmpeg -c copy → HLS 分片
        └─ 流畅优先：ffmpeg NVENC + CFR → HLS 分片
        ▼
   PotPlayer / VLC / mpv
```

### 实测数据

房间 825803，蓝光8M 档：

```
视频：1920x1080 / 59.94fps / H.264 High / 7484 kbps
音频：aac (LC) / 44100 Hz / stereo / 128 kbps
分片：2 秒一片，每片 120 帧（= 60fps，零丢帧）
```

</details>

---

## ⚖️ 免责声明

本项目仅供**个人学习与技术研究**使用。所有直播内容版权归虎牙及相应主播所有，请勿用于任何商业用途或二次分发。使用本工具产生的任何后果由使用者自行承担。

---

## 📄 License

[MIT](LICENSE)
