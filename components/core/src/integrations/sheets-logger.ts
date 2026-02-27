/**
 * Integration layer to log job activities to Google Sheets
 */

import { GoogleSheetsClient, extractSpreadsheetId, formatDate, JobRow } from '../utils/google-sheets';
import { JobScore, JobListing } from '../types';

export interface SheetsLoggerConfig {
  spreadsheetUrl: string;
  sheetName: string;
  enabled?: boolean;
}

export class SheetsLogger {
  private client: GoogleSheetsClient;
  private spreadsheetId: string;
  private sheetName: string;
  private enabled: boolean;

  constructor(config: SheetsLoggerConfig) {
    this.client = new GoogleSheetsClient();
    this.spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);
    this.sheetName = config.sheetName;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Log a job analysis to Google Sheets
   */
  async logJobAnalysis(
    jobId: string,
    jobListing: JobListing,
    score: JobScore,
    jobUrl: string,
    options?: {
      resumeUrl?: string;
      origin?: string;
      threshold?: number;
    }
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const threshold = options?.threshold ?? 75;
      const meetsThreshold = score.overallScore >= threshold;

      const jobData: JobRow = {
        id: jobId,
        role: jobListing.title,
        company: jobListing.company,
        status: 'Analyzed',
        applied: '', // Will be filled when actually applied
        updated: formatDate(),
        notes: `Score: ${score.overallScore}% - ${meetsThreshold ? '✅ Meets threshold' : '❌ Below threshold'}`,
        origin: options?.origin || 'CLI',
        score: `${score.overallScore}%`,
        threshold: meetsThreshold ? 'Yes' : 'No',
        analysis: this.formatAnalysis(score),
        jobUrl: jobUrl,
        resumeUrl: options?.resumeUrl || '',
        jobTitleShorthand: this.generateShorthand(jobListing.title)
      };

      // Insert at top (most recent first)
      await this.client.insertRowAtTop(this.spreadsheetId, this.sheetName, jobData);

      console.log(`📊 Job logged to Google Sheets: ${jobId}`);

    } catch (error) {
      console.error('⚠️ Failed to log to Google Sheets:', error);
      // Don't throw - logging is optional, shouldn't break the main flow
    }
  }

  /**
   * Update job status when application is submitted
   */
  async markAsApplied(
    jobId: string,
    resumeUrl?: string
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.updateRowById(
        this.spreadsheetId,
        this.sheetName,
        jobId,
        {
          status: 'Applied',
          applied: formatDate(),
          updated: formatDate(),
          resumeUrl: resumeUrl || undefined
        }
      );

      console.log(`📊 Job marked as applied: ${jobId}`);

    } catch (error) {
      console.error('⚠️ Failed to update Google Sheets:', error);
    }
  }

  /**
   * Update job status when rejected
   */
  async markAsRejected(
    jobId: string,
    rationale?: string
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.updateRowById(
        this.spreadsheetId,
        this.sheetName,
        jobId,
        {
          status: 'Rejected',
          updated: formatDate(),
          rejectionRationale: rationale || ''
        }
      );

      console.log(`📊 Job marked as rejected: ${jobId}`);

    } catch (error) {
      console.error('⚠️ Failed to update Google Sheets:', error);
    }
  }

  /**
   * Update job status when interview scheduled
   */
  async markAsInterview(
    jobId: string,
    notes?: string
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.updateRowById(
        this.spreadsheetId,
        this.sheetName,
        jobId,
        {
          status: 'Interview',
          updated: formatDate(),
          notes: notes || 'Interview scheduled'
        }
      );

      console.log(`📊 Job marked as interview: ${jobId}`);

    } catch (error) {
      console.error('⚠️ Failed to update Google Sheets:', error);
    }
  }

  /**
   * Update "Who Got Hired" field
   */
  async recordWhoGotHired(
    jobId: string,
    name: string,
    linkedinUrl?: string
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const whoGotHired = linkedinUrl
        ? `${name} (${linkedinUrl})`
        : name;

      await this.client.updateRowById(
        this.spreadsheetId,
        this.sheetName,
        jobId,
        {
          whoGotHired: whoGotHired,
          updated: formatDate()
        }
      );

      console.log(`📊 Recorded who got hired: ${name} for ${jobId}`);

    } catch (error) {
      console.error('⚠️ Failed to update Google Sheets:', error);
    }
  }

  /**
   * Format the analysis text for the sheet
   */
  private formatAnalysis(score: JobScore): string {
    const lines = [
      `Overall: ${score.overallScore}%`,
      '',
      'Breakdown:',
      `• Skills (Required): ${score.breakdown.required_skills}%`,
      `• Skills (Preferred): ${score.breakdown.preferred_skills}%`,
      `• Experience: ${score.breakdown.experience_level}%`,
      `• Salary: ${score.breakdown.salary}%`,
      `• Location: ${score.breakdown.location}%`,
      `• Company: ${score.breakdown.company_match}%`,
      '',
      'Rationale:',
      score.rationale
    ];

    return lines.join('\n');
  }

  /**
   * Generate a shorthand version of the job title
   */
  private generateShorthand(title: string): string {
    // Extract meaningful words and create acronym
    const meaningfulWords = title
      .split(/\s+/)
      .filter(word =>
        !['and', 'or', 'the', 'a', 'an', 'of', 'in', 'at', 'for', 'to'].includes(word.toLowerCase())
      )
      .slice(0, 3); // Take first 3 meaningful words

    if (meaningfulWords.length === 0) {
      return title.substring(0, 10);
    }

    // Create acronym
    const acronym = meaningfulWords
      .map(word => word[0].toUpperCase())
      .join('');

    return acronym;
  }
}

/**
 * Create a configured SheetsLogger from environment variables
 */
export function createSheetsLogger(): SheetsLogger | null {
  const spreadsheetUrl = process.env.GOOGLE_SHEETS_URL;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';
  const enabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';

  if (!spreadsheetUrl) {
    return null;
  }

  return new SheetsLogger({
    spreadsheetUrl,
    sheetName,
    enabled
  });
}
