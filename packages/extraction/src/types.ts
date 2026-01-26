/**
 * Core types for job extraction
 */

export interface JobData {
  title: string;
  company: string;
  location: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryDisplay?: string;
  url?: string;
  applicantCount?: number;
  competitionLevel?: 'low' | 'medium' | 'high' | 'very_high';
  postedDate?: string;
  employmentType?: string;
  remote?: boolean;
  benefits?: string[];
  requirements?: string[];
}

export interface ApplicantInfo {
  count: number;
  threshold: number;
  shouldExit: boolean;
  competitionLevel: 'low' | 'medium' | 'high' | 'very_high';
}

export interface ExtractionResult {
  success: boolean;
  data?: JobData;
  error?: string;
  source?: 'json-ld' | 'llm' | 'regex' | 'hybrid';
}

export interface ExtractionOptions {
  ignoreCompetition?: boolean;
  sourceUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}
