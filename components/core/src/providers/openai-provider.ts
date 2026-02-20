import OpenAI from 'openai';
import { BaseLLMProvider, LLMProviderConfig, LLMRequest, LLMResponse, CostEstimate } from './llm-provider';

export class OpenAIProvider extends BaseLLMProvider {
  private openai: OpenAI;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.openai = new OpenAI({ apiKey: config.apiKey });
  }

  supportsPromptCaching(): boolean {
    return false; // OpenAI doesn't support explicit prompt caching
  }

  async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    // Concatenate cached content with prompt (no special caching)
    let fullPrompt = request.prompt;
    if (request.cachedContent) {
      fullPrompt = request.cachedContent + '\n\n' + request.prompt;
    }

    const messages: any[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: fullPrompt });

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens || 4000,
      temperature: this.config.temperature || 0.3
    });

    return {
      text: response.choices[0]?.message?.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        cachedTokens: 0 // OpenAI doesn't expose cache info
      }
    };
  }

  estimateCost(request: LLMRequest): CostEstimate {
    // Rough token count estimation
    const estimatedInputTokens = Math.ceil((request.prompt.length + (request.cachedContent?.length || 0)) / 4);
    const estimatedOutputTokens = this.config.maxTokens || 4000;

    // Pricing varies by model - use conservative estimates
    // GPT-4o: $2.50/MTok input, $10/MTok output
    // GPT-4o-mini: $0.15/MTok input, $0.60/MTok output
    // Unknown models: assume GPT-4o pricing
    let inputPricePerMTok = 2.50;
    let outputPricePerMTok = 10;

    if (this.config.model.includes('mini')) {
      inputPricePerMTok = 0.15;
      outputPricePerMTok = 0.60;
    } else if (this.config.model.startsWith('gpt-5')) {
      // Future GPT-5 models - estimate higher pricing
      inputPricePerMTok = 5;
      outputPricePerMTok = 20;
    }

    const inputCost = (estimatedInputTokens / 1_000_000) * inputPricePerMTok;
    const outputCost = (estimatedOutputTokens / 1_000_000) * outputPricePerMTok;

    return {
      inputCost,
      outputCost,
      cachingSavings: 0, // No caching support
      totalCost: inputCost + outputCost
    };
  }
}
