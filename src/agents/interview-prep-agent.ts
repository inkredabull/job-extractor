import { ClaudeBaseAgent } from './claude-base-agent';
import { JobListing, AgentConfig, StatementType, StatementOptions, StatementResult, JobTheme, ThemeExtractionResult, ThemeExample, ProfileConfig, ProfileResult, ProjectInfo, ProjectExtractionResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class InterviewPrepAgent extends ClaudeBaseAgent {
  private currentJobId: string = '';
  private profileConfig: ProfileConfig = {
    location: "hybrid in/near SF",
    role: "I'm a hands-on leader who still builds",
    preferredStack: ["React", "Python", "TypeScript", "GCP"],
    teamSize: "3-5 Sr. EM/Staff-level full-stack direct reports",
    domains: ["MarTech", "FinTech", "ClimateTech"],
    domainOfExcellence: "SaaS and data-driven products"
  };

  constructor(claudeApiKey: string, model?: string, maxTokens?: number) {
    super(claudeApiKey, model, maxTokens);
  }

  private getMinSalary(): number {
    const envSalary = process.env.MIN_SALARY;
    if (envSalary) {
      const parsedSalary = parseInt(envSalary, 10);
      if (!isNaN(parsedSalary)) {
        return parsedSalary;
      }
    }
    // Fallback to a default if not set in environment
    return 225000;
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
      // Store jobId for use in sub-methods
      this.currentJobId = jobId;
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
      const themesWithExamples = await this.enrichThemesWithExamples(themes, cvContent, job);
      // Get jobId from the generateMaterial caller context
      const actualJobId = this.currentJobId;
      await this.updateThemesWithExamples(job, themesWithExamples, actualJobId);
      promptTemplate = this.injectThemesIntoPrompt(promptTemplate, themesWithExamples);
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

  private async enrichThemesWithExamples(themes: JobTheme[], cvContent: string, job: JobListing): Promise<JobTheme[]> {
    console.log('🔍 Analyzing CV examples for each theme...');
    
    const prompt = `Analyze the provided CV content and identify 1-2 specific, quantifiable examples for each theme that demonstrate the candidate's relevant experience. For each example, extract:

1. The specific text/achievement from the CV
2. The source section (which job/project it came from)
3. The quantified impact/result

Additionally, identify the 2-3 BEST examples overall that demonstrate the highest professional impact and would make compelling interview stories.

Themes to match:
${themes.map((theme, index) => `${index + 1}. **${theme.name}**: ${theme.definition}`).join('\n')}

CV Content:
${cvContent}

Respond in this JSON format:
{
  "themeExamples": [
    {
      "themeName": "Theme Name",
      "examples": [
        {
          "text": "Specific achievement from CV",
          "source": "Company/Role where this happened",
          "impact": "Quantified result (e.g., '35% improvement', '$1M revenue')"
        }
      ]
    }
  ],
  "highlightedExamples": [
    {
      "text": "Most impactful achievement",
      "source": "Source role/company",
      "impact": "Quantified impact",
      "isHighlighted": true
    }
  ],
  "interviewStories": [
    "Brief story description suitable for STAR method interview response..."
  ]
}`;

    const response = await this.makeClaudeRequest(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️  Failed to extract examples, using themes without examples');
        return themes;
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Merge examples back into themes
      const enrichedThemes = themes.map(theme => {
        const themeData = parsedResponse.themeExamples?.find(
          (te: any) => te.themeName === theme.name
        );
        
        return {
          ...theme,
          examples: themeData?.examples || []
        };
      });
      
      // Store highlighted examples and stories for later use
      this.tempHighlightedExamples = parsedResponse.highlightedExamples || [];
      this.tempInterviewStories = parsedResponse.interviewStories || [];
      
      return enrichedThemes;
    } catch (parseError) {
      console.warn('⚠️  Failed to parse examples response, using themes without examples');
      return themes;
    }
  }

  private tempHighlightedExamples: ThemeExample[] = [];
  private tempInterviewStories: string[] = [];

  private async updateThemesWithExamples(job: JobListing, themesWithExamples: JobTheme[], actualJobId?: string): Promise<void> {
    try {
      const jobId = actualJobId || this.currentJobId;
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      // Find the most recent themes file
      const files = fs.readdirSync(jobDir);
      const themeFiles = files
        .filter(file => file.startsWith('themes-') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (themeFiles.length > 0) {
        // Update the most recent themes file
        const themeFilePath = path.join(jobDir, themeFiles[0]);
        const existingData = JSON.parse(fs.readFileSync(themeFilePath, 'utf-8'));
        
        const updatedData = {
          ...existingData,
          themes: themesWithExamples,
          highlightedExamples: this.tempHighlightedExamples,
          interviewStories: this.tempInterviewStories,
          lastEnrichedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(themeFilePath, JSON.stringify(updatedData, null, 2));
        console.log(`📝 Updated themes file with examples: ${themeFilePath}`);
      } else {
        // Create new themes file with examples
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const themeData = {
          timestamp: new Date().toISOString(),
          jobId,
          themes: themesWithExamples,
          highlightedExamples: this.tempHighlightedExamples,
          interviewStories: this.tempInterviewStories,
          extractedAt: new Date().toISOString()
        };

        const themesPath = path.join(jobDir, `themes-${timestamp}.json`);
        fs.writeFileSync(themesPath, JSON.stringify(themeData, null, 2));
        console.log(`📝 Created themes file with examples: ${themesPath}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to update themes with examples: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getJobIdFromJob(job: JobListing): string {
    // Try to derive jobId from the job data
    // This is a simple approach - in practice, you might want to store jobId with the job data
    const crypto = require('crypto');
    const jobString = `${job.title}-${job.company}`;
    return crypto.createHash('md5').update(jobString).digest('hex').substring(0, 8);
  }

  private injectThemesIntoPrompt(promptTemplate: string, themes: JobTheme[]): string {
    // Create a formatted list of themes to inject, including examples
    const themesList = themes
      .map((theme, index) => {
        let themeText = `${index + 1}. **${theme.name}**: ${theme.definition}`;
        
        if (theme.examples && theme.examples.length > 0) {
          themeText += '\n   Examples from CV:';
          theme.examples.forEach((example, exIndex) => {
            themeText += `\n   - ${example.text} (${example.impact})`;
          });
        }
        
        return themeText;
      })
      .join('\n\n');
    
    // Replace the line about extracting themes with a directive to use the provided themes
    const updatedPrompt = promptTemplate.replace(
      '1. Use the priority themes provided (these have been automatically extracted from the job description)',
      `1. Use the following priority themes and their associated examples from the candidate's CV:\n\n${themesList}\n\nUse the provided examples to craft compelling bullet points. Focus on the themes marked as "high" importance first, then include medium importance themes if space allows.`
    );
    
    return updatedPrompt;
  }

  async getInterviewStories(jobId: string): Promise<{ success: boolean; stories?: string[]; highlightedExamples?: ThemeExample[]; error?: string }> {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        return { success: false, error: 'Job directory not found' };
      }

      const files = fs.readdirSync(jobDir);
      const themeFiles = files
        .filter(file => file.startsWith('themes-') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (themeFiles.length === 0) {
        return { success: false, error: 'No themes file found. Run theme extraction first.' };
      }

      const themeFilePath = path.join(jobDir, themeFiles[0]);
      const themeData = JSON.parse(fs.readFileSync(themeFilePath, 'utf-8'));

      if (!themeData.interviewStories && !themeData.highlightedExamples) {
        return { success: false, error: 'No interview stories found. Run about-me generation to extract stories.' };
      }

      return {
        success: true,
        stories: themeData.interviewStories || [],
        highlightedExamples: themeData.highlightedExamples || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Profile Generation Methods (TypeScript versions of Google Apps Script)
  
  private where(): string {
    return this.profileConfig.location;
  }

  private who(): string {
    return this.profileConfig.role;
  }

  private focus(): string {
    return [
      "My track record is in",
      this.profileConfig.domainOfExcellence,
      "but I've been self-teaching around GenAI and am excited about",
      this.profileConfig.domains.join('/') + "."
    ].join(' ');
  }

  private why(): string {
    return [
      `Ideal team-size is ${this.profileConfig.teamSize}.`,
      `Ideal stack includes ${this.profileConfig.preferredStack.join('/')} on ${this.profileConfig.preferredStack.includes('GCP') ? 'GCP' : 'cloud'}.`
    ].join(" ");
  }

  private whatAndWhere(): string {
    const minSalary = this.getMinSalary();
    return [
      "looking for a full-time role ",
      "leading full-stack development as CTO/HoE/VPE at Seed/Series A or as DIR/Sr. EM at later stage",
      ", preferably " + this.where() + ". ",
      `Min base salary of $${(minSalary / 1000)}K; more if 5d/in-office. `,
      this.focus(), " "
    ].join('');
  }

  private generateProfile(): string {
    let result = '';
    result += this.who() + " ";
    result += this.whatAndWhere() + " ";
    result += this.why() + " ";
    return result.trim();
  }

  async createProfile(): Promise<ProfileResult> {
    try {
      const profile = this.generateProfile();
      const googleScript = this.transpileToGoogleScript();
      
      // Save to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const profilePath = path.resolve('logs', `profile-${timestamp}.txt`);
      const scriptPath = path.resolve('logs', `google-script-${timestamp}.js`);
      
      fs.writeFileSync(profilePath, profile);
      fs.writeFileSync(scriptPath, googleScript);
      
      console.log(`📝 Profile saved to: ${profilePath}`);
      console.log(`📄 Google Script saved to: ${scriptPath}`);
      console.log('📋 Google Script ready to copy-paste into Apps Script');
      
      return {
        success: true,
        profile,
        googleScript
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private transpileToGoogleScript(): string {
    const config = this.profileConfig;
    const minSalary = this.getMinSalary();
    
    return `function where() {
  return "${config.location}";
}

function who() {
  return "${config.role}";
}

function whatAndWhere() {
  return [
    "looking for a full-time role ", 
    "leading full-stack development as CTO/HoE/VPE at Seed/Series A or as DIR/Sr. EM at later stage",
    ", preferably " + where() + ". ",
    "Min base salary of $${(minSalary / 1000)}K; more if 5d/in-office. ",
    focus(), " "
  ].join('');
}

function why() {
  return [
    "Ideal team-size is ${config.teamSize}.",
    "Ideal stack includes ${config.preferredStack.join('/')} on ${config.preferredStack.includes('GCP') ? 'GCP' : 'cloud'}."
  ].join(" ");
}

const DOMAINS = [
  ${config.domains.map(d => `'${d}'`).join(',\n  ')}
];

// const domainOfExcellence = "${config.domainOfExcellence}";

function focus() {
  return [
    "My track record is in",
    domainOfExcellence,
    "but I've been self-teaching around GenAI and am excited about",
    DOMAINS.join('/') + "."
  ].join(' ');
}

function cmf2() {
  var result = '';
  
  result += who() + " ";
  result += whatAndWhere() + " ";
  result += why() + " ";
  
  console.log(result);
  return result;
}`;
  }

  updateProfileConfig(config: Partial<ProfileConfig>): void {
    this.profileConfig = { ...this.profileConfig, ...config };
  }

  getProfileConfig(): ProfileConfig {
    return { ...this.profileConfig };
  }

  async extractProject(jobId: string, projectIndex: number): Promise<ProjectExtractionResult> {
    try {
      // Load themes data for the job
      const themesData = this.loadThemesData(jobId);
      if (!themesData) {
        return {
          success: false,
          error: 'No themes data found for this job ID. Run theme extraction first.'
        };
      }

      // Extract project from examples
      const project = this.extractProjectFromExamples(themesData, projectIndex);
      if (!project) {
        return {
          success: false,
          error: `Project ${projectIndex} not found in themes data. Available projects: ${this.getAvailableProjectsCount(themesData)}`
        };
      }

      // Format for form fields
      const formattedOutput = this.formatProjectForForm(project);

      return {
        success: true,
        project,
        formattedOutput
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private loadThemesData(jobId: string): any {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      if (!fs.existsSync(jobDir)) {
        return null;
      }

      const files = fs.readdirSync(jobDir);
      const themeFiles = files
        .filter(file => file.startsWith('themes-') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (themeFiles.length === 0) {
        return null;
      }

      const themeFilePath = path.join(jobDir, themeFiles[0]);
      const themeData = JSON.parse(fs.readFileSync(themeFilePath, 'utf-8'));

      return themeData;
    } catch (error) {
      return null;
    }
  }

  private extractProjectFromExamples(themesData: any, projectIndex: number): ProjectInfo | null {
    const allExamples: (ThemeExample & { themeName?: string })[] = [];
    
    // Collect all examples from all themes
    if (themesData.themes) {
      themesData.themes.forEach((theme: JobTheme) => {
        if (theme.examples) {
          theme.examples.forEach((example: ThemeExample) => {
            allExamples.push({
              ...example,
              themeName: theme.name
            });
          });
        }
      });
    }

    // Add highlighted examples
    if (themesData.highlightedExamples) {
      themesData.highlightedExamples.forEach((example: ThemeExample) => {
        allExamples.push({
          ...example,
          isHighlighted: true
        });
      });
    }

    if (projectIndex < 1 || projectIndex > allExamples.length) {
      return null;
    }

    const selectedExample = allExamples[projectIndex - 1];
    return this.convertExampleToProject(selectedExample);
  }

  private convertExampleToProject(example: ThemeExample & { themeName?: string }): ProjectInfo {
    // Parse company and role from source field
    const sourceMatch = example.source.match(/(.*?)\s*@\s*(.*)/);
    const role = sourceMatch ? sourceMatch[1].trim() : 'Senior Engineer';
    const company = sourceMatch ? sourceMatch[2].trim() : example.source;

    // Generate project components
    const title = this.generateProjectTitle(example.text);
    const industry = this.mapToIndustry(company, example.text);
    const projectType = this.mapToProjectType(example.text);
    const duration = this.mapToDuration(example.text);
    const organizationSize = this.estimateOrganizationSize(example.text, company);
    const functionArea = this.mapToFunction(role, example.text);
    const location = this.estimateLocation(company);
    
    // Parse Problem-Action-Result structure
    const { problem, action, result } = this.parseProjectSummary(example.text, example.impact);

    return {
      title,
      industry,
      projectType,
      duration,
      organizationSize,
      function: functionArea,
      location,
      problem,
      action,
      result
    };
  }

  private mapToIndustry(company: string, text: string): string {
    const companyLower = company.toLowerCase();
    const textLower = text.toLowerCase();
    
    // SaaS/Technology companies
    if (companyLower.includes('myna') || companyLower.includes('coursekey') || 
        textLower.includes('saas') || textLower.includes('platform')) {
      return 'Technology/SaaS';
    }
    
    // E-commerce/Retail
    if (companyLower.includes('decorist') || textLower.includes('marketplace') ||
        textLower.includes('e-commerce') || textLower.includes('retail')) {
      return 'E-commerce/Retail';
    }
    
    // AI/Machine Learning
    if (textLower.includes('ai') || textLower.includes('llm') || textLower.includes('genai')) {
      return 'Artificial Intelligence';
    }
    
    // Default
    return 'Technology';
  }

  private mapToProjectType(text: string): string {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('transform') || textLower.includes('restructur') || textLower.includes('organization')) {
      return 'Organizational Transformation';
    } else if (textLower.includes('ai') || textLower.includes('llm') || textLower.includes('genai')) {
      return 'Technology Implementation';
    } else if (textLower.includes('platform') || textLower.includes('system') || textLower.includes('architecture')) {
      return 'Platform Development';
    } else if (textLower.includes('security') || textLower.includes('cve')) {
      return 'Security Enhancement';
    } else if (textLower.includes('team') || textLower.includes('leadership') || textLower.includes('scale')) {
      return 'Team Development';
    } else if (textLower.includes('process') || textLower.includes('workflow') || textLower.includes('efficiency')) {
      return 'Process Improvement';
    } else {
      return 'Strategic Initiative';
    }
  }

  private mapToDuration(text: string): '0-6 Months' | '6-12 Months' | '12-24 Months' | '24+ Months' {
    const textLower = text.toLowerCase();
    
    // Look for specific time indicators
    if (textLower.includes('quarter') || textLower.includes('3 month')) {
      return '0-6 Months';
    } else if (textLower.includes('year') || textLower.includes('12 month')) {
      return '6-12 Months';
    } else if (textLower.includes('18 month') || textLower.includes('2 year')) {
      return '12-24 Months';
    } else if (textLower.includes('multi-year') || textLower.includes('long-term')) {
      return '24+ Months';
    }
    
    // Default based on project complexity
    if (textLower.includes('transform') || textLower.includes('restructur')) {
      return '6-12 Months';
    } else {
      return '0-6 Months';
    }
  }

  private estimateOrganizationSize(text: string, company: string): string {
    const textLower = text.toLowerCase();
    const companyLower = company.toLowerCase();
    
    // Look for team size indicators
    if (textLower.includes('32') || textLower.includes('50')) {
      return 'Large (1000+ employees)';
    } else if (textLower.includes('19') || textLower.includes('20')) {
      return 'Medium (100-999 employees)';
    } else if (companyLower.includes('startup') || companyLower.includes('seed') || textLower.includes('small team')) {
      return 'Small (10-99 employees)';
    }
    
    // Company-specific knowledge
    if (companyLower.includes('myna') || companyLower.includes('coursekey')) {
      return 'Small (10-99 employees)';
    } else if (companyLower.includes('decorist')) {
      return 'Medium (100-999 employees)';
    }
    
    return 'Medium (100-999 employees)';
  }

  private mapToFunction(role: string, text: string): string {
    const roleLower = role.toLowerCase();
    const textLower = text.toLowerCase();
    
    if (roleLower.includes('cto') || roleLower.includes('chief')) {
      return 'Executive Leadership';
    } else if (roleLower.includes('vp') || roleLower.includes('vice president')) {
      return 'Senior Management';
    } else if (roleLower.includes('director') || roleLower.includes('head')) {
      return 'Management';
    } else if (textLower.includes('engineering') || textLower.includes('technical')) {
      return 'Engineering';
    } else if (textLower.includes('product')) {
      return 'Product Management';
    } else {
      return 'Technology';
    }
  }

  private estimateLocation(company: string): string {
    // For now, default to remote/hybrid as that's common for tech roles
    // Could be enhanced with company-specific data
    return 'Remote/Hybrid';
  }

  private parseProjectSummary(text: string, impact: string): { problem: string; action: string; result: string } {
    // Try to parse the example text into Problem-Action-Result structure
    const textLower = text.toLowerCase();
    
    let problem = '';
    let action = '';
    let result = impact;
    
    // Identify problem indicators
    if (textLower.includes('transform') || textLower.includes('restructur')) {
      problem = 'Organization structure was inefficient and limiting productivity';
      action = text;
    } else if (textLower.includes('security') || textLower.includes('cve')) {
      problem = 'Security vulnerabilities needed systematic remediation';
      action = text;
    } else if (textLower.includes('ai') || textLower.includes('llm') || textLower.includes('genai')) {
      problem = 'Manual processes required automation to improve efficiency';
      action = text;
    } else if (textLower.includes('platform') || textLower.includes('system')) {
      problem = 'System architecture needed modernization for scale';
      action = text;
    } else {
      // Generic case
      problem = 'Organization needed technical leadership to drive strategic initiatives';
      action = text;
    }
    
    return { problem, action, result };
  }

  private generateProjectTitle(text: string): string {
    // Try to extract a meaningful title from the text
    if (text.includes('LLM') || text.includes('GenAI') || text.includes('AI')) {
      return 'AI/LLM Implementation Project';
    } else if (text.includes('transform') || text.includes('restructur')) {
      return 'Engineering Transformation Initiative';
    } else if (text.includes('platform') || text.includes('system')) {
      return 'Platform Development Project';
    } else if (text.includes('security') || text.includes('CVE')) {
      return 'Security Enhancement Project';
    } else if (text.includes('team') || text.includes('organization')) {
      return 'Team Leadership & Scaling';
    } else {
      return 'Strategic Engineering Initiative';
    }
  }


  private getAvailableProjectsCount(themesData: any): number {
    let count = 0;
    
    if (themesData.themes) {
      themesData.themes.forEach((theme: JobTheme) => {
        if (theme.examples) {
          count += theme.examples.length;
        }
      });
    }

    if (themesData.highlightedExamples) {
      count += themesData.highlightedExamples.length;
    }

    return count;
  }

  private formatProjectForForm(project: ProjectInfo): string {
    return `Project Title:
${project.title}

Industry:
${project.industry}

Project Type:
${project.projectType}

Project Duration:
${project.duration}

Size of Organization:
${project.organizationSize}

Function:
${project.function}

Location:
${project.location}

Project Summary Problem:
${project.problem}

Project Summary Action:
${project.action}

Project Summary Result:
${project.result}`;
  }

  async listAvailableProjects(jobId: string): Promise<{ success: boolean; projects?: string[]; count?: number; error?: string }> {
    try {
      const themesData = this.loadThemesData(jobId);
      if (!themesData) {
        return {
          success: false,
          error: 'No themes data found for this job ID. Run theme extraction first.'
        };
      }

      const projects: string[] = [];
      let index = 1;

      // List examples from themes
      if (themesData.themes) {
        themesData.themes.forEach((theme: JobTheme) => {
          if (theme.examples) {
            theme.examples.forEach((example: ThemeExample) => {
              const title = this.generateProjectTitle(example.text);
              const company = example.source.includes('@') ? example.source.split('@')[1].trim() : example.source;
              projects.push(`${index}. ${title} (${company})`);
              index++;
            });
          }
        });
      }

      // List highlighted examples
      if (themesData.highlightedExamples) {
        themesData.highlightedExamples.forEach((example: ThemeExample) => {
          const title = this.generateProjectTitle(example.text);
          const company = example.source.includes('@') ? example.source.split('@')[1].trim() : example.source;
          projects.push(`${index}. ${title} (${company}) [HIGHLIGHTED]`);
          index++;
        });
      }

      return {
        success: true,
        projects,
        count: projects.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

}
