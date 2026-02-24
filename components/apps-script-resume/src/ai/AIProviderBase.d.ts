/**
 * AI Provider Base Class - Abstract base for AI providers
 *
 * @module ai/AIProviderBase
 * @migration-status STUB - Needs implementation from Code-refactored.gs lines 1005-1095
 */
export declare abstract class AIProviderBase {
    abstract makeRequest(prompt: string, maxTokens: number): string;
    protected suppressWarnings(): void;
}
//# sourceMappingURL=AIProviderBase.d.ts.map