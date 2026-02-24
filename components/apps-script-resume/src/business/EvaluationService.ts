/**
 * Evaluation Service - Evaluates achievement quality and relevance
 *
 * @module business/EvaluationService
 */

import { CONFIG } from '../config';
import { AIService } from '../ai/AIService';

/**
 * Service for evaluating achievements
 */
export class EvaluationService {
  private aiService: AIService;

  /**
   * Create an EvaluationService
   * @param aiService - AI service instance
   */
  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Evaluate if achievement meets quality criteria
   * @param achievement - Achievement to evaluate
   * @returns Evaluation result (TRUE/FALSE)
   */
  evaluateAchievement(achievement: string): string {
    const prompt = `${CONFIG.PROMPTS.IS_IMPACTFUL}

Achievement: ${achievement}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION,
      provider: 'claude',
    });
  }

  /**
   * Check if achievement is impactful
   * @param achievement - Achievement to check
   * @returns True if impactful
   */
  isImpactful(achievement: string): boolean {
    const result = this.evaluateAchievement(achievement);
    return result.toUpperCase().includes('TRUE');
  }

  /**
   * Get judgement score for achievement
   * @param achievement - Achievement to judge
   * @returns Judgement score
   */
  getJudgement(achievement: string): string {
    const prompt = `On a scale of 1 to 10, where 1 means 'Boring.' and 10 means 'Amazing!' - how impressed are you by the following achievement?

Only return the numeric digit value.

Achievement: ${achievement}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION,
      provider: 'openai',
    });
  }

  /**
   * Check if achievement is relevant to job description
   * @param achievement - Achievement to check
   * @param jobDescription - Job description
   * @returns Relevance score
   */
  isRelevant(achievement: string, jobDescription: string): string {
    const prompt = `Given the following job description:

${jobDescription}

Score the achievement:

'${achievement}'

... against the responsibilities defined in the job according to a 5-point Likert Scale of 'Not at all applicable' to 'Extremely applicable.'

Return only the score. If not applicable, return 'Not at all applicable')

${CONFIG.PROMPTS.MARKS}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION,
      provider: 'openai',
    });
  }

  /**
   * Check if sequence meets threshold criteria
   * @param sequence - Sequence number
   * @returns True if meets criteria
   */
  meetsSequenceCriteria(sequence: number | string): boolean {
    return (
      sequence !== null &&
      sequence !== undefined &&
      Number(sequence) <= CONFIG.THRESHOLDS.SEQUENCE_THRESHOLD
    );
  }

  /**
   * Determine if achievement should be included
   * @param wowFactor - Wow factor score
   * @param sequence - Sequence number
   * @param meetsAdditionalCriteria - Additional criteria flag
   * @returns True if should include
   */
  shouldInclude(
    wowFactor: number,
    sequence: number | string,
    meetsAdditionalCriteria: boolean = true
  ): boolean {
    return (
      this.meetsSequenceCriteria(sequence) &&
      (wowFactor === 10 ||
        (wowFactor >= CONFIG.THRESHOLDS.WOW_THRESHOLD && meetsAdditionalCriteria))
    );
  }
}
