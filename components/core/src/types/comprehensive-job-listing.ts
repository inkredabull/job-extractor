// Comprehensive Job Listing Type - Superset for Frontend/Backend Use
// This type covers current extraction data, Teal requirements, and extensible fields

export interface ComprehensiveJobListing {
  // Core Required Fields (Teal + Current System)
  id?: string; // Generated job ID for tracking
  title: string; // Job Title / Role
  company: string; // Company Name
  location: string; // Job Location
  description: string; // Full job description
  url?: string; // Original job posting URL
  
  // Salary Information (Enhanced)
  salary?: {
    min?: string | number; // Minimum salary
    max?: string | number; // Maximum salary
    currency: string; // Currency code (USD, EUR, etc.)
    equity?: string; // Equity information
    benefits?: string[]; // List of benefits
    totalCompensation?: string; // Total comp description
  };
  
  // Competition & Applicant Data
  applicantCount?: number; // Number of applicants
  competitionLevel?: 'low' | 'medium' | 'high' | 'extreme';
  competitionMetrics?: {
    applicantCount: number;
    threshold: number;
    viewCount?: number; // Number of views
    daysPosted?: number; // Days since posting
  };
  
  // Job Details & Requirements
  jobDetails?: {
    employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'temporary'; // Employment type
    workArrangement?: 'remote' | 'hybrid' | 'on-site'; // Work arrangement
    experienceLevel?: 'entry' | 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'director' | 'vp' | 'c-level';
    department?: string; // Engineering, Product, Marketing, etc.
    teamSize?: string; // Team size description
    reportsTo?: string; // Reporting structure
    directReports?: number; // Number of direct reports
  };
  
  // Skills & Requirements
  requirements?: {
    requiredSkills?: string[]; // Must-have skills
    preferredSkills?: string[]; // Nice-to-have skills
    education?: string[]; // Education requirements
    certifications?: string[]; // Required certifications
    yearsOfExperience?: {
      min?: number;
      max?: number;
      preferred?: number;
    };
    languages?: string[]; // Programming or spoken languages
  };
  
  // Company Information
  companyInfo?: {
    industry?: string; // Company industry
    size?: string; // Company size
    stage?: 'startup' | 'scale-up' | 'established' | 'enterprise' | 'public'; // Company stage
    fundingStage?: 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c' | 'late-stage' | 'public';
    employees?: {
      min?: number;
      max?: number;
    };
    culture?: string[]; // Company culture values
    techStack?: string[]; // Technology stack used
    mission?: string; // Company mission statement
  };
  
  // Application & Process Information
  application?: {
    deadline?: string; // Application deadline
    process?: string[]; // Interview process steps
    timeToHire?: string; // Expected time to hire
    contact?: {
      recruiter?: string;
      hiringManager?: string;
      email?: string;
    };
    applicationMethod?: 'direct' | 'referral' | 'recruiter' | 'job-board';
    status?: 'not-applied' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';
  };
  
  // Teal-Specific Fields
  teal?: {
    stage?: string; // Teal application stage
    priority?: 'high' | 'medium' | 'low'; // Priority in Teal
    notes?: string; // Personal notes
    rating?: number; // Personal rating (1-5)
    lastUpdated?: string; // Last update timestamp
    tags?: string[]; // Custom tags
    followUpDate?: string; // Follow-up date
  };
  
  // Metadata & Tracking
  metadata?: {
    source: 'extracted' | 'manual' | 'imported' | 'api'; // How this job was added
    extractedAt?: string; // When extracted
    updatedAt?: string; // Last updated
    version?: number; // Data version for migrations
    extractorVersion?: string; // Version of extractor used
    quality?: 'high' | 'medium' | 'low'; // Data quality assessment
    flags?: string[]; // Special flags or warnings
  };
  
  // Analytics & Scoring
  analysis?: {
    score?: number; // Overall job score (0-100)
    matchPercentage?: number; // How well it matches criteria
    pros?: string[]; // Positive aspects
    cons?: string[]; // Negative aspects
    keyThemes?: string[]; // Main themes identified
    sentimentScore?: number; // Description sentiment (-1 to 1)
  };
  
  // External Integrations
  integrations?: {
    tealId?: string; // Teal job tracker ID
    linkedinUrl?: string; // LinkedIn job URL
    glassdoorUrl?: string; // Glassdoor company URL
    githubUrl?: string; // Company GitHub
    crunchbaseUrl?: string; // Crunchbase company page
    leverUrl?: string; // Lever job posting
    workdayUrl?: string; // Workday posting
  };
}

// Simplified version for Teal API
export interface TealJobData {
  title: string; // maps to 'role' field in Teal
  company: string; // maps to 'company_name' field in Teal
  location: string;
  url?: string;
  description: string;
}

// Conversion utility functions
export const convertToTealFormat = (job: ComprehensiveJobListing): TealJobData => ({
  title: job.title,
  company: job.company,
  location: job.location,
  url: job.url,
  description: job.description,
});

export const convertFromCurrentFormat = (currentJob: any): ComprehensiveJobListing => ({
  title: currentJob.title || '',
  company: currentJob.company || '',
  location: currentJob.location || '',
  description: currentJob.description || '',
  url: currentJob.url,
  salary: currentJob.salary ? {
    min: currentJob.salary.min,
    max: currentJob.salary.max,
    currency: currentJob.salary.currency || 'USD',
  } : undefined,
  applicantCount: currentJob.applicantCount,
  competitionLevel: currentJob.competitionLevel,
  metadata: {
    source: currentJob.source || 'extracted',
    extractedAt: new Date().toISOString(),
  },
});

// Type guards
export const isTealJobData = (job: any): job is TealJobData => {
  return typeof job.title === 'string' && 
         typeof job.company === 'string' && 
         typeof job.location === 'string';
};

export const isComprehensiveJobListing = (job: any): job is ComprehensiveJobListing => {
  return typeof job.title === 'string' && 
         typeof job.company === 'string' && 
         typeof job.location === 'string' &&
         typeof job.description === 'string';
};