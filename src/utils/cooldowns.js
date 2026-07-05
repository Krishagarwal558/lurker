class CooldownManager {
  constructor() {
    this.cooldowns = new Map();
  }

  isReady(key, durationMs) {
    if (durationMs <= 0) return true;
    const expiresAt = this.cooldowns.get(key) || 0;
    return Date.now() >= expiresAt;
  }

  mark(key, durationMs) {
    if (durationMs <= 0) return;
    this.cooldowns.set(key, Date.now() + durationMs);
  }

  canTalk(guildId, channelId, userId, settings) {
    const channelKey = `channel:${guildId}:${channelId}`;
    const userKey = `user:${guildId}:${userId}`;
    return (
      this.isReady(channelKey, settings.channelCooldownSeconds * 1000) &&
      this.isReady(userKey, settings.userCooldownSeconds * 1000)
    );
  }

  markTalk(guildId, channelId, userId, settings) {
    this.mark(`channel:${guildId}:${channelId}`, settings.channelCooldownSeconds * 1000);
    this.mark(`user:${guildId}:${userId}`, settings.userCooldownSeconds * 1000);
  }
}

module.exports = new CooldownManager();
