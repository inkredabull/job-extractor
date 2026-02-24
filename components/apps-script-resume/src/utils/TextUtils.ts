/**
 * Text utility class
 *
 * @module utils/TextUtils
 */

import { CONFIG } from '../config';

export class TextUtils {
  /**
   * Generate unique hash for text
   * @param text - Text to hash
   * @param length - Length of hash (default: 6)
   * @returns Hex hash
   */
  static generateHash(text: string, length: number = 6): string {
    let hexstr = '';
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
    for (let i = 0; i < digest.length; i++) {
      const val = (digest[i]! + 256) % 256;
      hexstr += ('0' + val.toString(16)).slice(-2);
    }
    return hexstr.slice(0, length);
  }

  /**
   * Truncate text to maximum length
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @returns Truncated text
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Escape markdown characters
   * @param text - Text to escape
   * @returns Escaped text
   */
  static escapeMarkdown(text: string): string {
    return text
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  /**
   * Convert basic Markdown to HTML
   * @param markdown - Markdown text
   * @returns HTML text
   */
  static convertMarkdownToHtml(markdown: string): string {
    const html = markdown
      // Replace Markdown headings (#, ##, ###, etc.)
      .replace(/^(#{1,6})\s+(.*)/gm, (_match: string, hashes: string, title: string) => {
        const level = hashes.length;
        return `<h${level}>${title}</h${level}>`;
      })
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      // Italic *text*
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      // Convert newlines to <br>
      .replace(/\n/g, '<br>');

    return `<html><body>${html}</body></html>`;
  }

  /**
   * Replace size placeholders in text
   * @param text - Text with placeholders
   * @param targetAudience - Target audience ('cv' or 'linkedin')
   * @returns Text with replaced values
   */
  static replaceSizePlaceholders(text: string, targetAudience: string = 'linkedin'): string {
    const scaleFactor =
      targetAudience !== 'linkedin' ? CONFIG.AI.LONG_SCALE : CONFIG.AI.SHORT_SCALE;

    const minLength = Math.round(CONFIG.AI.TEAL_BULLET_POINT_MIN_LENGTH / scaleFactor);
    const maxLength = Math.round(CONFIG.AI.TEAL_BULLET_POINT_MAX_LENGTH / scaleFactor);

    return text
      .replace(/minOuputSizeInChars/g, String(minLength))
      .replace(/maxOuputSizeInChars/g, String(maxLength));
  }

  /**
   * Extract first word (verb) from text
   * @param input - Input text
   * @returns First word
   */
  static extractVerb(input: string): string {
    if (typeof input !== 'string') return '';
    const words = input.split(' ');
    return words.length > 0 ? words[0]! : '';
  }
}
