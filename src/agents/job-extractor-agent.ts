import { BaseAgent } from './base-agent';
import { JobListing, ExtractorResult, AgentConfig } from '../types';
import { WebScraper } from '../utils/web-scraper';

export class JobExtractorAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async extract(url: string): Promise<ExtractorResult> {
    try {
      // Fetch HTML
      const html = await WebScraper.fetchHtml(url);
      
      // Check applicant count first - early exit if too competitive
      const applicantInfo = this.extractApplicantCount(html);
      if (applicantInfo.shouldExit) {
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
      
      // If applicant count detected but within threshold, log it
      if (applicantInfo.count > 0) {
        console.log(`👥 ${applicantInfo.count} applicants detected - competition level: ${applicantInfo.competitionLevel}`);
      }
      
      // First, try to extract structured data (JSON-LD)
      const structuredData = WebScraper.extractStructuredData(html);
      
      if (structuredData) {
        console.log('🎯 Using structured data (JSON-LD)');
        const jobData = this.parseStructuredData(structuredData, applicantInfo);
        return {
          success: true,
          data: jobData,
        };
      }
      
      // Fallback to HTML scraping if no structured data
      console.log('📄 Falling back to HTML scraping');
      const simplifiedHtml = WebScraper.simplifyHtml(html);

      // Create prompt for LLM
      const prompt = this.createExtractionPrompt(simplifiedHtml);

      // Get LLM response
      const response = await this.makeOpenAIRequest(prompt);

      // Parse JSON response
      const jobData = this.parseJobData(response, applicantInfo);

      return {
        success: true,
        data: jobData,
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
      const jobData: JobListing = {
        title: jsonLd.title || jsonLd.identifier?.name || '',
        company: jsonLd.hiringOrganization?.name || '',
        location: this.extractLocation(jsonLd.jobLocation),
        description: jsonLd.description || '',
      };

      // Add applicant information if available
      if (applicantInfo && applicantInfo.count > 0) {
        jobData.applicantCount = applicantInfo.count;
        jobData.competitionLevel = applicantInfo.competitionLevel;
      }

      // Extract salary if available in structured data
      if (jsonLd.baseSalary || jsonLd.salary) {
        const salaryData = jsonLd.baseSalary || jsonLd.salary;
        jobData.salary = {
          min: salaryData.value?.minValue || salaryData.minValue,
          max: salaryData.value?.maxValue || salaryData.maxValue,
          currency: salaryData.currency || 'USD',
        };
      } else {
        // Fallback: try to extract salary from description text
        const salaryFromDescription = this.extractSalaryFromText(jobData.description);
        if (salaryFromDescription) {
          jobData.salary = salaryFromDescription;
        }
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
      if (address.addressLocality) {
        return address.addressLocality;
      }
      if (address.addressRegion && address.addressCountry) {
        return `${address.addressRegion}, ${address.addressCountry}`;
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
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.title || !parsed.company || !parsed.location || !parsed.description) {
        throw new Error('Missing required fields in extracted data');
      }

      // Add applicant information if available
      if (applicantInfo && applicantInfo.count > 0) {
        parsed.applicantCount = applicantInfo.count;
        parsed.competitionLevel = applicantInfo.competitionLevel;
      }

      return parsed as JobListing;
    } catch (error) {
      throw new Error(`Failed to parse job data: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }
}