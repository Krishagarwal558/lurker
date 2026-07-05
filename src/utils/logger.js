const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const minimumLevel = levels[configuredLevel] || levels.info;

function write(level, args) {
  if (levels[level] < minimumLevel) return;
  const timestamp = new Date().toISOString();
  const method = level === 'debug' ? 'log' : level;
  console[method](`[${timestamp}] [${level.toUpperCase()}]`, ...args);
}

module.exports = {
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args)
};
