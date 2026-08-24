const config = require('../config');
const logger = require('../utils/logger');

class OpenAIProvider {
  constructor() {
    this.name = 'openai';
  }

  isConfigured() {
    return Boolean(config.ai.openai.apiKey);
  }

  async chat(messages, options = {}) {
    const apiKey = config.ai.openai.apiKey;
    const baseUrl = config.ai.openai.baseUrl.replace(/\/+$/, '');
    const model = options.model || config.ai.openai.model;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.bot.replyTimeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? config.ai.groq.temperature,
          max_tokens: options.maxTokens ?? config.ai.groq.maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${err.slice(0, 300)}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI returned empty message.');
      return content;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
}

module.exports = new OpenAIProvider();
