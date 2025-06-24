export interface JobListing {
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: {
    min?: string;
    max?: string;
    currency: string;
  };
}

export interface AgentConfig {
  openaiApiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ExtractorResult {
  success: boolean;
  data?: JobListing;
  error?: string;
}

export interface JobCriteria {
  required_skills: string[];
  preferred_skills: string[];
  experience_levels: Record<string, number>;
  salary_range: {
    min: number;
    max: number;
    currency: string;
  };
  locations: string[];
  company_size: string[];
  job_types: string[];
  weights: {
    required_skills: number;
    preferred_skills: number;
    experience_level: number;
    salary: number;
    location: number;
    company_match: number;
  };
}

export interface JobScore {
  jobId: string;
  overallScore: number;
  rationale: string;
  breakdown: {
    required_skills: number;
    preferred_skills: number;
    experience_level: number;
    salary: number;
    location: number;
    company_match: number;
  };
  timestamp: string;
}