import { BaseAgent } from './base-agent';
import { JobListing, ExtractorResult, AgentConfig } from '../types';
import { WebScraper } from '../utils/web-scraper';
import { TealTracker, getTealCredentials } from '../integrations/teal-tracker';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class JobExtractorAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async extract(url: string, options?: { ignoreCompetition?: boolean }): Promise<ExtractorResult> {
    try {
      // Fetch HTML
      const html = await WebScraper.fetchHtml(url);
      
      // Check applicant count first - early exit if too competitive (unless overridden)
      const applicantInfo = this.extractApplicantCount(html);
      if (applicantInfo.shouldExit && !options?.ignoreCompetition) {
        console.log(`🚫 Job has ${applicantInfo.count} applicants (>${applicantInfo.threshold}) - skipping due to high competition`);
        return {
          success: false,
          error: `Too many applicants (${applicantInfo.count}) - competition level too high`,
          competitionReason: {
            applicantCount: applicantInfo.count,
            threshold: applicantInfo.threshold,
            competitionLevel: applicantInfo.competitionLevel
          }
        };
      }
      
      // If competition would normally block extraction but was overridden, log it
      if (applicantInfo.shouldExit && options?.ignoreCompetition) {
        console.log(`⚠️  Job has ${applicantInfo.count} applicants (>${applicantInfo.threshold}) - extracting anyway due to --force-extract flag`);
      }
      
      // If applicant count detected but within threshold, log it
      if (applicantInfo.count > 0) {
        console.log(`👥 ${applicantInfo.count} applicants detected - competition level: ${applicantInfo.competitionLevel}`);
      }
      
      // Extract job data from HTML/structured data
      const jobData = await this.extractJobDataFromHtml(html, applicantInfo);
      
      // Post to Teal using Puppeteer
      await this.postToTealViaPuppeteer(jobData, url);
      
      // Generate job ID and save locally
      const jobId = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create job-specific subdirectory
      const jobDir = path.join('logs', jobId);
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }
      
      const logFileName = `job-${timestamp}.json`;
      const logFilePath = path.join(jobDir, logFileName);

      // Save JSON to log file
      const jobDataWithSource = { ...jobData, source: "extracted" };
      const jsonOutput = JSON.stringify(jobDataWithSource, null, 2);
      fs.writeFileSync(logFilePath, jsonOutput, 'utf-8');
      console.log(`✅ Job information logged to ${logFilePath}`);

      return {
        success: true,
        data: jobDataWithSource,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private createExtractionPrompt(html: string): string {
    return `
Extract job information from the following HTML content and return it as a JSON object that matches this exact schema:

{
  "title": "job title",
  "company": "company name",
  "location": "job location",
  "description": "full job description text",
  "salary": {
    "min": "minimum salary if available",
    "max": "maximum salary if available", 
    "currency": "currency code (e.g., USD, EUR)"
  }
}

Rules:
- Return ONLY valid JSON, no other text or markdown
- If salary information is not available, omit the salary field entirely
- If only one salary value is provided, use it as both min and max
- Extract the complete job description including responsibilities, requirements, and benefits
- Use the exact company name as it appears on the page
- For location, use the format "City, State" or "City, Country"

HTML Content:
${html.slice(0, 8000)}...

JSON:`;
  }

  private extractApplicantCount(html: string): { count: number; shouldExit: boolean; threshold: number; competitionLevel: 'low' | 'medium' | 'high' | 'extreme' } {
    const threshold = 200;
    let count = 0;
    let competitionLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';

    // Look for applicant count in HTML

    // patterns - enhanced with more variations
    const sourcePatterns = [
      /(\d{1,3}(?:,\d{3})*)\s+(?:candidates?\s+who\s+)?clicked\s+apply/i,
      /(\d{1,3}(?:,\d{3})*)\s+applicants?/i,
      /Over\s+(\d{1,3}(?:,\d{3})*)\s+(?:candidates?\s+who\s+)?clicked\s+apply/i,
      /(\d{1,3}(?:,\d{3})*)\s+people\s+clicked\s+apply/i,
      /Be\s+among\s+the\s+first\s+(\d+)\s+applicants?/i,
      /(\d{1,3}(?:,\d{3})*)\s+candidates?/i,
      /(\d{1,3}(?:,\d{3})*)\s+(?:people\s+)?applied/i
    ];
    
    // Special handling for "Over X" cases - treat as minimum estimate
    const overPattern = /Over\s+(\d{1,3}(?:,\d{3})*)\s+(?:appli|candidate)/i;
    const overMatch = html.match(overPattern);
    if (overMatch && overMatch[1]) {
      const overCount = parseInt(overMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(overCount)) {
        // For "Over X" cases, multiply by a conservative factor to estimate real count
        // "Over 200" likely means 300-2000+ applicants, so use conservative 2x multiplier
        count = Math.max(overCount * 2, 300); 
        console.log(`📊 Detected "Over ${overCount}" → estimated ${count} applicants (high competition)`);
      }
    }

    // Indeed patterns
    const indeedPatterns = [
      /(\d{1,3}(?:,\d{3})*)\s+applicants?/i,
      /Applied\s+by\s+(\d{1,3}(?:,\d{3})*)\s+people/i
    ];

    // Try all patterns only if we haven't found an "Over X" case
    if (count === 0) {
      const allPatterns = [...sourcePatterns, ...indeedPatterns];
      
      for (let i = 0; i < allPatterns.length; i++) {
        const pattern = allPatterns[i];
        const match = html.match(pattern);
        if (match && match[1]) {
          const foundCount = parseInt(match[1].replace(/,/g, ''), 10);
          if (!isNaN(foundCount)) {
            count = foundCount;
            break;
          }
        }
      }
    }

    // Determine competition level
    if (count === 0) {
      competitionLevel = 'low';
    } else if (count <= 50) {
      competitionLevel = 'low';
    } else if (count <= 200) {
      competitionLevel = 'medium';
    } else if (count <= 500) {
      competitionLevel = 'high';
    } else {
      competitionLevel = 'extreme';
    }

    const shouldExit = count > threshold;

    return {
      count,
      shouldExit,
      threshold,
      competitionLevel
    };
  }

  private parseStructuredData(jsonLd: any, applicantInfo?: { count: number; competitionLevel: 'low' | 'medium' | 'high' | 'extreme' }): JobListing {
    try {
      // Extract fields from JSON-LD JobPosting
      let location = this.extractLocation(jsonLd.jobLocation);
      
      // Handle remote work designation
      if (jsonLd.jobLocationType === 'TELECOMMUTE' || jsonLd.jobLocationType === 'REMOTE') {
        if (location && location !== 'United States') {
          location = `Remote (${location})`;
        } else {
          location = 'Remote';
        }
      }
      
      // Clean up HTML description if present
      let description = jsonLd.description || '';
      if (description.includes('<')) {
        // Simple HTML tag removal - convert HTML to plain text
        description = description
          .replace(/<[^>]*>/g, ' ')                    // Remove HTML tags
          .replace(/&nbsp;/g, ' ')                     // Replace &nbsp; with space
          .replace(/&amp;/g, '&')                      // Replace &amp; with &
          .replace(/&lt;/g, '<')                       // Replace &lt; with <
          .replace(/&gt;/g, '>')                       // Replace &gt; with >
          .replace(/&quot;/g, '"')                     // Replace &quot; with "
          .replace(/\s+/g, ' ')                        // Normalize whitespace
          .trim();
      }
      
      const jobData: JobListing = {
        title: jsonLd.title || jsonLd.identifier?.name || '',
        company: jsonLd.hiringOrganization?.name || '',
        location: location,
        description: description,
      };

      // Add applicant information if available
      if (applicantInfo && applicantInfo.count > 0) {
        jobData.applicantCount = applicantInfo.count;
        jobData.competitionLevel = applicantInfo.competitionLevel;
      }

      // Always include salary structure, even if empty
      let salaryFound = false;
      
      // Extract salary if available in structured data
      if (jsonLd.baseSalary || jsonLd.salary) {
        const salaryData = jsonLd.baseSalary || jsonLd.salary;
        const minValue = salaryData.value?.minValue || salaryData.minValue;
        const maxValue = salaryData.value?.maxValue || salaryData.maxValue;
        
        if (minValue || maxValue) {
          jobData.salary = {
            min: minValue || '',
            max: maxValue || '',
            currency: salaryData.currency || 'USD',
          };
          salaryFound = true;
        }
      }
      
      if (!salaryFound) {
        // Fallback: try to extract salary from description text
        const salaryFromDescription = this.extractSalaryFromText(jobData.description);
        if (salaryFromDescription) {
          jobData.salary = salaryFromDescription;
          salaryFound = true;
        }
      }
      
      // If no salary found, include empty salary structure
      if (!salaryFound) {
        jobData.salary = {
          min: '',
          max: '',
          currency: 'USD'
        };
      }

      // Validate required fields
      if (!jobData.title || !jobData.company || !jobData.location || !jobData.description) {
        throw new Error('Missing required fields in structured data');
      }

      return jobData;
    } catch (error) {
      throw new Error(`Failed to parse structured data: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  private extractLocation(jobLocation: any): string {
    if (!jobLocation) return '';
    
    if (typeof jobLocation === 'string') return jobLocation;
    
    if (jobLocation.address) {
      const address = jobLocation.address;
      if (address.addressLocality && address.addressRegion) {
        return `${address.addressLocality}, ${address.addressRegion}`;
      }
      if (address.addressLocality) {
        return address.addressLocality;
      }
      if (address.addressRegion && address.addressCountry) {
        return `${address.addressRegion}, ${address.addressCountry}`;
      }
      if (address.addressCountry) {
        return address.addressCountry;
      }
    }
    
    return jobLocation.name || '';
  }

  private extractSalaryFromText(description: string): { min: string; max: string; currency: string } | null {
    if (!description) return null;

    // Pattern to match salary ranges like "$248,700 - $342,000" or "Hiring Range: $248,700 - $342,000"
    const salaryRangePatterns = [
      /(?:Hiring Range|Salary Range|Range|Compensation):\s*\$?([\d,]+)(?:\s*-\s*|\s+to\s+)\$?([\d,]+)/i,
      /\$?([\d,]+)(?:\s*-\s*|\s+to\s+)\$?([\d,]+)(?:\s+(?:USD|per year|annually))?/i,
      /(?:between|from)\s+\$?([\d,]+)(?:\s*-\s*|\s+to\s+|\s+and\s+)\$?([\d,]+)/i
    ];

    // Pattern to match single salary values
    const singleSalaryPatterns = [
      /(?:Salary|Compensation|Pay):\s*\$?([\d,]+)/i,
      /\$?([\d,]+)(?:\s+(?:USD|per year|annually))/i
    ];

    // Try salary range patterns first
    for (const pattern of salaryRangePatterns) {
      const match = description.match(pattern);
      if (match && match[1] && match[2]) {
        return {
          min: `$${match[1].replace(/,/g, '')}`,
          max: `$${match[2].replace(/,/g, '')}`,
          currency: 'USD'
        };
      }
    }

    // Try single salary patterns
    for (const pattern of singleSalaryPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        const salary = `$${match[1].replace(/,/g, '')}`;
        return {
          min: salary,
          max: salary,
          currency: 'USD'
        };
      }
    }

    return null;
  }

  private parseJobData(response: string, applicantInfo?: { count: number; competitionLevel: 'low' | 'medium' | 'high' | 'extreme' }): JobListing {
    try {
      // Clean the response to extract JSON - try multiple approaches
      let jsonStr = '';
      
      // Approach 1: Look for complete JSON object with balanced braces
      const braceMatch = this.extractBalancedJson(response);
      if (braceMatch) {
        jsonStr = braceMatch;
      } else {
        // Approach 2: Try to fix incomplete JSON by finding opening brace and attempting repair
        const openBraceIndex = response.indexOf('{');
        if (openBraceIndex !== -1) {
          let jsonPart = response.substring(openBraceIndex);
          
          // If JSON appears truncated (no closing brace), try to complete it
          if (!jsonPart.includes('}')) {
            // Add missing closing braces for common truncation patterns
            const fieldCount = (jsonPart.match(/"/g) || []).length / 2; // Rough estimate of field count
            if (fieldCount >= 4) { // If we have at least 2 complete fields
              jsonPart += '"}'; // Close the last field and object
            }
          }
          
          jsonStr = jsonPart;
        } else {
          // Approach 3: Look for JSON between ```json blocks
          const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
          } else {
            console.log('🔍 LLM Response for debugging:', response.substring(0, 800));
            throw new Error('No JSON found in response');
          }
        }
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        // If JSON parsing fails, try to extract partial data
        console.log('⚠️  JSON parsing failed, attempting partial extraction...');
        console.log('📄 Raw JSON string:', jsonStr.substring(0, 300));
        
        // Try to extract at least title, company, location from partial JSON
        const partialData = this.extractPartialJobData(jsonStr);
        if (partialData) {
          parsed = partialData;
        } else {
          throw parseError;
        }
      }

      // Validate required fields
      if (!parsed.title || !parsed.company || !parsed.location) {
        throw new Error('Missing required fields in extracted data');
      }

      // Ensure description exists, even if partial
      if (!parsed.description) {
        parsed.description = 'Job description not fully extracted due to response truncation.';
      }

      // Add applicant information if available
      if (applicantInfo && applicantInfo.count > 0) {
        parsed.applicantCount = applicantInfo.count;
        parsed.competitionLevel = applicantInfo.competitionLevel;
      }

      // Ensure salary structure always exists, even if empty
      if (!parsed.salary) {
        parsed.salary = {
          min: '',
          max: '',
          currency: 'USD'
        };
      }

      return parsed as JobListing;
    } catch (error) {
      throw new Error(`Failed to parse job data: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  private extractBalancedJson(text: string): string | null {
    // Find the first opening brace
    const startIndex = text.indexOf('{');
    if (startIndex === -1) return null;

    let braceCount = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            // Found the closing brace
            return text.substring(startIndex, i + 1);
          }
        }
      }
    }

    return null; // No balanced JSON found
  }

  private extractPartialJobData(jsonStr: string): JobListing | null {
    try {
      // Try to extract key fields using regex patterns even from broken JSON
      const titleMatch = jsonStr.match(/"title"\s*:\s*"([^"]+)"/);
      const companyMatch = jsonStr.match(/"company"\s*:\s*"([^"]+)"/);
      const locationMatch = jsonStr.match(/"location"\s*:\s*"([^"]+)"/);
      const descriptionMatch = jsonStr.match(/"description"\s*:\s*"([^"]*)/);

      if (titleMatch && companyMatch && locationMatch) {
        return {
          title: titleMatch[1],
          company: companyMatch[1],
          location: locationMatch[1],
          description: descriptionMatch ? descriptionMatch[1] : 'Description truncated due to response limit.',
          salary: {
            min: '',
            max: '',
            currency: 'USD'
          }
        };
      }
    } catch (error) {
      console.warn('Failed to extract partial job data:', error);
    }
    
    return null;
  }

  async extractRequiredTerms(description: string): Promise<string[]> {
    try {
      const prompt = `Analyze the following job description and extract 10-15 key terms and phrases that are essential requirements for this role. Focus on:
- Technical skills and technologies
- Programming languages and frameworks
- Tools and platforms
- Methodologies and practices
- Certifications or specific knowledge areas
- Years of experience requirements
- Key responsibilities that are critical

Return ONLY a JSON array of strings, with each string being a key term or phrase. Be specific and avoid generic terms.

Job Description:
${description}

Response format: ["term1", "term2", "term3", ...]`;

      const response = await this.makeOpenAIRequest(prompt);
      
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const terms = JSON.parse(jsonMatch[0]);
      
      // Validate and limit to 15 terms
      if (!Array.isArray(terms)) {
        throw new Error('Response is not an array');
      }
      
      return terms.slice(0, 15).map(term => String(term).trim());
    } catch (error) {
      console.warn('Failed to extract required terms:', error instanceof Error ? error.message : 'Unknown error');
      return []; // Return empty array as fallback
    }
  }

  async upsertJobIndex(jobId: string, jdFileName: string, requiredTerms: string[]): Promise<void> {
    const indexPath = path.join(process.cwd(), 'data', 'index.jsonl');
    
    try {
      // Read existing index entries
      const existingEntries: any[] = [];
      let foundExisting = false;

      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.job_id === jobId) {
              // Update existing entry
              entry.jd_file = jdFileName;
              entry.required_terms = requiredTerms;
              entry.updated_at = new Date().toISOString();
              foundExisting = true;
            }
            existingEntries.push(entry);
          } catch (parseError) {
            console.warn('Skipping invalid JSONL line:', line);
          }
        }
      }

      // Add new entry if not found
      if (!foundExisting) {
        existingEntries.push({
          job_id: jobId,
          jd_file: jdFileName,
          required_terms: requiredTerms,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Write back to file
      const newContent = existingEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      fs.writeFileSync(indexPath, newContent, 'utf-8');
      
    } catch (error) {
      throw new Error(`Failed to update job index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processJobDescription(jobId: string, description: string): Promise<void> {
    try {
      // Extract required terms
      console.log('🔍 Extracting required terms...');
      const requiredTerms = await this.extractRequiredTerms(description);
      
      if (requiredTerms.length === 0) {
        console.log('⚠️  No required terms extracted, proceeding without terms');
      } else {
        console.log(`📝 Extracted ${requiredTerms.length} required terms`);
      }

      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Save job description to txt file
      const jdFileName = `jd_${jobId}.txt`;
      const txtFilePath = path.join(dataDir, jdFileName);
      fs.writeFileSync(txtFilePath, description, 'utf-8');

      // Update index
      await this.upsertJobIndex(jobId, jdFileName, requiredTerms);
      
      console.log(`📄 Job description saved to: ${txtFilePath}`);
      console.log(`📋 Index updated in: ${path.join(dataDir, 'index.jsonl')}`);
      
    } catch (error) {
      throw new Error(`Failed to process job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractForEval(): Promise<{ processed: number; errors: number; skipped: number }> {
    const logsDir = path.join(process.cwd(), 'logs');
    const results = { processed: 0, errors: 0, skipped: 0 };

    try {
      // Check if logs directory exists
      if (!fs.existsSync(logsDir)) {
        console.log('📁 No logs directory found - no jobs to process');
        return results;
      }

      // Get all job subdirectories
      const entries = fs.readdirSync(logsDir, { withFileTypes: true });
      const jobIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();

      if (jobIds.length === 0) {
        console.log('📁 No job directories found in logs');
        return results;
      }

      console.log(`🔄 Processing ${jobIds.length} job directories...`);
      console.log('');

      for (let i = 0; i < jobIds.length; i++) {
        const jobId = jobIds[i];
        const jobDir = path.join(logsDir, jobId);
        
        console.log(`📊 [${i + 1}/${jobIds.length}] Processing job ${jobId}...`);

        try {
          // Find the most recent job JSON file
          const files = fs.readdirSync(jobDir);
          const jobFiles = files
            .filter(file => file.startsWith('job-') && file.endsWith('.json'))
            .sort()
            .reverse(); // Most recent first

          if (jobFiles.length === 0) {
            console.log(`   ⚠️  No job JSON files found - skipping`);
            results.skipped++;
            continue;
          }

          const jobFilePath = path.join(jobDir, jobFiles[0]);
          
          // Read and parse the job JSON file
          const jobDataRaw = fs.readFileSync(jobFilePath, 'utf-8');
          const jobData = JSON.parse(jobDataRaw);

          if (!jobData.description) {
            console.log(`   ⚠️  No description field found - skipping`);
            results.skipped++;
            continue;
          }

          // Check if txt file already exists to avoid reprocessing
          const dataDir = path.join(process.cwd(), 'data');
          const txtFileName = `jd_${jobId}.txt`;
          const txtFilePath = path.join(dataDir, txtFileName);
          
          if (fs.existsSync(txtFilePath)) {
            // Check if description has changed by comparing content
            const existingContent = fs.readFileSync(txtFilePath, 'utf-8');
            if (existingContent.trim() === jobData.description.trim()) {
              console.log(`   ✅ Already processed (content unchanged) - skipping`);
              results.skipped++;
              continue;
            }
          }

          // Process the job description
          await this.processJobDescription(jobId, jobData.description);
          console.log(`   ✅ Processed successfully`);
          results.processed++;

          // Small delay to avoid overwhelming the API
          if (i < jobIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.errors++;
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to extract for eval: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createJob(company?: string, title?: string, blurbPath?: string, companyUrl?: string): Promise<{ jobId: string; filePath: string }> {
    try {
      // Generate unique job ID
      const jobId = this.generateJobId();
      
      // Create logs directory structure
      const logsDir = path.join(process.cwd(), 'logs');
      const jobDir = path.join(logsDir, jobId);
      
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      let jobDescription = "";
      
      // If both blurb and URL are provided, synthesize job description
      if (blurbPath && companyUrl) {
        try {
          console.log(`📄 Reading blurb from: ${blurbPath}`);
          console.log(`🌐 Gathering company info from: ${companyUrl}`);
          
          jobDescription = await this.synthesizeJobDescription(blurbPath, companyUrl);
          console.log(`✅ Job description synthesized successfully`);
        } catch (error) {
          console.log(`⚠️  Failed to synthesize job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log(`   Proceeding with empty description that can be filled manually`);
        }
      }

      // Create empty job JSON template
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `job-${timestamp}.json`;
      const filePath = path.join(jobDir, fileName);
      
      const emptyJobData = {
        title: title || "",
        company: company || "",
        location: "",
        description: jobDescription,
        source: "manual",
        salary: {
          min: "",
          max: "",
          currency: "USD"
        }
      };

      fs.writeFileSync(filePath, JSON.stringify(emptyJobData, null, 2), 'utf-8');
      
      // If we have enough data (title, company), post to Teal immediately
      if (emptyJobData.title && emptyJobData.company) {
        await this.postToTealViaPuppeteer(emptyJobData as JobListing);
      }
      
      console.log(`📁 Created job directory: logs/${jobId}`);
      console.log(`📄 Created empty job file: ${fileName}`);
      
      if (!emptyJobData.title || !emptyJobData.company) {
        console.log(`✏️  Edit the file to add missing job details, then run:`);
        console.log(`   npm run dev post-to-teal ${jobId}`);
        console.log(`   npm run dev extract-description ${jobId}`);
      }
      
      return { jobId, filePath };
    } catch (error) {
      throw new Error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateJobId(): string {
    // Generate 8-character hex ID similar to existing pattern
    return Math.random().toString(16).substring(2, 10);
  }

  private async synthesizeJobDescription(blurbPath: string, companyUrl: string): Promise<string> {
    try {
      // Read blurb file
      const blurbContent = fs.readFileSync(path.resolve(blurbPath), 'utf-8').trim();
      if (!blurbContent) {
        throw new Error('Blurb file is empty');
      }
      
      // Gather company information from URL
      const companyInfo = await this.gatherCompanyInfo(companyUrl);
      
      // Create synthesis prompt
      const prompt = this.createJobDescriptionSynthesisPrompt(blurbContent, companyInfo);
      
      // Get LLM response
      const synthesizedDescription = await this.makeOpenAIRequest(prompt, 3000);
      
      return synthesizedDescription.trim();
    } catch (error) {
      throw new Error(`Failed to synthesize job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async gatherCompanyInfo(companyUrl: string): Promise<string> {
    try {
      const { WebScraper } = require('../utils/web-scraper');
      const html = await WebScraper.fetchHtml(companyUrl);
      const simplifiedHtml = WebScraper.simplifyHtml(html);
      
      // Extract key company information using LLM
      const prompt = `Extract key company information from the following HTML content. Focus on:
- Company mission, values, and culture
- Products, services, and business model
- Company size, stage, and market position
- Recent news, achievements, or initiatives
- Work environment and company benefits

Provide a concise summary that would be useful for creating a targeted job description.

HTML Content:
${simplifiedHtml.slice(0, 8000)}...`;
      
      const companyInfo = await this.makeOpenAIRequest(prompt, 2000);
      return companyInfo.trim();
    } catch (error) {
      throw new Error(`Failed to gather company info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private createJobDescriptionSynthesisPrompt(blurb: string, companyInfo: string): string {
    return `Create a comprehensive job description by combining the provided job blurb with company information.

Job Blurb:
${blurb}

Company Information:
${companyInfo}

Instructions:
- Use the job blurb as the foundation for the role requirements and responsibilities
- Incorporate relevant company information to make the description more specific and appealing
- Maintain the core job requirements from the blurb
- Add company-specific context, culture, and benefits where appropriate
- Ensure the tone matches professional job posting standards
- Make the description comprehensive but not overly long
- Focus on what would attract qualified candidates

Return only the synthesized job description text, no additional formatting or commentary.`;
  }

  private async extractJobDataFromHtml(html: string, applicantInfo?: { count: number; competitionLevel: 'low' | 'medium' | 'high' | 'extreme' }): Promise<JobListing> {
    // First, try to extract structured data (JSON-LD)
    const structuredData = WebScraper.extractStructuredData(html);
    
    if (structuredData) {
      console.log('🎯 Using structured data (JSON-LD)');
      try {
        return this.parseStructuredData(structuredData, applicantInfo);
      } catch (error) {
        console.log('⚠️  Structured data parsing failed:', error instanceof Error ? error.message : 'Unknown error');
        console.log('📄 Falling back to HTML scraping');
      }
    } else {
      // Fallback to HTML scraping if no structured data
      console.log('📄 Falling back to HTML scraping');
    }
    
    // HTML scraping fallback logic
    const simplifiedHtml = WebScraper.simplifyHtml(html);

    // Create prompt for LLM
    const prompt = this.createExtractionPrompt(simplifiedHtml);

    // Get LLM response with higher token limit for job extraction
    const response = await this.makeOpenAIRequest(prompt, 4000);

    // Parse JSON response
    return this.parseJobData(response, applicantInfo);
  }

  async postToTealViaPuppeteer(jobData: JobListing, url?: string): Promise<void> {
    try {
      const credentials = getTealCredentials();
      if (!credentials) {
        console.log('⚠️  Teal credentials not found - skipping Teal posting');
        console.log('   Set TEAL_EMAIL and TEAL_PASSWORD environment variables to enable Teal integration');
        return;
      }

      console.log('🔖 Posting job to Teal via Puppeteer...');
      
      const tealTracker = new TealTracker(credentials);
      await tealTracker.initialize();
      
      const success = await tealTracker.addJob(jobData, url);
      
      if (success) {
        console.log('✅ Successfully posted job to Teal tracker');
      } else {
        console.log('❌ Failed to post job to Teal tracker');
      }
      
      await tealTracker.close();
      
    } catch (error) {
      console.error('❌ Error posting to Teal:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}