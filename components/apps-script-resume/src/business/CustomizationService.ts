/**
 * Customization Service - Customizes resumes for job descriptions
 *
 * @module business/CustomizationService
 */

import { CONFIG } from '../config';
import { AIService } from '../ai/AIService';
import { SheetService } from '../data/SheetService';

/**
 * Service for customizing resumes
 */
export class CustomizationService {
  private aiService: AIService | null;
  private sheetService: SheetService;

  /**
   * Create a CustomizationService
   * @param aiService - AI service instance (null if only using static methods)
   * @param sheetService - Sheet service instance
   */
  constructor(aiService: AIService | null, sheetService: SheetService) {
    this.aiService = aiService;
    this.sheetService = sheetService;
  }

  /**
   * Customize resume for job description
   * @returns Customized resume in Markdown
   */
  customizeResume(): string {
    if (!this.aiService) {
      throw new Error('AIService is required for customizeResume()');
    }

    const resume = this._getResume();
    const jobDescription = this._getJobDescription();
    const basis = this._getCustomizationBasis();

    const prompt = `${basis}

JOB DESCRIPTION: ${jobDescription}

RESUME: ${resume}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.RESUME,
      provider: 'claude',
    });
  }

  /**
   * Get resume text from sheet
   * @returns Resume text
   * @private
   */
  private _getResume(): string {
    const data = this.sheetService.getSheetData(CONFIG.SHEETS.CUSTOMIZER);
    return (data[1]?.[CONFIG.COLUMNS.CUSTOMIZER.RESUME] as string) || '';
  }

  /**
   * Get job description from sheet
   * @returns Job description
   * @private
   */
  private _getJobDescription(): string {
    const data = this.sheetService.getSheetData(CONFIG.SHEETS.CUSTOMIZER);
    return (data[1]?.[CONFIG.COLUMNS.CUSTOMIZER.JOB_DESCRIPTION] as string) || '';
  }

  /**
   * Build customization basis prompt
   * @returns Customization instructions
   * @private
   */
  private _getCustomizationBasis(): string {
    const bullets =
      'Each bullet point should be no more than 86 characters and begin with an asterisk.';
    const roles = 'Include only the most recent three roles.';
    const format = 'Return output as Markdown in the format of a reverse chronological resume.';

    return `Take the following RESUME and modify it to fit the needs of the following JOB DESCRIPTION.

Include 4-5 bullet points for the most recent job, 3-4 for the next job, and 2-3 for each job after that. ${bullets}

${roles} Always include dates for roles on the same line as title and company name.

Stipulate "Complete work history available upon request." in italics.

Include a "SKILLS" section with a bulleted overview of relevant skills.

For each role, include a summary overview of no more than two sentences.

Do not include a cover letter.

If an achievement in RESUME includes the name of the company for the JOB DESCRIPTION, be sure to include that explicit reference in the adapted version.

Include and begin with a professional summary.
${format}`;
  }

  /**
   * Get summary for resume
   * @returns Summary text
   */
  getSummaryForResume(): string {
    // Default summary - could be enhanced to be dynamic
    const asENGLeader = [
      "Hands-on technical leader who's scaled SaaS and data-driven products as well as global teams of up to 50 over 13+ years.",
      'Solid track record of ownership with a bias-to-action, especially around unblocking teams in support of execution.',
      'Proven ability to harness AI/ML to sharpen operations and accelerate time-to-market.',
      'Skilled at driving operational excellence, streamlining cross-functional communication, and consistently delivering high-impact products.',
      'Known for a servant-leadership that fosters mentorship, innovation, and cross-functional collaboration.',
    ];

    return asENGLeader.join(' ');
  }
}
