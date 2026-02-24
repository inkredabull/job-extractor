/**
 * Variant Service - Calls Claude API to generate reworded message variants
 *
 * @module business/VariantService
 */
/**
 * Two generated message variants
 */
export interface MessageVariants {
    variant1: string;
    variant2: string;
}
/**
 * Generates Claude-powered message variants for a personalized outreach message
 */
export declare class VariantService {
    private readonly apiUrl;
    private readonly anthropicVersion;
    /**
     * Retrieves the Anthropic API key from Script Properties
     * @throws Error if the key is not configured
     */
    private getApiKey;
    /**
     * Calls the Anthropic API with a prompt and returns the text response
     */
    private callClaude;
    /**
     * Generates two reworded variants of a personalized LinkedIn message.
     * Preserves the tone, personal details, and intent of the original.
     *
     * @param originalMessage - The exact message sent with the initial connection request
     * @param contactName - Name of the contact (for context)
     * @returns Two variant messages ready to paste into LinkedIn
     */
    generateVariants(originalMessage: string, contactName: string): MessageVariants;
}
//# sourceMappingURL=VariantService.d.ts.map