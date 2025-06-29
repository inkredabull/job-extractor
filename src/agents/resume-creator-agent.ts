import { ClaudeBaseAgent } from './claude-base-agent';
import { JobListing, ResumeResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { ResumeCriticAgent } from './resume-critic-agent';

export class ResumeCreatorAgent extends ClaudeBaseAgent {
  private maxRoles: number;
  private claudeApiKey: string;

  constructor(claudeApiKey: string, model?: string, maxTokens?: number, maxRoles: number = 3) {
    super(claudeApiKey, model, maxTokens);
    this.maxRoles = maxRoles;
    this.claudeApiKey = claudeApiKey;
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
      const pdfPath = await this.generatePDF(tailoredContent, jobData, outputPath, jobId);
      
      // Check if recommendations.txt exists for this job, if not, run critique automatically
      await this.checkAndRunCritique(jobId);
      
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

  private escapeForPrompt(text: string): string {
    // Remove or replace problematic control characters
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Replace control characters with spaces
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n') // Convert remaining carriage returns
      .replace(/\t/g, '    ') // Convert tabs to spaces
      .trim();
  }

  private loadPromptTemplate(variables: {
    job: JobListing;
    cvContent: string;
    maxRoles: number;
    recommendationsSection: string;
  }): string {
    try {
      const promptPath = path.resolve('prompts', 'resume-creator.md');
      let promptTemplate = fs.readFileSync(promptPath, 'utf-8');
      
      // Remove markdown headers and formatting to get clean prompt
      promptTemplate = promptTemplate
        .replace(/^# .+$/gm, '') // Remove markdown headers
        .replace(/^## (.+)$/gm, '$1') // Convert ## headers to plain text
        .replace(/^### (.+)$/gm, '$1') // Convert ### headers to plain text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
        .replace(/```json[\s\S]*?```/g, (match) => {
          // Extract JSON from code block
          return match.replace(/```json\n?/, '').replace(/\n?```/, '');
        })
        .replace(/- \[ \]/g, '-') // Remove checkbox formatting
        .trim();
      
      // Replace template variables with escaped content
      const prompt = promptTemplate
        .replace(/{{maxRoles}}/g, variables.maxRoles.toString())
        .replace(/{{job\.title}}/g, this.escapeForPrompt(variables.job.title))
        .replace(/{{job\.company}}/g, this.escapeForPrompt(variables.job.company))
        .replace(/{{job\.description}}/g, this.escapeForPrompt(variables.job.description))
        .replace(/{{cvContent}}/g, this.escapeForPrompt(variables.cvContent))
        .replace(/{{recommendationsSection}}/g, variables.recommendationsSection);
      
      return prompt;
    } catch (error) {
      console.warn(`⚠️  Failed to load prompt template, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to a minimal prompt if template loading fails
      return `You are a professional resume writer. Create a tailored resume for this job:\n\nJob: ${variables.job.title} at ${variables.job.company}\nDescription: ${variables.job.description}\n\nCV Content:\n${variables.cvContent}\n\nReturn JSON with markdownContent and changes array.`;
    }
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

    const prompt = this.loadPromptTemplate({
      job,
      cvContent,
      maxRoles: this.maxRoles,
      recommendationsSection
    });

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

  private extractCandidateName(markdownContent: string): string {
    // Look for the heading pattern: "# NAME : ROLE" or just "# NAME"
    const headingMatch = markdownContent.match(/^#\s*([^:]+?)(?:\s*:\s*.+)?$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    
    // Fallback: look for name in contact info or other patterns
    const namePatterns = [
      /^([A-Z][a-z]+\s+[A-Z][a-z]+)/m, // First Last pattern
      /San Francisco, CA.*?([A-Z][a-z]+\s+[A-Z][a-z]+)/m, // Name before contact
    ];
    
    for (const pattern of namePatterns) {
      const match = markdownContent.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return 'Resume'; // Fallback
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace characters that aren't safe for filenames
    return filename
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  private async generatePDF(content: { markdownContent: string; changes: string[] }, job: JobListing, outputPath?: string, jobId?: string): Promise<string> {
    // Extract candidate name and create meaningful filename
    const candidateName = this.extractCandidateName(content.markdownContent);
    const role = job.title;
    const company = job.company;
    
    const meaningfulName = this.sanitizeFilename(`${candidateName} for ${role} at ${company}`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const markdownFileName = `${meaningfulName}-${timestamp}.md`;
    const pdfFileName = `${meaningfulName}.pdf`;
    
    // Create outputs directory if it doesn't exist
    const outputsDir = path.join(process.cwd(), 'outputs');
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }
    
    // Write markdown to file
    const markdownPath = path.join(outputsDir, markdownFileName);
    fs.writeFileSync(markdownPath, content.markdownContent, 'utf-8');
    
    // Determine final PDF path - save to configured location by default
    let finalPath: string;
    if (outputPath) {
      finalPath = outputPath;
    } else {
      // Get resume output directory from environment variable
      const resumeOutputDir = this.getResumeOutputDir();
      
      // Create the directory if it doesn't exist
      if (!fs.existsSync(resumeOutputDir)) {
        fs.mkdirSync(resumeOutputDir, { recursive: true });
      }
      
      finalPath = path.join(resumeOutputDir, pdfFileName);
      
      // Also save a copy to the job logs directory if jobId is provided
      if (jobId) {
        const jobDir = path.resolve('logs', jobId);
        if (!fs.existsSync(jobDir)) {
          fs.mkdirSync(jobDir, { recursive: true });
        }
        // We'll create a second copy after PDF generation
      }
    }
    
    try {
      // Use pandoc to convert markdown to PDF
      const pandocCommand = `pandoc "${markdownPath}" -o "${finalPath}" -V geometry:margin=0.5in`;
      execSync(pandocCommand, { stdio: 'pipe' });
      
      console.log(`✅ Resume generated: ${finalPath}`);
      
      // Also save a copy to the job logs directory if jobId is provided
      if (jobId && !outputPath) {
        const jobDir = path.resolve('logs', jobId);
        const logsCopyPath = path.join(jobDir, pdfFileName);
        try {
          fs.copyFileSync(finalPath, logsCopyPath);
          console.log(`📄 Copy saved to logs: ${logsCopyPath}`);
        } catch (copyError) {
          console.warn(`⚠️  Failed to copy resume to logs directory: ${copyError instanceof Error ? copyError.message : 'Unknown error'}`);
        }
      }
      
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

  private getResumeOutputDir(): string {
    const envDir = process.env.RESUME_OUTPUT_DIR;
    if (envDir) {
      // Handle tilde expansion for home directory
      if (envDir.startsWith('~/')) {
        const homeDir = os.homedir();
        return path.join(homeDir, envDir.slice(2));
      }
      return envDir;
    }
    
    // Fallback to default Google Drive location
    const homeDir = os.homedir();
    return path.join(homeDir, 'Google Drive', 'My Drive', 'Professional', 'Job Search', 'Applications', 'Resumes');
  }

  private async checkAndRunCritique(jobId: string): Promise<void> {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        return;
      }

      // Check if recommendations.txt exists
      const recommendationsPath = path.join(jobDir, 'recommendations.txt');
      if (fs.existsSync(recommendationsPath)) {
        console.log(`📋 Recommendations already exist for job ${jobId}, skipping auto-critique`);
        return;
      }

      // Check if any critique files exist
      const files = fs.readdirSync(jobDir);
      const critiqueFiles = files.filter(file => file.startsWith('critique-') && file.endsWith('.json'));
      
      if (critiqueFiles.length > 0) {
        console.log(`📋 Critique already exists for job ${jobId}, skipping auto-critique`);
        return;
      }

      console.log(`🔍 No recommendations found for job ${jobId}, running automatic critique...`);
      
      // Create ResumeCriticAgent and run critique
      const critic = new ResumeCriticAgent(
        this.claudeApiKey,
        this.model,
        this.maxTokens
      );
      
      const result = await critic.critiqueResume(jobId);
      
      if (result.success) {
        console.log(`✅ Auto-critique completed for job ${jobId}`);
        console.log(`⭐ Overall Rating: ${result.overallRating}/10`);
        
        if (result.recommendations && result.recommendations.length > 0) {
          console.log(`💡 Generated ${result.recommendations.length} recommendations for future iterations`);
        }
      } else {
        console.warn(`⚠️  Auto-critique failed for job ${jobId}: ${result.error}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to run auto-critique for job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}