const config = require('../config');
const logger = require('../utils/logger');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GroqClient {
  constructor() {
    this.apiKey = config.groq.apiKey;
    this.baseUrl = config.groq.baseUrl.replace(/\/+$/, '');
    this.model = config.groq.model;
  }

  async chat(messages, options = {}) {
    const body = {
      model: options.model || this.model,
      messages,
      temperature: options.temperature ?? config.groq.temperature,
      max_tokens: options.maxTokens ?? config.groq.maxTokens
    };

    let lastError;

    for (let attempt = 0; attempt <= config.groq.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.groq.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get('retry-after')) || attempt + 1;
          throw Object.assign(new Error(`Groq retryable status ${response.status}`), {
            retryAfterMs: retryAfter * 1000,
            retryable: true
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq request failed ${response.status}: ${errorText.slice(0, 300)}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('Groq returned an empty completion.');
        return content;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        const retryable = error.retryable || error.name === 'AbortError';
        if (!retryable || attempt >= config.groq.maxRetries) break;

        const backoff = error.retryAfterMs || (attempt + 1) * 750;
        logger.warn(`Groq request retrying in ${backoff}ms:`, error.message);
        await wait(backoff);
      }
    }

    throw lastError;
  }
}

module.exports = new GroqClient();
