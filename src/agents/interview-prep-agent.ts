import { ClaudeBaseAgent } from './claude-base-agent';
import { JobListing, AgentConfig, StatementType, StatementOptions, StatementResult, JobTheme, ThemeExtractionResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class InterviewPrepAgent extends ClaudeBaseAgent {
  constructor(claudeApiKey: string, model?: string, maxTokens?: number) {
    super(claudeApiKey, model, maxTokens);
  }

  async extract(): Promise<never> {
    throw new Error('InterviewPrepAgent does not implement extract method. Use generateMaterial instead.');
  }

  async createResume(): Promise<never> {
    throw new Error('InterviewPrepAgent does not implement createResume method. Use generateMaterial instead.');
  }

  async generateMaterial(
    type: StatementType,
    jobId: string,
    cvFilePath: string,
    options: StatementOptions = {},
    regenerate: boolean = false,
    contentOnly: boolean = false
  ): Promise<StatementResult> {
    try {
      let content: string;
      
      // If content-only mode and not regenerating, just find the most recent statement file
      if (contentOnly && !regenerate) {
        const mostRecentContent = this.loadMostRecentMaterial(jobId, type);
        if (mostRecentContent) {
          return {
            success: true,
            content: mostRecentContent,
            type,
            characterCount: mostRecentContent.length
          };
        } else {
          // No existing statement found, fall through to generate new one
          console.log(`📋 No existing ${type.replace('-', ' ')} material found for job ${jobId}, generating...`);
        }
      }
      
      // Load job data and CV content
      const jobData = this.loadJobData(jobId);
      const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
      
      // Check if we should use cached content or regenerate
      if (!regenerate && !contentOnly) {
        const cachedContent = this.loadCachedMaterial(jobId, type, cvFilePath, options);
        if (cachedContent) {
          console.log(`📋 Using cached ${type.replace('-', ' ')} material for job ${jobId}`);
          content = cachedContent;
        } else {
          console.log(`📋 No cached ${type.replace('-', ' ')} material found for job ${jobId}, generating...`);
          content = await this.createMaterial(type, jobData, cvContent, options);
          // Cache the newly generated content
          this.cacheMaterial(jobId, type, content, cvFilePath, options);
        }
      } else {
        // Regenerate content or content-only mode with no existing file
        if (regenerate) {
          console.log(`🔄 Regenerating ${type.replace('-', ' ')} material for job ${jobId}`);
        }
        content = await this.createMaterial(type, jobData, cvContent, options);
        // Cache the regenerated content
        this.cacheMaterial(jobId, type, content, cvFilePath, options);
      }
      
      return {
        success: true,
        content,
        type,
        characterCount: content.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        type
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

  private loadPromptTemplate(type: StatementType): string {
    try {
      const promptPath = path.resolve('prompts', `statement-${type}.md`);
      return fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.warn(`⚠️  Failed to load prompt template for ${type}, using fallback`);
      return this.getFallbackPrompt(type);
    }
  }

  private getFallbackPrompt(type: StatementType): string {
    const basePrompt = `You are a professional writer helping create a ${type.replace('-', ' ')} based on a job posting and work history.`;
    
    switch (type) {
      case 'cover-letter':
        return `${basePrompt}\n\nCreate a cover letter between 600-850 characters. Begin with "Greetings:" and end with "Regards, Anthony". Use informal tone.`;
      case 'endorsement':
        return `${basePrompt}\n\nCreate an endorsement between 375-500 characters in third person. Use first name only when referencing the candidate.`;
      case 'about-me':
        return `${basePrompt}\n\nCreate talking points as a two-level nested bullet list for "Tell me about yourself" response. Maximum 900 characters.`;
      case 'general':
        return `${basePrompt}\n\nCreate a general statement between 250-425 characters in third person. Reference examples from entire work history.`;
      default:
        return basePrompt;
    }
  }

  private async createMaterial(
    type: StatementType,
    job: JobListing,
    cvContent: string,
    options: StatementOptions
  ): Promise<string> {
    let promptTemplate = this.loadPromptTemplate(type);
    
    // For about-me type, check if themes exist and include them
    if (type === 'about-me') {
      const themes = await this.getOrExtractThemes(job);
      promptTemplate = this.injectThemesIntoPrompt(promptTemplate, themes);
    }
    
    // Build the complete prompt
    const prompt = this.buildPrompt(promptTemplate, type, job, cvContent, options);
    
    // Log the prompt
    console.log(`📝 Generating ${type.replace('-', ' ')} material...`);
    
    const response = await this.makeClaudeRequest(prompt);
    
    // Clean up the response
    return this.cleanResponse(response, type);
  }

  private buildPrompt(
    template: string,
    type: StatementType,
    job: JobListing,
    cvContent: string,
    options: StatementOptions
  ): string {
    // Replace template variables
    let prompt = template
      .replace(/{{job\.title}}/g, job.title)
      .replace(/{{job\.company}}/g, job.company)
      .replace(/{{job\.description}}/g, job.description)
      .replace(/{{cvContent}}/g, cvContent)
      .replace(/{{emphasis}}/g, options.emphasis || '')
      .replace(/{{companyInfo}}/g, options.companyInfo || '')
      .replace(/{{customInstructions}}/g, options.customInstructions || '');

    // Add specific instructions based on type
    const typeInstructions = this.getTypeSpecificInstructions(type, options);
    if (typeInstructions) {
      prompt += `\n\nAdditional Instructions:\n${typeInstructions}`;
    }

    prompt += `\n\nJob Posting:\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description}\n\nWork History:\n${cvContent}`;

    return prompt;
  }

  private getTypeSpecificInstructions(type: StatementType, options: StatementOptions): string {
    switch (type) {
      case 'cover-letter':
        let instructions = 'Length: 600-850 characters. Begin with "Greetings:" and end with "Regards, Anthony". Informal tone.';
        if (options.emphasis) {
          instructions += `\n\nEMPHASIS: ${options.emphasis}`;
        }
        return instructions;
        
      case 'endorsement':
        return 'Length: 375-500 characters. Third person. Use first name only. Tell stories about strengths and value.';
        
      case 'about-me':
        let aboutInstructions = 'Two-level nested bullet list. Informal tone. Max 900 characters. Include desire for small team (5-7 people) and ability to have impact.';
        if (options.companyInfo) {
          aboutInstructions += `\n\nInclude: "I'm excited about ${options.companyInfo} because..."`;
        }
        return aboutInstructions;
        
      case 'general':
        return 'Length: 250-425 characters. Third person. Use first name only. Reference examples from entire work history, including end user work and data center/on-premise deployment experience.';
        
      default:
        return '';
    }
  }

  private generateCacheKey(type: StatementType, cvFilePath: string, options: StatementOptions): string {
    // Generate a simple hash based on statement type, CV file content, and options
    const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
    const stats = fs.statSync(cvFilePath);
    const optionsStr = JSON.stringify(options);
    const combinedData = type + cvContent + stats.mtime.toISOString() + optionsStr;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combinedData.length; i++) {
      const char = combinedData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  private loadMostRecentMaterial(jobId: string, type: StatementType): string | null {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        return null;
      }
      
      const files = fs.readdirSync(jobDir);
      
      // Find all interview prep files for this type and get the most recent one
      const materialFiles = files
        .filter(file => 
          file.startsWith(`interview-prep-${type}-`) && 
          file.endsWith('.json')
        )
        .sort()
        .reverse(); // Most recent first
      
      const mostRecentFile = materialFiles[0];
      
      if (!mostRecentFile) {
        return null;
      }
      
      const filePath = path.join(jobDir, mostRecentFile);
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const parsedData = JSON.parse(fileData);
      
      // Return content if it exists and type matches
      if (parsedData.content && parsedData.type === type) {
        return parsedData.content;
      }
      
      return null;
    } catch (error) {
      // If any error occurs, return null
      return null;
    }
  }

  private loadCachedMaterial(
    jobId: string,
    type: StatementType,
    cvFilePath: string,
    options: StatementOptions
  ): string | null {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        return null;
      }
      
      const cacheKey = this.generateCacheKey(type, cvFilePath, options);
      const files = fs.readdirSync(jobDir);
      
      // Look for cached interview prep files and get the most recent one
      const cacheFiles = files
        .filter(file => 
          file.startsWith(`interview-prep-${type}-${cacheKey}-`) && 
          file.endsWith('.json')
        )
        .sort()
        .reverse(); // Most recent first
      
      const cacheFile = cacheFiles[0];
      
      if (!cacheFile) {
        return null;
      }
      
      const cachePath = path.join(jobDir, cacheFile);
      const cacheData = fs.readFileSync(cachePath, 'utf-8');
      const parsedData = JSON.parse(cacheData);
      
      // Validate cache structure - ensure it has the cache key and correct type
      if (parsedData.content && 
          parsedData.type === type && 
          parsedData.cacheKey === cacheKey) {
        return parsedData.content;
      }
      
      return null;
    } catch (error) {
      // If any error occurs in cache loading, return null to generate fresh content
      return null;
    }
  }

  private cacheMaterial(
    jobId: string,
    type: StatementType,
    content: string,
    cvFilePath: string,
    options: StatementOptions
  ): void {
    try {
      const jobDir = path.resolve('logs', jobId);
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      const cacheKey = this.generateCacheKey(type, cvFilePath, options);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const cacheData = {
        timestamp: new Date().toISOString(),
        jobId,
        type,
        content,
        characterCount: content.length,
        options,
        cvFilePath: path.basename(cvFilePath),
        cacheKey
      };

      const cachePath = path.join(jobDir, `interview-prep-${type}-${cacheKey}-${timestamp}.json`);
      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
      console.log(`📝 Interview material cached to: ${cachePath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to cache interview material: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private cleanResponse(response: string, type: StatementType): string {
    // Remove any markdown formatting or extra text
    let cleaned = response
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
      .trim();

    // For about-me type, preserve bullet formatting
    if (type === 'about-me') {
      return cleaned;
    }

    // For other types, ensure single paragraph format if needed
    if (type === 'general') {
      cleaned = cleaned.replace(/\n\n+/g, ' ').replace(/\n/g, ' ');
    }

    return cleaned;
  }

  async extractThemes(jobId: string): Promise<ThemeExtractionResult> {
    try {
      // Load job data
      const jobData = this.loadJobData(jobId);
      
      // Extract themes using Claude
      const themes = await this.extractJobThemes(jobData);
      
      // Log themes to file
      this.logThemes(jobId, themes);
      
      // Console log themes
      this.displayThemes(themes);
      
      return {
        success: true,
        jobId,
        themes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  private async extractJobThemes(job: JobListing): Promise<JobTheme[]> {
    const prompt = `Analyze the following job posting and extract 3-5 priority themes that are most important for this role. For each theme, provide:
1. A clear, concise name (2-4 words)
2. A brief definition overview (1-2 sentences explaining what this theme means in the context of this role)
3. Importance level (high, medium, low)

Focus on the core competencies, skills, and qualities that would be essential for success in this position.

Job Title: ${job.title}
Company: ${job.company}
Description: ${job.description}

Please respond in the following JSON format:
{
  "themes": [
    {
      "name": "Theme Name",
      "definition": "Brief definition explaining what this theme means for this role...",
      "importance": "high"
    }
  ]
}`;

    console.log('🎯 Extracting priority themes from job description...');
    
    const response = await this.makeClaudeRequest(prompt);
    
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      if (!parsedResponse.themes || !Array.isArray(parsedResponse.themes)) {
        throw new Error('Invalid themes format in response');
      }
      
      return parsedResponse.themes;
    } catch (parseError) {
      console.warn('⚠️  Failed to parse themes response, using fallback');
      // Return fallback themes if parsing fails
      return [
        {
          name: "Technical Expertise",
          definition: "Core technical skills and domain knowledge required for the role.",
          importance: "high" as const
        },
        {
          name: "Leadership & Communication",
          definition: "Ability to lead teams and communicate effectively across stakeholders.",
          importance: "high" as const
        },
        {
          name: "Problem Solving",
          definition: "Analytical thinking and ability to solve complex challenges.",
          importance: "medium" as const
        }
      ];
    }
  }

  private logThemes(jobId: string, themes: JobTheme[]): void {
    try {
      const jobDir = path.resolve('logs', jobId);
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const themeData = {
        timestamp: new Date().toISOString(),
        jobId,
        themes,
        extractedAt: new Date().toISOString()
      };

      const themesPath = path.join(jobDir, `themes-${timestamp}.json`);
      fs.writeFileSync(themesPath, JSON.stringify(themeData, null, 2));
      console.log(`📝 Themes logged to: ${themesPath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to log themes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private displayThemes(themes: JobTheme[]): void {
    console.log('\n🎯 Priority Themes Extracted:');
    console.log('=' .repeat(50));
    
    themes.forEach((theme, index) => {
      const importanceIcon = theme.importance === 'high' ? '🔴' : 
                           theme.importance === 'medium' ? '🟡' : '🟢';
      
      console.log(`\n${index + 1}. ${importanceIcon} ${theme.name} (${theme.importance.toUpperCase()})`);
      console.log(`   ${theme.definition}`);
    });
    
    console.log('\n' + '=' .repeat(50));
  }

  private async getOrExtractThemes(job: JobListing): Promise<JobTheme[]> {
    // First, check if themes already exist for this job
    const existingThemes = this.loadExistingThemes(job.title, job.company);
    
    if (existingThemes && existingThemes.length > 0) {
      console.log('📋 Using existing themes for about-me generation');
      return existingThemes;
    }
    
    // If no existing themes, extract them
    console.log('🎯 No existing themes found, extracting themes for about-me generation...');
    return await this.extractJobThemes(job);
  }

  private loadExistingThemes(jobTitle: string, jobCompany: string): JobTheme[] | null {
    try {
      // Look for theme files that match this job (by checking all job directories)
      const logsDir = path.resolve('logs');
      if (!fs.existsSync(logsDir)) {
        return null;
      }

      const jobDirs = fs.readdirSync(logsDir);
      
      for (const jobDir of jobDirs) {
        const jobDirPath = path.join(logsDir, jobDir);
        if (!fs.statSync(jobDirPath).isDirectory()) continue;

        // Check if this directory has theme files
        const files = fs.readdirSync(jobDirPath);
        const themeFiles = files
          .filter(file => file.startsWith('themes-') && file.endsWith('.json'))
          .sort()
          .reverse(); // Most recent first

        if (themeFiles.length > 0) {
          // Load the most recent theme file and check if it matches this job
          const themeFilePath = path.join(jobDirPath, themeFiles[0]);
          const themeData = JSON.parse(fs.readFileSync(themeFilePath, 'utf-8'));
          
          // Check if we can find a job file in the same directory to compare
          const jobFiles = files.filter(file => file.startsWith('job-') && file.endsWith('.json'));
          if (jobFiles.length > 0) {
            const jobFilePath = path.join(jobDirPath, jobFiles[0]);
            const jobData = JSON.parse(fs.readFileSync(jobFilePath, 'utf-8'));
            
            // If title and company match, use these themes
            if (jobData.title === jobTitle && jobData.company === jobCompany) {
              return themeData.themes;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️  Failed to load existing themes, will extract new ones');
      return null;
    }
  }

  private injectThemesIntoPrompt(promptTemplate: string, themes: JobTheme[]): string {
    // Create a formatted list of themes to inject
    const themesList = themes
      .map((theme, index) => `${index + 1}. **${theme.name}**: ${theme.definition}`)
      .join('\n');
    
    // Replace the line about extracting themes with a directive to use the provided themes
    const updatedPrompt = promptTemplate.replace(
      '1. Extract 2-4 priority themes from the job description',
      `1. Use the following priority themes that have been extracted from the job description:\n\n${themesList}\n\nFocus on the themes marked as "high" importance first, then include medium importance themes if space allows.`
    );
    
    return updatedPrompt;
  }

}