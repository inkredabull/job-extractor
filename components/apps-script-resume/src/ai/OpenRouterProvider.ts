/**
 * OpenRouter Provider - Unified AI model access via OpenRouter
 *
 * @module ai/OpenRouterProvider
 * @migration-status STUB - Needs implementation from Code-refactored.gs lines 1096-1228
 */

import { AIProviderBase } from './AIProviderBase';
import { CONFIG } from '../config';
import { Logger } from '../utils/Logger';

export class OpenRouterProvider extends AIProviderBase {
  // TODO: Migrate class implementation from Code-refactored.gs
  // This class handles:
  // - Making requests to OpenRouter API
  // - Model selection and switching
  // - Error handling and retries

  makeRequest(_prompt: string, _maxTokens: number): string {
    // Suppress unused parameter warnings (will be used when implemented)
    void CONFIG;
    void Logger;
    throw new Error('Not implemented - migrate from Code-refactored.gs');
  }

  // Add other methods as needed from original implementation
}
