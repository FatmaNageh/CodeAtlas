// Pure function to build summary prompt
export function buildSummaryPrompt(params: {
  filePath: string;
  code: string;
  symbols: string[];
  imports: string[];
}): string {
  return `Analyze this code file: ${params.filePath}

CODE:
\`\`\`
${params.code.slice(0, 3000)}
\`\`\`

SYMBOLS: ${params.symbols.slice(0, 20).join(', ')}
IMPORTS: ${params.imports.slice(0, 10).join(', ')}

Provide a brief functional summary (2-3 sentences) covering:
1. What this file does
2. Key functions/components  
3. How it connects to other parts

Keep it concise and technical.`;
}
