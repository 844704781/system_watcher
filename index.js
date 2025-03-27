const si = require('systeminformation');
const os = require('os');
const axios = require('axios');
const osUtils = require('node-os-utils');
const CONFIG = require('./config');
const log = require('./logger');

// 获取系统信息
async function getSystemInfo() {
  try {
    // 准备要收集的信息列表
    const infoTasks = [
      getCpuInfo(),
      getMemoryInfo(),
      getDiskInfo(),
      getNetworkInfo()
    ];
    
    // 根据配置决定是否收集GPU信息
    if (CONFIG.COLLECT_GPU) {
      infoTasks.push(getGpuInfo());
    }
    
    // 并行获取各项系统信息
    const results = await Promise.all(infoTasks);
    
    // 获取操作系统信息
    const osInfo = {
      platform: os.platform(),     // 操作系统平台：win32, linux, darwin等
      type: os.type(),             // 操作系统类型：Windows_NT, Linux, Darwin等
      release: os.release(),       // 操作系统版本号
      arch: os.arch(),             // CPU架构：x64, arm64等
      hostname: os.hostname(),     // 主机名
      uptime: os.uptime()          // 系统运行时间(秒)
    };
    
    // 添加更友好的OS名称
    if (osInfo.platform === 'win32') {
      // 根据版本号判断是Windows 10还是Windows 11
      const versionNumber = parseFloat(osInfo.release.split('.').slice(0, 2).join('.'));
      const buildNumber = parseInt(osInfo.release.split('.')[2]);
      
      if (buildNumber >= 22000) {
        osInfo.name = 'Windows 11';
      } else if (buildNumber >= 10000) {
        osInfo.name = 'Windows 10';
      } else if (buildNumber >= 9000) {
        osInfo.name = 'Windows 8.1';
      } else if (buildNumber >= 7000) {
        osInfo.name = 'Windows 7';
      } else {
        osInfo.name = 'Windows';
      }
    } else if (osInfo.platform === 'linux') {
      // 尝试获取更详细的Linux发行版信息
      try {
        const { execSync } = require('child_process');
        osInfo.name = execSync('cat /etc/os-release | grep PRETTY_NAME').toString().split('=')[1].replace(/"/g, '').trim();
      } catch (e) {
        osInfo.name = 'Linux';
      }
    } else if (osInfo.platform === 'darwin') {
      osInfo.name = 'macOS';
    } else {
      osInfo.name = osInfo.type;
    }
    
    const systemInfo = {
      server_id: CONFIG.SERVER_ID,
      timestamp: Date.now(),
      os: osInfo,                  // 添加操作系统信息
      cpu: results[0],
      memory: results[1],
      disk: results[2],
      network: results[3]
    };
    
    // 如果收集了GPU信息，添加到结果中
    if (CONFIG.COLLECT_GPU) {
      systemInfo.gpu = results[4];
    }

    return systemInfo;
  } catch (error) {
    log.error('获取系统信息时出错:', error);
    return {
      server_id: CONFIG.SERVER_ID,
      timestamp: Date.now(),
      error: error.message
    };
  }
}

// 获取CPU信息
async function getCpuInfo() {
  try {
    const cpu = osUtils.cpu;
    const usage = await cpu.usage();
    const cpuInfo = await si.cpu();
    
    return {
      usage: usage,
      cores: os.cpus().length,
      model: cpuInfo.manufacturer + ' ' + cpuInfo.brand,
      speed: cpuInfo.speed
    };
  } catch (error) {
    log.error('获取CPU信息时出错:', error);
    return { error: error.message };
  }
}

// 获取内存信息
async function getMemoryInfo() {
  try {
    const mem = await si.mem();
    return {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      usage: parseFloat(((mem.used / mem.total) * 100).toFixed(2))
    };
  } catch (error) {
    log.error('获取内存信息时出错:', error);
    return { error: error.message };
  }
}

// 获取磁盘信息
async function getDiskInfo() {
  try {
    const disks = await si.fsSize();
    return disks.map(disk => ({
      fs: disk.fs,
      type: disk.type,
      size: disk.size,
      used: disk.used,
      available: disk.available,
      usage: disk.use
    }));
  } catch (error) {
    log.error('获取磁盘信息时出错:', error);
    return { error: error.message };
  }
}

// 获取网络信息
async function getNetworkInfo() {
  try {
    const networkStats = await si.networkStats();
    const defaultNet = networkStats[0]; // 默认使用第一个网络接口
    
    // 获取本地IP地址信息
    const interfaces = os.networkInterfaces();
    let privateIPv4 = null;
    let privateIPv6 = null;
    
    // 查找本地网络接口的IP地址
    for (const ifaceName in interfaces) {
      for (const info of interfaces[ifaceName]) {
        // 处理IPv4地址
        if ((info.family === 'IPv4' || info.family === 4) && isPrivateIPv4(info.address)) {
          if (!privateIPv4 && ifaceName === defaultNet.iface) {
            privateIPv4 = info.address; // 优先使用默认接口的IP
          } else if (!privateIPv4) {
            privateIPv4 = info.address;
          }
        } 
        // 处理IPv6地址
        else if ((info.family === 'IPv6' || info.family === 6) && isPrivateIPv6(info.address)) {
          if (!privateIPv6 && ifaceName === defaultNet.iface) {
            privateIPv6 = info.address;
          } else if (!privateIPv6) {
            privateIPv6 = info.address;
          }
        }
      }
    }
    
    // 获取公网IP（通过缓存机制提高性能）
    const publicIPs = await getPublicIPs();
    
    return {
      interface: defaultNet.iface,
      privateIPv4: privateIPv4,
      privateIPv6: privateIPv6,
      publicIPv4: publicIPs.ipv4,
      publicIPv6: publicIPs.ipv6,
      rx_bytes: defaultNet.rx_bytes,
      tx_bytes: defaultNet.tx_bytes,
      rx_sec: defaultNet.rx_sec ?? 0,  // 使用空值合并运算符，默认为0
      tx_sec: defaultNet.tx_sec ?? 0   // 使用空值合并运算符，默认为0
    };
  } catch (error) {
    log.error('获取网络信息时出错:', error);
    return { error: error.message };
  }
}

// 判断是否为私有IPv4地址
function isPrivateIPv4(ip) {
  // 检查RFC1918私有地址范围
  const parts = ip.split('.').map(part => parseInt(part, 10));
  return parts[0] === 10 || // 10.0.0.0/8
         (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
         (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
         (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16 (APIPA)
         (parts[0] === 127); // 127.0.0.0/8 (环回地址)
}

// 判断是否为私有IPv6地址
function isPrivateIPv6(ip) {
  // 检查本地链路地址和环回地址
  return ip.startsWith('fe80') || ip.startsWith('fc00') || ip.startsWith('fd') || ip === '::1';
}

// 更可靠的公网IP获取函数
let cachedPublicIPv4 = null;
let cachedPublicIPv6 = null;
let lastIPFetchTime = 0;
const IP_CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存

async function getPublicIPs() {
  const now = Date.now();
  
  // 如果缓存有效，直接返回缓存值
  if (cachedPublicIPv4 && (now - lastIPFetchTime < IP_CACHE_DURATION)) {
    return { ipv4: cachedPublicIPv4, ipv6: cachedPublicIPv6 };
  }
  
  // IPv4服务列表（按顺序尝试）
  const ipv4Services = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://icanhazip.com',
    'https://ipv4.icanhazip.com',
    'https://v4.ident.me',
    'https://ipecho.net/plain'
  ];
  
  // IPv6服务列表
  const ipv6Services = [
    'https://ipv6.icanhazip.com',
    'https://v6.ident.me',
    'https://ipv6.seeip.org'
  ];
  
  // 尝试获取IPv4地址
  for (const service of ipv4Services) {
    try {
      log.debug(`正在尝试从 ${service} 获取公网IPv4...`);
      const response = await axios.get(service, { 
        timeout: 5000,
        // 确保服务返回IPv4地址
        headers: {
          'Accept': 'text/plain',
          'User-Agent': 'Mozilla/5.0 (SystemMonitor)'
        }
      });
      const ip = response.data.trim();
      
      // 验证返回的是否是IPv4格式
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        cachedPublicIPv4 = ip;
        log.info(`成功获取公网IPv4: ${ip} (来源: ${service})`);
        break;
      } else {
        log.warn(`从 ${service} 获取的IP格式不正确: ${ip}`);
      }
    } catch (error) {
      log.warn(`从 ${service} 获取IPv4失败: ${error.message}`);
      // 继续尝试下一个服务
    }
  }
  
  // 尝试获取IPv6地址
  for (const service of ipv6Services) {
    try {
      log.debug(`正在尝试从 ${service} 获取公网IPv6...`);
      const response = await axios.get(service, { 
        timeout: 5000,
        headers: {
          'Accept': 'text/plain',
          'User-Agent': 'Mozilla/5.0 (SystemMonitor)'
        }
      });
      const ip = response.data.trim();
      
      // 简单验证IPv6格式（包含冒号且不是IPv4）
      if (ip.includes(':') && !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        cachedPublicIPv6 = ip;
        log.info(`成功获取公网IPv6: ${ip} (来源: ${service})`);
        break;
      } else {
        log.warn(`从 ${service} 获取的IPv6格式不正确: ${ip}`);
      }
    } catch (error) {
      log.warn(`从 ${service} 获取IPv6失败: ${error.message}`);
      // 继续尝试下一个服务
    }
  }
  
  // 更新最后获取时间
  lastIPFetchTime = Date.now();
  
  return { 
    ipv4: cachedPublicIPv4, 
    ipv6: cachedPublicIPv6 
  };
}

// 获取GPU信息的增强版本
async function getGpuInfo() {
  try {
    // 基础信息获取与之前相同
    const graphics = await si.graphics();
    
    // 处理GPU控制器基本信息
    const allGpus = graphics.controllers.map((gpu, index) => {
      // 判断是否为独立显卡或集成显卡
      const isIntegrated = gpu.vendor && (
        gpu.vendor.toLowerCase().includes('intel') || 
        (gpu.model && gpu.model.toLowerCase().includes('integrated')) ||
        (gpu.name && gpu.name.toLowerCase().includes('integrated'))
      );
      
      // 检测是否为虚拟GPU
      const isVirtual = isVirtualGPU(gpu);
      
      // 尝试识别显卡类型
      let gpuType = 'unknown';
      if (isVirtual) {
        gpuType = 'virtual';
      } else if (isIntegrated) {
        gpuType = 'integrated';
      } else if (gpu.vendor) {
        const vendor = gpu.vendor.toLowerCase();
        if (vendor.includes('nvidia')) {
          gpuType = 'discrete_nvidia';
        } else if (vendor.includes('amd') || vendor.includes('ati')) {
          gpuType = 'discrete_amd';
        } else {
          gpuType = 'discrete_other';
        }
      }
      
      // 构建基本GPU信息
      const gpuInfo = {
        index: index,
        model: gpu.model || gpu.name || '未知型号',
        vendor: gpu.vendor || '未知厂商',
        vram: gpu.vram || null,
        vram_dynamic: gpu.vramDynamic || false,
        bus: gpu.bus || null,
        usage: gpu.utilizationGpu || 0,
        memory_usage: gpu.memoryUsed || null,
        memory_total: gpu.memoryTotal || null,
        driver_version: gpu.driverVersion || null,
        sub_device_id: gpu.subDeviceId || null,
        type: gpuType,
        is_integrated: isIntegrated,
        is_virtual: isVirtual
      };
      
      return gpuInfo;
    });
    
    // 核心改进：针对特定GPU厂商使用专门的工具获取详细信息
    await enhanceGpuInfo(allGpus);
    
    // 返回所有GPU，包括虚拟GPU
    return allGpus;
  } catch (error) {
    log.error('获取GPU信息时出错:', error);
    return { error: error.message };
  }
}

// 增强GPU信息的新函数
async function enhanceGpuInfo(gpus) {
  try {
    // 检测操作系统
    const isWindows = os.platform() === 'win32';
    const isLinux = os.platform() === 'linux';
    
    for (const gpu of gpus) {
      // 针对NVIDIA显卡
      if (gpu.type === 'discrete_nvidia') {
        try {
          let gpuData = null;
          
          if (isWindows) {
            // Windows平台使用node-nvidia-smi模块
            try {
              // 尝试动态导入，如果没有安装会失败
              const nvidiaSmi = require('node-nvidia-smi');
              gpuData = await new Promise((resolve, reject) => {
                nvidiaSmi.getNvsmi((err, data) => {
                  if (err) reject(err);
                  else resolve(data);
                });
              });
            } catch (err) {
              log.warn('无法使用node-nvidia-smi模块:', err.message);
              log.info('请运行: npm install node-nvidia-smi');
              // 尝试使用命令行方式
              gpuData = await runNvidiaSmiCommand();
            }
          } else if (isLinux) {
            // Linux平台直接使用nvidia-smi命令
            gpuData = await runNvidiaSmiCommand();
          }
          
          // 如果获取到了数据，填充到GPU信息中
          if (gpuData) {
            updateNvidiaGpuInfo(gpu, gpuData);
          }
        } catch (nvidiaError) {
          log.warn(`无法获取NVIDIA显卡详细信息: ${nvidiaError.message}`);
        }
      }
      // 针对AMD显卡
      else if (gpu.type === 'discrete_amd') {
        try {
          // AMD GPU信息获取逻辑，类似于NVIDIA
          // ...
        } catch (amdError) {
          log.warn(`无法获取AMD显卡详细信息: ${amdError.message}`);
        }
      }
    }
  } catch (error) {
    log.warn(`增强GPU信息失败: ${error.message}`);
  }
}

// 运行nvidia-smi命令
async function runNvidiaSmiCommand() {
  try {
    const { execSync } = require('child_process');
    const cmd = 'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,driver_version --format=csv,noheader,nounits';
    const output = execSync(cmd).toString().trim();
    
    // 解析输出
    const lines = output.split('\n');
    return lines.map(line => {
      const [usage, memUsed, memTotal, driverVersion] = line.split(', ').map(s => s.trim());
      return {
        usage: parseFloat(usage),
        memoryUsed: parseInt(memUsed),
        memoryTotal: parseInt(memTotal),
        driverVersion: driverVersion
      };
    });
  } catch (error) {
    log.warn(`执行nvidia-smi命令失败: ${error.message}`);
    return null;
  }
}

// 更新NVIDIA GPU信息
function updateNvidiaGpuInfo(gpu, nvidiaSmiData) {
  // 找到匹配的GPU数据
  const gpuData = nvidiaSmiData[0]; // 简化处理，假设只有一个显卡
  
  if (gpuData) {
    gpu.usage = gpuData.usage ?? gpu.usage ?? 0;  
    gpu.memory_usage = gpuData.memoryUsed || gpu.memory_usage;  // 对应已修改的字段名
    gpu.memory_total = gpuData.memoryTotal || gpu.memory_total;  // 对应已修改的字段名
    gpu.driver_version = gpuData.driverVersion || gpu.driver_version;  // 对应已修改的字段名
    log.info(`已更新NVIDIA GPU详细信息: 使用率=${gpu.usage}%, 显存=${gpu.memory_usage}/${gpu.memory_total}MB`);
  }
}

// 检测虚拟GPU的函数
function isVirtualGPU(gpu) {
  const modelLower = (gpu.model || gpu.name || '').toLowerCase();
  const vendorLower = (gpu.vendor || '').toLowerCase();
  
  // 虚拟GPU的关键词列表
  const virtualKeywords = [
    'virtual', 'remote', 'vnc', 'rdp', 'citrix', 'vmware', 'parallels',
    'basic display', 'microsoft basic display', 'microsoft remote display',
    'teamviewer', 'meta', 'vbox', 'virtualbox'
  ];
  
  // 检查名称和厂商是否包含虚拟GPU关键词
  for (const keyword of virtualKeywords) {
    if (modelLower.includes(keyword) || vendorLower.includes(keyword)) {
      return true;
    }
  }
  
  // 特殊检测: 没有实际VRAM且没有总线信息的通常是虚拟设备
  if (!gpu.vram && !gpu.bus && !gpu.utilizationGpu) {
    return true;
  }
  
  return false;
}

// 发送数据到API
async function sendDataToApi(data) {
  try {
    log.info('正在发送系统状态数据...');
    args = JSON.stringify(data)
    log.info('发送数据内容:\n' + args);
    const req = {
      business_type: "server_monitor",
      args: args
    }
    const response = await axios.post(CONFIG.API_ENDPOINT, req, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5秒超时
    });

    log.info(`数据发送成功，状态码: ${response.status}`);
    return response;
  } catch (error) {
    log.error('发送数据时出错:', error.message);
    if (error.response) {
      log.error('API返回错误:', error.response.status, error.response.data);
    }
  }
}

// 主监控循环
async function monitorLoop() {
  try {
    const systemInfo = await getSystemInfo();
    await sendDataToApi(systemInfo);
  } catch (error) {
    log.error('监控循环出错:', error.message);
  }
  
  // 设置下一次执行
  setTimeout(monitorLoop, CONFIG.INTERVAL);
}

// 程序启动
log.info(`系统监控服务启动，服务器ID: ${CONFIG.SERVER_ID}`);
log.info(`监控间隔: ${CONFIG.INTERVAL / 1000}秒`);
log.info(`API端点: ${CONFIG.API_ENDPOINT}`);
log.info(`日志级别: ${CONFIG.LOG_LEVEL}`);
log.info(`收集GPU信息: ${CONFIG.COLLECT_GPU ? '是' : '否'}`);

// 开始监控循环
monitorLoop();

// 处理进程退出
process.on('SIGINT', async () => {
  log.info('正在关闭系统监控服务...');
  process.exit();
});

// 添加日期格式化函数
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
} 