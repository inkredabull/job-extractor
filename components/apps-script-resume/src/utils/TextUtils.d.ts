/**
 * Text utility class
 *
 * @module utils/TextUtils
 */
export declare class TextUtils {
    /**
     * Generate unique hash for text
     * @param text - Text to hash
     * @param length - Length of hash (default: 6)
     * @returns Hex hash
     */
    static generateHash(text: string, length?: number): string;
    /**
     * Truncate text to maximum length
     * @param text - Text to truncate
     * @param maxLength - Maximum length
     * @returns Truncated text
     */
    static truncate(text: string, maxLength: number): string;
    /**
     * Escape markdown characters
     * @param text - Text to escape
     * @returns Escaped text
     */
    static escapeMarkdown(text: string): string;
    /**
     * Convert basic Markdown to HTML
     * @param markdown - Markdown text
     * @returns HTML text
     */
    static convertMarkdownToHtml(markdown: string): string;
    /**
     * Replace size placeholders in text
     * @param text - Text with placeholders
     * @param targetAudience - Target audience ('cv' or 'linkedin')
     * @returns Text with replaced values
     */
    static replaceSizePlaceholders(text: string, targetAudience?: string): string;
    /**
     * Extract first word (verb) from text
     * @param input - Input text
     * @returns First word
     */
    static extractVerb(input: string): string;
}
//# sourceMappingURL=TextUtils.d.ts.map