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

    CREATE TABLE IF NOT EXISTS used_hot_takes (
      guild_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      used_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, topic)
    );

    CREATE TABLE IF NOT EXISTS hot_take_openers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      opener TEXT NOT NULL,
      used_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hot_take_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      messages_since_hot_take INTEGER NOT NULL DEFAULT 0,
      last_hot_take_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS active_hot_takes (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      stance TEXT NOT NULL,
      opener TEXT NOT NULL,
      active_until INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL,
      agreement_count INTEGER NOT NULL DEFAULT 0,
      switched_sides INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS target_gremlin_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      target_user_id TEXT,
      next_check_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS target_gremlin_daily (
      guild_id TEXT NOT NULL,
      day TEXT NOT NULL,
      roast_count INTEGER NOT NULL DEFAULT 0,
      mention_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, day)
    );

    CREATE TABLE IF NOT EXISTS target_gremlin_used_templates (
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL,
      template_key TEXT NOT NULL,
      used_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, type, template_key)
    );

    CREATE INDEX IF NOT EXISTS idx_memories_guild_user
      ON memories (guild_id, user_id, type, created_at);

    CREATE INDEX IF NOT EXISTS idx_history_channel
      ON conversation_history (guild_id, channel_id, id);

    CREATE INDEX IF NOT EXISTS idx_reviver_starters_channel
      ON reviver_starters (guild_id, channel_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_hot_take_openers
      ON hot_take_openers (guild_id, used_at);

    CREATE INDEX IF NOT EXISTS idx_active_hot_takes
      ON active_hot_takes (guild_id, channel_id, active_until);

    CREATE INDEX IF NOT EXISTS idx_target_gremlin_templates
      ON target_gremlin_used_templates (guild_id, type, used_at);
  `);
}

module.exports = initializeSchema;
