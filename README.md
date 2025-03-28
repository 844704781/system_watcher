# 系统状态监控工具

这是一个跨平台（Windows/Linux）的系统状态监控工具，每隔一段时间（默认10秒）会收集服务器的CPU、内存、网络、硬盘和GPU使用率信息，并发送到指定的API接口。

## 功能特点

- 兼容Windows和Linux系统
- 收集系统关键指标：CPU、内存、磁盘、网络和GPU（可选）使用情况
- 可配置的监控间隔和其他参数
- 稳定的错误处理和日志机制
- 通过环境变量或配置文件进行灵活配置
- 持久化日志系统，支持日志分级和每日轮转打包

## 安装

1. 克隆或下载此仓库
2. 安装依赖：

```bash
npm install
```

## 配置

可以通过以下两种方式配置系统监控工具：

### 1. 配置文件

编辑 `config.js` 文件：

```javascript
module.exports = {
  // 监控间隔时间(毫秒)，默认10000毫秒(10秒)
  INTERVAL: 10000,
  
  // API接口地址，必须配置
  API_ENDPOINT: 'http://your-api-endpoint/system-status',
  
  // 服务器标识，默认使用主机名
  SERVER_ID: 'your-server-id',
  
  // 是否收集GPU信息，部分服务器可能没有GPU或无法获取GPU信息
  COLLECT_GPU: true,
  
  // 日志级别: 'error', 'warn', 'info', 'debug'
  LOG_LEVEL: 'info'
};
```

### 2. 环境变量

也可以使用环境变量来覆盖配置：

```bash
# Windows
set API_ENDPOINT=http://your-api-endpoint/system-status
set SERVER_ID=server001
set MONITOR_INTERVAL=10000
set COLLECT_GPU=true
set LOG_LEVEL=info

# Linux
export API_ENDPOINT=http://your-api-endpoint/system-status
export SERVER_ID=server001
export MONITOR_INTERVAL=10000
export COLLECT_GPU=true
export LOG_LEVEL=info
```

## 使用方法

启动监控服务：

```bash
npm start
```

## 打包和分发

此工具可以打包成独立的可执行文件，无需安装Node.js即可在目标系统上运行。

### 打包准备

首先安装开发依赖：

```bash
npm install
```

### 打包命令

打包所有平台版本：

```bash
npm run build
```

也可以单独打包特定平台：

```bash
# 打包Windows版本
npm run build:win

# 打包Linux版本
npm run build:linux

# 打包macOS版本
npm run build:macos
```

打包后的可执行文件将保存在`dist`目录下。

### 运行打包后的程序

打包后的可执行文件可以直接运行，无需安装Node.js环境：

Windows:
```
.\dist\system-monitor-win.exe
```

Linux:
```
./dist/system-monitor-linux
```

macOS:
```
./dist/system-monitor-macos
```

> **注意**: 打包后的程序会将日志文件保存在可执行文件所在目录下的`logs`文件夹中。如果无法在当前目录创建`logs`文件夹，程序会尝试在用户主目录下创建`system_watcher_logs`文件夹，或在系统临时目录下创建同名文件夹。程序启动时会显示日志保存的位置。

### 配置打包后的程序

打包后的程序可以通过环境变量或命令行参数进行配置：

Windows (CMD):
```
set API_ENDPOINT=http://your-api-endpoint/system-status
.\dist\system-monitor-win.exe
```

Windows (PowerShell):
```
$env:API_ENDPOINT="http://your-api-endpoint/system-status"
.\dist\system-monitor-win.exe
```

Linux/macOS:
```
API_ENDPOINT=http://your-api-endpoint/system-status ./dist/system-monitor-linux
```

也可以创建一个`config.json`文件放在程序同一目录下：

```json
{
  "API_ENDPOINT": "http://your-api-endpoint/system-status",
  "SERVER_ID": "server001",
  "INTERVAL": 10000,
  "COLLECT_GPU": true,
  "LOG_LEVEL": "info"
}
```

### 作为服务运行打包后的程序

#### 在Windows上作为服务运行

使用NSSM工具可以将打包后的exe文件作为服务运行：

```
nssm install SystemWatcher "C:\Users\SD45\workspace\system_watcher\system-monitor-win.exe"
nssm set SystemWatcher AppDirectory "C:\Users\SD45\workspace\system_watcher"
nssm start SystemWatcher
```

#### 在Linux上作为服务运行

创建systemd服务文件，但使用打包后的可执行文件：

```
[Unit]
Description=System Status Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/workspace
ExecStart=/root/workspace/system-monitor-linux
Restart=always
RestartSec=10
Environment=API_ENDPOINT=https://ocpc.dianbaobao.com/msg/deal/proc1

[Install]
WantedBy=multi-user.target
```

