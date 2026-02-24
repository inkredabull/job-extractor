/**
 * Variant Service - Calls Claude API to generate reworded message variants
 *
 * @module business/VariantService
 */

import { CLAUDE_MODEL } from '../config';

/**
 * Response shape from the Anthropic Messages API
 */
interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  error?: { message: string };
}

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
export class VariantService {
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
  private readonly anthropicVersion = '2023-06-01';

  /**
   * Retrieves the Anthropic API key from Script Properties
   * @throws Error if the key is not configured
   */
  private getApiKey(): string {
    const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY not found in Script Properties. ' +
          'Go to Project Settings → Script Properties and add it.'
      );
    }
    return key;
  }

  /**
   * Calls the Anthropic API with a prompt and returns the text response
   */
  private callClaude(prompt: string): string {
    const apiKey = this.getApiKey();

    const payload = {
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    };

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.anthropicVersion,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(this.apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Claude API error ${responseCode}: ${responseText}`);
    }

    const parsed = JSON.parse(responseText) as AnthropicResponse;

    if (parsed.error) {
      throw new Error(`Claude API error: ${parsed.error.message}`);
    }

    const firstContent = parsed.content[0];
    if (!firstContent || firstContent.type !== 'text') {
      throw new Error('Unexpected response format from Claude API');
    }

    return firstContent.text.trim();
  }

  /**
   * Generates two reworded variants of a personalized LinkedIn message.
   * Preserves the tone, personal details, and intent of the original.
   *
   * @param originalMessage - The exact message sent with the initial connection request
   * @param contactName - Name of the contact (for context)
   * @returns Two variant messages ready to paste into LinkedIn
   */
  generateVariants(originalMessage: string, contactName: string): MessageVariants {
    const prompt = `You are helping reword a personalized LinkedIn outreach message for a follow-up connection attempt.

The original message sent to ${contactName} was:
"${originalMessage}"

Generate exactly TWO alternative versions of this message. Each version should:
- Preserve all specific personal details, names, and context from the original
- Keep the same casual, human tone
- Be slightly different in phrasing/structure (not just synonym swaps)
- Be appropriate length for a LinkedIn connection note (under 300 characters preferred)
- Feel genuine, not templated

Return ONLY the two messages in this exact format with no other text:
VARIANT_1: [first reworded message]
VARIANT_2: [second reworded message]`;

    const raw = this.callClaude(prompt);

    const v1Match = raw.match(/VARIANT_1:\s*(.+?)(?=VARIANT_2:|$)/s);
    const v2Match = raw.match(/VARIANT_2:\s*(.+?)$/s);

    const variant1 = v1Match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? originalMessage;
    const variant2 = v2Match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? originalMessage;

    return { variant1, variant2 };
  }
}
