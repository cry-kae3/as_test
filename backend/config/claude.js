const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

const DEFAULT_AI_PARAMS = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    temperature: 0.2,
};

module.exports = {
    anthropic,
    DEFAULT_AI_PARAMS
};