import { generateText } from 'ai';
import { createOpenRouterClient, models } from '../config/openrouter';

// Pure function to generate text with context
export async function generateTextWithContext(
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
) {
  const openrouter = createOpenRouterClient();
  
  const result = await generateText({
    model: openrouter(models.chat),
    prompt,
    temperature: options.temperature ?? 0.1,
    maxOutputTokens: options.maxTokens ?? 1500,
  });
  
  return result.text;
}
