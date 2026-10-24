# ============================================================
#  虎牙直播中继 - 首次运行环境准备
#
#  需要什么就补什么，已经有了就直接跳过：
#    · Node.js   -> runtime\node.exe（便携版，约 30MB）
#    · ffmpeg    -> ffmpeg.exe（便携版，约 22MB）
#
#  不写注册表、不需要管理员权限、不用重启、不污染系统。
#  由 play-huya.bat 自动调用，一般不需要手动运行。
# ============================================================

$ErrorActionPreference = 'Stop'

# ---- 想换版本改这里 ----
$NodeVersion = 'v20.18.0'
$NodeFolder  = "node-$NodeVersion-win-x64"
$NodeUrlCn   = "https://npmmirror.com/mirrors/node/$NodeVersion/$NodeFolder.zip"
$NodeUrlOff  = "https://nodejs.org/dist/$NodeVersion/$NodeFolder.zip"
$FfmpegUrlCn = 'https://registry.npmmirror.com/@ffmpeg-installer/win32-x64/-/win32-x64-4.1.0.tgz'

$Root    = $PSScriptRoot
$Runtime = Join-Path $Root 'runtime'
$NodeExe = Join-Path $Runtime 'node.exe'
$Ffmpeg  = Join-Path $Root 'ffmpeg.exe'
$Sys32   = Join-Path $env:SystemRoot 'System32'
$Curl    = Join-Path $Sys32 'curl.exe'
$Tar     = Join-Path $Sys32 'tar.exe'

function Test-NodeReady {
    if (Test-Path $NodeExe) { return $true }
    if (Get-Command node -ErrorAction SilentlyContinue) { return $true }
    return $false
}

function Test-FfmpegReady {
    $cands = @(
        $Ffmpeg,
        (Join-Path $Root 'bin\ffmpeg.exe'),
        (Join-Path (Split-Path -Parent $Root) 'Engine\ffmpeg.exe'),
        (Join-Path (Split-Path -Parent $Root) 'ffmpeg.exe')
    )
    foreach ($c in $cands) { if (Test-Path $c) { return $true } }
    if (Get-Command ffmpeg -ErrorAction SilentlyContinue) { return $true }
    return $false
}

$needNode = -not (Test-NodeReady)
$needFf   = -not (Test-FfmpegReady)

# 什么都不缺就安静退出，不打扰启动
if (-not $needNode -and -not $needFf) { exit 0 }

Write-Host ''
Write-Host '=========================================='
Write-Host '      首次运行：正在准备运行环境'
Write-Host '=========================================='
Write-Host ''
if ($needNode) { Write-Host '  · Node.js   运行环境      约 30MB' }
if ($needFf)   { Write-Host '  · ffmpeg    音视频转封装  约 22MB' }
Write-Host ''
Write-Host '  只解压到本文件夹里，不写注册表、'
Write-Host '  不需要管理员权限、不用重启。'
Write-Host ''
Write-Host '  下载完自动继续，请勿关闭本窗口。'
Write-Host ''

# ---------------- 下载 ----------------
function Get-RemoteFile {
    param([string]$Url, [string]$OutFile)

    if (Test-Path $Curl) {
        & $Curl -L --fail --progress-bar --connect-timeout 20 --max-time 900 -o $OutFile $Url
        if ($LASTEXITCODE -eq 0) { return $true }

        Write-Host ''
        Write-Host '  换一种连接方式重试（忽略系统代理）...'
        Write-Host ''
        & $Curl -L --fail --progress-bar --noproxy '*' --connect-timeout 20 --max-time 900 -o $OutFile $Url
        if ($LASTEXITCODE -eq 0) { return $true }
        return $false
    }

    # 系统没有 curl（很老的 Windows），退回 .NET
    try {
        Write-Host '  正在下载（无进度显示，请耐心等待）...'
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($Url, $OutFile)
        return $true
    } catch {
        return $false
    }
}

