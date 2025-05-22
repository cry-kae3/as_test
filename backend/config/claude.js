const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

// Claude APIクライアントの初期化
const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

// デフォルトのAIパラメータ
const DEFAULT_AI_PARAMS = {
    model: 'claude-3-7-sonnet-20250219',
    maxTokens: 2000,
    temperature: 0.2,
};

module.exports = {
    anthropic,
    DEFAULT_AI_PARAMS
};