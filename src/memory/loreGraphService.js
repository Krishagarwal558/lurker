const repositories = require('../database/repositories');
const config = require('../config');

const loreGraphService = {
  addLore({ guildId, category = 'meme', title, content, createdBy }) {
    return repositories.addGuildLore({
      guildId,
      category,
      title: title.trim(),
      content: content.trim(),
      createdBy
    });
  },

  getRelevantLore(guildId, limit = 8) {
    if (!config.bot.enableLoreGraph) return [];
    return repositories.getGuildLore(guildId, limit);
  },

  formatLoreList(loreList) {
    if (!loreList || !loreList.length) return 'no server lore recorded yet';
    return loreList
      .map((item) => `**#${item.id} [${item.category.toUpperCase()}] ${item.title}**\n> ${item.content}`)
      .join('\n\n');
  }
};

module.exports = loreGraphService;
