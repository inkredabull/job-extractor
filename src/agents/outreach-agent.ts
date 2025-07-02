import { JobListing, LinkedInConnection, OutreachResult } from '../types';
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
      
      console.log(`🔍 Finding LinkedIn connections at ${company}...`);
      
      // For now, this will be a manual process with guidance
      // In a full implementation, this would integrate with LinkedIn's API
      const result = await this.searchLinkedInConnections(company, jobId);
      
      // Save results to file
      this.saveConnectionsResult(jobId, result);
      
      return result;
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

  private async searchLinkedInConnections(company: string, jobId: string): Promise<OutreachResult> {
    // Since LinkedIn doesn't allow automated scraping, we'll provide manual search guidance
    // and create a template for manual data entry
    
    const searchUrl = this.generateLinkedInSearchUrl(company);
    const timestamp = new Date().toISOString();
    
    // Automatically open the LinkedIn URL in Chrome
    try {
      console.log(`🔗 Opening LinkedIn company page for ${company}...`);
      console.log(`📱 URL: ${searchUrl}`);
      this.openUrlInChrome(searchUrl);
      console.log(`✅ LinkedIn page opened in Chrome`);
    } catch (error) {
      console.log(`⚠️  Could not automatically open Chrome: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`🔗 Please manually open: ${searchUrl}`);
    }
    
    // Create instructions file for manual search
    const instructions = this.generateSearchInstructions(company, searchUrl, jobId);
    const instructionsPath = this.saveInstructions(jobId, instructions);
    
    console.log(`\n📋 LinkedIn Search Instructions:`);
    console.log(`==========================================`);
    console.log(`1. Chrome should have opened the LinkedIn company page automatically`);
    console.log(`2. Review the search results for 1st and 2nd degree connections`);
    console.log(`3. Follow the instructions in: ${instructionsPath}`);
    console.log(`4. Update the connections data manually in the generated template`);
    console.log(`==========================================\n`);
    
    // Create a template connections file for manual editing
    const templatePath = this.createConnectionsTemplate(jobId, company);
    
    return {
      success: true,
      company,
      companyUrl: searchUrl,
      connections: [], // Will be populated manually
      totalConnections: 0,
      firstDegreeCount: 0,
      secondDegreeCount: 0,
      timestamp
    };
  }

  private generateLinkedInSearchUrl(company: string): string {
    // Create LinkedIn company people search URL with network filter for 1st and 2nd degree connections
    const companySlug = this.convertToLinkedInSlug(company);
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

  private openUrlInChrome(url: string): void {
    try {
      // Use platform-specific command to open Chrome
      const platform = process.platform;
      
      if (platform === 'darwin') {
        // macOS
        execSync(`open -a "Google Chrome" "${url}"`, { stdio: 'ignore' });
      } else if (platform === 'win32') {
        // Windows
        execSync(`start chrome "${url}"`, { stdio: 'ignore' });
      } else {
        // Linux and others
        execSync(`google-chrome "${url}"`, { stdio: 'ignore' });
      }
    } catch (error) {
      throw new Error(`Failed to open Chrome: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateSearchInstructions(company: string, searchUrl: string, jobId: string): string {
    return `# LinkedIn Outreach Instructions for ${company}

## Job ID: ${jobId}
## Generated: ${new Date().toLocaleDateString()}

### Step 1: Search for Connections
1. Open this URL: ${searchUrl}
2. This will show people at ${company} who are your 1st or 2nd degree connections
3. Review each result carefully

### Step 2: Collect Information
For each relevant connection, collect:
- Name
- Current title/role
- Profile URL
- Connection degree (1st or 2nd)
- If 2nd degree: Who is the mutual connection?
- Location (if visible)

### Step 3: Update the Template
Edit the connections template file: logs/${jobId}/connections-template.json

### Step 4: Focus on Relevant Roles
Prioritize connections who are:
- In engineering/technical roles
- In leadership positions (Director, VP, CTO, etc.)
- In hiring/recruiting
- Recent joiners who might have insights

### Step 5: Craft Personalized Messages
Consider mentioning:
- Mutual connections (for 2nd degree)
- Shared interests or background
- Specific interest in the role/company
- A clear ask (informational interview, advice, etc.)

### LinkedIn Search Tips:
- Use filters to narrow by role, seniority, etc.
- Check "All filters" for more options
- Look at company page for additional insights
- Review recent company posts for context
`;
  }

  private saveInstructions(jobId: string, instructions: string): string {
    const jobDir = path.resolve('logs', jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }
    
    const instructionsPath = path.join(jobDir, 'linkedin-outreach-instructions.md');
    fs.writeFileSync(instructionsPath, instructions, 'utf-8');
    return instructionsPath;
  }

  private createConnectionsTemplate(jobId: string, company: string): string {
    const template = {
      jobId,
      company,
      timestamp: new Date().toISOString(),
      instructions: "Edit this file to add your LinkedIn connections. Remove this instructions field when done.",
      connections: [
        {
          name: "Example Person",
          title: "Senior Software Engineer",
          profileUrl: "https://linkedin.com/in/example-person",
          connectionDegree: "1st",
          mutualConnection: null,
          location: "San Francisco, CA",
          company: company,
          notes: "Optional: Add personal notes about this connection"
        },
        {
          name: "Another Example",
          title: "Engineering Manager",
          profileUrl: "https://linkedin.com/in/another-example",
          connectionDegree: "2nd",
          mutualConnection: "Mutual Friend Name",
          location: "New York, NY", 
          company: company,
          notes: "Optional: Add personal notes about this connection"
        }
      ]
    };
    
    const jobDir = path.resolve('logs', jobId);
    const templatePath = path.join(jobDir, 'connections-template.json');
    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2), 'utf-8');
    
    console.log(`📝 Connections template created: ${templatePath}`);
    return templatePath;
  }

  private saveConnectionsResult(jobId: string, result: OutreachResult): void {
    const jobDir = path.resolve('logs', jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultPath = path.join(jobDir, `outreach-${timestamp}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`💾 Outreach result saved: ${resultPath}`);
  }

  async loadConnections(jobId: string): Promise<OutreachResult> {
    try {
      const jobDir = path.resolve('logs', jobId);
      
      // First check if manual connections have been added
      const templatePath = path.join(jobDir, 'connections-template.json');
      if (fs.existsSync(templatePath)) {
        const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        
        // Check if the template has been edited (removed instructions field)
        if (!templateData.instructions) {
          const connections = templateData.connections.filter((conn: any) => 
            conn.name !== "Example Person" && conn.name !== "Another Example"
          );
          
          const firstDegreeCount = connections.filter((c: LinkedInConnection) => c.connectionDegree === '1st').length;
          const secondDegreeCount = connections.filter((c: LinkedInConnection) => c.connectionDegree === '2nd').length;
          
          return {
            success: true,
            company: templateData.company,
            connections,
            totalConnections: connections.length,
            firstDegreeCount,
            secondDegreeCount,
            timestamp: templateData.timestamp
          };
        }
      }
      
      // Fall back to saved outreach results
      const files = fs.readdirSync(jobDir);
      const outreachFiles = files
        .filter(file => file.startsWith('outreach-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
      
      if (outreachFiles.length === 0) {
        return {
          success: false,
          error: 'No outreach data found. Run outreach search first.',
          timestamp: new Date().toISOString()
        };
      }
      
      const latestFile = path.join(jobDir, outreachFiles[0]);
      const data = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
      return data;
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  async listConnections(jobId: string): Promise<{ success: boolean; summary?: string; connections?: LinkedInConnection[]; error?: string }> {
    try {
      const result = await this.loadConnections(jobId);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      if (!result.connections || result.connections.length === 0) {
        return { 
          success: true, 
          summary: `No connections found for ${result.company}. Update the connections template file.`,
          connections: []
        };
      }
      
      const summary = `Found ${result.totalConnections} connections at ${result.company}:\n` +
                     `  • 1st degree: ${result.firstDegreeCount}\n` +
                     `  • 2nd degree: ${result.secondDegreeCount}`;
      
      return {
        success: true,
        summary,
        connections: result.connections
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}