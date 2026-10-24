# 在 PotPlayer 里看虎牙 / 哔哩哔哩直播

> 把虎牙和 B 站的碎块流拼成连续流，用 PotPlayer / VLC / mpv 播 1080p60 原画。
> **双击即用。不用装 Node.js，不用装 ffmpeg，不用管理员权限。**

---

## 一句话说明

虎牙的直链丢给 PotPlayer 只能播几秒就断，这个程序在你自己电脑上把它拼成连续流，让 PotPlayer 能正常播 1080p60 原画。

虎牙和 B 站两个平台都支持，同一个窗口里输入哪个都行。

> 🤖 **不想自己动手？** [把下面那段话复制给任何 AI](#懒人模式让-ai-帮你装)，它会替你装好、配好、开播。

---

## ⚡ 使用（两步）

### 第 1 步：下载解压

点右上角绿色 **`Code`** → **`Download ZIP`** → 解压到任意文件夹。

> 路径尽量短，比如 `D:\huya-bilibili`。带空格或很深的路径偶尔会出问题。

### 第 2 步：双击 `play-huya&bili.bat`

> ⚠️ 文件名里带 `&`，**双击没问题**，但在 cmd 里手打会被 `&` 截断。
> 要用命令行启动，记得加引号：`"play-huya&bili.bat"`

**第一次运行会自动准备环境**（下载约 50MB，一两分钟），屏幕上会显示进度条，等着就行。以后每次启动都是秒开。

准备完之后，窗口问你房间号：

```
  请输入直播间，支持这些写法：

    虎牙房间号   660000      （24 小时赛事频道）
    虎牙房间名   dank1ng
    虎牙链接     https://www.huya.com/dank1ng
    B 站链接     https://live.bilibili.com/6
    B 站简写     bili:6

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

项目：https://github.com/NZNL31/huya-bilibili-in-potplayer
作用：把虎牙 / 哔哩哔哩直播的碎块 CDN 流拼成本地 HLS，用 PotPlayer 播放。

请按顺序做：

1. 用 PowerShell 下载并解压（解压路径别带空格和中文）。
   仓库改过名，当前叫 huya-bilibili-in-potplayer，旧名 huya-in-potplayer
   也能下载（GitHub 会自动重定向），两个都试，哪个成功用哪个。
   整段一次粘进去执行：
   $d="$env:USERPROFILE\huya-bilibili"; $z="$env:TEMP\h.zip"; $r='huya-bilibili-in-potplayer'; try { Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing } catch { $r='huya-in-potplayer'; Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing }; Expand-Archive $z -DestinationPath $d -Force

2. 运行 "$d\$r-main\play-huya&bili.bat"（$r 就是第 1 步下载成功的那个仓库名）
   注意文件名里有 &，PowerShell 里必须用引号包住（上面已经包了），别去掉引号。
   首次运行会自动下载 Node.js 和 ffmpeg（共约 50MB），等进度条走完。

3. 窗口提示「请输入房间」时直接回车（默认 dank1ng）；想先确认能播，输 660000（24 小时赛事频道）。
   想看 B 站就输 https://live.bilibili.com/6 这样的完整链接。

4. 接着问画质、问模式，两次都直接回车（默认就是最佳配置）。
   B 站没配 Cookie 时不会问画质，直接进模式选择，属正常。

5. PotPlayer 会自动打开播放。播放期间不要关闭那个命令行窗口。

注意事项：
- 没装 PotPlayer 的话先装：https://potplayer.daum.net/
- 如果自动下载失败，手动把 node.exe 放进 runtime\ 目录，
  把 ffmpeg.exe 放进项目根目录（和 play-huya&bili.bat 同一层），再双击一次
- 换台就重新双击 play-huya&bili.bat，输入新房间号
- B 站不登录最高只有 720p30，这是 B 站接口限制，不是工具的问题。
  想要 1080p 原画需要自己配 bili-cookie.txt（README 里有步骤），不要替用户去搞 Cookie
````

### 或者自己粘一行命令

开始菜单搜 **PowerShell** 打开，粘这一行回车，剩下的和双击一样：

```powershell
$ProgressPreference='SilentlyContinue'; $d="$env:USERPROFILE\huya-bilibili"; $z="$env:TEMP\h.zip"; $r='huya-bilibili-in-potplayer'; try { Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing } catch { $r='huya-in-potplayer'; Invoke-WebRequest "https://codeload.github.com/NZNL31/$r/zip/refs/heads/main" -OutFile $z -UseBasicParsing }; Expand-Archive $z -DestinationPath $d -Force; & "$d\$r-main\play-huya&bili.bat"
```

> 这行命令做的事：下载 → 解压到 `%USERPROFILE%\huya-bilibili` → 启动。只有 30KB 左右，秒下。
> 仓库改过名，当前名和旧名都会试一遍，哪个能下用哪个。

---

## 首次运行在干什么？

| 补什么 | 装到哪 | 下载 | 占用磁盘 |
|--------|--------|------|---------|
| Node.js 便携版 | 本文件夹的 `runtime\node.exe` | 约 30MB | 约 70MB |
| ffmpeg 便携版 | 本文件夹的 `ffmpeg.exe` | 约 22MB | 约 62MB |

实测：千兆宽带下整套准备过程 **16 秒**，装完整个文件夹约 **130MB**。

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

## B 站怎么用

输入方式和虎牙完全一样，同一个窗口，不用换程序、不用加参数。三种写法随便挑一个：

```
  请输入房间: https://live.bilibili.com/6      ← 直接粘地址栏
  请输入房间: bili:6                           ← 简写
  请输入房间: b站:6                            ← 中文简写也行
```

房间号就是 `live.bilibili.com/` 后面那串数字。比如：

| 地址栏 | 房间号 |
|--------|--------|
| `https://live.bilibili.com/6` | `6` |
| `https://live.bilibili.com/21452505` | `21452505` |

> B 站有「短号」和「真实房间号」两套编号，程序会自动换算，两种都能用。
> 比如 `6` 的真实房间号是 `7734200`，启动日志里会写出来。

### ⚠️ B 站画质：不登录只有 720p

这是 B 站接口的限制，不是程序的问题：

| 登录状态 | 最高画质 |
|---------|---------|
| 没登录 | **1280×720 / 30 帧** |
| 有 Cookie | 1080p60 原画，甚至更高 |

没配 Cookie 时，程序会直接告诉你当前是 720p，画质选择那一步也会跳过（因为选了也没用）。

**想要 1080p 原画**，配一次 Cookie，之后一直有效：

1. 用浏览器打开 [live.bilibili.com](https://live.bilibili.com) 并**登录**
2. 按 `F12` → 顶部选 `Application`（应用）→ 左边 `Cookies` → `https://www.bilibili.com`
3. 找到名为 **`SESSDATA`** 的那一行，双击复制它的值（一长串字符）
4. 在本文件夹里新建文本文件 `bili-cookie.txt`，把值粘进去（只粘值，不要 `SESSDATA=` 前缀）
5. 保存，重新双击 `play-huya&bili.bat` —— 画质选择里就会多出「原画」

文件内容长这样，只有一行：

```
1a2b3c4d%2C1700000000%2Cabcd1234...
```

> 🔒 `bili-cookie.txt` 已经在 `.gitignore` 里，不会被上传到 GitHub。
> Cookie 等同于账号凭证，**别发给别人，也别截图发群里**。失效了就重新复制一次。

也可以不用文件，改用环境变量：

```powershell
$env:BILI_COOKIE='你的SESSDATA'; node relay.js "https://live.bilibili.com/6"
```

---

## 画质和模式怎么选

### 画质（虎牙）

| 选项 | 是什么 | 什么时候选 |
|------|--------|-----------|
| `[1]` 蓝光8M | 1080p / 60 帧 | ✅ **默认，直接回车** |
| `[2]` 蓝光4M | 1080p / 30 帧 | 网络一般，或 8M 卡的时候 |
| `[3]` 超清2M | 720p 级别 | 网络很差，只求能看 |

> 8M 档峰值能到 **15Mbps**。家里带宽 20M 以下建议选 4M。

### 画质（B 站）

只在**配了 Cookie** 之后才会问，三档对应 B 站的 `qn` 值：

| 选项 | qn | 是什么 |
|------|----|--------|
| `[1]` 原画 | 10000 | 主播推流的上限，通常 1080p60 |
| `[2]` 蓝光 | 400 | 1080p / 30 帧 |
| `[3]` 超清 | 250 | 1280×720 / 30 帧 |

没配 Cookie 时固定 720p30，不问。

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
2. 输入 `"play-huya&bili.bat"` 回车（**引号不能省**，`&` 在 cmd 里是命令分隔符）
3. 看它报什么错

最常见的是**杀毒软件拦了 `setup.ps1`**——把这个文件夹加进白名单再试。

### 首次运行卡在下载

网络问题。等它自己换源重试；还不行就手动来：

1. 下载这两个文件（浏览器打开即可）
   - Node.js：`https://npmmirror.com/mirrors/node/v20.18.0/node-v20.18.0-win-x64.zip`
   - ffmpeg：`https://registry.npmmirror.com/@ffmpeg-installer/win32-x64/-/win32-x64-4.1.0.tgz`
2. Node.js 那个 zip 解压，把里面的 `node.exe` 放进本文件夹新建的 `runtime` 文件夹
3. ffmpeg 那个 tgz 用 7-Zip 解开两层，把 `ffmpeg.exe` 放进本文件夹
4. 重新双击 `play-huya&bili.bat`

### 窗口在跑，但 PotPlayer 没弹出来

看黑窗口里有没有这行：

```
  播放器: 未找到（可用 --player 指定，或设置 POTPLAYER_PATH）
```

说明没找到 PotPlayer。程序会搜这几个位置：本文件夹、上一级、上两级、`C:\Program Files\DAUM\PotPlayer`、`C:\Program Files (x86)\DAUM\PotPlayer`、`%LOCALAPPDATA%\Programs\DAUM\PotPlayer`。

**绿色版、或者装在别的盘**（比如 `D:\PotPlayer`）就搜不到，两种办法任选：

1. **把本文件夹整个挪进 PotPlayer 目录**（像 `D:\PotPlayer\huya`），下次自动认出
2. 或者启动时指定路径：
   ```bat
   runtime\node.exe relay.js 825803 --open --player "D:\PotPlayer\PotPlayerMini64.exe"
   ```

都不想弄也行——黑窗口里会打印播放地址，手动在 PotPlayer 里按 `Ctrl+U`「打开 URL」粘进去，一样能播。

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
3. **ffmpeg 太旧**：删掉文件夹里的 `ffmpeg.exe`，重新双击 `play-huya&bili.bat` 让它重下

### 画面卡顿 / 掉帧

1. **换模式** → 重新运行，模式选 `[2] 流畅优先`
2. **降码率** → 画质选 `[2] 蓝光4M`
3. **看带宽** → 任务管理器看网络有没有跑满
4. **画面有花块 / 糊一下** → 是码流参考帧断了。默认 350ms 抖动缓冲已经能补住绝大部分，
   网络特别抖的话再调大：
   ```bat
   runtime\node.exe relay.js 825803 --open --jitter 600
   ```

### 主播没开播

程序会提示并一直重试。**别关窗口**，开播后会自动接上。

重试日志做了节流：同类错误 8 秒才打一行，不会刷屏。

### B 站相关

| 现象 | 原因 | 怎么办 |
|------|------|--------|
| 只有 720p，画质那一步直接跳过了 | 没配 Cookie，B 站匿名只给 250 | 按 [B 站怎么用](#b-站怎么用) 配 `bili-cookie.txt` |
| 配了 Cookie 还是 720p | Cookie 过期了（`SESSDATA` 有效期约半年） | 重新复制一次 |
| 提示「主播当前未开播」 | 房间确实没播，或进的是轮播/回放房间 | 换一个正在直播的房间 |
| 提示「未找到该房间」 | 房间号写错了 | 从地址栏重新复制 |
| 提示「B 站临时风控」 | 短时间请求太频繁 | 等几分钟再试，别反复重开 |

---

## 🔧 进阶：命令行

```bat
:: 最简单
node relay.js 825803 --open

:: 指定画质 4M
node relay.js 825803 --bitrate 4000 --open

:: 用完整链接
node relay.js https://www.huya.com/dank1ng --open

:: 流畅优先（NVENC 重编码）
node relay.js 825803 --transcode --open

:: 低延迟（FLV 直出）
node relay.js 825803 --flv --open

:: 换端口
node relay.js 825803 --port 8766 --open
```

如果用的是便携版 Node，把 `node` 换成 `runtime\node.exe`。

### 全部参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `<房间>` | `dank1ng` | 房间号 / 房间名 / 完整链接，可省略 |
| `--room <值>` | — | 同上，显式指定 |
| `--port <端口>` | `8765` | 本地监听端口 |
| `--bili` | 关 | 强制按 B 站处理（房间号是纯数字、又不想写 `bili:` 前缀时用） |
| `--qn <档位>` | `10000` | B 站画质：`10000` 原画 / `400` 蓝光 / `250` 超清 |
| `--bitrate <码率>` | `8000` | 虎牙画质：`8000` 蓝光8M / `4000` 蓝光4M / `2000` 超清 |
| `--open` | 关 | 启动后自动拉起 PotPlayer |
| `--transcode` | 关 | 启用 NVENC 重编码（流畅优先） |
| `--flv` | 关 | 直接输出 FLV（低延迟） |
| `--fps <帧率>` | 跟随码率 | 重编码目标帧率，8M 档默认 60 |
| `--jitter <毫秒>` | `350` | 抖动缓冲深度。网络抖就调大，想压延迟就调小（低于 150 会开始丢帧） |
| `--player <路径>` | 自动探测 | 指定 PotPlayer 可执行文件 |
| `--ffmpeg <路径>` | 自动探测 | 指定 ffmpeg 可执行文件 |

环境变量：`POTPLAYER_PATH`、`FFMPEG_PATH`、`BILI_COOKIE`。

> `--qn` 和 `--bitrate` 互斥：B 站只认 `--qn`，虎牙只认 `--bitrate`。传错了程序会自动忽略（B 站的 `ratio` 参数会被 CDN 拒绝，虎牙的码率对 B 站也没有意义）。

B 站单独跑的例子：

```powershell
node relay.js "https://live.bilibili.com/6" --qn 10000 --open
node relay.js bili:21452505 --port 9000
```

### 不用 PotPlayer？

程序会打印地址，自己用 VLC / mpv 打开：

- **HLS（推荐）**：`http://127.0.0.1:8765/live.m3u8`
- **FLV（低延迟）**：`http://127.0.0.1:8765/live.flv`

---

## 📁 文件说明

| 文件 | 作用 | 哪来的 |
|------|------|--------|
| `play-huya&bili.bat` | 双击入口 | 仓库自带 |
| `setup.ps1` | 首次运行检查并补齐环境 | 仓库自带 |
| `launcher.js` | 交互界面：问房间 / 画质 / 模式 | 仓库自带 |
| `relay.js` | 核心中继：拉流、拼接、HLS 输出（虎牙 + B 站） | 仓库自带 |
| `runtime\node.exe` | Node.js 便携版 | 首次运行自动下载 |
| `ffmpeg.exe` | ffmpeg 便携版 | 首次运行自动下载 |
| `last-room.txt` | 记住上次的房间（含平台信息） | 运行时自动生成 |
| `bili-cookie.txt` | B 站登录 Cookie，可选，用于解锁 1080p | 自己手动创建 |

---

## 🧠 技术原理

<details>
<summary>点开看实现细节（不看也完全不影响使用）</summary>

### 五个真实痛点

| 痛点 | 现象 | 做法 |
|------|------|------|
| **分块重叠** | 时间戳倒退 → H.264 参考链断裂 → 花屏 | 严格按时间戳去重，只转发更新的帧 |
| **分块间隙** | 30fps 的流只剩 24.7fps | 并发预读 + 1.5 秒无数据就动态补拉 |
| **跨连接丢关键帧** | 1080p60 只剩 44fps，满屏 concealing 报错 | 抖动缓冲：先排队再按序发，让别的连接把空洞补齐 |
| **中途接入缺参考帧** | 开头花屏，B 站 30fps 只剩 27fps | GOP 缓存：记住上一个关键帧以来的所有数据，新客户端接入先补发 |
| **配置头丢失** | 转封装后没声音 / 被猜成单声道 | 单独缓存并转发 AAC sequence header |

### 关键设计

1. **并发预读** — 每 2 秒发起一条新连接，最多 2~4 条并发，用重叠覆盖 CDN 块之间的间隙
2. **动态补拉** — 1.5 秒没有新内容立即追加连接，应对碎块房间
3. **抖动缓冲** — 收到的帧先按时间戳排队 350ms，等各条连接把彼此的空洞补上，再按顺序一次性发出
4. **GOP 缓存** — 记住最近一个关键帧以来的所有 tag（上限 8MB），FLV 客户端接入时先补发，让它从关键帧开始解码
5. **配置头补发** — AVC / AAC 的 sequence header 单独缓存，在 FLV 头之后立即补发

第 3 条是 v2.7 的核心修复。之前只做「时间戳单调去重」，某条连接内部有空洞时它会跳着往前，另一条连接补过来的那几帧因为时间戳落后被当成重复帧丢掉；一旦丢掉的正好是关键帧，后面整段 P 帧都没有参考帧，解码器只能瞎猜。实测同一段流：

| | 视频帧 | 解码成功 | 解码报错 |
|---|---|---|---|
| 虎牙原始流（直连） | 483 | 483 | 0 |
| 旧版中继 | 515 | 388（75%） | 693 |
| 新版（抖动缓冲） | 730 | 723（99%） | 2 |

第 4 条是 v2.8 加的。之前 FLV 客户端只补配置头、不补关键帧，中途接进来拿到的第一帧是 P 帧，参考帧早就发过去了。实测 B 站 720p30 的流：

| | 帧数 / 时长 | 实际帧率 | 解码报错 |
|---|---|---|---|
| 修复前 | 271 / 9.99s | 27.1fps | 7 条 `co located POCs unavailable` |
| 修复后 | 360 / 11.98s | 30.1fps | 0 |

> 测量时要用 `-vsync 0`。`ffmpeg -f null` 默认按 CFR 输出，遇到时间戳不均匀会主动丢帧，
> 数出来的帧数会偏低，容易误判成中继在丢帧。

### 处理链路

```
虎牙 CDN（2~8 秒碎块）        B 站 CDN（连续 FLV）
        │  并发拉取，每条带随机参数            │  2 条并发，贴着直播边缘
        ▼                                      ▼
  Node 中继（relay.js）
        │  按时间戳去重 → 抖动缓冲重排 → 补发配置头 → 连续 FLV
        ▼
  http://127.0.0.1:8765/live.flv
        │
        ├─ 原画直通：ffmpeg -c copy → HLS 分片
        └─ 流畅优先：ffmpeg NVENC + CFR → HLS 分片
        ▼
   PotPlayer / VLC / mpv
```

### 实测数据

**干净环境**（空文件夹、PATH 里没有 node 和 ffmpeg）从零跑通，两档画质都验过：

房间 825803，蓝光8M 档：

```
视频：1920x1080 / 59.94fps / H.264 High / 7484~9151 kbps
音频：aac (LC) / 44100 Hz / stereo / 127 kbps
分片：2 秒一片，每片 120 帧（= 60fps，零丢帧）
```

房间 dank1ng（10188），蓝光8M 档 —— 主播自身推流码率就低：

```
视频：1920x1080 / 60fps / H.264 High / 2644 kbps
音频：aac (LC) / 44100 Hz / stereo / 105 kbps
分片：3.05s 一片 180 帧（59.0fps）、1.19s 一片 70 帧（58.8fps），解码报错 0
```

> 分片长度由关键帧间隔决定（`-c copy` 只能在关键帧切），这个房间的关键帧间隔在
> 1.17 秒和 3 秒之间交替，所以分片长度也跟着交替，属正常。
> 连续跑 6 分 49 秒，分片器零重启。

**B 站**（房间 6 → 7734200，未登录，qn=250）：

```
视频：1280x720 / 30fps / H.264 High / yuv420p bt709
音频：aac (LC) / 48000 Hz / stereo / 130 kbps
分片：3.05s 一片 90 帧（29.5fps），逐片解码报错 0
HLS 连播 20 秒：598 帧 = 29.9fps，解码报错 0
FLV 连播 20 秒：600 帧 = 30.0fps，解码报错 0
```

连续跑 6 分钟无重连、无重新同步、分片器零重启。

**虎牙**（房间 825803，蓝光8M 档，比赛中途）：

```
HLS 连播 20 秒：1199 帧 = 60.0fps，连测三次都是 60.0
FLV 连播 20 秒：1182 帧 = 59.6fps
分片：2.00s 一片 120 帧（59.94fps）
```

虎牙这条流是 59.94fps（非整数），在 90kHz 时间基里每帧 1501.5 tick，取整后
偶尔会有两帧落到同一个刻度上，ffmpeg 会打一行
`non monotonically increasing dts to muxer`。这是**输出时基取整的提示，不是丢帧**
（1199 帧 ÷ 20 秒 = 59.95fps，一帧没少），可以忽略。

</details>

### B 站和虎牙的实现差异

| | 虎牙 | B 站 |
|---|---|---|
| 直链获取 | `mp.huya.com/cache.php`，带 `ratio` 参数换大块 | `getRoomPlayInfo`，从 `playurl_info` 里挑 `http_stream` + `flv` + `avc` |
| 必需请求头 | 只带 UA | **必须带 `Referer: https://live.bilibili.com/`**，否则 403 |
| 直链拼法 | 直接给完整 URL | `host` + `base_url` + `extra` 三段拼接，缺一不可 |
| CDN 节点 | 多节点，可测速选最快 | 只给一个 host，没有可选节点 |
| 画质控制 | `ratio` 换码率档 | `qn` 换画质档，匿名被压到 250 |
| 并发连接 | 2~4 条，靠随机参数强制回源 | 2 条，连续流天然贴着直播边缘 |

> B 站早期接口 `getInfoByRoom` 在不登录时直接返回 `-352`（风控），所以改用
> `room/v1/Room/get_info` 拿房间状态、再用 `live_user/v1/UserInfo/get_anchor_in_room`
> 单独拿主播名 —— 两个接口都不需要登录。

</details>

---

## ⚖️ 免责声明

本项目仅供**个人学习与技术研究**使用。所有直播内容版权归虎牙、哔哩哔哩及相应主播所有，请勿用于任何商业用途或二次分发。使用本工具产生的任何后果由使用者自行承担。

本项目不破解任何付费/会员画质，B 站的高画质依赖你自己的账号登录状态（Cookie），程序只是带上它去请求接口。

---

## 📄 License

[MIT](LICENSE)
