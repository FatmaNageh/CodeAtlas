import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Pure functional config - no classes
export const createOpenRouterClient = () => createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Lightweight models via OpenRouter
export const models = {
  embedding: 'openai/text-embedding-3-small',
  chat: 'meta-llama/llama-3.1-8b-instruct', // Fast & lightweight
} as const;

export const embedDimensions = 1536;
