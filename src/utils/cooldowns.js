const config = require('../config');

class CooldownManager {
  constructor() {
    this.channelCooldowns = new Map();
    this.userCooldowns = new Map();
  }

  channelKey(guildId, channelId) {
    return `${guildId}:${channelId}`;
  }

  userKey(guildId, userId) {
    return `${guildId}:${userId}`;
  }

  canTalk(guildId, channelId, userId, settings = {}) {
    const now = Date.now();
    const channelCooldown = (settings.channelCooldownSeconds ?? config.bot.channelCooldownSeconds) * 1000;
    const userCooldown = (settings.userCooldownSeconds ?? config.bot.userCooldownSeconds) * 1000;

    const lastChannel = this.channelCooldowns.get(this.channelKey(guildId, channelId)) || 0;
    if (now - lastChannel < channelCooldown) return false;

    const lastUser = this.userCooldowns.get(this.userKey(guildId, userId)) || 0;
    if (now - lastUser < userCooldown) return false;

    return true;
  }

  markTalk(guildId, channelId, userId) {
    const now = Date.now();
    this.channelCooldowns.set(this.channelKey(guildId, channelId), now);
    this.userCooldowns.set(this.userKey(guildId, userId), now);
  }

  clearChannel(guildId, channelId) {
    this.channelCooldowns.delete(this.channelKey(guildId, channelId));
  }

  clearUser(guildId, userId) {
    this.userCooldowns.delete(this.userKey(guildId, userId));
  }
}

module.exports = new CooldownManager();
