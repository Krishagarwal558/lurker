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
    const candidateModels = [
      options.model || config.ai.groq.model,
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768'
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastError;
    for (const modelName of candidateModels) {
      const body = {
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens
      };

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

          if (response.status === 404) {
            const errorText = await response.text();
            logger.warn(`Groq model '${modelName}' not found. Trying next fallback model...`);
            break; // Break inner retry loop and try next model
          }

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
    }

    throw lastError;
  }
}

module.exports = new GroqProvider();
