/**
 * TypeScript type definitions for LangSmith evaluation
 */

export interface EvaluationMetrics {
  job_id: string;
  terms_count?: number;
  terms_coverage?: number;
  avg_term_length?: number;
  has_technical_terms?: boolean;
  required_terms?: string[];
  required_fields_present?: number;
  required_fields_total?: number;
  completeness_score?: number;
  has_salary?: boolean;
  error?: string;
}

export interface EvaluationOptions {
  termsOnly?: boolean;
  completenessOnly?: boolean;
  verbose?: boolean;
}

export interface EvaluationResult {
  success: boolean;
  metrics?: EvaluationMetrics;
  error?: string;
  stderr?: string;
}

export interface LangSmithConfig {
  apiKey?: string;
  projectName?: string;
  verbose?: boolean;
}
