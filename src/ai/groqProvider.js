const config = require('../config');
const logger = require('../utils/logger');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let discoveredModelsCache = null;
let lastDiscoveryTime = 0;
let preferredModel = null;

async function fetchLiveGroqModels(baseUrl, apiKey) {
  const now = Date.now();
  if (discoveredModelsCache && now - lastDiscoveryTime < 60000 * 30) {
    return discoveredModelsCache;
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (res.ok) {
      const data = await res.json();
      const models = (data?.data || [])
        .map((m) => m.id)
        .filter((id) => id && !id.includes('whisper') && !id.includes('guard') && !id.includes('tts') && !id.includes('embedding'));
      if (models.length) {
        discoveredModelsCache = models;
        lastDiscoveryTime = now;
        logger.info(`Discovered ${models.length} active Groq models: ${models.slice(0, 6).join(', ')}`);
        return models;
      }
    }
  } catch (err) {
    logger.warn('Dynamic Groq model discovery failed, using fallback list:', err.message);
  }

  return [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'deepseek-r1-distill-llama-70b',
    'llama-3.2-3b-preview',
    'llama-3.2-1b-preview',
    'qwen-qwq-32b'
  ];
}

class GroqProvider {
  constructor() {
    this.name = 'groq';
  }

  isConfigured() {
    return Boolean(config.ai.groq.apiKey);
  }

  async chat(messages, options = {}) {
    const apiKey = (config.ai.groq.apiKey || '').trim();
    const baseUrl = config.ai.groq.baseUrl.replace(/\/+$/, '');
    const maxTokens = options.maxTokens ?? config.ai.groq.maxTokens;
    const temperature = options.temperature ?? config.ai.groq.temperature;

    const liveModels = await fetchLiveGroqModels(baseUrl, apiKey);

    const candidateModels = [
      preferredModel,
      options.model,
      config.ai.groq.model,
      ...liveModels,
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'deepseek-r1-distill-llama-70b',
      'llama-3.2-3b-preview',
      'llama-3.2-1b-preview'
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

          if (response.status === 404 || response.status === 400) {
            const errorText = await response.text();
            logger.warn(`Groq model '${modelName}' returned ${response.status}: ${errorText.slice(0, 150)}. Trying next fallback model...`);
            if (preferredModel === modelName) preferredModel = null;
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

          // Cache the winning working model
          preferredModel = modelName;
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
