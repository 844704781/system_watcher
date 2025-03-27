/**
 * 系统监控配置文件
 */
const os = require('os');

module.exports = {
  // 监控间隔时间(毫秒)，默认10000毫秒(10秒)
  INTERVAL: process.env.MONITOR_INTERVAL || 10000,
  
  // API接口地址，必须配置
  API_ENDPOINT: process.env.API_ENDPOINT || 'http://your-api-endpoint/system-status',
  
  // 服务器标识，默认使用主机名
  SERVER_ID: process.env.SERVER_ID || os.hostname(),
  
  // 是否收集GPU信息，部分服务器可能没有GPU或无法获取GPU信息
  COLLECT_GPU: process.env.COLLECT_GPU !== 'false',
  
  // 日志级别: 'error', 'warn', 'info', 'debug'
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
}; 