const db = require('./connection');
const config = require('../config');
const { randomInt } = require('../utils/random');

function now() {
  return Date.now();
}

function reviverTargetMinutes() {
  return randomInt(config.bot.reviverMinMinutes, config.bot.reviverMaxMinutes);
}

function ensureGuild(guildId, name = 'Unknown Server') {
  const timestamp = now();
  db.prepare(`
    INSERT INTO guilds (
      id,
      name,
      ai_enabled,
      reply_chance,
      keyword_reply_chance,
      channel_cooldown_seconds,
      user_cooldown_seconds,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at
  `).run(
    guildId,
    name,
    config.bot.defaultAiEnabled ? 1 : 0,
    config.bot.replyChance,
    config.bot.keywordReplyChance,
    config.bot.channelCooldownSeconds,
    config.bot.userCooldownSeconds,
    timestamp,
    timestamp
  );
}

function upsertGuild(guild) {
  ensureGuild(guild.id, guild.name || 'Unknown Server');
}

function upsertUser(user, member = null) {
  const timestamp = now();
  const displayName = member?.displayName || user.globalName || user.username;

  db.prepare(`
    INSERT INTO users (id, username, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
  `).run(user.id, user.username, displayName, timestamp, timestamp);

  if (member?.guild?.id) {
    db.prepare(`
      INSERT INTO guild_users (
        guild_id,
        user_id,
        display_name,
        nickname,
        last_seen_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        display_name = excluded.display_name,
        nickname = excluded.nickname,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    `).run(
      member.guild.id,
      user.id,
      member.displayName,
      member.nickname || null,
      timestamp,
      timestamp,
      timestamp
    );
  }
}

function getGuildSettings(guildId) {
  ensureGuild(guildId);
  const row = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);

  return {
    guildId,
    aiEnabled: Boolean(row.ai_enabled),
    replyChance: row.reply_chance ?? config.bot.replyChance,
    keywordReplyChance: row.keyword_reply_chance ?? config.bot.keywordReplyChance,
    channelCooldownSeconds: row.channel_cooldown_seconds ?? config.bot.channelCooldownSeconds,
    userCooldownSeconds: row.user_cooldown_seconds ?? config.bot.userCooldownSeconds
  };
}

function setGuildAiEnabled(guildId, enabled) {
  ensureGuild(guildId);
  db.prepare('UPDATE guilds SET ai_enabled = ?, updated_at = ? WHERE id = ?')
    .run(enabled ? 1 : 0, now(), guildId);
}

function setReplyChance(guildId, chance) {
  ensureGuild(guildId);
  db.prepare('UPDATE guilds SET reply_chance = ?, updated_at = ? WHERE id = ?')
    .run(chance, now(), guildId);
}

function setCooldown(guildId, type, seconds) {
  ensureGuild(guildId);
  const column = type === 'channel' ? 'channel_cooldown_seconds' : 'user_cooldown_seconds';
  db.prepare(`UPDATE guilds SET ${column} = ?, updated_at = ? WHERE id = ?`)
    .run(seconds, now(), guildId);
}

function ensureChannelSettings(guildId, channelId) {
  ensureGuild(guildId);
  const timestamp = now();

  db.prepare(`
    INSERT INTO channel_settings (
      guild_id,
      channel_id,
      inactivity_target_minutes,
      last_activity_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, channel_id) DO NOTHING
  `).run(guildId, channelId, reviverTargetMinutes(), timestamp, timestamp, timestamp);
}

function touchChannel(guildId, channelId, timestamp = now()) {
  ensureChannelSettings(guildId, channelId);
  db.prepare(`
    UPDATE channel_settings
    SET last_activity_at = ?, updated_at = ?
    WHERE guild_id = ? AND channel_id = ?
  `).run(timestamp, timestamp, guildId, channelId);
}

function getChannelSettings(guildId, channelId) {
  ensureChannelSettings(guildId, channelId);
  const row = db.prepare(`
    SELECT *
    FROM channel_settings
    WHERE guild_id = ? AND channel_id = ?
  `).get(guildId, channelId);

  return {
    guildId,
    channelId,
    aiEnabled: row.ai_enabled === null ? null : Boolean(row.ai_enabled),
    blacklisted: Boolean(row.blacklisted),
    whitelisted: Boolean(row.whitelisted),
    lastActivityAt: row.last_activity_at || null,
    lastReviverAt: row.last_reviver_at || null,
    inactivityTargetMinutes: row.inactivity_target_minutes,
    lastStarter: row.last_starter || null
  };
}

