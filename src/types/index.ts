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