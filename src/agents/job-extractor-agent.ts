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
      
      // First, try to extract structured data (JSON-LD)
      const structuredData = WebScraper.extractStructuredData(html);
      
      if (structuredData) {
        console.log('🎯 Using structured data (JSON-LD)');
        const jobData = this.parseStructuredData(structuredData);
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
      const jobData = this.parseJobData(response);

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

  private parseStructuredData(jsonLd: any): JobListing {
    try {
      // Extract fields from JSON-LD JobPosting
      const jobData: JobListing = {
        title: jsonLd.title || jsonLd.identifier?.name || '',
        company: jsonLd.hiringOrganization?.name || '',
        location: this.extractLocation(jsonLd.jobLocation),
        description: jsonLd.description || '',
      };

      // Extract salary if available
      if (jsonLd.baseSalary || jsonLd.salary) {
        const salaryData = jsonLd.baseSalary || jsonLd.salary;
        jobData.salary = {
          min: salaryData.value?.minValue || salaryData.minValue,
          max: salaryData.value?.maxValue || salaryData.maxValue,
          currency: salaryData.currency || 'USD',
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
      if (address.addressLocality) {
        return address.addressLocality;
      }
      if (address.addressRegion && address.addressCountry) {
        return `${address.addressRegion}, ${address.addressCountry}`;
      }
    }
    
    return jobLocation.name || '';
  }

  private parseJobData(response: string): JobListing {
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

      return parsed as JobListing;
    } catch (error) {
      throw new Error(`Failed to parse job data: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }
}