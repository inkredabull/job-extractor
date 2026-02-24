/**
 * Sheet Service - Handles all spreadsheet data access operations
 *
 * @module data/SheetService
 */

import { CONFIG } from '../config';

/**
 * Company data structure
 */
export interface CompanyData {
  sequence: string;
  title: string;
  duration: string;
  summary: string;
  stack: string;
  domain: string;
}

/**
 * Story bank data structure
 */
export interface StoryBankDataResult {
  headers: string[];
  rows: unknown[][];
}

/**
 * Active row data structure
 */
export interface ActiveRowDataResult {
  rowIndex: number;
  row: unknown[];
  headers: string[];
}

/**
 * Sort column specification
 */
export interface SortColumnSpec {
  column: number;
  ascending: boolean;
}

/**
 * Service for interacting with Google Sheets
 */
export class SheetService {
  private spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

  /**
   * Create a new SheetService
   * @param spreadsheet - Optional spreadsheet object
   */
  constructor(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null) {
    this.spreadsheet = spreadsheet || SpreadsheetApp.getActive();
  }

  /**
   * Get a sheet by name
   * @param sheetName - Name of the sheet
   * @returns Sheet object
   * @throws Error if sheet doesn't exist
   */
  getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    return sheet;
  }

  /**
   * Ensure a sheet exists, create if not
   * @param sheetName - Name of the sheet
   * @returns Sheet object
   */
  ensureSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
    let sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet(sheetName);
    }
    return sheet;
  }

  /**
   * Get all data from a sheet
   * @param sheetName - Name of the sheet
   * @returns 2D array of values
   */
  getSheetData(sheetName: string): unknown[][] {
    const sheet = this.getSheet(sheetName);
    return sheet.getDataRange().getValues();
  }

  /**
   * Get headers from a sheet
   * @param sheetName - Name of the sheet
   * @returns Array of header names
   */
  getHeaders(sheetName: string): string[] {
    const data = this.getSheetData(sheetName);
    return data.length > 0 ? (data[0] as string[]) : [];
  }

  /**
   * Get cell value
   * @param sheetName - Name of the sheet
   * @param row - Row number (1-indexed)
   * @param col - Column number (1-indexed)
   * @returns Cell value
   */
  getCellValue(sheetName: string, row: number, col: number): unknown {
    const sheet = this.getSheet(sheetName);
    return sheet.getRange(row, col).getValue();
  }

  /**
   * Set cell value
   * @param sheetName - Name of the sheet
   * @param row - Row number (1-indexed)
   * @param col - Column number (1-indexed)
   * @param value - Value to set
   */
  setCellValue(sheetName: string, row: number, col: number, value: unknown): void {
    const sheet = this.getSheet(sheetName);
    sheet.getRange(row, col).setValue(value);
  }

  /**
   * Sort a sheet by columns
   * @param sheetName - Name of the sheet
   * @param sortColumns - Array of {column: number, ascending: boolean}
   */
  sortSheet(sheetName: string, sortColumns: SortColumnSpec[]): void {
    const sheet = this.getSheet(sheetName);
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    dataRange.sort(sortColumns);
  }

  /**
   * Get Story Bank data with headers
   * @returns Object with headers array and rows array
   */
  getStoryBankData(): StoryBankDataResult {
    const data = this.getSheetData(CONFIG.SHEETS.STORY_BANK);
    const headers = data.shift() as string[];
    return { headers, rows: data };
  }

  /**
   * Get Company data as object
   * @returns Company data keyed by company name
   */
  getCompanyData(): Record<string, CompanyData> {
    const sheet = this.getSheet(CONFIG.SHEETS.COMPANIES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] as string[];

    const companyIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.COMPANY);
    const sequenceIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.SEQUENCE);
    const titleIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.TITLE);
    const durationIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.DURATION);
    const summaryIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.SUMMARY);
    const stackIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.STACK);
    const domainIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.DOMAIN);

    const companyData: Record<string, CompanyData> = {};

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const company = row[companyIndex] as string;

      if (company) {
        companyData[company] = {
          sequence: (row[sequenceIndex] as string) || '',
          title: (row[titleIndex] as string) || '',
          duration: (row[durationIndex] as string) || '',
          summary: (row[summaryIndex] as string) || '',
          stack: (row[stackIndex] as string) || '',
          domain: (row[domainIndex] as string) || '',
        };
      }
    }

    return companyData;
  }

  /**
   * Get active cell
   * @returns Active cell range
   */
  getActiveCell(): GoogleAppsScript.Spreadsheet.Range {
    return this.spreadsheet.getActiveSheet().getActiveCell();
  }

  /**
   * Get active row data
   * @param sheetName - Name of the sheet
   * @returns Object with rowIndex, row array, and headers array
   */
  getActiveRowData(sheetName: string): ActiveRowDataResult {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift() as string[];

    const currentCell = sheet.getActiveCell();
    const rowIndex = currentCell.getRow();
    const rowAsRange = sheet.getRange(`${rowIndex}:${rowIndex}`);
    const row = rowAsRange.getValues()[0] || [];

    return { rowIndex, row, headers };
  }
}