## 日志系统

系统使用Winston日志框架，提供以下功能：

- 日志按级别分类：error、warn、info、debug
- 日志存储在`logs`目录下，按日期和级别分文件
- 自动日志轮转，每天创建新日志文件
- 日志自动打包存档（zipped archive）
- 保留最近14天的日志记录

日志文件命名规则：
- `all-YYYY-MM-DD.log` - 包含所有级别的日志
- `error-YYYY-MM-DD.log` - 仅错误级别日志
- `warn-YYYY-MM-DD.log` - 警告级别日志
- `info-YYYY-MM-DD.log` - 信息级别日志
- `debug-YYYY-MM-DD.log` - 调试级别日志

过期日志会自动压缩为`.gz`格式并保留14天。

## 数据格式

发送到API的数据格式示例：

```json
{
  "server_id": "server001",  // 服务器唯一标识符，默认使用主机名
  "timestamp": 1743055784668,  // 时间戳（毫秒），表示数据采集时间
  "os": {  // 操作系统信息
    "platform": "win32",  // 操作系统平台：win32, linux, darwin等
    "type": "Windows_NT",  // 操作系统类型：Windows_NT, Linux, Darwin等
    "release": "10.0.26100",  // 操作系统版本号
    "arch": "x64",  // CPU架构：x64, arm64等
    "hostname": "DESKTOP-ABC123",  // 主机名
    "uptime": 345678,  // 系统运行时间(秒)
    "name": "Windows 11"  // 友好的操作系统名称
  },
  "cpu": {
    "usage": 21.79,  // CPU使用率百分比
    "cores": 24,  // CPU核心数量
    "model": "Intel Core i7-13700KF",  // CPU型号
    "speed": 3.4  // CPU基础频率(GHz)
  },
  "memory": {
    "total": 34182410240,  // 总内存大小(字节)
    "used": 15733960704,  // 已使用内存(字节)
    "free": 18448449536,  // 可用内存(字节)
    "usage": 46.03  // 内存使用率百分比
  },
  "disk": [  // 磁盘信息数组，可包含多个磁盘
    {
      "fs": "C:",  // 文件系统挂载点
      "type": "NTFS",  // 文件系统类型
      "size": 1023164805120,  // 磁盘总容量(字节)
      "used": 745313497088,  // 已使用空间(字节)
      "available": 277851308032,  // 可用空间(字节)
      "usage": 72.84  // 磁盘使用率百分比
    }
  ],
  "network": {
    "interface": "WLAN",  // 网络接口名称
    "privateIPv4": "192.168.1.100",  // 局域网IPv4地址
    "privateIPv6": "fe80::8ec7:65f1:2e86:3ce7",  // 局域网IPv6地址
    "publicIPv4": "117.143.174.25",  // 公网IPv4地址
    "publicIPv6": "2409:8a1e:6e73:3790:9119:430c:2ba9:5f0d",  // 公网IPv6地址
    "rx_bytes": 277628227,  // 总接收流量(字节)
    "tx_bytes": 52752365,  // 总发送流量(字节)
    "rx_sec": 9413.87,  // 当前接收速率(字节/秒)
    "tx_sec": 4775.78  // 当前发送速率(字节/秒)
  },
  "gpu": [  // GPU信息数组，可包含多个GPU
    {
      "index": 0,  // GPU索引号
      "model": "NVIDIA GeForce RTX 4070 Ti SUPER",  // GPU型号
      "vendor": "NVIDIA",  // GPU制造商
      "vram": 16376,  // 显存大小(MB)
      "vram_dynamic": true,  // 是否支持动态显存分配
      "bus": "PCI",  // GPU总线类型
      "usage": 1,  // GPU使用率百分比
      "memory_usage": 1038,  // 已使用显存(MB)
      "memory_total": 16376,  // 总显存(MB)
      "driver_version": "566.14",  // GPU驱动版本
      "sub_device_id": "15007377",  // 子设备ID
      "type": "discrete_nvidia",  // GPU类型(discrete_nvidia/discrete_amd/integrated/virtual)
      "is_integrated": false,  // 是否为集成GPU
      "is_virtual": false  // 是否为虚拟GPU
    }
  ]
}
```

这些数据将通过HTTP POST请求发送到配置的API端点，Content-Type为application/json。服务器可以根据这些数据进行系统性能监控、资源使用分析或自动报警等操作。

## 作为服务运行

### 在 Linux 上使用 systemd

创建一个 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/system-watcher.service
```

添加以下内容：

```