const config = require('../config');
const groqProvider = require('./groqProvider');
const geminiProvider = require('./geminiProvider');
const openaiProvider = require('./openaiProvider');
const logger = require('../utils/logger');

const providers = {
  groq: groqProvider,
  gemini: geminiProvider,
  openai: openaiProvider
};

class ProviderFactory {
  getAvailableProviders() {
    const order = config.ai.providerOrder;
    const available = [];
    for (const name of order) {
      const provider = providers[name];
      if (provider && provider.isConfigured()) {
        available.push(provider);
      }
    }
    return available;
  }

  async chat(messages, options = {}) {
    const available = this.getAvailableProviders();

    if (!available.length) {
      // If none configured with key, check if groq default is present
      if (groqProvider.isConfigured()) {
        return groqProvider.chat(messages, options);
      }
      throw new Error('No AI provider is configured. Please provide GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in .env');
    }

    let lastError = null;
    for (const provider of available) {
      try {
        const result = await provider.chat(messages, options);
        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`Provider [${provider.name}] failed: ${error.message}. Trying next fallback provider...`);
      }
    }

    throw lastError || new Error('All AI providers failed to respond.');
  }
}

module.exports = new ProviderFactory();
