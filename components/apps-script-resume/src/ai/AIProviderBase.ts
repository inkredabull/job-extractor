/**
 * AI Provider Base - Abstract base class for AI providers
 *
 * @module ai/AIProviderBase
 */

import { Logger } from '../utils/Logger';

/**
 * Base class for AI providers
 */
export abstract class AIProviderBase {
  protected apiKey: string;
  protected model: string;
  protected name: string;

  /**
   * Create an AI provider
   * @param apiKey - API key
   * @param model - Model name
   * @param name - Provider name
   */
  constructor(apiKey: string, model: string, name: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.name = name;
  }

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
  abstract generatePayload(
    prompt: string,
    maxTokens: number,
    modelName?: string
  ): Record<string, unknown>;

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
  query(prompt: string, maxTokens: number = 1000): string {
    try {
      const payload = this.generatePayload(prompt, maxTokens);
      const headers = this.generateAuthHeader();
      const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'post',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        contentType: 'application/json',
      };

      const url = this.getEndpoint();
      const response = UrlFetchApp.fetch(url, options);

      if (response.getResponseCode() === 200) {
        const result = this.parseResponse(response);
        Logger.log(`AI response length: ${result.length}`);
        return result;
      } else {
        const errorText = response.getContentText();
        Logger.error(`AI query failed: ${errorText}`);
        throw new Error(errorText);
      }
    } catch (error) {
      Logger.error(`AI query failed: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
}
