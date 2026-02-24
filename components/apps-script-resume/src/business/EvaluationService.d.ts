/**
 * Evaluation Service - Evaluates achievement quality and relevance
 *
 * @module business/EvaluationService
 */
import { AIService } from '../ai/AIService';
/**
 * Service for evaluating achievements
 */
export declare class EvaluationService {
    private aiService;
    /**
     * Create an EvaluationService
     * @param aiService - AI service instance
     */
    constructor(aiService: AIService);
    /**
     * Evaluate if achievement meets quality criteria
     * @param achievement - Achievement to evaluate
     * @returns Evaluation result (TRUE/FALSE)
     */
    evaluateAchievement(achievement: string): string;
    /**
     * Check if achievement is impactful
     * @param achievement - Achievement to check
     * @returns True if impactful
     */
    isImpactful(achievement: string): boolean;
    /**
     * Get judgement score for achievement
     * @param achievement - Achievement to judge
     * @returns Judgement score
     */
    getJudgement(achievement: string): string;
    /**
     * Check if achievement is relevant to job description
     * @param achievement - Achievement to check
     * @param jobDescription - Job description
     * @returns Relevance score
     */
    isRelevant(achievement: string, jobDescription: string): string;
    /**
     * Check if sequence meets threshold criteria
     * @param sequence - Sequence number
     * @returns True if meets criteria
     */
    meetsSequenceCriteria(sequence: number | string): boolean;
    /**
     * Determine if achievement should be included
     * @param wowFactor - Wow factor score
     * @param sequence - Sequence number
     * @param meetsAdditionalCriteria - Additional criteria flag
     * @returns True if should include
     */
    shouldInclude(wowFactor: number, sequence: number | string, meetsAdditionalCriteria?: boolean): boolean;
}
//# sourceMappingURL=EvaluationService.d.ts.map