const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentThreshold = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function formatPrefix(level, color) {
  return `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${color}[${level.toUpperCase()}]${COLORS.reset}`;
}

const logger = {
  debug(...args) {
    if (currentThreshold <= LOG_LEVELS.debug) {
      console.log(formatPrefix('debug', COLORS.dim), ...args);
    }
  },
  info(...args) {
    if (currentThreshold <= LOG_LEVELS.info) {
      console.log(formatPrefix('info', COLORS.cyan), ...args);
    }
  },
  warn(...args) {
    if (currentThreshold <= LOG_LEVELS.warn) {
      console.warn(formatPrefix('warn', COLORS.yellow), ...args);
    }
  },
  error(...args) {
    if (currentThreshold <= LOG_LEVELS.error) {
      console.error(formatPrefix('error', COLORS.red), ...args);
    }
  },
  success(...args) {
    if (currentThreshold <= LOG_LEVELS.info) {
      console.log(formatPrefix('success', COLORS.green), ...args);
    }
  },
  ai(...args) {
    if (currentThreshold <= LOG_LEVELS.info) {
      console.log(formatPrefix('lurker-ai', COLORS.magenta), ...args);
    }
  }
};

module.exports = logger;
