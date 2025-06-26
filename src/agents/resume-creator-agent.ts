import { ClaudeBaseAgent } from './claude-base-agent';
import { JobListing, ResumeResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export class ResumeCreatorAgent extends ClaudeBaseAgent {
  private maxRoles: number;

  constructor(claudeApiKey: string, model?: string, maxTokens?: number, maxRoles: number = 3) {
    super(claudeApiKey, model, maxTokens);
    this.maxRoles = maxRoles;
  }

  async createResume(jobId: string, cvFilePath: string, outputPath?: string, regenerate: boolean = true): Promise<ResumeResult> {
    try {
      // Load job data
      const jobData = this.loadJobData(jobId);
      
      let tailoredContent: { markdownContent: string; changes: string[] };
      
      // Check if we should use cached content or regenerate
      if (!regenerate) {
        const cachedContent = this.loadMostRecentTailoredContent(jobId);
        if (cachedContent) {
          console.log(`📋 Using most recent tailored content for job ${jobId}`);
          tailoredContent = cachedContent;
        } else {
          console.log(`📋 No cached content found for job ${jobId}, regenerating...`);
          const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
          const scopedCvContent = this.scopeCVContent(cvContent);
          tailoredContent = await this.generateTailoredContent(jobData, scopedCvContent, jobId);
          
          // Cache the newly generated content
          this.saveTailoredContent(jobId, cvFilePath, tailoredContent);
        }
      } else {
        // Regenerate tailored content
        console.log(`🔄 Regenerating tailored content for job ${jobId}`);
        const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
        const scopedCvContent = this.scopeCVContent(cvContent);
        tailoredContent = await this.generateTailoredContent(jobData, scopedCvContent, jobId);
        
        // Cache the tailored content
        this.saveTailoredContent(jobId, cvFilePath, tailoredContent);
      }
      
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
    const jobDir = path.resolve('logs', jobId);
    
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

  private loadMostRecentTailoredContent(jobId: string): { markdownContent: string; changes: string[] } | null {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      // Check if job directory exists
      if (!fs.existsSync(jobDir)) {
        return null;
      }
      
      const files = fs.readdirSync(jobDir);
      
      // Find all tailored content JSON files and sort by timestamp (most recent first)
      const tailoredFiles = files
        .filter(file => file.startsWith('tailored-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
      
      if (tailoredFiles.length === 0) {
        return null;
      }
      
      // Load the most recent tailored content
      const mostRecentFile = tailoredFiles[0];
      const cachePath = path.join(jobDir, mostRecentFile);
      const cacheData = fs.readFileSync(cachePath, 'utf-8');
      const parsedData = JSON.parse(cacheData);
      
      // Extract markdown filename from JSON metadata
      const markdownFilename = parsedData.markdownFilename;
      if (!markdownFilename) {
        return null;
      }
      
      // Load markdown content from separate .md file
      const markdownPath = path.join(jobDir, markdownFilename);
      if (!fs.existsSync(markdownPath)) {
        return null;
      }
      
      const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
      
      // Validate cache structure
      if (markdownContent && Array.isArray(parsedData.changes)) {
        return {
          markdownContent: markdownContent,
          changes: parsedData.changes
        };
      }
      
      return null;
    } catch (error) {
      // If any error occurs in cache loading, return null to generate fresh content
      return null;
    }
  }

  private loadCachedTailoredContent(jobId: string, cvFilePath: string): { markdownContent: string; changes: string[] } | null {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      // Check if job directory exists
      if (!fs.existsSync(jobDir)) {
        return null;
      }
      
      const cvHash = this.generateCVHash(cvFilePath);
      const files = fs.readdirSync(jobDir);
      
      // Look for cached tailored content metadata file in job directory
      const cacheFile = files.find(file => 
        file.startsWith(`tailored-${cvHash}-`) && 
        file.endsWith('.json')
      );
      
      if (!cacheFile) {
        return null;
      }
      
      // Load metadata from JSON file
      const cachePath = path.join(jobDir, cacheFile);
      const cacheData = fs.readFileSync(cachePath, 'utf-8');
      const parsedData = JSON.parse(cacheData);
      
      // Extract markdown filename from JSON metadata
      const markdownFilename = parsedData.markdownFilename;
      if (!markdownFilename) {
        return null;
      }
      
      // Load markdown content from separate .md file
      const markdownPath = path.join(jobDir, markdownFilename);
      if (!fs.existsSync(markdownPath)) {
        return null;
      }
      
      const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
      
      // Validate cache structure
      if (markdownContent && Array.isArray(parsedData.changes)) {
        return {
          markdownContent: markdownContent,
          changes: parsedData.changes
        };
      }
      
      return null;
    } catch (error) {
      // If any error occurs in cache loading, return null to generate fresh content
      return null;
    }
  }

  private saveTailoredContent(jobId: string, cvFilePath: string, content: { markdownContent: string; changes: string[] }): void {
    try {
      const logsDir = path.resolve('logs');
      const jobDir = path.resolve(logsDir, jobId);
      
      // Create logs directory if it doesn't exist
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Create job-specific subdirectory if it doesn't exist
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }
      
      const cvHash = this.generateCVHash(cvFilePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Save markdown content to separate .md file
      const markdownFileName = `tailored-${cvHash}-${timestamp}.md`;
      const markdownPath = path.join(jobDir, markdownFileName);
      fs.writeFileSync(markdownPath, content.markdownContent, 'utf-8');
      
      // Save metadata to JSON file (without markdown content)
      const cacheFileName = `tailored-${cvHash}-${timestamp}.json`;
      const cachePath = path.join(jobDir, cacheFileName);
      
      const cacheData = {
        jobId,
        cvFilePath: path.basename(cvFilePath),
        timestamp: new Date().toISOString(),
        markdownFilename: markdownFileName,
        changes: content.changes
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
      console.log(`📋 Tailored content cached to: ${cachePath}`);
      console.log(`📝 Editable markdown saved to: ${markdownPath}`);
    } catch (error) {
      // Log error but don't fail the resume generation process
      console.warn(`⚠️  Failed to cache tailored content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateCVHash(cvFilePath: string): string {
    try {
      // Generate a simple hash based on CV file content and modification time
      const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
      const stats = fs.statSync(cvFilePath);
      const combinedData = cvContent + stats.mtime.toISOString();
      
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < combinedData.length; i++) {
        const char = combinedData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(16).substring(0, 8);
    } catch (error) {
      // Fallback to timestamp-based hash if file operations fail
      return Date.now().toString(16).substring(0, 8);
    }
  }

  private scopeCVContent(cvContent: string): string {
    if (this.maxRoles <= 0) return cvContent;

    // Try to identify role/experience sections and limit them
    const lines = cvContent.split('\n');
    const scopedLines: string[] = [];
    let roleCount = 0;
    let inExperienceSection = false;
    let currentRoleLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim().toLowerCase();
      
      // Detect experience section headers
      if (trimmedLine.includes('experience') || 
          trimmedLine.includes('employment') || 
          trimmedLine.includes('work history') ||
          trimmedLine.includes('professional experience')) {
        inExperienceSection = true;
        scopedLines.push(line);
        continue;
      }
      
      // Detect end of experience section (start of other sections)
      if (inExperienceSection && (
          trimmedLine.includes('education') ||
          trimmedLine.includes('skills') ||
          trimmedLine.includes('projects') ||
          trimmedLine.includes('certifications') ||
          trimmedLine.includes('languages') ||
          trimmedLine.includes('achievements') ||
          trimmedLine.includes('publications'))) {
        // Add any remaining role lines before ending experience section
        if (currentRoleLines.length > 0 && roleCount < this.maxRoles) {
          scopedLines.push(...currentRoleLines);
          currentRoleLines = [];  // Clear currentRoleLines after adding them
        }
        inExperienceSection = false;
        scopedLines.push(line);
        continue;
      }
      
      if (!inExperienceSection) {
        // Not in experience section, include all lines
        scopedLines.push(line);
        continue;
      }
      
      // In experience section - try to detect role boundaries
      const isRoleHeader = this.isLikelyRoleHeader(line);
      
      if (isRoleHeader) {
        // Save previous role if we have room
        if (currentRoleLines.length > 0 && roleCount < this.maxRoles) {
          scopedLines.push(...currentRoleLines);
          roleCount++;
        }
        
        // Start new role
        currentRoleLines = [line];
        
        // If we've reached max roles, stop processing experience
        if (roleCount >= this.maxRoles) {
          break;
        }
      } else {
        // Add to current role
        currentRoleLines.push(line);
      }
    }
    
    // Add final role if we have room
    if (currentRoleLines.length > 0 && roleCount < this.maxRoles) {
      scopedLines.push(...currentRoleLines);
    }
    
    // Add remaining non-experience lines from where we left off
    const remainingLines = lines.slice(scopedLines.length);
    for (const line of remainingLines) {
      const trimmedLine = line.trim().toLowerCase();
      if (!trimmedLine.includes('experience') && 
          !trimmedLine.includes('employment') && 
          !this.isLikelyRoleHeader(line)) {
        scopedLines.push(line);
      }
    }
    
    const scopedContent = scopedLines.join('\n');
    console.log(`📝 Scoped CV to ${this.maxRoles} most recent roles`);
    return scopedContent;
  }

  private isLikelyRoleHeader(line: string): boolean {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) return false;
    
    // Common patterns for role headers
    const rolePatterns = [
      /^[A-Z][A-Za-z\s]+\s*[||\-–—]\s*[A-Z]/,  // "Job Title | Company" or "Job Title - Company"
      /^[A-Z][A-Za-z\s]+\s*at\s*[A-Z]/,        // "Job Title at Company"
      /^\d{4}\s*[-–—]\s*\d{4}/,                 // "2020 - 2023"
      /^\d{4}\s*[-–—]\s*Present/i,              // "2020 - Present"
      /^[A-Z][A-Za-z\s]+\s*\(\d{4}/,           // "Job Title (2020"
    ];
    
    return rolePatterns.some(pattern => pattern.test(trimmedLine));
  }

  private loadRecommendations(jobId?: string): string[] {
    const recommendations: string[] = [];
    
    if (!jobId) return recommendations;
    
    try {
      const jobDir = path.resolve('logs', jobId);
      
      // Check for recommendations.txt file in job directory
      const recommendationsFile = path.join(jobDir, 'recommendations.txt');
      if (fs.existsSync(recommendationsFile)) {
        const content = fs.readFileSync(recommendationsFile, 'utf-8');
        const lines = content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#')); // Skip comments and empty lines
        recommendations.push(...lines);
        console.log(`📋 Loaded ${lines.length} recommendations from recommendations.txt`);
      }
      
      // Also check for latest critique file recommendations
      if (fs.existsSync(jobDir)) {
        const files = fs.readdirSync(jobDir);
        const critiqueFiles = files
          .filter(file => file.startsWith('critique-') && file.endsWith('.json'))
          .sort()
          .reverse(); // Most recent first
        
        if (critiqueFiles.length > 0) {
          const latestCritiqueFile = path.join(jobDir, critiqueFiles[0]);
          const critiqueData = JSON.parse(fs.readFileSync(latestCritiqueFile, 'utf-8'));
          
          if (critiqueData.recommendations && Array.isArray(critiqueData.recommendations)) {
            recommendations.push(...critiqueData.recommendations);
            console.log(`📋 Loaded ${critiqueData.recommendations.length} recommendations from latest critique`);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Remove duplicates
    return [...new Set(recommendations)];
  }

  private async generateTailoredContent(job: JobListing, cvContent: string, jobId?: string): Promise<{
    markdownContent: string;
    changes: string[];
  }> {
    // Load any existing recommendations
    const recommendations = this.loadRecommendations(jobId);
    
    // Build the recommendations section for the prompt
    let recommendationsSection = '';
    if (recommendations.length > 0) {
      recommendationsSection = `

## Previous Recommendations
Based on previous critiques, please also incorporate these specific recommendations:
${recommendations.map(rec => `- ${rec}`).join('\n')}

`;
    }

    const prompt = `
You are a professional resume writer. 

Given a job posting and a candidate's CV, create a tailored version that optimizes the CV for this specific job while maintaining truthfulness.

Instructions:

Reorder and emphasize relevant experience and skills
Highlight relevant achievements and projects
Be sure to include metrics to quantify team size, project scope, and business impact
Use keywords from the job description where appropriate
Maintain all factual information - do not fabricate anything
${recommendationsSection}

General structure should be:

* Heading
* Contact Information 
* Summary
* Roles
* Skills
* Education

## Heading
Lead with "<CANDIDATE NAME> : ROLE" where role is the role from the job description.

## Contact Information
San Francisco, CA | +1 415-269-4893 | anthony at bluxomelabs.com | linkedin.com/in/anthony-bull

## Summary
Include a "SUMMARY" section, beginning with a professional summary in the form of a single paragraph. 
Tailor the summary to the job description, including as much of the following points as can be organically incoprated: 
- hands-on, end-user-facing engineering leader as player/coach who builds and ships products
- scales teams collaboratively and cross-functionally while staying technical

The summary must be between 275 and 400 characters in length.
Don't use "I" statements; lead with past-tense verb in the first person instead.
Include at least one time-based statement (e.g. 'Increased profits 50% in 5 (five) weeks')
Include at least one improvement metric (e.g. 'Increased profits by 25-26%')

## Roles
Include only up to the most recent ${this.maxRoles} roles. 
Always include dates for roles on the same line as title and company name. 
For each role, include an overview of the role of between 110 and 180 characters, being sure to include specific, quantitative metrics where referenced.
Include 5 bullet points for the most recent role, 3-4 for the next role, and 2-3 for each role after that. 
Each bullet point should be between 80 and 95 characters.
If an input contains the name of the company from the job description, be sure to include it.
Be sure bullets reflect the verbiage used in the job description.

### Technologies
If it makes sense to include a "Technologies:" line selectively for each role, include it, highlighting those that are relevant.  
If it is included, do not make the line in italics.  Bold "Technologies:" but not the rest of the line.
If it is not included, add a "Technologies:" line item under the Skills sections and include relevant technologies. 

Stipulate "Complete work history available upon request." in italics before a SKILLS section.

## Skills
Include a "SKILLS" section with a bulleted overview of relevant skills. 
Separate skills with bullet points. 
Bold the skill umbrella. 
Include at most five relevant skill areas and only include relevant skills.
Each line of skills should be at maximum 95 characters long.

## Education
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

Current CV Content:
${cvContent}

Return a JSON object with:
{
  "markdownContent": "The complete resume as markdown formatted text",
  "changes": ["List of specific changes made to tailor the resume"]
}

Respond with ONLY the JSON object:`;

    // Write prompt to log file in job subdirectory
    if (jobId) {
      try {
        const logsDir = path.resolve('logs');
        const jobDir = path.resolve(logsDir, jobId);
        
        // Create logs and job directories if they don't exist
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        if (!fs.existsSync(jobDir)) {
          fs.mkdirSync(jobDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const promptLogFile = path.join(jobDir, `prompt-${timestamp}.txt`);
        
        const logContent = [
          '📝 Prompt being sent to Claude for resume tailoring:',
          '='.repeat(80),
          prompt,
          '='.repeat(80),
          `\nGenerated at: ${new Date().toISOString()}`
        ].join('\n');
        
        fs.writeFileSync(promptLogFile, logContent, 'utf-8');
        console.log(`📄 Prompt logged to: ${promptLogFile}`);
      } catch (error) {
        console.warn(`⚠️  Failed to log prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const response = await this.makeClaudeRequest(prompt);
    
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
    
    // Determine final PDF path - save to job subdirectory if jobId provided
    let finalPath: string;
    if (outputPath) {
      finalPath = outputPath;
    } else if (jobId) {
      const jobDir = path.resolve('logs', jobId);
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }
      finalPath = path.join(jobDir, `resume-${timestamp}.pdf`);
    } else {
      finalPath = path.join('logs', pdfFileName);
    }
    
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