/**
 * AI Provider Base - Abstract base class for AI providers
 *
 * @module ai/AIProviderBase
 */
/**
 * Base class for AI providers
 */
export declare abstract class AIProviderBase {
    protected apiKey: string;
    protected model: string;
    protected name: string;
    /**
     * Create an AI provider
     * @param apiKey - API key
     * @param model - Model name
     * @param name - Provider name
     */
    constructor(apiKey: string, model: string, name: string);
    /**
     * Generate API endpoint URL
     * @returns Endpoint URL
     */
    abstract getEndpoint(): string;
    /**
     * Generate request payload
     * @param prompt - Prompt text
     * @param maxTokens - Maximum output tokens
     * @param modelName - Optional model name
     * @returns Request payload
     */
    abstract generatePayload(prompt: string, maxTokens: number, modelName?: string): Record<string, unknown>;
    /**
     * Generate authentication headers
     * @returns Headers object
     */
    abstract generateAuthHeader(): Record<string, string>;
    /**
     * Parse API response
     * @param response - HTTP response
     * @returns Extracted text
     */
    abstract parseResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): string;
    /**
     * Query the AI provider
     * @param prompt - Prompt text
     * @param maxTokens - Maximum output tokens
     * @returns AI response
     */
    query(prompt: string, maxTokens?: number): string;
}
//# sourceMappingURL=AIProviderBase.d.ts.map