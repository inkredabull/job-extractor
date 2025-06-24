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
  company_size?: string[];
  job_types?: string[];
  company_requirements?: {
    funding_stage?: string[];
    company_size?: {
      min: number;
      max: number;
      ideal: number;
    };
    team_size?: {
      direct_reports?: {
        min: number;
        max: number;
      };
      org_size?: number;
    };
    financial_metrics?: {
      arr_minimum?: number;
      runway_years?: number;
      revenue_per_employee?: number;
      net_dollar_retention?: number;
      new_logo_growth?: number;
    };
    budget_responsibility?: number;
    domains?: string[];
    example_companies?: string[];
  };
  role_requirements?: {
    leadership_level?: string;
    autonomy?: boolean;
    hands_on?: boolean;
    strategic_involvement?: boolean;
    no_oncall?: boolean;
    report_to_ceo?: boolean;
    proven_executive_team?: boolean;
  };
  cultural_values?: string[];
  deal_breakers?: string[];
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

export interface CVData {
  personalInfo: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
    achievements?: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    details?: string;
  }>;
  skills: {
    technical?: string[];
    languages?: string[];
    certifications?: string[];
  };
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
  }>;
}

export interface ResumeResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
  tailoringChanges?: string[];
}

export interface ResumeCritique {
  success: boolean;
  jobId: string;
  resumePath: string;
  overallRating: number; // 1-10 scale
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  detailedAnalysis: string;
  timestamp: string;
  error?: string;
}