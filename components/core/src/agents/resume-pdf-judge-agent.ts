import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import type { PDFJudgeResult, PDFValidationGuidance } from '../types/index.js';

interface PDFMetadata {
  pageCount: number;
  textContent: string;
  metadata: any;
}

interface JudgeResponse {
  passes: boolean;
  violations: string[];
  suggestions: string[];
  confidence: number;
}

export class ResumePDFJudgeAgent {
  private client: Anthropic;
  private logsDir: string;

  constructor(logsDir: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey });
    this.logsDir = logsDir;
  }

  /**
   * Extract PDF metadata including page count and text content
   */
  async extractPDFMetadata(pdfPath: string): Promise<PDFMetadata> {
    try {
      const parser = new PDFParse({ url: pdfPath });
      const result = await parser.getText();

      return {
        pageCount: result.pages.length,
        textContent: result.text,
        metadata: {}
      };
    } catch (error) {
      throw new Error(`Failed to extract PDF metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate PDF against guidance criteria using Claude
   */
  async validatePDF(
    pdfPath: string,
    guidance: PDFValidationGuidance,
    attemptNumber: number = 1,
    previousSuggestions?: string[]
  ): Promise<PDFJudgeResult> {
    const timestamp = new Date().toISOString();

    try {
      // Extract PDF metadata
      console.log('📄 Extracting PDF metadata...');
      const metadata = await this.extractPDFMetadata(pdfPath);

      // Build validation prompt
      const prompt = this.buildValidationPrompt(metadata, guidance, attemptNumber, previousSuggestions);

      // Call Claude for validation
      console.log('🤖 Running LLM judge validation...');
      const judgeResponse = await this.callClaude(prompt);

      // Build result
      const result: PDFJudgeResult = {
        success: true,
        passes: judgeResponse.passes,
        pageCount: metadata.pageCount,
        violations: judgeResponse.violations,
        suggestions: judgeResponse.suggestions,
        confidence: judgeResponse.confidence,
        timestamp
      };

      // Log result
      await this.logJudgeResult(result, attemptNumber);

      return result;
    } catch (error) {
      return {
        success: false,
        passes: false,
        pageCount: 0,
        violations: [],
        suggestions: [],
        confidence: 0,
        timestamp,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Build the validation prompt for Claude
   */
  private buildValidationPrompt(
    metadata: PDFMetadata,
    guidance: PDFValidationGuidance,
    attemptNumber: number,
    previousSuggestions?: string[]
  ): string {
    const { pageCount, textContent } = metadata;
    const { maxPages, requiredSections, forbidden } = guidance;

    let prompt = `You are a resume validator. Your job is to evaluate whether a resume PDF meets strict formatting requirements.

STRICT REQUIREMENTS:
- Must be exactly ${maxPages} page${maxPages === 1 ? '' : 's'} (no more, no less)`;

    if (requiredSections && requiredSections.length > 0) {
      prompt += `\n- Must include these sections: ${requiredSections.join(', ')}`;
    }

    if (forbidden && forbidden.length > 0) {
      prompt += `\n- Must NOT include: ${forbidden.join(', ')}`;
    }

    prompt += `

CURRENT PDF STATUS:
- Page count: ${pageCount}
- Attempt number: ${attemptNumber}`;

    if (previousSuggestions && previousSuggestions.length > 0) {
      prompt += `\n- Previous suggestions applied:\n${previousSuggestions.map(s => `  • ${s}`).join('\n')}`;
    }

    prompt += `

EXTRACTED TEXT CONTENT (first 3000 characters):
${textContent.substring(0, 3000)}

TASK:
1. Evaluate if the PDF meets ALL strict requirements
2. If violations exist, identify them specifically
3. Provide ACTIONABLE, SPECIFIC suggestions for condensation if the page count exceeds ${maxPages}

Your suggestions should be CONCRETE and TACTICAL:
- "Remove the 'Hobbies' section entirely"
- "Condense the third bullet under 'Software Engineer at Google' from 90 to 60 characters"
- "Reduce Experience section bullets from 4 to 3 per role"
- "Combine the last two roles under 'Early Career' into a single condensed entry"
${maxPages === 1 ? '\nIMPORTANT: Be aggressive in cutting content. It is better to have a tight one-page resume than overflow to two pages.' : '\nIMPORTANT: For two-page resumes, ensure RELEVANT EXPERIENCE fits on page 1 with header, summary, and skills. RELATED EXPERIENCE should start on page 2.'}

Return your evaluation as JSON:
{
  "passes": boolean,
  "violations": ["specific violation 1", "specific violation 2"],
  "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2"],
  "confidence": number (1-10, how confident you are in this assessment)
}`;

    return prompt;
  }

  /**
   * Call Claude API for validation
   */
  private async callClaude(prompt: string): Promise<JudgeResponse> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
    }

    const judgeResponse: JudgeResponse = JSON.parse(jsonMatch[0]);
    return judgeResponse;
  }

  /**
   * Log judge result to file
   */
  private async logJudgeResult(result: PDFJudgeResult, attemptNumber: number): Promise<void> {
    try {
      const filename = `judge-attempt-${attemptNumber}-${Date.now()}.json`;
      const filepath = path.join(this.logsDir, filename);
      await fs.writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`📝 Judge result saved: ${filename}`);
    } catch (error) {
      console.error('Failed to log judge result:', error);
    }
  }
}
