const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const logger = require('./logger');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeTyping(channel) {
  try {
    if (channel && typeof channel.sendTyping === 'function') {
      await channel.sendTyping();
    }
  } catch (error) {
    logger.debug('sendTyping failed:', error.message);
  }
}

async function safeReply(message, content, options = {}) {
  if (!message || !content) return null;
  try {
    return await message.reply({
      content: String(content),
      allowedMentions: { repliedUser: false, users: options.allowedUsers || [] }
    });
  } catch (error) {
    logger.warn('safeReply failed:', error.message);
    try {
      if (message.channel && typeof message.channel.send === 'function') {
        return await message.channel.send({
          content: String(content),
          allowedMentions: { users: options.allowedUsers || [] }
        });
      }
    } catch (fallbackError) {
      logger.error('safeSend fallback failed:', fallbackError.message);
    }
    return null;
  }
}

async function safeSend(channel, content, allowedUsers = []) {
  if (!channel || !content) return null;
  try {
    return await channel.send({
      content: String(content),
      allowedMentions: { users: allowedUsers }
    });
  } catch (error) {
    logger.warn('safeSend failed:', error.message);
    return null;
  }
}

async function safeReact(message, emoji) {
  if (!message || !emoji) return false;
  try {
    await message.react(emoji);
    return true;
  } catch (error) {
    logger.debug(`safeReact [${emoji}] failed:`, error.message);
    return false;
  }
}

async function sendMultiBubble({ channel, replyToMessage = null, bubbles = [], burstDelayMs = 900 }) {
  if (!channel || !bubbles || !bubbles.length) return null;

  let lastSent = null;
  for (let i = 0; i < bubbles.length; i += 1) {
    const text = bubbles[i];
    if (!text) continue;

    if (i > 0) {
      await safeTyping(channel);
      await wait(burstDelayMs);
    }

    if (i === 0 && replyToMessage) {
      lastSent = await safeReply(replyToMessage, text);
    } else {
      lastSent = await safeSend(channel, text);
    }
  }

  return lastSent;
}

function createEmbed({ title, description, fields = [], color = 0x8b5cf6, footer = null }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });

  return embed;
}

function createHotTakeActionRow(topic) {
  const agreeBtn = new ButtonBuilder()
    .setCustomId(`hottake:agree:${encodeURIComponent(topic.slice(0, 30))}`)
    .setLabel('Agree 🟢')
    .setStyle(ButtonStyle.Success);

  const disagreeBtn = new ButtonBuilder()
    .setCustomId(`hottake:disagree:${encodeURIComponent(topic.slice(0, 30))}`)
    .setLabel('Cap 🔴')
    .setStyle(ButtonStyle.Danger);

  const argueBtn = new ButtonBuilder()
    .setCustomId(`hottake:argue:${encodeURIComponent(topic.slice(0, 30))}`)
    .setLabel('Fight Me ⚔️')
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder().addComponents(agreeBtn, disagreeBtn, argueBtn);
}

module.exports = {
  createEmbed,
  createHotTakeActionRow,
  safeReact,
  safeReply,
  safeSend,
  safeTyping,
  sendMultiBubble
};
