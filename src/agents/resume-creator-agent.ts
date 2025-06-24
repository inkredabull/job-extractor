import { BaseAgent } from './base-agent';
import { JobListing, CVData, ResumeResult, AgentConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export class ResumeCreatorAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async extract(): Promise<never> {
    throw new Error('ResumeCreatorAgent does not implement extract method. Use createResume instead.');
  }

  async createResume(jobId: string, cvFilePath: string, outputPath?: string): Promise<ResumeResult> {
    try {
      // Load job data
      const jobData = this.loadJobData(jobId);
      
      // Parse CV data
      const cvData = await this.parseCVFile(cvFilePath);
      
      // Generate tailored content using AI
      const tailoredContent = await this.generateTailoredContent(jobData, cvData);
      
      // Create PDF
      const pdfPath = await this.generatePDF(tailoredContent, outputPath, jobId);
      
      return {
        success: true,
        pdfPath,
        tailoringChanges: tailoredContent.changes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private loadJobData(jobId: string): JobListing {
    const logsDir = path.resolve('logs');
    const files = fs.readdirSync(logsDir);
    
    const jobFile = files.find(file => file.includes(jobId) && file.endsWith('.json') && file.startsWith('job-'));
    if (!jobFile) {
      throw new Error(`Job file not found for ID: ${jobId}`);
    }

    const jobPath = path.join(logsDir, jobFile);
    const jobData = fs.readFileSync(jobPath, 'utf-8');
    return JSON.parse(jobData);
  }

  private async parseCVFile(cvFilePath: string): Promise<CVData> {
    const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
    
    const prompt = `
Parse the following CV/resume text and extract structured information. Return a JSON object with this exact schema:

{
  "personalInfo": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number if found",
    "location": "city, state/country if found",
    "linkedin": "LinkedIn URL if found",
    "github": "GitHub URL if found"
  },
  "summary": "Professional summary or objective if found",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start - End dates",
      "description": "Job description",
      "achievements": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Type",
      "institution": "School Name",
      "year": "Graduation year",
      "details": "Additional details if any"
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "languages": ["language1", "language2"],
    "certifications": ["cert1", "cert2"]
  },
  "projects": [
    {
      "name": "Project Name",
      "description": "Project description",
      "technologies": ["tech1", "tech2"],
      "url": "project URL if found"
    }
  ]
}

CV Content:
${cvContent}

Return ONLY the JSON object, no other text:`;

    const response = await this.makeOpenAIRequest(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in CV parsing response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse CV data: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  private async generateTailoredContent(job: JobListing, cv: CVData): Promise<{
    markdownContent: string;
    changes: string[];
  }> {
    const prompt = `
You are a professional resume writer. 

Given a job posting and a candidate's CV, create a tailored version that optimizes the CV for this specific job while maintaining truthfulness.

Instructions:
1. Reorder and emphasize relevant experience and skills
2. Tailor the summary to match the job requirements
3. Highlight relevant achievements and projects
4. Use keywords from the job description where appropriate
5. Maintain all factual information - do not fabricate anything

Lead with "<CANDIDATE NAME> - ROLE" where role is the role from the job description.

## Summary
Include a "SUMMARY" section, beginning with a professional summary in the form of a single paragraph. 
Tailor the summary to the job description, including as much of the following points as can be organically incoprated: 
- hands-on end-user-facing platform engineering leader 
- player/coach approach to build and ship products
- scales cross-functional teams while staying technical

The summary must be between 275 and 400 characters in length.
Don't use "I" statements; lead with past-tense verb in the first person instead.
Include at least one time-based statement (e.g. 'Increased profits 50% in 5 (five) weeks')
Include at least one improvement metric (e.g. 'Increased profits by 25-26%')

# Roles
Include only up to the most recent three roles. 
Always include dates for roles on the same line as title and company name. 
For each role, include an overview of the role of between 110 and 180 characters.

# Per job 
Include 5 bullet points for the most recent job, 3-4 for the next job, and 2-3 for each job after that. 
Each bullet point should be no more than 90 characters.
If an input contains the name of the company from the job description, be sure to include it.
Be sure bullets reflect the verbiage used in the job description.

### Technologies
If it makes sense to include a "Technologies:" line selectively for each role, include it, highlighting those that are relevant.  
If it is included, do not make the line in italics.  Bold "Technologies:" but not the rest of the line.
If it is not included, add a "Technologies:" line item under the Skills sections and include relevant technologies. 

Stipulate "Complete work history available upon request." in italics before a SKILLS section.

# Skills
Include a "SKILLS" section with a bulleted overview of relevant skills. 
Separate skills with bullet points. 
Bold the skill umbrella. 
Include at most five relevant skill areas and only include relevant skills.
Each line of skills should be at maximum 90 characters long.

Include an "EDUCATION" section after the SKILLS section. 
  
# Misc
Do not include a cover letter. 
Do not make use of the • character.
Return output as Markdown in the format of a reverse chronological resume.
Final output should print to no more than one page as a PDF. 

Job Posting:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}

Current CV Data:
${JSON.stringify(cv, null, 2)}

Return a JSON object with:
{
  "markdownContent": "The complete resume as markdown formatted text",
  "changes": ["List of specific changes made to tailor the resume"]
}

Respond with ONLY the JSON object:`;

    const response = await this.makeOpenAIRequest(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in tailoring response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to generate tailored content: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  private async generatePDF(content: { markdownContent: string; changes: string[] }, outputPath?: string, jobId?: string): Promise<string> {
    // Generate timestamp and filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const markdownFileName = `resume-${jobId || 'custom'}-${timestamp}.md`;
    const pdfFileName = `resume-${jobId || 'custom'}-${timestamp}.pdf`;
    
    // Create outputs directory if it doesn't exist
    const outputsDir = path.join(process.cwd(), 'outputs');
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }
    
    // Write markdown to file
    const markdownPath = path.join(outputsDir, markdownFileName);
    fs.writeFileSync(markdownPath, content.markdownContent, 'utf-8');
    
    // Determine final PDF path
    const finalPath = outputPath || path.join('logs', pdfFileName);
    
    try {
      // Use pandoc to convert markdown to PDF
      const pandocCommand = `pandoc "${markdownPath}" -o "${finalPath}" -V geometry:margin=0.5in`;
      execSync(pandocCommand, { stdio: 'pipe' });
      
      console.log(`✅ Resume generated: ${finalPath}`);
      
      // Clean up temporary markdown file
      fs.unlinkSync(markdownPath);
      
      return finalPath;
    } catch (error) {
      // Clean up temporary markdown file even if pandoc fails
      if (fs.existsSync(markdownPath)) {
        fs.unlinkSync(markdownPath);
      }
      
      throw new Error(`Failed to generate PDF with pandoc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}