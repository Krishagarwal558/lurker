const config = require('../config');
const logger = require('../utils/logger');

class GeminiProvider {
  constructor() {
    this.name = 'gemini';
  }

  isConfigured() {
    return Boolean(config.ai.gemini.apiKey);
  }

  async chat(messages, options = {}) {
    const apiKey = config.ai.gemini.apiKey;
    const model = options.model || config.ai.gemini.model;
    const url = `${config.ai.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    // Extract system instruction and user/assistant messages
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: msg.content }]
        };
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: msg.content }]
        });
      }
    }

    if (!contents.length) {
      contents.push({ role: 'user', parts: [{ text: 'hey' }] });
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? config.ai.groq.temperature,
        maxOutputTokens: options.maxTokens ?? config.ai.groq.maxTokens
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.bot.replyTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini request failed (${response.status}): ${err.slice(0, 300)}`);
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('Gemini returned empty text candidate.');
      return content;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
}

module.exports = new GeminiProvider();
