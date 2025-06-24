import { BaseAgent } from './base-agent';
import { ResumeCreatorAgent } from './resume-creator-agent';
import { JobListing, JobCriteria, JobScore, AgentConfig } from '../types';
import { getAnthropicConfig, getAutoResumeConfig } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export class JobScorerAgent extends BaseAgent {
  private criteria: JobCriteria;
  private autoResumeConfig: { threshold: number; cvPath: string | null };

  constructor(config: AgentConfig, criteriaPath?: string) {
    super(config);
    this.criteria = this.loadCriteria(criteriaPath || 'criteria.json');
    this.autoResumeConfig = getAutoResumeConfig();
  }

  async extract(): Promise<never> {
    throw new Error('JobScorerAgent does not implement extract method. Use scoreJob instead.');
  }

  async scoreJob(jobId: string): Promise<JobScore> {
    try {
      const jobData = this.loadJobData(jobId);
      const score = await this.calculateScore(jobData);
      
      const jobScore: JobScore = {
        jobId,
        overallScore: Math.round(score.overall * 100),
        rationale: await this.generateRationale(jobData, score),
        breakdown: {
          required_skills: Math.round(score.breakdown.required_skills * 100),
          preferred_skills: Math.round(score.breakdown.preferred_skills * 100),
          experience_level: Math.round(score.breakdown.experience_level * 100),
          salary: Math.round(score.breakdown.salary * 100),
          location: Math.round(score.breakdown.location * 100),
          company_match: Math.round(score.breakdown.company_match * 100),
        },
        timestamp: new Date().toISOString(),
      };

      this.logScore(jobScore);
      
      // Automatically generate resume if score is above threshold and CV path is provided
      if (jobScore.overallScore >= this.autoResumeConfig.threshold && this.autoResumeConfig.cvPath) {
        await this.generateAutoResume(jobId, jobScore.overallScore);
      }
      
      return jobScore;
    } catch (error) {
      throw new Error(`Failed to score job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private loadCriteria(criteriaPath: string): JobCriteria {
    const fullPath = path.resolve(criteriaPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Criteria file not found: ${fullPath}`);
    }
    
    const criteriaData = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(criteriaData);
  }

  private loadJobData(jobId: string): JobListing {
    const logsDir = path.resolve('logs');
    const files = fs.readdirSync(logsDir);
    
    const jobFile = files.find(file => file.includes(jobId) && file.endsWith('.json'));
    if (!jobFile) {
      throw new Error(`Job file not found for ID: ${jobId}`);
    }

    const jobPath = path.join(logsDir, jobFile);
    const jobData = fs.readFileSync(jobPath, 'utf-8');
    return JSON.parse(jobData);
  }

  private async calculateScore(job: JobListing): Promise<{
    overall: number;
    breakdown: {
      required_skills: number;
      preferred_skills: number;
      experience_level: number;
      salary: number;
      location: number;
      company_match: number;
    };
  }> {
    const breakdown = {
      required_skills: this.scoreRequiredSkills(job),
      preferred_skills: this.scorePreferredSkills(job),
      experience_level: this.scoreExperienceLevel(job),
      salary: this.scoreSalary(job),
      location: this.scoreLocation(job),
      company_match: this.scoreCompanyMatch(job),
    };

    const overall =
      breakdown.required_skills * this.criteria.weights.required_skills +
      breakdown.preferred_skills * this.criteria.weights.preferred_skills +
      breakdown.experience_level * this.criteria.weights.experience_level +
      breakdown.salary * this.criteria.weights.salary +
      breakdown.location * this.criteria.weights.location +
      breakdown.company_match * this.criteria.weights.company_match;

    return { overall, breakdown };
  }

  private scoreRequiredSkills(job: JobListing): number {
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    const foundSkills = this.criteria.required_skills.filter(skill =>
      jobText.includes(skill.toLowerCase())
    );
    return foundSkills.length / this.criteria.required_skills.length;
  }

  private scorePreferredSkills(job: JobListing): number {
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    const foundSkills = this.criteria.preferred_skills.filter(skill =>
      jobText.includes(skill.toLowerCase())
    );
    return foundSkills.length / this.criteria.preferred_skills.length;
  }

  private scoreExperienceLevel(job: JobListing): number {
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    let bestMatch = 0;
    
    for (const [level, years] of Object.entries(this.criteria.experience_levels)) {
      if (jobText.includes(level.toLowerCase())) {
        const yearPattern = new RegExp(`(\\d+)\\+?\\s*years?`, 'gi');
        const yearMatches = job.description.match(yearPattern);
        
        if (yearMatches) {
          const requiredYears = Math.max(...yearMatches.map(match => parseInt(match)));
          const score = Math.min(years / requiredYears, 1);
          bestMatch = Math.max(bestMatch, score);
        } else {
          bestMatch = Math.max(bestMatch, 0.7);
        }
      }
    }
    
    return bestMatch;
  }

  private scoreSalary(job: JobListing): number {
    if (!job.salary) return 0.5;
    
    const jobMin = parseInt(job.salary.min?.replace(/[$,]/g, '') || '0');
    const jobMax = parseInt(job.salary.max?.replace(/[$,]/g, '') || '0');
    const criteriaMin = this.criteria.salary_range.min;
    const criteriaMax = this.criteria.salary_range.max;
    
    if (jobMin === 0 && jobMax === 0) return 0.5;
    
    const jobAvg = jobMax > 0 ? (jobMin + jobMax) / 2 : jobMin;
    const criteriaAvg = (criteriaMin + criteriaMax) / 2;
    
    if (jobAvg >= criteriaMin && jobAvg <= criteriaMax) return 1;
    if (jobAvg < criteriaMin) return Math.max(0, jobAvg / criteriaMin);
    return Math.max(0, 1 - (jobAvg - criteriaMax) / criteriaMax);
  }

  private scoreLocation(job: JobListing): number {
    const jobLocation = job.location.toLowerCase();
    const matchingLocations = this.criteria.locations.filter(location =>
      jobLocation.includes(location.toLowerCase()) || location.toLowerCase() === 'remote'
    );
    return matchingLocations.length > 0 ? 1 : 0.3;
  }

  private scoreCompanyMatch(job: JobListing): number {
    let score = 0;
    let maxScore = 0;
    
    const jobText = `${job.title} ${job.description} ${job.company}`.toLowerCase();
    
    // Check for domain match
    if (this.criteria.company_requirements?.domains) {
      maxScore += 0.3;
      const matchingDomains = this.criteria.company_requirements.domains.filter(domain =>
        jobText.includes(domain.toLowerCase())
      );
      if (matchingDomains.length > 0) {
        score += 0.3;
      }
    }
    
    // Check for example companies
    if (this.criteria.company_requirements?.example_companies) {
      maxScore += 0.2;
      const matchingCompanies = this.criteria.company_requirements.example_companies.filter(company =>
        job.company.toLowerCase().includes(company.toLowerCase()) ||
        company.toLowerCase().includes(job.company.toLowerCase())
      );
      if (matchingCompanies.length > 0) {
        score += 0.2;
      }
    }
    
    // Check for cultural values
    if (this.criteria.cultural_values) {
      maxScore += 0.2;
      const matchingValues = this.criteria.cultural_values.filter(value =>
        jobText.includes(value.toLowerCase())
      );
      if (matchingValues.length > 0) {
        score += 0.2 * (matchingValues.length / this.criteria.cultural_values.length);
      }
    }
    
    // Check for deal breakers (negative scoring)
    if (this.criteria.deal_breakers) {
      const dealBreakerFound = this.criteria.deal_breakers.some(dealBreaker => {
        if (dealBreaker.toLowerCase().includes('rto') || dealBreaker.toLowerCase().includes('return to office')) {
          return jobText.includes('5 days') && jobText.includes('office');
        }
        if (dealBreaker.toLowerCase().includes('on-call') || dealBreaker.toLowerCase().includes('oncall')) {
          return jobText.includes('on-call') || jobText.includes('oncall') || jobText.includes('pager');
        }
        return jobText.includes(dealBreaker.toLowerCase());
      });
      
      if (dealBreakerFound) {
        return 0; // Immediate disqualification
      }
    }
    
    // Check for leadership/management requirements
    if (this.criteria.role_requirements) {
      maxScore += 0.3;
      let roleScore = 0;
      
      if (this.criteria.role_requirements.leadership_level === 'player-coach') {
        if (jobText.includes('player-coach') || 
            (jobText.includes('hands-on') && jobText.includes('leadership'))) {
          roleScore += 0.1;
        }
      }
      
      if (this.criteria.role_requirements.autonomy && 
          (jobText.includes('autonomy') || jobText.includes('independent'))) {
        roleScore += 0.1;
      }
      
      if (this.criteria.role_requirements.strategic_involvement && 
          (jobText.includes('strategic') || jobText.includes('vision') || jobText.includes('roadmap'))) {
        roleScore += 0.1;
      }
      
      score += roleScore;
    }
    
    // Default base score if no specific criteria
    if (maxScore === 0) {
      return 0.7;
    }
    
    return Math.min(score / maxScore, 1);
  }

  private async generateRationale(job: JobListing, score: any): Promise<string> {
    const prompt = `
Analyze this job posting and provide a brief rationale for why it received a ${Math.round(score.overall * 100)}% match score:

Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Salary: ${job.salary ? `$${job.salary.min} - $${job.salary.max}` : 'Not specified'}

Score Breakdown:
- Required Skills: ${Math.round(score.breakdown.required_skills * 100)}%
- Preferred Skills: ${Math.round(score.breakdown.preferred_skills * 100)}%
- Experience Level: ${Math.round(score.breakdown.experience_level * 100)}%
- Salary: ${Math.round(score.breakdown.salary * 100)}%
- Location: ${Math.round(score.breakdown.location * 100)}%

Provide a concise 2-3 sentence rationale explaining the match quality and key factors that influenced the score.
`;

    return await this.makeOpenAIRequest(prompt);
  }

  private async generateAutoResume(jobId: string, score: number): Promise<void> {
    try {
      console.log(`🎯 Score of ${score}% exceeds threshold of ${this.autoResumeConfig.threshold}% - generating tailored resume...`);
      
      const anthropicConfig = getAnthropicConfig();
      const resumeCreator = new ResumeCreatorAgent(
        anthropicConfig.anthropicApiKey,
        anthropicConfig.model,
        anthropicConfig.maxTokens
      );
      
      const result = await resumeCreator.createResume(jobId, this.autoResumeConfig.cvPath!);
      
      if (result.success) {
        console.log(`✅ Auto-generated resume: ${result.pdfPath}`);
        if (result.tailoringChanges && result.tailoringChanges.length > 0) {
          console.log(`🔧 Tailoring changes made: ${result.tailoringChanges.length} modifications`);
        }
      } else {
        console.log(`⚠️  Auto-resume generation failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`⚠️  Auto-resume generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private logScore(jobScore: JobScore): void {
    const logEntry = {
      timestamp: jobScore.timestamp,
      jobId: jobScore.jobId,
      score: jobScore.overallScore,
      rationale: jobScore.rationale,
      breakdown: jobScore.breakdown,
    };

    const logPath = path.resolve('logs', `score-${jobScore.jobId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify(logEntry, null, 2));
    console.log(`✅ Job score logged to: ${logPath}`);
  }
}