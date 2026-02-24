/**
 * OpenRouter Provider - Unified AI provider via OpenRouter API
 *
 * @module ai/OpenRouterProvider
 */
import { AIProviderBase } from './AIProviderBase';
/**
 * OpenRouter unified AI provider
 * Access to Claude, Gemini, OpenAI, Mistral, Cohere, and 200+ models through single API
 */
export declare class OpenRouterProvider extends AIProviderBase {
    /**
     * Create an OpenRouter provider
     * @param apiKey - OpenRouter API key
     */
    constructor(apiKey: string);
    /**
     * Get OpenRouter API endpoint
     * @returns Endpoint URL
     */
    getEndpoint(): string;
    /**
     * Generate OpenRouter request payload
     * @param prompt - Prompt text
     * @param maxTokens - Maximum output tokens
     * @param modelName - Model identifier (e.g., 'anthropic/claude-3.7-sonnet')
     * @returns Request payload
     */
    generatePayload(prompt: string, maxTokens: number, modelName?: string): Record<string, unknown>;
    /**
     * Generate OpenRouter authentication headers
     * @returns Headers object
     */
    generateAuthHeader(): Record<string, string>;
    /**
     * Parse OpenRouter response
     * @param response - HTTP response
     * @returns Extracted text
     */
    parseResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): string;
    /**
     * Query OpenRouter with specific model
     * @param prompt - Prompt text
     * @param maxTokens - Maximum output tokens
     * @param modelName - Model identifier
     * @returns AI response
     */
    queryWithModel(prompt: string, maxTokens: number, modelName: string): string;
}
//# sourceMappingURL=OpenRouterProvider.d.ts.map