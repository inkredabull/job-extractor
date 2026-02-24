/**
 * AI Provider Base Class - Abstract base for AI providers
 *
 * @module ai/AIProviderBase
 * @migration-status STUB - Needs implementation from Code-refactored.gs lines 1005-1095
 */

import { Logger } from '../utils/Logger';

export abstract class AIProviderBase {
  // TODO: Migrate class implementation from Code-refactored.gs
  // This is an abstract base class for AI providers

  abstract makeRequest(prompt: string, maxTokens: number): string;

  // Suppress unused import warning
  protected suppressWarnings(): void {
    void Logger;
  }

  // Add other methods as needed from original implementation
}
