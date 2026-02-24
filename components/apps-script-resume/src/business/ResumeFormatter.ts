/**
 * Resume Formatter - Formats resumes as Google Docs
 *
 * @module business/ResumeFormatter
 */

import { CONFIG } from '../config';
import { DocumentService } from '../document/DocumentService';
import { SheetService, CompanyData } from '../data/SheetService';
import { CustomizationService } from './CustomizationService';

/**
 * Service for formatting resumes as Google Docs
 */
export class ResumeFormatter {
  private documentService: DocumentService;
  private sheetService: SheetService;

  /**
   * Create a ResumeFormatter
   * @param documentService - Document service
   * @param sheetService - Sheet service
   */
  constructor(documentService: DocumentService, sheetService: SheetService) {
    this.documentService = documentService;
    this.sheetService = sheetService;
  }

  /**
   * Generate a formatted resume document
   * @returns URL of generated document
   */
  generateResume(): string {
    const companyData = this.sheetService.getCompanyData();
    const { headers, rows } = this.sheetService.getStoryBankData();

    // Create document from template
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm'
    );
    const documentName = `Resume for ${CONFIG.CONTACT.NAME} - ${timestamp}`;
    const doc = this.documentService.copyTemplate(CONFIG.DOCUMENT.RESUME_TEMPLATE_ID, documentName);
    const body = doc.getBody();

    // Build resume sections
    this._addHeader(body);
    this._addSummary(body);
    this._addKeyAccomplishments(body);
    this._addStrengths(body);
    this._addExperience(body, headers, rows, companyData);
    this._addEducation(body);

