function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ai_enabled INTEGER NOT NULL DEFAULT 1,
      reply_chance REAL,
      keyword_reply_chance REAL,
      channel_cooldown_seconds INTEGER,
      user_cooldown_seconds INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guild_users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT,
      nickname TEXT,
      last_seen_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS channel_settings (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      ai_enabled INTEGER,
      blacklisted INTEGER NOT NULL DEFAULT 0,
      whitelisted INTEGER NOT NULL DEFAULT 0,
      last_activity_at INTEGER,
      last_reviver_at INTEGER,
      inactivity_target_minutes INTEGER NOT NULL,
      last_starter TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS message_stats (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      total_messages INTEGER NOT NULL DEFAULT 0,
      bot_mentions INTEGER NOT NULL DEFAULT 0,
      bot_replies INTEGER NOT NULL DEFAULT 0,
      bot_reactions INTEGER NOT NULL DEFAULT 0,
      last_message_at INTEGER,
      PRIMARY KEY (guild_id, user_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS nicknames (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      source_message_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      source_message_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      is_bot INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      message_id TEXT,
      personality TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviver_starters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      starter TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_guild_user
      ON memories (guild_id, user_id, type, created_at);

    CREATE INDEX IF NOT EXISTS idx_history_channel
      ON conversation_history (guild_id, channel_id, id);

    CREATE INDEX IF NOT EXISTS idx_reviver_starters_channel
      ON reviver_starters (guild_id, channel_id, created_at);
  `);
}

module.exports = initializeSchema;
