/**
 * Document Service - Handles Google Docs operations
 *
 * @module document/DocumentService
 */

import { CONFIG } from '../config';

/**
 * Paragraph styling options
 */
export interface ParagraphOptions {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  alignment?: string;
  spacingBefore?: number;
  spacingAfter?: number;
}

/**
 * Table options
 */
export interface TableOptions {
  borderWidth?: number;
}

/**
 * Service for document operations
 */
export class DocumentService {
  private defaultPadding: number;
  private defaultFontSize: number;

  constructor() {
    this.defaultPadding = CONFIG.DOCUMENT.DEFAULT_PADDING;
    this.defaultFontSize = CONFIG.DOCUMENT.DEFAULT_FONT_SIZE;
  }

  /**
   * Create a new Google Doc
   * @param title - Document title
   * @returns Document object
   */
  createDocument(title: string): GoogleAppsScript.Document.Document {
    return DocumentApp.create(title);
  }

  /**
   * Open existing document by ID
   * @param docId - Document ID
   * @returns Document object
   */
  openDocument(docId: string): GoogleAppsScript.Document.Document {
    return DocumentApp.openById(docId);
  }

  /**
   * Copy template document
   * @param templateId - Template document ID
   * @param newName - New document name
   * @returns Copied document
   */
  copyTemplate(templateId: string, newName: string): GoogleAppsScript.Document.Document {
    const template = DriveApp.getFileById(templateId);
    const newDocId = template.makeCopy(newName).getId();
    return DocumentApp.openById(newDocId);
  }

  /**
   * Append heading to body
   * @param body - Document body
   * @param text - Heading text
   * @param level - Heading level (1-4)
   * @param alignment - Text alignment
   */
  appendHeading(
    body: GoogleAppsScript.Document.Body,
    text: string,
    level: number = 1,
    alignment: string = 'CENTER'
  ): GoogleAppsScript.Document.Paragraph {
    const headings = [
      DocumentApp.ParagraphHeading.HEADING1,
      DocumentApp.ParagraphHeading.HEADING2,
      DocumentApp.ParagraphHeading.HEADING3,
      DocumentApp.ParagraphHeading.HEADING4,
    ];
    const headingType = headings[Math.min(level - 1, 3)] || DocumentApp.ParagraphHeading.HEADING1;

    const alignmentType =
      DocumentApp.HorizontalAlignment[alignment as keyof typeof DocumentApp.HorizontalAlignment];

    const para = body.appendParagraph(text);
    para.setHeading(headingType);
    para.setAlignment(alignmentType);
    return para;
  }

  /**
   * Append paragraph to body
   * @param body - Document body
   * @param text - Paragraph text
   * @param options - Style options
   * @returns Paragraph element
   */
  appendParagraph(
    body: GoogleAppsScript.Document.Body,
    text: string,
    options: ParagraphOptions = {}
  ): GoogleAppsScript.Document.Paragraph {
    const para = body.appendParagraph(text);

    const {
      fontSize = this.defaultFontSize,
      bold = false,
      italic = false,
      alignment = 'LEFT',
      spacingBefore = this.defaultPadding,
      spacingAfter = this.defaultPadding,
    } = options;

    const textElement = para.editAsText();
    textElement.setFontSize(fontSize);
    if (bold) textElement.setBold(bold);
    if (italic) textElement.setItalic(italic);
    para.setAlignment(
      DocumentApp.HorizontalAlignment[alignment as keyof typeof DocumentApp.HorizontalAlignment]
    );
    para.setAttributes({
      [DocumentApp.Attribute.SPACING_BEFORE]: spacingBefore,
      [DocumentApp.Attribute.SPACING_AFTER]: spacingAfter,
    });

    return para;
  }

  /**
   * Append list item to body
   * @param body - Document body
   * @param text - List item text
   * @param glyphType - Glyph type (BULLET, NUMBER, etc.)
   * @returns List item element
   */
  appendListItem(
    body: GoogleAppsScript.Document.Body,
    text: string,
    glyphType: string = 'BULLET'
  ): GoogleAppsScript.Document.ListItem {
    const item = body.appendListItem(text);
    item.editAsText().setFontSize(this.defaultFontSize);
    item.setGlyphType(DocumentApp.GlyphType[glyphType as keyof typeof DocumentApp.GlyphType]);
    return item;
  }

  /**
   * Append table to body
   * @param body - Document body
   * @param data - Table data
   * @param options - Table options
   * @returns Table element
   */
  appendTable(
    body: GoogleAppsScript.Document.Body,
    data: unknown[][],
    options: TableOptions = {}
  ): GoogleAppsScript.Document.Table {
    const table = body.appendTable(data as string[][]);
    const { borderWidth = 0 } = options;
    table.setBorderWidth(borderWidth);
    return table;
  }

  /**
   * Append horizontal rule
   * @param body - Document body
   * @returns Rule element
   */
  appendHorizontalRule(
    body: GoogleAppsScript.Document.Body
  ): GoogleAppsScript.Document.HorizontalRule {
    return body.appendHorizontalRule();
  }
}
