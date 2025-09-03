import { JobListing, OutreachResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export class OutreachAgent {
  constructor() {
    // No external dependencies needed for basic implementation
  }

  async findConnections(jobId: string): Promise<OutreachResult> {
    try {
      // Load job data
      const jobData = this.loadJobData(jobId);
      const company = jobData.company;
      
      // Check for custom LinkedIn company slug, fall back to company name
      const linkedInSlug = (jobData as any).linkedInCompany || (jobData as any).linked_in || (jobData as any).linkedin_company;
      const companyIdentifier = linkedInSlug || company;
      
      if (linkedInSlug) {
        console.log(`🔍 Opening LinkedIn company people page for ${company} (using custom slug: ${linkedInSlug})...`);
      } else {
        console.log(`🔍 Opening LinkedIn company people page for ${company}...`);
      }
      
      // Generate LinkedIn company people URL
      const linkedinUrl = this.generateLinkedInPeopleUrl(companyIdentifier, !!linkedInSlug);
      
      // Open LinkedIn page and inject connection extraction script
      this.openLinkedInPageAndExtract(linkedinUrl, company);
      
      return {
        success: true,
        company,
        companyUrl: linkedinUrl,
        connections: [], // Will be populated by the browser script
        totalConnections: 0,
        firstDegreeCount: 0,
        secondDegreeCount: 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
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

  private generateLinkedInPeopleUrl(companyIdentifier: string, isCustomSlug: boolean = false): string {
    // Create LinkedIn company people page URL with network filter for 1st and 2nd degree connections
    const companySlug = isCustomSlug ? companyIdentifier : this.convertToLinkedInSlug(companyIdentifier);
    return `https://www.linkedin.com/company/${companySlug}/people/?facetNetwork=F,S`;
  }

  private convertToLinkedInSlug(company: string): string {
    // Convert company name to LinkedIn company slug format
    // This is a best-effort conversion - some manual adjustment may be needed
    return company
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  private openLinkedInPageAndExtract(url: string, company: string): void {
    try {
      console.log(`🔗 Opening LinkedIn company people page for ${company}...`);
      console.log(`📱 URL: ${url}`);
      
      // Open the LinkedIn page and trigger extension script injection
      this.openUrlAndTriggerExtension(url);
      
      console.log(`✅ LinkedIn page opened in Chrome`);
      console.log('🤖 Chrome extension will inject and run the extraction script');
      console.log('📊 Connection extraction and profile opening will begin automatically...');
      console.log('\n💡 The script will:');
      console.log('   • Extract all visible connections from the page');
      console.log('   • Open each connection profile in a new tab');
      console.log('   • Use random delays (750-1500ms) between tabs');
      console.log('   • Log progress to the browser console');
      
    } catch (error) {
      console.log(`⚠️  Could not automatically open Chrome: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`🔗 Please manually open: ${url}`);
      console.log('\nExtension script injection may not work with manual opening.');
    }
  }

  private generateConnectionExtractionScript(): string {
    return `
// LinkedIn Connection Extractor with Auto-Opening
console.log("Extracting LinkedIn connections and opening profiles...");
console.log("Team Member~Title~URL");

var containerElements = document.querySelectorAll(".org-people-profile-card__profile-info");
var urls = [];

// Extract all URLs first
for (let i = 0; i < containerElements.length; i++) {
    var container = containerElements[i];
    var nameElements = container.getElementsByClassName("t-black");
    var urlElements = container.getElementsByTagName("a");
    var headlineElements = container.getElementsByClassName("t-14");
    
    var name = nameElements.length > 0 ? nameElements[0].innerText.trim() : "";
    var url = urlElements.length > 0 ? urlElements[0].href.split("?")[0] : "";
    var headline = headlineElements.length > 0 ? headlineElements[0].innerText.trim() : "";

    if (url && name) {
        console.log(\`\${name}~\${headline}~\${url}\`);
        urls.push(url);
    }
}

console.log(\`Found \${urls.length} connections. Opening profiles in new tabs...\`);

// Function to open URLs with random delays
function openUrlsWithDelay(urls, index = 0) {
    if (index >= urls.length) {
        console.log("Finished opening all connection profiles!");
        return;
    }
    
    // Random delay between 750-1500ms
    var delay = Math.floor(Math.random() * (1500 - 750 + 1)) + 750;
    
    setTimeout(() => {
        console.log(\`Opening profile \${index + 1}/\${urls.length}: \${urls[index]}\`);
        window.open(urls[index], '_blank');
        openUrlsWithDelay(urls, index + 1);
    }, delay);
}

// Start opening URLs with delays
if (urls.length > 0) {
    openUrlsWithDelay(urls);
} else {
    console.log("No connections found. Make sure you're on the right LinkedIn company people page.");
}
`.trim();
  }

  private openUrlAndTriggerExtension(url: string): void {
    try {
      const platform = process.platform;
      
      // Open URL normally - the extension will detect LinkedIn and inject the script
      if (platform === 'darwin') {
        execSync(`open -a "Google Chrome" "${url}"`, { stdio: 'ignore' });
      } else if (platform === 'win32') {
        execSync(`start chrome "${url}"`, { stdio: 'ignore' });
      } else {
        execSync(`google-chrome "${url}"`, { stdio: 'ignore' });
      }
      
      // The Chrome extension should automatically detect the LinkedIn company people page
      // and inject the connection extraction script
      
    } catch (error) {
      throw new Error(`Failed to open Chrome: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Remove the complex manual template creation and instruction methods
  // Keep only the essential connection loading method for backward compatibility
  async loadConnections(jobId: string): Promise<OutreachResult> {
    return {
      success: false,
      error: 'Manual connection loading no longer supported. Use the new automated LinkedIn extraction instead.',
      timestamp: new Date().toISOString()
    };
  }

  async listConnections(jobId: string): Promise<{ success: boolean; summary?: string; connections?: any[]; error?: string }> {
    return { 
      success: false, 
      error: 'Manual connection listing no longer supported. Use the new automated LinkedIn extraction instead.'
    };
  }
}