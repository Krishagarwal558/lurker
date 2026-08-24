const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const config = require('../config');
const initializeSchema = require('./schema');
const logger = require('../utils/logger');

let dbInstance = null;

function getDatabase() {
  if (dbInstance) return dbInstance;

  const dbPath = config.database.path;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(dbPath, {
    timeout: 5000
  });

  // Enable WAL mode and performance pragmas
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 5000');

  initializeSchema(dbInstance);
  logger.info(`SQLite connected at ${dbPath} (WAL mode)`);

  return dbInstance;
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('SQLite connection closed.');
  }
}

module.exports = {
  closeDatabase,
  getDatabase
};
