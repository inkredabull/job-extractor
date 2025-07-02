import { AgentConfig, ExtractorResult } from '../types';
import OpenAI from 'openai';

export abstract class BaseAgent {
  protected openai: OpenAI;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  protected async makeOpenAIRequest(prompt: string, maxTokens?: number): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        max_tokens: maxTokens || this.config.maxTokens || 2000,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  abstract extract(url: string): Promise<ExtractorResult>;
}