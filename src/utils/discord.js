const logger = require('./logger');

async function safeReply(message, content) {
  try {
    return await message.reply({
      content,
      allowedMentions: {
        parse: [],
        repliedUser: false
      }
    });
  } catch (error) {
    logger.warn('Reply failed:', error.message);
    return null;
  }
}

async function safeSend(channel, content) {
  try {
    return await channel.send({
      content,
      allowedMentions: {
        parse: []
      }
    });
  } catch (error) {
    logger.warn(`Send failed in channel ${channel.id}:`, error.message);
    return null;
  }
}

async function safeTyping(channel) {
  try {
    await channel.sendTyping();
    return true;
  } catch (error) {
    logger.debug(`Typing indicator failed in channel ${channel.id}:`, error.message);
    return false;
  }
}

async function safeReact(message, emoji) {
  try {
    await message.react(emoji);
    return true;
  } catch (error) {
    logger.debug('Reaction failed:', error.message);
    return false;
  }
}

module.exports = {
  safeReact,
  safeReply,
  safeSend,
  safeTyping
};
