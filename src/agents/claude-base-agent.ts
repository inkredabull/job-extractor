import Anthropic from '@anthropic-ai/sdk';
import { ResumeResult } from '../types';

export abstract class ClaudeBaseAgent {
  protected anthropic: Anthropic;
  protected model: string;
  protected maxTokens: number;

  constructor(claudeApiKey: string, model: string = 'claude-3-5-sonnet-20241022', maxTokens: number = 4000) {
    this.anthropic = new Anthropic({
      apiKey: claudeApiKey,
    });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  protected async makeClaudeRequest(prompt: string): Promise<string> {
    try {
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

      // Extract text content from the response
      const textContent = response.content.find(block => block.type === 'text');
      return textContent?.text || '';
    } catch (error) {
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  abstract createResume(jobId: string, cvFilePath: string, outputPath?: string): Promise<ResumeResult>;
}