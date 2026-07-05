const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const config = require('../config');
const logger = require('../utils/logger');
const initializeSchema = require('./schema');

fs.mkdirSync(path.dirname(config.database.path), { recursive: true });

const db = new Database(config.database.path);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

initializeSchema(db);
logger.info(`SQLite ready at ${config.database.path}`);

module.exports = db;
