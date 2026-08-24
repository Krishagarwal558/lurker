const config = require('../config');
const { getDatabase } = require('./connection');

function currentDay() {
  return new Date().toISOString().slice(0, 10);
}

const repositories = {
  // Guild Management
  upsertGuild(guild) {
    const db = getDatabase();
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO guilds (id, name, created_at, updated_at)
      VALUES (@id, @name, @now, @now)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `);
    stmt.run({ id: guild.id, name: guild.name, now });
  },

  getGuildSettings(guildId) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);
    return {
      aiEnabled: row ? Boolean(row.ai_enabled) : config.bot.defaultAiEnabled,
      replyChance: row?.reply_chance ?? config.bot.replyChance,
      keywordReplyChance: row?.keyword_reply_chance ?? config.bot.keywordReplyChance,
      channelCooldownSeconds: row?.channel_cooldown_seconds ?? config.bot.channelCooldownSeconds,
      userCooldownSeconds: row?.user_cooldown_seconds ?? config.bot.userCooldownSeconds
    };
  },

  setGuildAiEnabled(guildId, enabled) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      UPDATE guilds SET ai_enabled = ?, updated_at = ? WHERE id = ?
    `).run(enabled ? 1 : 0, now, guildId);
  },

  setReplyChance(guildId, chance) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      UPDATE guilds SET reply_chance = ?, updated_at = ? WHERE id = ?
    `).run(chance, now, guildId);
  },

  setCooldown(guildId, type, seconds) {
    const db = getDatabase();
    const now = Date.now();
    const column = type === 'channel' ? 'channel_cooldown_seconds' : 'user_cooldown_seconds';
    db.prepare(`
      UPDATE guilds SET ${column} = ?, updated_at = ? WHERE id = ?
    `).run(seconds, now, guildId);
  },

  // User Management
  upsertUser(author, member) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO users (id, username, display_name, created_at, updated_at)
      VALUES (@id, @username, @displayName, @now, @now)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
    `).run({
      id: author.id,
      username: author.username,
      displayName: member?.displayName || author.globalName || author.username,
      now
    });

    if (member?.guild?.id) {
      db.prepare(`
        INSERT INTO guild_users (guild_id, user_id, display_name, nickname, last_seen_at, created_at, updated_at)
        VALUES (@guildId, @userId, @displayName, @nickname, @now, @now, @now)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          display_name = excluded.display_name,
          nickname = excluded.nickname,
          last_seen_at = excluded.last_seen_at,
          updated_at = excluded.updated_at
      `).run({
        guildId: member.guild.id,
        userId: author.id,
        displayName: member.displayName,
        nickname: member.nickname || null,
        now
      });
    }
  },

  // Channel Settings & Filtering
  touchChannel(guildId, channelId) {
    const db = getDatabase();
    const now = Date.now();
    const targetMinutes = Math.floor(
      Math.random() * (config.bot.reviverMaxMinutes - config.bot.reviverMinMinutes + 1) + config.bot.reviverMinMinutes
    );

    db.prepare(`
      INSERT INTO channel_settings (
        guild_id, channel_id, last_activity_at, inactivity_target_minutes, created_at, updated_at
      ) VALUES (@guildId, @channelId, @now, @targetMinutes, @now, @now)
      ON CONFLICT(guild_id, channel_id) DO UPDATE SET
        last_activity_at = excluded.last_activity_at,
        updated_at = excluded.updated_at
    `).run({ guildId, channelId, now, targetMinutes });
  },

  getChannelSettings(guildId, channelId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM channel_settings WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId);

    return {
      blacklisted: Boolean(row?.blacklisted),
      whitelisted: Boolean(row?.whitelisted),
      lastActivityAt: row?.last_activity_at || null,
      lastReviverAt: row?.last_reviver_at || null,
      inactivityTargetMinutes: row?.inactivity_target_minutes || config.bot.reviverMinMinutes,
      lastStarter: row?.last_starter || null
    };
  },

  isAmbientChannelAllowed(guildId, channelId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT blacklisted, whitelisted FROM channel_settings WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId);

    if (row?.blacklisted) return false;

    const whitelistCount = db.prepare(`
      SELECT COUNT(*) as count FROM channel_settings WHERE guild_id = ? AND whitelisted = 1
    `).get(guildId).count;

    if (whitelistCount > 0) {
      return Boolean(row?.whitelisted);
    }

    return true;
  },

  setChannelBlacklist(guildId, channelId, blacklisted) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO channel_settings (guild_id, channel_id, blacklisted, inactivity_target_minutes, created_at, updated_at)
      VALUES (@guildId, @channelId, @blacklisted, 60, @now, @now)
      ON CONFLICT(guild_id, channel_id) DO UPDATE SET
        blacklisted = excluded.blacklisted,
        updated_at = excluded.updated_at
    `).run({ guildId, channelId, blacklisted: blacklisted ? 1 : 0, now });
  },

  setChannelWhitelist(guildId, channelId, whitelisted) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO channel_settings (guild_id, channel_id, whitelisted, inactivity_target_minutes, created_at, updated_at)
      VALUES (@guildId, @channelId, @whitelisted, 60, @now, @now)
      ON CONFLICT(guild_id, channel_id) DO UPDATE SET
        whitelisted = excluded.whitelisted,
        updated_at = excluded.updated_at
    `).run({ guildId, channelId, whitelisted: whitelisted ? 1 : 0, now });
  },

  clearWhitelist(guildId) {
    const db = getDatabase();
    db.prepare('UPDATE channel_settings SET whitelisted = 0 WHERE guild_id = ?').run(guildId);
  },

  listChannelsByFlag(guildId, flag) {
    const db = getDatabase();
    const column = flag === 'blacklisted' ? 'blacklisted' : 'whitelisted';
    return db.prepare(`
      SELECT channel_id FROM channel_settings WHERE guild_id = ? AND ${column} = 1
    `).all(guildId);
  },

  // Stats
  recordUserMessage({ guildId, userId, channelId, mentionedBot }) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO message_stats (guild_id, user_id, channel_id, total_messages, bot_mentions, last_message_at)
      VALUES (@guildId, @userId, @channelId, 1, @mentionedBot, @now)
      ON CONFLICT(guild_id, user_id, channel_id) DO UPDATE SET
        total_messages = total_messages + 1,
        bot_mentions = bot_mentions + excluded.bot_mentions,
        last_message_at = excluded.last_message_at
    `).run({ guildId, userId, channelId, mentionedBot: mentionedBot ? 1 : 0, now });
  },

  recordBotReply({ guildId, userId, channelId }) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO message_stats (guild_id, user_id, channel_id, bot_replies)
      VALUES (@guildId, @userId, @channelId, 1)
      ON CONFLICT(guild_id, user_id, channel_id) DO UPDATE SET
        bot_replies = bot_replies + 1
    `).run({ guildId, userId, channelId });
  },

  recordBotReaction({ guildId, userId, channelId }) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO message_stats (guild_id, user_id, channel_id, bot_reactions)
      VALUES (@guildId, @userId, @channelId, 1)
      ON CONFLICT(guild_id, user_id, channel_id) DO UPDATE SET
        bot_reactions = bot_reactions + 1
    `).run({ guildId, userId, channelId });
  },

  getUserStats(guildId, userId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(total_messages), 0) AS totalMessages,
        COALESCE(SUM(bot_mentions), 0) AS botMentions,
        COALESCE(SUM(bot_replies), 0) AS botReplies,
        COALESCE(SUM(bot_reactions), 0) AS botReactions
      FROM message_stats
      WHERE guild_id = ? AND user_id = ?
    `).get(guildId, userId);

    return row || { totalMessages: 0, botMentions: 0, botReplies: 0, botReactions: 0 };
  },

  getGuildStats(guildId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(total_messages), 0) AS totalMessages,
        COUNT(DISTINCT user_id) AS activeUsers
      FROM message_stats
      WHERE guild_id = ?
    `).get(guildId);

    return row || { totalMessages: 0, activeUsers: 0 };
  },

  // Conversation History
  addConversationMessage({ guildId, channelId, userId, username, isBot, content, messageId, personality }) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO conversation_history (
        guild_id, channel_id, user_id, username, is_bot, content, message_id, personality, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, channelId, userId, username, isBot ? 1 : 0, content, messageId || null, personality || null, now);
  },

  getRecentMessages(guildId, channelId, limit = 15) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM conversation_history
      WHERE guild_id = ? AND channel_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(guildId, channelId, limit);

    return rows.reverse().map((row) => ({
      ...row,
      is_bot: Boolean(row.is_bot)
    }));
  },

  getChannelConversationSignals(guildId, channelId, botUserId) {
    const db = getDatabase();
    const lastBot = db.prepare(`
      SELECT created_at, user_id FROM conversation_history
      WHERE guild_id = ? AND channel_id = ? AND is_bot = 1
      ORDER BY id DESC LIMIT 1
    `).get(guildId, channelId);

    const lastTrigger = db.prepare(`
      SELECT user_id FROM conversation_history
      WHERE guild_id = ? AND channel_id = ? AND is_bot = 0
      ORDER BY id DESC LIMIT 1
    `).get(guildId, channelId);

    let messagesSinceLastBot = 0;
    if (lastBot) {
      const countRow = db.prepare(`
        SELECT COUNT(*) as count FROM conversation_history
        WHERE guild_id = ? AND channel_id = ? AND created_at > ?
      `).get(guildId, channelId, lastBot.created_at);
      messagesSinceLastBot = countRow.count;
    } else {
      const countRow = db.prepare(`
        SELECT COUNT(*) as count FROM conversation_history
        WHERE guild_id = ? AND channel_id = ?
      `).get(guildId, channelId);
      messagesSinceLastBot = countRow.count;
    }

    return {
      lastBotAt: lastBot?.created_at || null,
      lastTriggerUserId: lastTrigger?.user_id || null,
      messagesSinceLastBot
    };
  },

  // Memories
  saveMemory({ guildId, userId, type, content, createdBy, sourceMessageId }) {
    const db = getDatabase();
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO memories (guild_id, user_id, type, content, created_by, source_message_id, created_at, updated_at)
      VALUES (@guildId, @userId, @type, @content, @createdBy, @sourceMessageId, @now, @now)
    `).run({ guildId, userId, type, content, createdBy, sourceMessageId: sourceMessageId || null, now });

    return {
      id: Number(result.lastInsertRowid),
      guild_id: guildId,
      user_id: userId,
      type,
      content,
      created_by: createdBy,
      created_at: now
    };
  },

  upsertNickname({ guildId, userId, nickname, sourceMessageId }) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO nicknames (guild_id, user_id, nickname, source_message_id, created_at, updated_at)
      VALUES (@guildId, @userId, @nickname, @sourceMessageId, @now, @now)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        nickname = excluded.nickname,
        source_message_id = excluded.source_message_id,
        updated_at = excluded.updated_at
    `).run({ guildId, userId, nickname, sourceMessageId: sourceMessageId || null, now });
  },

  getMemoriesForUser(guildId, userId, limit = 20) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM memories WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?
    `).all(guildId, userId, limit);
  },

  getRelevantMemories(guildId, userId, limit = 16) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM memories WHERE guild_id = ? AND (user_id = ? OR type IN ('inside_joke', 'running_meme'))
      ORDER BY id DESC LIMIT ?
    `).all(guildId, userId, limit);
  },

  getAllMemories(guildId, limit = 100) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM memories WHERE guild_id = ? ORDER BY id DESC LIMIT ?
    `).all(guildId, limit);
  },

  deleteMemoryById({ guildId, memoryId, requesterId, canModerate }) {
    const db = getDatabase();
    const memory = db.prepare('SELECT * FROM memories WHERE guild_id = ? AND id = ?').get(guildId, memoryId);
    if (!memory) return { deleted: 0, reason: 'missing' };
    if (!canModerate && memory.user_id !== requesterId && memory.created_by !== requesterId) {
      return { deleted: 0, reason: 'forbidden' };
    }
    db.prepare('DELETE FROM memories WHERE id = ?').run(memoryId);
    return { deleted: 1, reason: 'ok' };
  },

  deleteAllMemoriesForUser({ guildId, userId, requesterId, canModerate }) {
    const db = getDatabase();
    if (!canModerate && userId !== requesterId) return { deleted: 0, reason: 'forbidden' };
    const result = db.prepare('DELETE FROM memories WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    return { deleted: result.changes, reason: 'ok' };
  },

  deleteMemoriesByText({ guildId, requesterId, text, canModerate }) {
    const db = getDatabase();
    const term = `%${text.trim()}%`;
    if (canModerate) {
      const res = db.prepare('DELETE FROM memories WHERE guild_id = ? AND content LIKE ?').run(guildId, term);
      return res.changes;
    }
    const res = db.prepare(`
      DELETE FROM memories WHERE guild_id = ? AND content LIKE ? AND (user_id = ? OR created_by = ?)
    `).run(guildId, term, requesterId, requesterId);
    return res.changes;
  },

  // Member Affinity Matrix (V2)
  getAffinity(guildId, userId) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM user_affinity WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    return row || { affinity_score: 0, total_interactions: 0, sentiment_tag: 'neutral' };
  },

  updateAffinity(guildId, userId, scoreDelta, sentimentTag = null) {
    const db = getDatabase();
    const now = Date.now();
    const current = this.getAffinity(guildId, userId);
    const newScore = Math.max(-100, Math.min(100, current.affinity_score + scoreDelta));
    const tag = sentimentTag || (newScore >= 30 ? 'bestie' : newScore <= -30 ? 'rival' : 'friend');

    db.prepare(`
      INSERT INTO user_affinity (guild_id, user_id, affinity_score, total_interactions, sentiment_tag, last_interaction_at, updated_at)
      VALUES (@guildId, @userId, @newScore, 1, @tag, @now, @now)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        affinity_score = @newScore,
        total_interactions = total_interactions + 1,
        sentiment_tag = @tag,
        last_interaction_at = @now,
        updated_at = @now
    `).run({ guildId, userId, newScore, tag, now });

    return { affinity_score: newScore, sentiment_tag: tag };
  },

  // Guild Lore Graph (V2)
  addGuildLore({ guildId, category = 'meme', title, content, createdBy }) {
    const db = getDatabase();
    const now = Date.now();
    const res = db.prepare(`
      INSERT INTO guild_lore (guild_id, category, title, content, created_by, usage_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(guildId, category, title, content, createdBy, now, now);
    return { id: Number(res.lastInsertRowid), title, content, category };
  },

  getGuildLore(guildId, limit = 15) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM guild_lore WHERE guild_id = ? ORDER BY usage_count DESC, id DESC LIMIT ?
    `).all(guildId, limit);
  },

  incrementLoreUsage(loreId) {
    const db = getDatabase();
    db.prepare('UPDATE guild_lore SET usage_count = usage_count + 1 WHERE id = ?').run(loreId);
  },

  // Reviver Starters
  addReviverStarter({ guildId, channelId, starter }) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO reviver_starters (guild_id, channel_id, starter, created_at)
      VALUES (?, ?, ?, ?)
    `).run(guildId, channelId, starter, Date.now());
  },

  getRecentStarters(guildId, channelId, limit = 10) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT starter FROM reviver_starters WHERE guild_id = ? AND channel_id = ?
      ORDER BY id DESC LIMIT ?
    `).all(guildId, channelId, limit);
    return rows.map((r) => r.starter);
  },

  markChannelRevived(guildId, channelId, starter) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      UPDATE channel_settings SET
        last_reviver_at = ?,
        last_starter = ?,
        updated_at = ?
      WHERE guild_id = ? AND channel_id = ?
    `).run(now, starter, now, guildId, channelId);
  },

  // Hot Takes & Debates
  getUsedHotTakeTopics(guildId) {
    const db = getDatabase();
    const rows = db.prepare('SELECT topic FROM used_hot_takes WHERE guild_id = ?').all(guildId);
    return rows.map((r) => r.topic);
  },

  markHotTakeTopicUsed(guildId, topic) {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO used_hot_takes (guild_id, topic, used_at) VALUES (?, ?, ?)
    `).run(guildId, topic, Date.now());
  },

  clearUsedHotTakeTopics(guildId) {
    const db = getDatabase();
    db.prepare('DELETE FROM used_hot_takes WHERE guild_id = ?').run(guildId);
  },

  getRecentHotTakeOpeners(guildId, limit = 10) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT opener FROM hot_take_openers WHERE guild_id = ? ORDER BY id DESC LIMIT ?
    `).all(guildId, limit);
    return rows.map((r) => r.opener);
  },

  recordHotTakeOpener(guildId, opener) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO hot_take_openers (guild_id, opener, used_at) VALUES (?, ?, ?)
    `).run(guildId, opener, Date.now());
  },

  getHotTakeChannelState(guildId, channelId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM hot_take_channels WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId);
    return row || { messages_since_hot_take: 0, last_hot_take_at: null };
  },

  incrementHotTakeMessageCount(guildId, channelId) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO hot_take_channels (guild_id, channel_id, messages_since_hot_take, created_at, updated_at)
      VALUES (@guildId, @channelId, 1, @now, @now)
      ON CONFLICT(guild_id, channel_id) DO UPDATE SET
        messages_since_hot_take = messages_since_hot_take + 1,
        updated_at = excluded.updated_at
    `).run({ guildId, channelId, now });
  },

  getLatestHotTakeAt(guildId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT MAX(last_hot_take_at) AS latest FROM hot_take_channels WHERE guild_id = ?
    `).get(guildId);
    return row?.latest || null;
  },

  markHotTakeStarted({ guildId, channelId, topic, stance, opener, activeUntil }) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT OR REPLACE INTO active_hot_takes (
        guild_id, channel_id, topic, stance, opener, active_until, started_at, last_activity_at, agreement_count, switched_sides
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(guildId, channelId, topic, stance, opener, activeUntil, now, now);

    db.prepare(`
      UPDATE hot_take_channels SET
        messages_since_hot_take = 0,
        last_hot_take_at = ?,
        updated_at = ?
      WHERE guild_id = ? AND channel_id = ?
    `).run(now, now, guildId, channelId);
  },

  getActiveHotTake(guildId, channelId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM active_hot_takes WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId);
  },

  clearActiveHotTake(guildId, channelId) {
    const db = getDatabase();
    db.prepare(`
      DELETE FROM active_hot_takes WHERE guild_id = ? AND channel_id = ?
    `).run(guildId, channelId);
  },

  incrementHotTakeAgreement(guildId, channelId) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      UPDATE active_hot_takes SET
        agreement_count = agreement_count + 1,
        last_activity_at = ?
      WHERE guild_id = ? AND channel_id = ?
    `).run(now, guildId, channelId);

    const row = db.prepare(`
      SELECT agreement_count FROM active_hot_takes WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId);
    return row?.agreement_count || 0;
  },

  switchActiveHotTakeStance(guildId, channelId, newStance) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      UPDATE active_hot_takes SET
        stance = ?,
        switched_sides = 1,
        last_activity_at = ?
      WHERE guild_id = ? AND channel_id = ?
    `).run(newStance, now, guildId, channelId);

    return this.getActiveHotTake(guildId, channelId);
  },

  touchActiveHotTake(guildId, channelId) {
    const db = getDatabase();
    db.prepare(`
      UPDATE active_hot_takes SET last_activity_at = ? WHERE guild_id = ? AND channel_id = ?
    `).run(Date.now(), guildId, channelId);
  },

  // Hot Take Voting (V2)
  castHotTakeVote({ guildId, channelId, topic, userId, voteType }) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT OR REPLACE INTO hot_take_votes (guild_id, channel_id, topic, user_id, vote_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(guildId, channelId, topic, userId, voteType, now);

    const counts = db.prepare(`
      SELECT vote_type, COUNT(*) as count FROM hot_take_votes
      WHERE guild_id = ? AND channel_id = ? AND topic = ?
      GROUP BY vote_type
    `).all(guildId, channelId, topic);

    return counts.reduce((acc, row) => {
      acc[row.vote_type] = row.count;
      return acc;
    }, { agree: 0, disagree: 0, neutral: 0 });
  },

  // Target Gremlin
  getTargetGremlinSettings(guildId) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM target_gremlin_settings WHERE guild_id = ?').get(guildId);
    return row || { enabled: config.bot.enableTargetGremlin ? 1 : 0, target_user_id: config.bot.targetUserId || null, next_check_at: null };
  },

  setTargetGremlinTarget(guildId, targetUserId) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO target_gremlin_settings (guild_id, enabled, target_user_id, created_at, updated_at)
      VALUES (@guildId, 1, @targetUserId, @now, @now)
      ON CONFLICT(guild_id) DO UPDATE SET
        enabled = 1,
        target_user_id = excluded.target_user_id,
        updated_at = excluded.updated_at
    `).run({ guildId, targetUserId, now });
  },

  disableTargetGremlin(guildId) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      UPDATE target_gremlin_settings SET enabled = 0, updated_at = ? WHERE guild_id = ?
    `).run(now, guildId);
  },

  setTargetGremlinNextCheck(guildId, nextCheckAt) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO target_gremlin_settings (guild_id, enabled, next_check_at, created_at, updated_at)
      VALUES (@guildId, 1, @nextCheckAt, @now, @now)
      ON CONFLICT(guild_id) DO UPDATE SET
        next_check_at = excluded.next_check_at,
        updated_at = excluded.updated_at
    `).run({ guildId, nextCheckAt, now });
  },

  getTargetGremlinDaily(guildId, day = currentDay()) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM target_gremlin_daily WHERE guild_id = ? AND day = ?
    `).get(guildId, day);
    return row || { roast_count: 0, mention_count: 0 };
  },

  incrementTargetGremlinDaily({ guildId, day = currentDay(), mentionUsed = false }) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO target_gremlin_daily (guild_id, day, roast_count, mention_count, updated_at)
      VALUES (@guildId, @day, 1, @mentionCount, @now)
      ON CONFLICT(guild_id, day) DO UPDATE SET
        roast_count = roast_count + 1,
        mention_count = mention_count + excluded.mention_count,
        updated_at = excluded.updated_at
    `).run({ guildId, day, mentionCount: mentionUsed ? 1 : 0, now });
  },

  getUsedGremlinTemplates(guildId, type) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT template_key FROM target_gremlin_used_templates WHERE guild_id = ? AND type = ?
    `).all(guildId, type);
    return rows.map((r) => r.template_key);
  },

  markGremlinTemplateUsed(guildId, type, templateKey) {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO target_gremlin_used_templates (guild_id, type, template_key, used_at)
      VALUES (?, ?, ?, ?)
    `).run(guildId, type, templateKey, Date.now());
  },

  clearGremlinTemplates(guildId, type) {
    const db = getDatabase();
    db.prepare('DELETE FROM target_gremlin_used_templates WHERE guild_id = ? AND type = ?').run(guildId, type);
  },

  getLastUserMessage(guildId, userId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM conversation_history
      WHERE guild_id = ? AND user_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(guildId, userId);
  },

  getMostActiveRecentChannel(guildId, sinceMs) {
    const db = getDatabase();
    return db.prepare(`
      SELECT channel_id, COUNT(*) as count FROM conversation_history
      WHERE guild_id = ? AND created_at >= ?
      GROUP BY channel_id
      ORDER BY count DESC LIMIT 1
    `).get(guildId, sinceMs);
  }
};

module.exports = repositories;
