/**
 * Customization Service - Customizes resumes for job descriptions
 *
 * @module business/CustomizationService
 */
import { AIService } from '../ai/AIService';
import { SheetService } from '../data/SheetService';
/**
 * Service for customizing resumes
 */
export declare class CustomizationService {
    private aiService;
    private sheetService;
    /**
     * Create a CustomizationService
     * @param aiService - AI service instance (null if only using static methods)
     * @param sheetService - Sheet service instance
     */
    constructor(aiService: AIService | null, sheetService: SheetService);
    /**
     * Customize resume for job description
     * @returns Customized resume in Markdown
     */
    customizeResume(): string;
    /**
     * Get resume text from sheet
     * @returns Resume text
     * @private
     */
    private _getResume;
    /**
     * Get job description from sheet
     * @returns Job description
     * @private
     */
    private _getJobDescription;
    /**
     * Build customization basis prompt
     * @returns Customization instructions
     * @private
     */
    private _getCustomizationBasis;
    /**
     * Get summary for resume
     * @returns Summary text
     */
    getSummaryForResume(): string;
}
//# sourceMappingURL=CustomizationService.d.ts.map