    doc.saveAndClose();
    return doc.getUrl();
  }

  /**
   * Add header section
   * @param body - Document body
   * @private
   */
  private _addHeader(body: GoogleAppsScript.Document.Body): void {
    const firstParagraph = body.getChild(0).asParagraph();
    firstParagraph.setText(CONFIG.CONTACT.NAME);
    firstParagraph.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    firstParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    firstParagraph.setAttributes({
      [DocumentApp.Attribute.SPACING_BEFORE]: 0,
      [DocumentApp.Attribute.SPACING_AFTER]: 4,
    });

    const contactInfo = `${CONFIG.CONTACT.LOCATION} | ${CONFIG.CONTACT.PHONE} | ${CONFIG.CONTACT.EMAIL} | ${CONFIG.CONTACT.LINKEDIN}`;
    this.documentService.appendParagraph(body, contactInfo, {
      fontSize: 10,
      alignment: 'CENTER',
    });

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add summary section
   * @param body - Document body
   * @private
   */
  private _addSummary(body: GoogleAppsScript.Document.Body): void {
    this.documentService.appendHeading(body, 'SUMMARY', 4);

    // Note: Passing null for aiService since we only need static summary
    const customizationService = new CustomizationService(null, this.sheetService);
    const summary = customizationService.getSummaryForResume();

    this.documentService.appendParagraph(body, summary, {
      alignment: 'LEFT',
      spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING,
      spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING,
    });

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add key accomplishments section
   * @param body - Document body
   * @private
   */
  private _addKeyAccomplishments(body: GoogleAppsScript.Document.Body): void {
    this.documentService.appendHeading(body, 'KEY ACCOMPLISHMENTS', 4);

    this.documentService.appendTable(
      body,
      [
        [
          `${CONFIG.KEY_ACCOMPLISHMENTS[0]}\n${CONFIG.KEY_ACCOMPLISHMENTS[1]}`,
          `${CONFIG.KEY_ACCOMPLISHMENTS[2]}\n${CONFIG.KEY_ACCOMPLISHMENTS[3]}`,
        ],
      ],
      { borderWidth: 0 }
    );

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add strengths section
   * @param body - Document body
   * @private
   */
  private _addStrengths(body: GoogleAppsScript.Document.Body): void {
    this.documentService.appendHeading(body, 'STRENGTHS', 4);

    CONFIG.STRENGTHS.forEach((strength) => {
      if (strength) {
        const listItem = this.documentService.appendListItem(body, strength);
        const colonIndex = strength.indexOf(':');
        if (colonIndex > -1) {
          listItem.editAsText().setBold(0, colonIndex - 1, true);
        }
      }
    });

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add experience section
   * @param body - Document body
   * @param headers - Column headers
   * @param rows - Data rows
   * @param companyData - Company metadata
   * @private
   */
  private _addExperience(
    body: GoogleAppsScript.Document.Body,
    headers: string[],
    rows: unknown[][],
    companyData: Record<string, CompanyData>
  ): void {
    this.documentService.appendHeading(body, 'EXPERIENCE', 4);

    const companyIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.COMPANY);
    const includeIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.INCLUDE);
    const achievementIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.SHORT);

    // Filter and group achievements by company
    const companyMap: Record<string, string[]> = {};
    rows.forEach((row) => {
      const toBeIncluded = row[includeIndex];
      if (toBeIncluded) {
        const company = row[companyIndex] as string;
        const achievement = row[achievementIndex] as string;
        if (!companyMap[company]) {
          companyMap[company] = [];
        }
        companyMap[company].push(achievement);
      }
    });

    // Add each company section
    for (const company in companyMap) {
      if (Object.prototype.hasOwnProperty.call(companyMap, company)) {
        const metadata = companyData[company];
        if (metadata) {
          this._addCompanySection(body, company, companyMap[company] || [], metadata);
        }
      }
    }

    this.documentService.appendParagraph(body, 'Complete work history available upon request', {
      fontSize: CONFIG.DOCUMENT.DEFAULT_FONT_SIZE - 1,
      italic: true,
      alignment: 'CENTER',
      spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING * 2,
      spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING * 2,
    });
  }

  /**
   * Add company section
   * @param body - Document body
   * @param company - Company name
   * @param achievements - Achievements list
   * @param metadata - Company metadata
   * @private
   */
  private _addCompanySection(
    body: GoogleAppsScript.Document.Body,
    company: string,
    achievements: string[],
    metadata: CompanyData
  ): void {
    const role = metadata.title;
    const duration = metadata.duration;
    const combo = `${role} @ ${company}`;

    const table = this.documentService.appendTable(body, [[combo, duration]], { borderWidth: 0 });
    const row = table.getRow(0);

    const companyCell = row.getCell(0);
    companyCell.setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
    companyCell.setPaddingTop(CONFIG.DOCUMENT.DEFAULT_PADDING * 2);
    const companyPara = companyCell.getChild(0).asParagraph();
    companyPara.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    const companyText = companyPara.editAsText();
    companyText.setBold(true);
    companyText.setFontSize(12);

    const datesCell = row.getCell(1);
    datesCell.setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
    datesCell.setPaddingTop(CONFIG.DOCUMENT.DEFAULT_PADDING * 2);
    const datesPara = datesCell.getChild(0).asParagraph();
    datesPara.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    const datesText = datesPara.editAsText();
    datesText.setBold(false);
    datesText.setFontSize(11);

    // Add domain and summary if available
    if (metadata.domain || metadata.summary) {
      const lastIndex = body.getNumChildren() - 1;
      const lastChild = body.getChild(lastIndex);
      if (lastChild.getType() === DocumentApp.ElementType.PARAGRAPH) {
        const paragraph = lastChild.asParagraph();
        if (paragraph.getText().trim() === '' && metadata.summary) {
          paragraph.setText(metadata.domain || '');
          paragraph.setAttributes({
            [DocumentApp.Attribute.SPACING_BEFORE]: CONFIG.DOCUMENT.DEFAULT_PADDING,
            [DocumentApp.Attribute.SPACING_AFTER]: CONFIG.DOCUMENT.DEFAULT_PADDING,
          });
          const paraText = paragraph.editAsText();
          paraText.setItalic(true);
          paraText.setFontSize(CONFIG.DOCUMENT.DEFAULT_FONT_SIZE);

          this.documentService.appendParagraph(body, metadata.summary, {
            italic: false,
            spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING,
            spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING,
          });
        }
      }
    }

    // Add achievements
    achievements.forEach((achievement) => {
      if (achievement) {
        this.documentService.appendListItem(body, achievement);
      }
    });

    // Add tech stack if configured
    if (CONFIG.DOCUMENT.INCLUDE_TECH_STACK && metadata.stack) {
      this.documentService.appendParagraph(body, metadata.stack, {
        fontSize: CONFIG.DOCUMENT.DEFAULT_FONT_SIZE - 1,
        spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING * 2,
        spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING,
      });
    }
  }

  /**
   * Add education section
   * @param body - Document body
   * @private
   */
  private _addEducation(body: GoogleAppsScript.Document.Body): void {
    this.documentService.appendHeading(body, 'EDUCATION', 4);

    CONFIG.EDUCATION.forEach((edu) => {
      this.documentService.appendParagraph(body, edu.degree, {
        bold: true,
        fontSize: 12,
        alignment: 'LEFT',
        spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING,
        spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING,
      });

      edu.details.forEach((detail) => {
        this.documentService.appendListItem(body, detail);
      });
    });
  }
}