function setChannelBlacklist(guildId, channelId, enabled) {
  ensureChannelSettings(guildId, channelId);
  db.prepare(`
    UPDATE channel_settings
    SET blacklisted = ?, whitelisted = CASE WHEN ? = 1 THEN 0 ELSE whitelisted END, updated_at = ?
    WHERE guild_id = ? AND channel_id = ?
  `).run(enabled ? 1 : 0, enabled ? 1 : 0, now(), guildId, channelId);
}

function setChannelWhitelist(guildId, channelId, enabled) {
  ensureChannelSettings(guildId, channelId);
  db.prepare(`
    UPDATE channel_settings
    SET whitelisted = ?, blacklisted = CASE WHEN ? = 1 THEN 0 ELSE blacklisted END, updated_at = ?
    WHERE guild_id = ? AND channel_id = ?
  `).run(enabled ? 1 : 0, enabled ? 1 : 0, now(), guildId, channelId);
}

function clearWhitelist(guildId) {
  ensureGuild(guildId);
  db.prepare('UPDATE channel_settings SET whitelisted = 0, updated_at = ? WHERE guild_id = ?')
    .run(now(), guildId);
}

function listChannelsByFlag(guildId, flag) {
  ensureGuild(guildId);
  const column = flag === 'blacklisted' ? 'blacklisted' : 'whitelisted';
  return db.prepare(`
    SELECT channel_id
    FROM channel_settings
    WHERE guild_id = ? AND ${column} = 1
    ORDER BY updated_at DESC
  `).all(guildId);
}

function whitelistCount(guildId) {
  ensureGuild(guildId);
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM channel_settings
    WHERE guild_id = ? AND whitelisted = 1
  `).get(guildId);
  return row.count;
}

function isAmbientChannelAllowed(guildId, channelId) {
  const channel = getChannelSettings(guildId, channelId);
  if (channel.blacklisted) return false;
  const hasWhitelist = whitelistCount(guildId) > 0;
  return !hasWhitelist || channel.whitelisted;
}

function recordUserMessage({ guildId, userId, channelId, mentionedBot }) {
  const timestamp = now();
  db.prepare(`
    INSERT INTO message_stats (
      guild_id,
      user_id,
      channel_id,
      total_messages,
      bot_mentions,
      bot_replies,
      bot_reactions,
      last_message_at
    )
    VALUES (?, ?, ?, 1, ?, 0, 0, ?)
    ON CONFLICT(guild_id, user_id, channel_id) DO UPDATE SET
      total_messages = total_messages + 1,
      bot_mentions = bot_mentions + excluded.bot_mentions,
      last_message_at = excluded.last_message_at
  `).run(guildId, userId, channelId, mentionedBot ? 1 : 0, timestamp);
}

function recordBotReply({ guildId, userId, channelId }) {
  db.prepare(`
    INSERT INTO message_stats (
      guild_id,
      user_id,
      channel_id,
      total_messages,
      bot_mentions,
      bot_replies,
      bot_reactions,
      last_message_at
    )
    VALUES (?, ?, ?, 0, 0, 1, 0, ?)
    ON CONFLICT(guild_id, user_id, channel_id) DO UPDATE SET
      bot_replies = bot_replies + 1
  `).run(guildId, userId, channelId, now());
}

function recordBotReaction({ guildId, userId, channelId }) {
  db.prepare(`
    INSERT INTO message_stats (
      guild_id,
      user_id,
      channel_id,
      total_messages,
      bot_mentions,
      bot_replies,
      bot_reactions,
      last_message_at
    )
    VALUES (?, ?, ?, 0, 0, 0, 1, ?)
    ON CONFLICT(guild_id, user_id, channel_id) DO UPDATE SET
      bot_reactions = bot_reactions + 1
  `).run(guildId, userId, channelId, now());
}

function getUserStats(guildId, userId) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_messages), 0) AS totalMessages,
      COALESCE(SUM(bot_mentions), 0) AS botMentions,
      COALESCE(SUM(bot_replies), 0) AS botReplies,
      COALESCE(SUM(bot_reactions), 0) AS botReactions,
      MAX(last_message_at) AS lastMessageAt
    FROM message_stats
    WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);
  return row;
}

function getGuildStats(guildId) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_messages), 0) AS totalMessages,
      COALESCE(SUM(bot_mentions), 0) AS botMentions,
      COALESCE(SUM(bot_replies), 0) AS botReplies,
      COALESCE(SUM(bot_reactions), 0) AS botReactions,
      COUNT(DISTINCT user_id) AS activeUsers
    FROM message_stats
    WHERE guild_id = ?
  `).get(guildId);
  return row;
}