function Write-ManualHelp {
    param([string]$What, [string[]]$Urls, [string]$Target)

    Write-Host ''
    Write-Host "  [失败] $What 下载没有成功，可能是网络问题。"
    Write-Host ''
    Write-Host '  手动解决（大约三分钟）：'
    Write-Host '    1. 用浏览器打开下面任一地址下载'
    foreach ($u in $Urls) { Write-Host "       $u" }
    Write-Host "    2. 解压，找到 $Target"
    Write-Host '    3. 放到本文件夹（和 play-huya.bat 同一层）'
    Write-Host '    4. 重新双击 play-huya.bat'
    Write-Host ''
}

# ---------------- 第一步：Node.js ----------------
if ($needNode) {
    Write-Host '  [1/2] 准备 Node.js...'
    Write-Host ''

    if (-not (Test-Path $Runtime)) {
        New-Item -ItemType Directory -Path $Runtime | Out-Null
    }

    $zip = Join-Path $Root 'runtime.zip'
    $ok = Get-RemoteFile -Url $NodeUrlCn -OutFile $zip
    if (-not $ok) {
        Write-Host ''
        Write-Host '  镜像源失败，改用官方源重试...'
        Write-Host ''
        $ok = Get-RemoteFile -Url $NodeUrlOff -OutFile $zip
    }

    if (-not $ok) {
        Write-ManualHelp -What 'Node.js' -Urls @($NodeUrlCn, $NodeUrlOff) -Target 'node.exe'
        exit 1
    }

    Write-Host ''
    Write-Host '  正在解压...'
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $arc = [System.IO.Compression.ZipFile]::OpenRead($zip)
        try {
            $entry = $arc.Entries |
                Where-Object { $_.FullName -eq "$NodeFolder/node.exe" } |
                Select-Object -First 1
            if (-not $entry) { throw "压缩包里找不到 $NodeFolder/node.exe" }
            if (Test-Path $NodeExe) { Remove-Item $NodeExe -Force }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $NodeExe, $true)
        } finally {
            $arc.Dispose()
        }
    } catch {
        Write-Host ''
        Write-Host "  [失败] 解压出错：$($_.Exception.Message)"
        Write-Host ''
        Write-Host '  请删掉 runtime 文件夹和 runtime.zip，重新双击 play-huya.bat。'
        Write-Host ''
        exit 1
    }

    Remove-Item $zip -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $NodeExe)) {
        Write-Host ''
        Write-Host '  [失败] 解压后没有找到 node.exe，请重试。'
        Write-Host ''
        exit 1
    }
    Write-Host '  Node.js 就绪。'
    Write-Host ''
}

# ---------------- 第二步：ffmpeg ----------------
if ($needFf) {
    Write-Host '  [2/2] 准备 ffmpeg...'
    Write-Host ''

    if (-not (Test-Path $Tar)) {
        Write-Host ''
        Write-Host '  [失败] 系统缺少 tar.exe（需要 Windows 10 1803 以上）。'
        Write-Host '  请手动下载 ffmpeg 放到本文件夹：'
        Write-Host '    https://www.gyan.dev/ffmpeg/builds/'
        Write-Host ''
        exit 1
    }

    $tgz = Join-Path $Root 'ffmpeg.tgz'
    $ok = Get-RemoteFile -Url $FfmpegUrlCn -OutFile $tgz

    if (-not $ok) {
        Write-ManualHelp -What 'ffmpeg' -Urls @($FfmpegUrlCn, 'https://www.gyan.dev/ffmpeg/builds/') -Target 'ffmpeg.exe'
        exit 1
    }

    Write-Host ''
    Write-Host '  正在解压...'
    & $Tar -xzf $tgz -C $Root --strip-components=1 'package/ffmpeg.exe'
    Remove-Item $tgz -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $Ffmpeg)) {
        Write-Host ''
        Write-Host '  [失败] 解压后没有找到 ffmpeg.exe，请重试。'
        Write-Host ''
        exit 1
    }
    Write-Host '  ffmpeg 就绪。'
    Write-Host ''
}

Write-Host '  环境准备完成，继续启动。'
Write-Host ''
exit 0
