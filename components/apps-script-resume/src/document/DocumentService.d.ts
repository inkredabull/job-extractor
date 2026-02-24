/**
 * Document Service - Handles Google Docs operations
 *
 * @module document/DocumentService
 */
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
export declare class DocumentService {
    private defaultPadding;
    private defaultFontSize;
    constructor();
    /**
     * Create a new Google Doc
     * @param title - Document title
     * @returns Document object
     */
    createDocument(title: string): GoogleAppsScript.Document.Document;
    /**
     * Open existing document by ID
     * @param docId - Document ID
     * @returns Document object
     */
    openDocument(docId: string): GoogleAppsScript.Document.Document;
    /**
     * Copy template document
     * @param templateId - Template document ID
     * @param newName - New document name
     * @returns Copied document
     */
    copyTemplate(templateId: string, newName: string): GoogleAppsScript.Document.Document;
    /**
     * Append heading to body
     * @param body - Document body
     * @param text - Heading text
     * @param level - Heading level (1-4)
     * @param alignment - Text alignment
     */
    appendHeading(body: GoogleAppsScript.Document.Body, text: string, level?: number, alignment?: string): GoogleAppsScript.Document.Paragraph;
    /**
     * Append paragraph to body
     * @param body - Document body
     * @param text - Paragraph text
     * @param options - Style options
     * @returns Paragraph element
     */
    appendParagraph(body: GoogleAppsScript.Document.Body, text: string, options?: ParagraphOptions): GoogleAppsScript.Document.Paragraph;
    /**
     * Append list item to body
     * @param body - Document body
     * @param text - List item text
     * @param glyphType - Glyph type (BULLET, NUMBER, etc.)
     * @returns List item element
     */
    appendListItem(body: GoogleAppsScript.Document.Body, text: string, glyphType?: string): GoogleAppsScript.Document.ListItem;
    /**
     * Append table to body
     * @param body - Document body
     * @param data - Table data
     * @param options - Table options
     * @returns Table element
     */
    appendTable(body: GoogleAppsScript.Document.Body, data: unknown[][], options?: TableOptions): GoogleAppsScript.Document.Table;
    /**
     * Append horizontal rule
     * @param body - Document body
     * @returns Rule element
     */
    appendHorizontalRule(body: GoogleAppsScript.Document.Body): GoogleAppsScript.Document.HorizontalRule;
}
//# sourceMappingURL=DocumentService.d.ts.map