import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider, LLMProviderConfig, LLMRequest, LLMResponse, CostEstimate } from './llm-provider';

export class ClaudeProvider extends BaseLLMProvider {
  private anthropic: Anthropic;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.anthropic = new Anthropic({ apiKey: config.apiKey });
  }

  supportsPromptCaching(): boolean {
    return true;
  }

  async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    const content: Array<any> = [];

    // Use prompt caching for CV content if supported
    if (request.cachedContent && this.supportsPromptCaching()) {
      content.push({
        type: 'text',
        text: request.cachedContent,
        cache_control: { type: 'ephemeral' }
      });
    }

    content.push({ type: 'text', text: request.prompt });

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4000,
      messages: [{
        role: 'user',
        content: content.length === 1 ? request.prompt : content
      }]
    });

    const textContent = response.content.find(b => b.type === 'text');

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedTokens: (response.usage as any).cache_read_input_tokens || 0
    };

    return {
      text: textContent?.text || '',
      usage,
      cost: this.calculateActualCost(usage)
    };
  }

  calculateActualCost(usage: { inputTokens: number; outputTokens: number; cachedTokens?: number }): {
    inputCost: number;
    outputCost: number;
    cachingSavings: number;
    totalCost: number;
  } {
    // Claude Sonnet pricing: $3/MTok input, $15/MTok output
    // Claude Haiku pricing: $0.25/MTok input, $1.25/MTok output
    // Cache reads: 10% of input cost (90% savings)
    const inputPricePerMTok = this.config.model.includes('haiku') ? 0.25 : 3;
    const outputPricePerMTok = this.config.model.includes('haiku') ? 1.25 : 15;
    const cacheReadPricePerMTok = inputPricePerMTok * 0.1;

    const regularInputTokens = usage.inputTokens - (usage.cachedTokens || 0);
    const cachedInputTokens = usage.cachedTokens || 0;

    const regularInputCost = (regularInputTokens / 1_000_000) * inputPricePerMTok;
    const cachedInputCost = (cachedInputTokens / 1_000_000) * cacheReadPricePerMTok;
    const outputCost = (usage.outputTokens / 1_000_000) * outputPricePerMTok;

    // Calculate what we would have paid without caching
    const fullInputCost = (usage.inputTokens / 1_000_000) * inputPricePerMTok;
    const cachingSavings = fullInputCost - regularInputCost - cachedInputCost;

    return {
      inputCost: regularInputCost + cachedInputCost,
      outputCost,
      cachingSavings,
      totalCost: regularInputCost + cachedInputCost + outputCost
    };
  }

  estimateCost(request: LLMRequest): CostEstimate {
    // Rough token count estimation
    const estimatedInputTokens = Math.ceil((request.prompt.length + (request.cachedContent?.length || 0)) / 4);
    const estimatedOutputTokens = this.config.maxTokens || 4000;

    // Claude Sonnet pricing: $3/MTok input, $15/MTok output
    // Claude Haiku pricing: $0.25/MTok input, $1.25/MTok output
    // Assume Sonnet-like pricing for unknown models
    const inputPricePerMTok = this.config.model.includes('haiku') ? 0.25 : 3;
    const outputPricePerMTok = this.config.model.includes('haiku') ? 1.25 : 15;

    const inputCost = (estimatedInputTokens / 1_000_000) * inputPricePerMTok;
    const outputCost = (estimatedOutputTokens / 1_000_000) * outputPricePerMTok;

    // Caching reduces input cost by 90%
    const cachingSavings = request.cachedContent ? inputCost * 0.9 : 0;

    return {
      inputCost,
      outputCost,
      cachingSavings,
      totalCost: inputCost + outputCost - cachingSavings
    };
  }
}
