const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');

// 确保使用应用程序外部的日志目录
// 尝试使用多个可能的目录位置
function getLogDirectory() {
  // 首先尝试使用当前工作目录
  let logDir = path.join(process.cwd(), 'logs');
  
  try {
    // 尝试创建或确认目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
  } catch (e) {
    // 如果失败，尝试使用用户主目录
    logDir = path.join(os.homedir(), 'system_watcher_logs');
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      return logDir;
    } catch (e) {
      // 如果还是失败，尝试使用系统临时目录
      logDir = path.join(os.tmpdir(), 'system_watcher_logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      return logDir;
    }
  }
}

// 获取日志目录
const logDir = getLogDirectory();
console.log(`日志将保存在: ${logDir}`);

// 日志级别定义
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// 设置日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(info => {
    return `[${info.timestamp}] [${info.level.toUpperCase()}] ${info.message}`;
  })
);

// 创建日志轮转传输对象 - 所有日志
const allLogRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'all-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,  // 打包旧日志
  maxSize: '20m',       // 每个日志文件最大20MB
  maxFiles: '14d',      // 保留14天的日志
  level: config.LOG_LEVEL
});

// 创建日志轮转传输对象 - 错误日志
const errorLogRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error'
});

// 创建日志轮转传输对象 - 警告日志
const warnLogRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'warn-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'warn'
});

// 创建日志轮转传输对象 - 信息日志
const infoLogRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'info-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info'
});

// 创建日志轮转传输对象 - 调试日志
const debugLogRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'debug-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'debug'
});

// 创建日志记录器
const logger = winston.createLogger({
  levels: levels,
  format: logFormat,
  transports: [
    // 输出到控制台
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => {
          return `[${info.timestamp}] [${info.level}] ${info.message}`;
        })
      ),
      level: config.LOG_LEVEL
    }),
    // 输出到文件
    allLogRotateTransport,
    errorLogRotateTransport,
    warnLogRotateTransport,
    infoLogRotateTransport,
    debugLogRotateTransport
  ],
  exitOnError: false
});

// 日志事件处理
allLogRotateTransport.on('rotate', function(oldFilename, newFilename) {
  logger.info(`日志轮转：从 ${oldFilename} 到 ${newFilename}`);
});

// 封装日志接口，与原有代码接口保持一致
const log = {
  error: (message, ...meta) => {
    logger.error(formatLogMessage(message, meta));
  },
  warn: (message, ...meta) => {
    logger.warn(formatLogMessage(message, meta));
  },
  info: (message, ...meta) => {
    logger.info(formatLogMessage(message, meta));
  },
  debug: (message, ...meta) => {
    logger.debug(formatLogMessage(message, meta));
  }
};

// 格式化日志消息，处理各种数据类型
function formatLogMessage(message, meta) {
  if (meta && meta.length > 0) {
    const formattedMeta = meta.map(item => {
      if (typeof item === 'object') {
        return JSON.stringify(item);
      }
      return item;
    }).join(' ');
    return `${message} ${formattedMeta}`;
  }
  return message;
}

module.exports = log; 