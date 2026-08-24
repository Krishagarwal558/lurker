const config = require('../config');
const logger = require('../utils/logger');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GroqProvider {
  constructor() {
    this.name = 'groq';
  }

  isConfigured() {
    return Boolean(config.ai.groq.apiKey);
  }

  async chat(messages, options = {}) {
    const apiKey = config.ai.groq.apiKey;
    const baseUrl = config.ai.groq.baseUrl.replace(/\/+$/, '');
    const model = options.model || config.ai.groq.model;
    const maxTokens = options.maxTokens ?? config.ai.groq.maxTokens;
    const temperature = options.temperature ?? config.ai.groq.temperature;

    const body = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };

    let lastError;
    for (let attempt = 0; attempt <= config.ai.groq.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.ai.groq.timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get('retry-after')) || attempt + 1;
          throw Object.assign(new Error(`Groq status ${response.status}`), {
            retryAfterMs: retryAfter * 1000,
            retryable: true
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq failed (${response.status}): ${errorText.slice(0, 300)}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('Groq returned empty completion.');
        return content;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        const retryable = error.retryable || error.name === 'AbortError';
        if (!retryable || attempt >= config.ai.groq.maxRetries) break;

        const backoff = error.retryAfterMs || (attempt + 1) * 750;
        logger.warn(`Groq retry in ${backoff}ms:`, error.message);
        await wait(backoff);
      }
    }

    throw lastError;
  }
}

module.exports = new GroqProvider();
