const axios = require('axios');

class GeminiKeyPool {
  constructor(name, keys) {
    this.name = name;
    // Normalize keys: filter out undefined/empty strings
    this.keys = keys.map(k => k ? k.trim() : '').filter(k => k.length > 0);
    this.keyStates = this.keys.map(key => ({
      key,
      status: 'ok',
      cooldownUntil: 0
    }));
    this.currentIndex = 0;
    console.log(`[GeminiKeyPool:${name}] Initialized with ${this.keys.length} keys.`);
  }

  getHealthyKey() {
    const now = Date.now();
    const len = this.keyStates.length;
    if (len === 0) {
      return null;
    }

    // Try starting from currentIndex and round robin
    for (let i = 0; i < len; i++) {
      const idx = (this.currentIndex + i) % len;
      const state = this.keyStates[idx];
      if (state.status === 'cooldown' && now > state.cooldownUntil) {
        state.status = 'ok';
      }
      if (state.status === 'ok') {
        this.currentIndex = (idx + 1) % len;
        return state;
      }
    }

    // If all are rate limited, find the one closest to cooldown expiry
    let best = this.keyStates[0];
    for (let i = 1; i < len; i++) {
      if (this.keyStates[i].cooldownUntil < best.cooldownUntil) {
        best = this.keyStates[i];
      }
    }
    return best;
  }

  async callGemini(prompt, systemInstruction = '', jsonMode = false) {
    const keyState = this.getHealthyKey();
    if (!keyState) {
      throw new Error(`[GeminiKeyPool:${this.name}] No keys configured in pool.`);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyState.key}`;

    const contents = [{
      parts: [{ text: prompt }]
    }];

    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    if (jsonMode) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      // Reset status on success
      keyState.status = 'ok';
      
      const candidate = response.data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      return text || '';
    } catch (error) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error?.message || error.message;

      if (status === 429 || status === 403 || errorMsg.includes('quota') || errorMsg.includes('limit')) {
        console.warn(`[GeminiKeyPool:${this.name}] Key rate limited (HTTP ${status}). Cooling down for 30s.`);
        keyState.status = 'cooldown';
        keyState.cooldownUntil = Date.now() + 30000; // 30 seconds cooldown

        // Retry with next key
        return this.callGemini(prompt, systemInstruction, jsonMode);
      }

      throw error;
    }
  }

  async callGeminiStream(prompt, systemInstruction = '', onChunk) {
    // Standard streaming fallback using standard callGemini since standard HTTP response buffering is fine for our UI
    try {
      const result = await this.callGemini(prompt, systemInstruction, false);
      // Simulate chunk-by-chunk stream for UI aesthetic
      const words = result.split(' ');
      for (let i = 0; i < words.length; i++) {
        onChunk(words[i] + ' ');
        await new Promise(r => setTimeout(r, 15));
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = GeminiKeyPool;
