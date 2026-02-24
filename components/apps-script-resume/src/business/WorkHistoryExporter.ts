/**
 * Work History Exporter - Exports work history to Google Docs
 *
 * @module business/WorkHistoryExporter
 */

import { CONFIG } from '../config';
import { Logger } from '../utils/Logger';
import { DocumentService } from '../document/DocumentService';
import { SheetService } from '../data/SheetService';
import { EvaluationService } from './EvaluationService';

/**
 * Work history item structure
 */
export interface WorkHistoryItem {
  challenge: string;
  actions: string;
  result: string;
  short: string;
  uniqueID: string;
  timeFrame: string;
}

/**
 * Grouped company data structure
 */
export interface GroupedCompanyData {
  company: string;
  items: WorkHistoryItem[];
  isNewCompany: boolean;
}

/**
 * Service for exporting work history to Google Docs
 */
export class WorkHistoryExporter {
  private documentService: DocumentService;
  private sheetService: SheetService;
  private evaluationService: EvaluationService;

  /**
   * Create a WorkHistoryExporter
   * @param documentService - Document service
   * @param sheetService - Sheet service
   * @param evaluationService - Evaluation service
   */
  constructor(
    documentService: DocumentService,
    sheetService: SheetService,
    evaluationService: EvaluationService
  ) {
    this.documentService = documentService;
    this.sheetService = sheetService;
    this.evaluationService = evaluationService;
  }

  /**
   * Export work history as Google Doc
   * @returns URL of created document
   */
  exportWorkHistory(): string {
    const title = `Work History as G Doc : ${Date.now()}`;
    const doc = this.documentService.createDocument(title);
    const body = doc.getBody();

    const { headers, rows } = this.sheetService.getStoryBankData();
    const groupedData = this._groupByCompany(headers, rows);

    let countOfWritten = 0;

    groupedData.forEach((companyData, index) => {
      if (index === 0) {
        const divider = body.appendParagraph(`@ ${companyData.company.toUpperCase()}`);
        divider.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      } else {
        const divider = body.appendParagraph(`@ ${companyData.company.toUpperCase()}`);
        divider.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      }

      companyData.items.forEach((item) => {
        countOfWritten++;

        this.documentService.appendHeading(body, item.short, 2);
        this.documentService.appendHeading(body, `Timeframe: ${item.timeFrame}`, 3);
        this.documentService.appendHeading(body, 'CHALLENGE', 3);
        this.documentService.appendParagraph(body, item.challenge);
        this.documentService.appendHeading(body, 'ACTIONS', 3);
        this.documentService.appendParagraph(body, item.actions);
        this.documentService.appendHeading(body, 'RESULT', 3);
        this.documentService.appendParagraph(body, item.result);
        this.documentService.appendHeading(body, `ID : ${item.uniqueID}`, 3);

        body.appendPageBreak();
      });
    });

    doc.saveAndClose();
    Logger.log(`Written ${countOfWritten} items`);
    Logger.log(doc.getUrl());
    return doc.getUrl();
  }

  /**
   * Group data by company
   * @param headers - Column headers
   * @param rows - Data rows
   * @returns Grouped data
   * @private
   */
  private _groupByCompany(headers: string[], rows: unknown[][]): GroupedCompanyData[] {
    const companyIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.COMPANY);
    const sequenceIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.SEQUENCE);
    const wowIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.WOW);
    const domainIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.DOMAIN);
    const challengeIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CHALLENGE);
    const actionsIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACTIONS);
    const resultIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.RESULT);
    const shortIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.LONG);
    const idIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ID);
    const timingIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.TIMING);

    const companyMap = new Map<string, WorkHistoryItem[]>();

    rows.forEach((row) => {
      const sequence = row[sequenceIndex] as number | string;
      const wow = row[wowIndex] as number;
      const domain = row[domainIndex] as string;
      const isProgramManagement = domain === 'Program Management';

      if (this.evaluationService.shouldInclude(wow, sequence, isProgramManagement)) {
        const company = String(row[companyIndex] || '');

        if (!companyMap.has(company)) {
          companyMap.set(company, []);
        }

        companyMap.get(company)!.push({
          challenge: String(row[challengeIndex] || ''),
          actions: String(row[actionsIndex] || ''),
          result: String(row[resultIndex] || ''),
          short: String(row[shortIndex] || ''),
          uniqueID: String(row[idIndex] || ''),
          timeFrame: String(row[timingIndex] || ''),
        });
      }
    });

    // Convert to array format
    const result: GroupedCompanyData[] = [];
    let previousCompany: string | null = null;

    companyMap.forEach((items, company) => {
      result.push({
        company,
        items,
        isNewCompany: company !== previousCompany,
      });
      previousCompany = company;
    });

    return result;
  }
}
