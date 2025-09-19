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
  private mode: 'builder' | 'leader';

  constructor(claudeApiKey: string, model?: string, maxTokens?: number, maxRoles: number = 6, mode: 'builder' | 'leader' = 'leader') {
    super(claudeApiKey, model, maxTokens);
    this.maxRoles = maxRoles;
    this.claudeApiKey = claudeApiKey;
    this.mode = mode;
  }

  async createResume(
    jobId: string, 
    cvFilePath: string, 
    outputPath?: string, 
    regenerate: boolean = true, 
    generate: boolean | string = false,
    critique: boolean = true
  ): Promise<ResumeResult> {
    try {
      // Load job data
      let jobData = this.loadJobData(jobId);
      
      // If generate flag is provided, check if we need to generate job description
      if (generate !== false && (!jobData.description || jobData.description.trim() === '' || this.isGenericDescription(jobData.description))) {
        console.log('🤖 Generating job description from company information...');
        const companyUrl = typeof generate === 'string' ? generate : undefined;
        jobData = await this.generateJobDescription(jobData, jobId, companyUrl);
      }
      
      // Check if this is the first time creating a resume or if we should regenerate
      const isFirstGeneration = this.isFirstGeneration(jobId);
      
      if (isFirstGeneration && critique) {
        console.log(`🎯 First time generating resume for job ${jobId} - will critique and regenerate automatically`);
        
        // First generation: create initial resume
        const initialResult = await this.generateInitialResume(jobId, cvFilePath, outputPath, jobData);
        if (!initialResult.success) {
          return initialResult;
        }
        
        // Run critique automatically 
        console.log(`🔍 Running automatic critique for first-time generation...`);
        const critiqueResult = await this.runCritique(jobId);
        
        if (critiqueResult && critiqueResult.recommendations && critiqueResult.recommendations.length > 0) {
          console.log(`💡 Received ${critiqueResult.recommendations.length} recommendations from critique`);
          
          // Delete the initial tailored markdown files
          this.cleanupTailoredFiles(jobId);
          
          // Regenerate with recommendations
          console.log(`🔄 Regenerating resume with critique recommendations...`);
          const finalResult = await this.generateImprovedResume(jobId, cvFilePath, outputPath, jobData);
          
          if (finalResult.success) {
            console.log(`✅ Resume regenerated successfully with improvements`);
            return {
              ...finalResult,
              improvedWithCritique: true,
              critiqueRating: critiqueResult.overallRating
            };
          }
          
          // If regeneration fails, return initial result
          console.warn(`⚠️  Failed to regenerate with recommendations, keeping initial version`);
          return initialResult;
        } else {
          console.log(`📋 No recommendations received from critique, keeping initial version`);
          return initialResult;
        }
      } else {
        // Not first generation - use existing logic
        return await this.generateStandardResume(jobId, cvFilePath, jobData, regenerate, outputPath, critique);
      }
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

  private isFirstGeneration(jobId: string): boolean {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        return true;
      }
      
      // Check for existing PDF files in the configured resume output directory
      const resumeOutputDir = this.getResumeOutputDir();
      if (fs.existsSync(resumeOutputDir)) {
        const files = fs.readdirSync(resumeOutputDir);
        const jobData = this.loadJobData(jobId);
        const candidateName = 'Resume'; // We'll extract this properly in the actual generation
        
        // Look for any PDF files that might be for this job
        const hasPdf = files.some(file => 
          file.endsWith('.pdf') && 
          (file.includes(jobData.company) || file.includes(jobData.title))
        );
        
        if (hasPdf) {
          return false;
        }
      }
      
      // Check for existing tailored content files
      const files = fs.readdirSync(jobDir);
      const hasTailoredContent = files.some(file => 
        file.startsWith('tailored-') && (file.endsWith('.json') || file.endsWith('.md'))
      );
      
      return !hasTailoredContent;
    } catch (error) {
      // If we can't determine, assume it's first generation
      return true;
    }
  }

  private async generateInitialResume(jobId: string, cvFilePath: string, outputPath?: string, jobData?: JobListing): Promise<ResumeResult> {
    const job = jobData || this.loadJobData(jobId);
    
    console.log(`🔄 Generating initial resume for job ${jobId}`);
    const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
    const scopedCvContent = this.scopeCVContent(cvContent);
    const tailoredContent = await this.generateTailoredContent(job, scopedCvContent, jobId);
    
    // Cache the tailored content
    this.saveTailoredContent(jobId, cvFilePath, tailoredContent);
    
    // Create PDF
    const pdfPath = await this.generatePDF(tailoredContent, job, outputPath, jobId);
    
    return {
      success: true,
      pdfPath,
      tailoringChanges: tailoredContent.changes
    };
  }

  private async generateImprovedResume(jobId: string, cvFilePath: string, outputPath?: string, jobData?: JobListing): Promise<ResumeResult> {
    const job = jobData || this.loadJobData(jobId);
    
    console.log(`🔄 Generating improved resume for job ${jobId} with critique recommendations`);
    const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
    const scopedCvContent = this.scopeCVContent(cvContent);
    const tailoredContent = await this.generateTailoredContent(job, scopedCvContent, jobId);
    
    // Cache the tailored content
    this.saveTailoredContent(jobId, cvFilePath, tailoredContent);
    
    // Create PDF
    const pdfPath = await this.generatePDF(tailoredContent, job, outputPath, jobId);
    
    return {
      success: true,
      pdfPath,
      tailoringChanges: tailoredContent.changes
    };
  }

  private async generateStandardResume(jobId: string, cvFilePath: string, jobData: JobListing, regenerate: boolean, outputPath?: string, critique: boolean = true): Promise<ResumeResult> {
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
    if (critique) {
      await this.checkAndRunCritique(jobId);
    }
    
    return {
      success: true,
      pdfPath,
      tailoringChanges: tailoredContent.changes
    };
  }

  private async runCritique(jobId: string): Promise<any> {
    try {
      // Create ResumeCriticAgent and run critique
      const critic = new ResumeCriticAgent(
        this.claudeApiKey,
        this.model,
        this.maxTokens
      );
      
      const result = await critic.critiqueResume(jobId);
      
      if (result.success) {
        console.log(`✅ Critique completed for job ${jobId}`);
        console.log(`⭐ Overall Rating: ${result.overallRating}/10`);
        
        if (result.recommendations && result.recommendations.length > 0) {
          console.log(`💡 Generated ${result.recommendations.length} recommendations`);
        }
        
        return result;
      } else {
        console.warn(`⚠️  Critique failed for job ${jobId}: ${result.error}`);
        return null;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to run critique for job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  private cleanupTailoredFiles(jobId: string): void {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        return;
      }
      
      const files = fs.readdirSync(jobDir);
      const tailoredFiles = files.filter(file => 
        file.startsWith('tailored-') && (file.endsWith('.json') || file.endsWith('.md'))
      );
      
      for (const file of tailoredFiles) {
        const filePath = path.join(jobDir, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted ${file} to prepare for regeneration`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup tailored files for job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  private loadCompanyValues(jobId?: string): string | null {
    if (!jobId) return null;
    
    try {
      const jobDir = path.resolve('logs', jobId);
      const companyValuesFile = path.join(jobDir, 'company-values.txt');
      
      if (fs.existsSync(companyValuesFile)) {
        const content = fs.readFileSync(companyValuesFile, 'utf-8').trim();
        if (content.length > 0) {
          console.log(`📋 Loaded company values from company-values.txt`);
          return content;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load company values: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return null;
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

  private formatCVForPrompt(text: string): string {
    // Format CV content preserving structure for better readability in logs
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Replace control characters with spaces
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n') // Convert remaining carriage returns
      .replace(/\t/g, '    ') // Convert tabs to spaces
      .split('\n')
      .map(line => line.trim()) // Clean up each line
      .filter(line => line.length > 0) // Remove empty lines
      .join('\n') // Rejoin with clean newlines
      .trim();
  }

  private loadPromptTemplate(variables: {
    job: JobListing;
    cvContent: string;
    maxRoles: number;
    recommendationsSection: string;
    companyValuesSection: string;
  }): string {
    try {
      // Load base template
      const basePath = path.resolve('prompts', 'resume-creator-base.md');
      let promptTemplate = fs.readFileSync(basePath, 'utf-8');
      
      // First, replace the maxRoles placeholder to ensure it's not lost
      promptTemplate = promptTemplate.replace(/\{\{maxRoles\}\}/g, variables.maxRoles.toString());
      
      // Load mode-specific fragments
      const fragmentsFileName = this.mode === 'builder' ? 'resume-creator-builder-fragments.md' : 'resume-creator-leader-fragments.md';
      const fragmentsPath = path.resolve('prompts', fragmentsFileName);
      const fragments = this.loadFragments(fragmentsPath);
      
      // Replace fragment placeholders with mode-specific content
      // First, define all possible fragment placeholders
      const allPlaceholders = [
        'modeSpecificInstructions',
        'summaryGuidance', 
        'rolesSpecificInstructions',
        'metricsType',
        'bulletPointGuidance',
        'verbReplacementSection',
        'technologiesSection',
        'skillsSpecificInstructions',
        'enforcementSection'
      ];
      
      // Replace each placeholder with fragment content or empty string if not found
      allPlaceholders.forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = fragments[key] || '';
        promptTemplate = promptTemplate.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      });
      
      // Replace remaining template variables with escaped content
      let prompt = promptTemplate
        .replace(/{{resumeMode}}/g, this.mode.toUpperCase())
        .replace(/{{job\.title}}/g, this.escapeForPrompt(variables.job.title))
        .replace(/{{job\.company}}/g, this.escapeForPrompt(variables.job.company))
        .replace(/{{job\.description}}/g, this.escapeForPrompt(variables.job.description))
        .replace(/{{cvContent}}/g, this.formatCVForPrompt(variables.cvContent))
        .replace(/{{recommendationsSection}}/g, variables.recommendationsSection)
        .replace(/{{companyValuesSection}}/g, variables.companyValuesSection);
      
      // Then remove markdown headers and formatting to get clean prompt
      prompt = prompt
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
      
      
      return prompt;
    } catch (error) {
      console.warn(`⚠️  Failed to load prompt template, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to a minimal prompt if template loading fails
      return `You are a professional resume writer. Create a tailored resume for this job:\n\nJob: ${variables.job.title} at ${variables.job.company}\nDescription: ${variables.job.description}\n\nCV Content:\n${this.formatCVForPrompt(variables.cvContent)}\n\nReturn JSON with markdownContent and changes array.`;
    }
  }

  private loadFragments(fragmentsPath: string): Record<string, string> {
    try {
      const fragmentsContent = fs.readFileSync(fragmentsPath, 'utf-8');
      const fragments: Record<string, string> = {};
      
      // Parse fragments using regex to find ### sectionName blocks
      const fragmentRegex = /### (\w+)\n((?:(?!### \w+)[\s\S])*)/g;
      let match;
      
      while ((match = fragmentRegex.exec(fragmentsContent)) !== null) {
        const [, sectionName, sectionContent] = match;
        fragments[sectionName] = sectionContent.trim();
      }
      
      return fragments;
    } catch (error) {
      console.warn(`⚠️  Failed to load fragments from ${fragmentsPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {};
    }
  }

  private addHeaderToMarkdown(markdownContent: string): string {
    const header = `---
header-includes: |
  \\usepackage{fancyhdr}
  \\usepackage{geometry}
  \\geometry{bottom=0.5in, footskip=0.33in}
  \\pagestyle{fancy}
  \\fancyhf{}
  \\fancyfoot[C]{\\footnotesize \\textit{Powered by \\href{https://github.com/inkredabull/job-extractor}{job-extractor}}}
  \\renewcommand{\\headrulewidth}{0pt}
---
`;

    // If markdown already has a YAML header, replace it, otherwise prepend our header
    if (markdownContent.startsWith('---')) {
      const endOfFrontMatterIndex = markdownContent.indexOf('---', 3);
      if (endOfFrontMatterIndex !== -1) {
        // Replace existing front matter
        const contentWithoutFrontMatter = markdownContent.substring(endOfFrontMatterIndex + 3).trim();
        return header + contentWithoutFrontMatter;
      }
    }
    
    // Prepend header to content
    return header + markdownContent;
  }

  private async generateTailoredContent(job: JobListing, cvContent: string, jobId?: string): Promise<{
    markdownContent: string;
    changes: string[];
  }> {
    // Load any existing recommendations
    const recommendations = this.loadRecommendations(jobId);
    
    // Load company values if available
    const companyValues = this.loadCompanyValues(jobId);
    
    // Build the recommendations section for the prompt
    let recommendationsSection = '';
    if (recommendations.length > 0) {
      recommendationsSection = `
Please also incorporate these specific recommendations based on previous critiques:
${recommendations.map(rec => `- ${rec}`).join('\n')}
`;
    }
    
    // Build the company values section for the prompt
    let companyValuesSection = '';
    if (companyValues) {
      companyValuesSection = `

Additionally, align the resume content with these company values:
${companyValues}

Ensure the resume highlights experiences and achievements that demonstrate alignment with these values.`;
    }

    const prompt = this.loadPromptTemplate({
      job,
      cvContent,
      maxRoles: this.maxRoles,
      recommendationsSection,
      companyValuesSection
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
      const result = JSON.parse(jsonMatch[0]);
      return {
        markdownContent: this.addHeaderToMarkdown(result.markdownContent),
        changes: result.changes
      };
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
    }
    
    try {
      // Use pandoc to convert markdown to PDF
      const pandocCommand = `pandoc "${markdownPath}" -o "${finalPath}" -V geometry:margin=0.5in`;
      execSync(pandocCommand, { stdio: 'pipe' });
      
      console.log(`✅ Resume generated: ${finalPath}`);
      
      // Open the PDF with the default viewer
      try {
        const openCommand = process.platform === 'darwin' ? 'open' : 
                           process.platform === 'win32' ? 'start' : 'xdg-open';
        execSync(`${openCommand} "${finalPath}"`, { stdio: 'ignore' });
        console.log(`📖 Opened PDF in default viewer: ${finalPath}`);
      } catch (openError) {
        console.warn(`⚠️  Failed to open PDF in default viewer: ${openError instanceof Error ? openError.message : 'Unknown error'}`);
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

  private isGenericDescription(description: string): boolean {
    // Check if the description contains generic placeholder text
    const genericPhrases = [
      'We are seeking a talented',
      'Tech Company Inc.',
      'Software Engineer to join our team',
      'competitive salary, health insurance, and flexible work hours',
      'Bachelor\'s degree in Computer Science, proficiency in Java and Python'
    ];
    
    return genericPhrases.some(phrase => description.includes(phrase));
  }

  private async generateJobDescription(jobData: JobListing, jobId: string, companyUrl?: string): Promise<JobListing> {
    try {
      // Fetch company information if URL is provided
      let companyInfo = '';
      
      if (companyUrl) {
        try {
          console.log(`🌐 Fetching company information from: ${companyUrl}`);
          companyInfo = await this.fetchCompanyInfo(companyUrl);
        } catch (error) {
          console.log(`⚠️  Could not fetch company info: ${error instanceof Error ? error.message : 'Unknown error'}`);
          companyInfo = `Information about ${jobData.company}`;
        }
      } else {
        console.log(`📋 No company URL provided, generating with basic company information`);
        companyInfo = `Information about ${jobData.company}`;
      }

      const prompt = `You are a professional job description generator. Based on the limited information provided, create a realistic and detailed job description that someone with this job title would likely have at this company.

**Job Information:**
- Title: ${jobData.title}
- Company: ${jobData.company}
- Location: ${jobData.location || 'Not specified'}

**Company Background:**
${companyInfo || `${jobData.company} is a company in the technology/business sector.`}

**Instructions:**
Create a comprehensive job description that includes:
1. Brief company overview (if not already covered above)
2. Role summary and key objectives
3. Primary responsibilities (5-8 bullet points)
4. Required qualifications and skills
5. Preferred qualifications
6. What the person will accomplish in this role
7. Growth opportunities
8. Benefits (general industry-standard benefits)

Make this specific to the job title "${jobData.title}" and realistic for what someone in this role would do at ${jobData.company}. The description should be professional, detailed, and sound like it came from the company's actual HR department.

Do not include salary information. Focus on making this sound authentic and role-appropriate.

Return ONLY the job description text, no additional formatting or commentary.`;

      console.log('🤖 Generating job description with AI...');
      const generatedDescription = await this.makeClaudeRequest(prompt);
      
      // Update the job data
      const updatedJobData = {
        ...jobData,
        description: generatedDescription.trim()
      };
      
      // Save the updated job data back to the job file
      this.saveUpdatedJobData(jobId, updatedJobData);
      
      console.log('✅ Job description generated and saved');
      return updatedJobData;
      
    } catch (error) {
      console.warn(`⚠️  Failed to generate job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return jobData; // Return original job data if generation fails
    }
  }


  private async fetchCompanyInfo(url: string): Promise<string> {
    try {
      // Import WebScraper dynamically to avoid circular dependencies
      const { WebScraper } = require('../utils/web-scraper');
      
      const html = await WebScraper.fetchHtml(url);
      const simplifiedHtml = WebScraper.simplifyHtml(html);
      
      // Use AI to extract key company information
      const prompt = `Extract key company information from the following website content. Focus on:
- Company mission and values
- Products or services offered  
- Company size and stage (startup, established, etc.)
- Industry and market focus
- Culture and work environment

Provide a concise 2-3 paragraph summary that would be useful for understanding what this company does and what it would be like to work there.

Website content:
${simplifiedHtml.slice(0, 8000)}...`;

      const companyInfo = await this.makeClaudeRequest(prompt);
      return companyInfo.trim();
      
    } catch (error) {
      throw new Error(`Failed to fetch company information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private saveUpdatedJobData(jobId: string, jobData: JobListing): void {
    try {
      const jobDir = path.resolve('logs', jobId);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `job-${timestamp}.json`;
      const filePath = path.join(jobDir, fileName);
      
      const updatedJobData = { ...jobData, source: 'generated' } as JobListing & { source: string };
      const jsonOutput = JSON.stringify(updatedJobData, null, 2);
      
      fs.writeFileSync(filePath, jsonOutput, 'utf-8');
      console.log(`📄 Updated job data saved to: ${fileName}`);
      
    } catch (error) {
      console.warn(`⚠️  Failed to save updated job data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}