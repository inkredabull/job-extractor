import Anthropic from '@anthropic-ai/sdk';
import { ResumeResult } from '../types';

export abstract class ClaudeBaseAgent {
  protected anthropic: Anthropic;
  protected model: string;
  protected maxTokens: number;

  constructor(claudeApiKey: string, model: string = 'claude-3-7-sonnet-20250219', maxTokens: number = 4000) {
    this.anthropic = new Anthropic({
      apiKey: claudeApiKey,
    });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  protected async makeClaudeRequest(prompt: string): Promise<string> {
    try {
      const startTime = Date.now();
      console.log(`🤖 Sending request to Claude (${this.model})...`);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      console.log(`✅ Response received in ${duration}s (${inputTokens} input tokens, ${outputTokens} output tokens)`);

      // Extract text content from the response
      const textContent = response.content.find(block => block.type === 'text');
      return textContent?.text || '';
    } catch (error) {
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  abstract createResume(jobId: string, cvFilePath: string, outputPath?: string, regenerate?: boolean, generate?: boolean | string, critique?: boolean, source?: 'cli' | 'programmatic'): Promise<ResumeResult>;
}
