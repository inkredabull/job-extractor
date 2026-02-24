/**
 * Work History Exporter - Exports work history to Google Docs
 *
 * @module business/WorkHistoryExporter
 */
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
export declare class WorkHistoryExporter {
    private documentService;
    private sheetService;
    private evaluationService;
    /**
     * Create a WorkHistoryExporter
     * @param documentService - Document service
     * @param sheetService - Sheet service
     * @param evaluationService - Evaluation service
     */
    constructor(documentService: DocumentService, sheetService: SheetService, evaluationService: EvaluationService);
    /**
     * Export work history as Google Doc
     * @returns URL of created document
     */
    exportWorkHistory(): string;
    /**
     * Group data by company
     * @param headers - Column headers
     * @param rows - Data rows
     * @returns Grouped data
     * @private
     */
    private _groupByCompany;
}
//# sourceMappingURL=WorkHistoryExporter.d.ts.map