import { ClaudeBaseAgent } from './claude-base-agent';
import { JobListing, ResumeCritique, ResumeResult } from '../types';
import { resolveFromProjectRoot } from '../utils/project-root';
import { getResumeOutputDir } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export class ResumeCriticAgent extends ClaudeBaseAgent {
  async extract(): Promise<never> {
    throw new Error('ResumeCriticAgent does not implement extract method. Use critiqueResume instead.');
  }

  async createResume(): Promise<never> {
    throw new Error('ResumeCriticAgent does not implement createResume method. Use critiqueResume instead.');
  }

  async critiqueResume(jobId: string): Promise<ResumeCritique> {
    try {
      // Find the most recent resume for this job ID
      const resumePath = this.findMostRecentResume(jobId);
      if (!resumePath) {
        return {
          success: false,
          jobId,
          resumePath: '',
          overallRating: 0,
          strengths: [],
          weaknesses: [],
          recommendations: [],
          detailedAnalysis: '',
          timestamp: new Date().toISOString(),
          error: `No resume found for job ID: ${jobId}`
        };
      }

      // Load the job data for context
      const jobData = this.loadJobData(jobId);

      // Extract text content from the PDF (for now, we'll simulate this)
      const resumeContent = this.extractResumeContent(resumePath);

      // Generate the critique using Claude
      const critique = await this.generateCritique(jobData, resumeContent, resumePath, jobId);

      // Log the critique
      this.logCritique(critique);

      return critique;
    } catch (error) {
      return {
        success: false,
        jobId,
        resumePath: '',
        overallRating: 0,
        strengths: [],
        weaknesses: [],
        recommendations: [],
        detailedAnalysis: '',
        timestamp: new Date().toISOString(),
        error: `Failed to critique resume for job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private findMostRecentResume(jobId: string): string | null {
    const allResumeFiles: Array<{name: string, path: string, mtime: Date}> = [];

    // Load job data to get company and role info for matching
    let jobData: JobListing | null = null;
    try {
      jobData = this.loadJobData(jobId);
    } catch (error) {
      console.warn(`Could not load job data for ${jobId}:`, error);
    }

    // Search in logs directory (legacy location)
    const jobDir = resolveFromProjectRoot('logs', jobId);
    if (fs.existsSync(jobDir)) {
      const files = fs.readdirSync(jobDir);
      const logResumeFiles = files
        .filter(file => {
          return file.endsWith('.pdf') && (
            file.startsWith('resume-') || // Old timestamp-based format
            (!file.startsWith('job-') && !file.startsWith('score-') && !file.startsWith('critique-') && !file.startsWith('tailored-') && !file.startsWith('prompt-')) // New meaningful format (exclude other log files)
          );
        })
        .map(file => {
          const fullPath = path.join(jobDir, file);
          const stats = fs.statSync(fullPath);
          return {
            name: file,
            path: fullPath,
            mtime: stats.mtime
          };
        });
      allResumeFiles.push(...logResumeFiles);
    }

    // Search in RESUME_OUTPUT_DIR (current location)
    const resumeOutputDir = getResumeOutputDir();
    if (fs.existsSync(resumeOutputDir)) {
      const files = fs.readdirSync(resumeOutputDir);
      const outputResumeFiles = files
        .filter(file => {
          if (!file.endsWith('.pdf')) return false;
          
          // First try to match by job ID (if filename contains it)
          if (file.includes(jobId)) return true;
          
          // If we have job data, try to match by company and role
          if (jobData) {
            const lowerFileName = file.toLowerCase();
            const lowerCompany = jobData.company.toLowerCase();
            const lowerTitle = jobData.title.toLowerCase();
            
            // Check if filename contains both company and role
            return lowerFileName.includes(lowerCompany) && 
                   (lowerFileName.includes(lowerTitle) || 
                    lowerTitle.split(' ').some(word => word.length > 3 && lowerFileName.includes(word)));
          }
          
          return false;
        })
        .map(file => {
          const fullPath = path.join(resumeOutputDir, file);
          const stats = fs.statSync(fullPath);
          return {
            name: file,
            path: fullPath,
            mtime: stats.mtime
          };
        });
      allResumeFiles.push(...outputResumeFiles);
    }

    // Sort all found files by modification time, most recent first
    allResumeFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return allResumeFiles.length > 0 ? allResumeFiles[0].path : null;
  }

  private loadJobData(jobId: string): JobListing {
    const jobDir = resolveFromProjectRoot('logs', jobId);
    
    if (!fs.existsSync(jobDir)) {
      throw new Error(`Job directory not found for ID: ${jobId}`);
    }
    
    const files = fs.readdirSync(jobDir);
    const jobFile = files.find(file => file.startsWith('job-') && file.endsWith('.json'));
    if (!jobFile) {
      throw new Error(`Job file not found for ID: ${jobId}`);
    }

    const jobPath = path.join(jobDir, jobFile);
    const jobData = fs.readFileSync(jobPath, 'utf-8');
    return JSON.parse(jobData);
  }

  private async extractResumeContent(resumePath: string): Promise<string> {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ url: resumePath });
      const result = await parser.getText();
      return result.text;
    } catch (error) {
      console.warn(`⚠️  Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`);
      const filename = path.basename(resumePath);
      return `[Resume content from ${filename} - PDF text extraction failed]`;
    }
  }

  private async generateCritique(job: JobListing, resumeContent: string, resumePath: string, jobId: string): Promise<ResumeCritique> {
    const prompt = `You are an expert resume critic and career coach. Analyze the following resume that was tailored for a specific job posting and provide detailed feedback.

JOB POSTING CONTEXT:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description}
${job.salary ? `Salary: ${job.salary.min} - ${job.salary.max} ${job.salary.currency}` : ''}

RESUME CONTENT:
${resumeContent}

CRITICAL: You must respond with ONLY valid JSON. No other text, explanations, or formatting. Your response must be parseable JSON that exactly matches this schema:

{
  "overallRating": <number between 1-10>,
  "strengths": [
    "<specific strength 1>",
    "<specific strength 2>",
    "<specific strength 3>"
  ],
  "weaknesses": [
    "<specific weakness 1>",
    "<specific weakness 2>",
    "<specific weakness 3>"
  ],
  "recommendations": [
    "<actionable recommendation 1>",
    "<actionable recommendation 2>",
    "<actionable recommendation 3>"
  ],
  "detailedAnalysis": "<2-3 paragraph detailed analysis covering alignment with job requirements, presentation quality, content effectiveness, and areas for improvement>"
}

EVALUATION CRITERIA:
- Job Alignment (40%): How well does the resume align with the specific job requirements?
- Content Quality (25%): Are achievements quantified? Are descriptions compelling?
- Presentation (20%): Is the resume well-structured and professional?
- Keyword Optimization (15%): Does it include relevant keywords from the job posting?

Focus on specific improvements, missing keywords, achievement quantification, narrative clarity, and technical formatting. Be constructive and provide actionable recommendations.

REMEMBER: Response must be valid JSON only. No additional text or explanations outside the JSON structure.`;

    const response = await this.makeClaudeRequest(prompt);
    
    try {
      // Clean the response to extract JSON if Claude adds extra text
      let cleanedResponse = response.trim();
      
      // Look for JSON object boundaries
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      const critiqueData = JSON.parse(cleanedResponse);
      
      // Validate required fields
      if (typeof critiqueData.overallRating !== 'number' ||
          !Array.isArray(critiqueData.strengths) ||
          !Array.isArray(critiqueData.weaknesses) ||
          !Array.isArray(critiqueData.recommendations) ||
          typeof critiqueData.detailedAnalysis !== 'string') {
        throw new Error('Response missing required fields or has incorrect types');
      }
      
      return {
        success: true,
        jobId: jobId, // Use the jobId parameter instead of extracting from path
        resumePath,
        overallRating: Math.max(1, Math.min(10, critiqueData.overallRating)), // Ensure 1-10 range
        strengths: critiqueData.strengths.filter((s: any) => typeof s === 'string' && s.trim()),
        weaknesses: critiqueData.weaknesses.filter((w: any) => typeof w === 'string' && w.trim()),
        recommendations: critiqueData.recommendations.filter((r: any) => typeof r === 'string' && r.trim()),
        detailedAnalysis: critiqueData.detailedAnalysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to parse critique response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  private extractJobIdFromPath(resumePath: string): string {
    const filename = path.basename(resumePath);
    const match = filename.match(/resume-([a-f0-9]+)-/);
    return match ? match[1] : 'unknown';
  }

  private logCritique(critique: ResumeCritique): void {
    const logEntry = {
      timestamp: critique.timestamp,
      jobId: critique.jobId,
      resumePath: critique.resumePath,
      overallRating: critique.overallRating,
      strengths: critique.strengths,
      weaknesses: critique.weaknesses,
      recommendations: critique.recommendations,
      detailedAnalysis: critique.detailedAnalysis
    };

    // Create job-specific subdirectory if it doesn't exist
    const jobDir = path.resolve('logs', critique.jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    // Log the full critique as JSON
    const logPath = path.join(jobDir, `critique-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify(logEntry, null, 2));
    console.log(`✅ Resume critique logged to: ${logPath}`);

    // Also append recommendations to recommendations.txt file
    if (critique.recommendations && critique.recommendations.length > 0) {
      const recommendationsFile = path.join(jobDir, 'recommendations.txt');
      const timestamp = new Date().toISOString();
      
      // Create header with timestamp for this critique session
      const recommendationHeader = `\n# Recommendations from critique on ${timestamp}\n`;
      const recommendationEntries = critique.recommendations.map(rec => rec.trim()).join('\n') + '\n';
      
      try {
        // Append to file (or create if it doesn't exist)
        fs.appendFileSync(recommendationsFile, recommendationHeader + recommendationEntries);
        console.log(`📝 ${critique.recommendations.length} recommendations appended to: ${recommendationsFile}`);
      } catch (error) {
        console.warn(`⚠️  Failed to write recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}