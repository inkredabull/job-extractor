/**
 * Resume Formatter - Formats resumes as Google Docs
 *
 * @module business/ResumeFormatter
 */
import { DocumentService } from '../document/DocumentService';
import { SheetService } from '../data/SheetService';
/**
 * Service for formatting resumes as Google Docs
 */
export declare class ResumeFormatter {
    private documentService;
    private sheetService;
    /**
     * Create a ResumeFormatter
     * @param documentService - Document service
     * @param sheetService - Sheet service
     */
    constructor(documentService: DocumentService, sheetService: SheetService);
    /**
     * Generate a formatted resume document
     * @returns URL of generated document
     */
    generateResume(): string;
    /**
     * Add header section
     * @param body - Document body
     * @private
     */
    private _addHeader;
    /**
     * Add summary section
     * @param body - Document body
     * @private
     */
    private _addSummary;
    /**
     * Add key accomplishments section
     * @param body - Document body
     * @private
     */
    private _addKeyAccomplishments;
    /**
     * Add strengths section
     * @param body - Document body
     * @private
     */
    private _addStrengths;
    /**
     * Add experience section
     * @param body - Document body
     * @param headers - Column headers
     * @param rows - Data rows
     * @param companyData - Company metadata
     * @private
     */
    private _addExperience;
    /**
     * Add company section
     * @param body - Document body
     * @param company - Company name
     * @param achievements - Achievements list
     * @param metadata - Company metadata
     * @private
     */
    private _addCompanySection;
    /**
     * Add education section
     * @param body - Document body
     * @private
     */
    private _addEducation;
}
//# sourceMappingURL=ResumeFormatter.d.ts.map