function upsertNickname({ guildId, userId, nickname, sourceMessageId }) {
  const timestamp = now();
  db.prepare(`
    INSERT INTO nicknames (guild_id, user_id, nickname, source_message_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      nickname = excluded.nickname,
      source_message_id = excluded.source_message_id,
      updated_at = excluded.updated_at
  `).run(guildId, userId, nickname, sourceMessageId || null, timestamp, timestamp);
}

function getNickname(guildId, userId) {
  const row = db.prepare(`
    SELECT nickname
    FROM nicknames
    WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);
  return row?.nickname || null;
}

function saveMemory({ guildId, userId, type, content, createdBy, sourceMessageId }) {
  const timestamp = now();
  const result = db.prepare(`
    INSERT INTO memories (
      guild_id,
      user_id,
      type,
      content,
      created_by,
      source_message_id,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    guildId,
    userId,
    type,
    content,
    createdBy,
    sourceMessageId || null,
    timestamp,
    timestamp
  );

  return getMemoryById(guildId, result.lastInsertRowid);
}

function getMemoryById(guildId, id) {
  return db.prepare(`
    SELECT *
    FROM memories
    WHERE guild_id = ? AND id = ?
  `).get(guildId, id);
}

function getMemoriesForUser(guildId, userId, limit = 20) {
  return db.prepare(`
    SELECT *
    FROM memories
    WHERE guild_id = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(guildId, userId, limit);
}

function getRelevantMemories(guildId, userId, limit = 16) {
  return db.prepare(`
    SELECT *
    FROM memories
    WHERE guild_id = ?
      AND (
        user_id = ?
        OR type IN ('inside_joke', 'running_meme', 'favorite_topic', 'favorite_game')
      )
    ORDER BY created_at DESC
    LIMIT ?
  `).all(guildId, userId, limit);
}

function deleteMemoryById({ guildId, memoryId, requesterId, canModerate }) {
  const memory = getMemoryById(guildId, memoryId);
  if (!memory) return { deleted: 0, reason: 'missing' };
  if (!canModerate && memory.user_id !== requesterId && memory.created_by !== requesterId) {
    return { deleted: 0, reason: 'forbidden' };
  }

  db.prepare('DELETE FROM memories WHERE guild_id = ? AND id = ?').run(guildId, memoryId);
  if (memory.type === 'nickname') {
    db.prepare('DELETE FROM nicknames WHERE guild_id = ? AND user_id = ?')
      .run(guildId, memory.user_id);
  }

  return { deleted: 1, reason: 'deleted' };
}

function deleteMemoriesByText({ guildId, requesterId, text, canModerate }) {
  const like = `%${text}%`;
  const result = canModerate
    ? db.prepare('DELETE FROM memories WHERE guild_id = ? AND content LIKE ?').run(guildId, like)
    : db.prepare('DELETE FROM memories WHERE guild_id = ? AND user_id = ? AND content LIKE ?')
      .run(guildId, requesterId, like);
  return result.changes;
}

function deleteAllMemoriesForUser({ guildId, userId, requesterId, canModerate }) {
  if (!canModerate && userId !== requesterId) return { deleted: 0, reason: 'forbidden' };
  const result = db.prepare('DELETE FROM memories WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId);
  db.prepare('DELETE FROM nicknames WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  return { deleted: result.changes, reason: 'deleted' };
}

function addConversationMessage({
  guildId,
  channelId,
  userId,
  username,
  isBot,
  content,
  messageId,
  personality = null
}) {
  const clipped = String(content || '').slice(0, 1200);
  db.prepare(`
    INSERT INTO conversation_history (
      guild_id,
      channel_id,
      user_id,
      username,
      is_bot,
      content,
      message_id,
      personality,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    guildId,
    channelId,
    userId,
    username,
    isBot ? 1 : 0,
    clipped,
    messageId || null,
    personality,
    now()
  );

  pruneConversation(guildId, channelId);
}

function pruneConversation(guildId, channelId, keep = 500) {
  db.prepare(`
    DELETE FROM conversation_history
    WHERE guild_id = ?
      AND channel_id = ?
      AND id NOT IN (
        SELECT id
        FROM conversation_history
        WHERE guild_id = ?
          AND channel_id = ?
        ORDER BY id DESC
        LIMIT ?
      )
  `).run(guildId, channelId, guildId, channelId, keep);
}

function getRecentMessages(guildId, channelId, limit) {
  const rows = db.prepare(`
    SELECT *
    FROM conversation_history
    WHERE guild_id = ? AND channel_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(guildId, channelId, limit);

  return rows.reverse();
}

function getChannelConversationSignals(guildId, channelId, botUserId) {
  const lastBot = db.prepare(`
    SELECT id, user_id, created_at
    FROM conversation_history
    WHERE guild_id = ?
      AND channel_id = ?
      AND user_id = ?
      AND is_bot = 1
    ORDER BY id DESC
    LIMIT 1
  `).get(guildId, channelId, botUserId);

  const messagesSinceLastBot = lastBot
    ? db.prepare(`
      SELECT COUNT(*) AS count
      FROM conversation_history
      WHERE guild_id = ?
        AND channel_id = ?
        AND is_bot = 0
        AND id > ?
    `).get(guildId, channelId, lastBot.id).count
    : db.prepare(`
      SELECT COUNT(*) AS count
      FROM conversation_history
      WHERE guild_id = ?
        AND channel_id = ?
        AND is_bot = 0
    `).get(guildId, channelId).count;

  const lastTrigger = lastBot
    ? db.prepare(`
      SELECT user_id
      FROM conversation_history
      WHERE guild_id = ?
        AND channel_id = ?
        AND is_bot = 0
        AND id < ?
      ORDER BY id DESC
      LIMIT 1
    `).get(guildId, channelId, lastBot.id)
    : null;

  return {
    lastBotAt: lastBot?.created_at || null,
    lastTriggerUserId: lastTrigger?.user_id || null,
    messagesSinceLastBot
  };
}

function addReviverStarter({ guildId, channelId, starter }) {
  db.prepare(`
    INSERT INTO reviver_starters (guild_id, channel_id, starter, created_at)
    VALUES (?, ?, ?, ?)
  `).run(guildId, channelId, starter, now());
}

function getRecentStarters(guildId, channelId, limit = 10) {
  return db.prepare(`
    SELECT starter
    FROM reviver_starters
    WHERE guild_id = ? AND channel_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(guildId, channelId, limit).map((row) => row.starter);
}

function markChannelRevived(guildId, channelId, starter) {
  const timestamp = now();
  db.prepare(`
    UPDATE channel_settings
    SET
      last_reviver_at = ?,
      last_activity_at = ?,
      inactivity_target_minutes = ?,
      last_starter = ?,
      updated_at = ?
    WHERE guild_id = ? AND channel_id = ?
  `).run(
    timestamp,
    timestamp,
    reviverTargetMinutes(),
    starter,
    timestamp,
    guildId,
    channelId
  );
}

module.exports = {
  addConversationMessage,
  addReviverStarter,
  clearWhitelist,
  deleteAllMemoriesForUser,
  deleteMemoriesByText,
  deleteMemoryById,
  ensureChannelSettings,
  ensureGuild,
  getChannelSettings,
  getGuildSettings,
  getChannelConversationSignals,
  getGuildStats,
  getMemoriesForUser,
  getMemoryById,
  getNickname,
  getRecentMessages,
  getRecentStarters,
  getRelevantMemories,
  getUserStats,
  isAmbientChannelAllowed,
  listChannelsByFlag,
  markChannelRevived,
  recordBotReaction,
  recordBotReply,
  recordUserMessage,
  saveMemory,
  setChannelBlacklist,
  setChannelWhitelist,
  setCooldown,
  setGuildAiEnabled,
  setReplyChance,
  touchChannel,
  upsertGuild,
  upsertNickname,
  upsertUser,
  whitelistCount
};
