import { Stagehand } from "@browserbasehq/stagehand";
import { JobListing } from '../types';

export interface TealCredentials {
  email: string;
  password: string;
}

export interface TealJobEntry {
  title: string;
  company: string;
  location: string;
  url?: string;
  description?: string;
  status: 'Bookmarked' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';
}

export class TealTracker {
  private stagehand: Stagehand | null = null;
  private isLoggedIn = false;

  constructor(private credentials: TealCredentials) {}

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Stagehand for Teal integration...');
    
    // Check for required OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for Stagehand AI automation');
    }
    
    this.stagehand = new Stagehand({
      env: 'LOCAL', // Use local browser
      verbose: 1, // Enable some logging
      domSettleTimeoutMs: 30_000,
    });

    await this.stagehand.init();
    console.log('✅ Stagehand initialized successfully');
  }

  async login(): Promise<boolean> {
    if (!this.stagehand) throw new Error('Teal tracker not initialized');

    try {
      console.log('🔑 Logging into Teal...');
      
      // Navigate to login page
      await this.stagehand.page.goto('https://app.tealhq.com/sign-in');
      
      // Use Stagehand's AI agent for form filling
      console.log('📝 Filling login form...');
      const agent = this.stagehand.agent();
      
      await agent.execute(
        `Fill out the login form with email "${this.credentials.email}" and password "${this.credentials.password}" and submit it to log in`
      );

      // Wait a bit for navigation with increased timeout
      try {
        await this.stagehand.page.waitForLoadState('networkidle', { timeout: 60000 });
      } catch (timeoutError) {
        console.log('⚠️  Page load timeout, but checking if login was successful...');
      }

      // Check if we successfully logged in by looking for dashboard elements
      const currentUrl = this.stagehand.page.url();
      console.log(`📍 Current URL after login: ${currentUrl}`);
      
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/tracker') || currentUrl.includes('/job') || currentUrl.includes('/home')) {
        this.isLoggedIn = true;
        console.log('✅ Successfully logged into Teal');
        return true;
      }

      // Alternative check - look for logout or user menu elements
      try {
        const loggedInElements = await this.stagehand.page.locator('button:has-text("Logout"), [data-testid*="user"], .user-menu, [href*="logout"]').first();
        if (await loggedInElements.count() > 0) {
          this.isLoggedIn = true;
          console.log('✅ Successfully logged into Teal (detected user menu)');
          return true;
        }
      } catch (error) {
        console.log('⚠️  Could not check for user menu elements');
      }

      console.warn('⚠️  Login may have failed - not on expected dashboard');
      return false;

    } catch (error) {
      console.error('❌ Teal login failed:', error);
      return false;
    }
  }

  async addJob(job: JobListing, url?: string): Promise<boolean> {
    if (!this.stagehand) throw new Error('Teal tracker not initialized');
    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) return false;
    }

    try {
      console.log(`📝 Adding job to Teal: ${job.title} at ${job.company}`);

      // Navigate to job tracker if not already there
      await this.navigateToJobTracker();

      // Use Stagehand agent to handle the entire job creation process
      console.log('🤖 Using AI agent to add job...');
      const agent = this.stagehand.agent();
      
      const fullInstructions = `
Add a new job to Teal with these details:
1. Click the "Add Job" button or "+" button to start adding a new job
2. Fill out the job form with:
   - Job title: "${job.title}"
   - Company name: "${job.company}"
   ${job.location ? `- Location: "${job.location}"` : ''}
   ${url ? `- Job URL: "${url}"` : ''}
   ${job.description ? `- Job description or notes: "${job.description.length > 300 ? job.description.substring(0, 300) + '...' : job.description}"` : ''}
   - Set status to "Bookmarked" if there's a status field
3. Submit/save the job by clicking the "Save", "Submit", or "Add Job" button

Please complete all these steps to successfully add the job to Teal.
      `.trim();

      await agent.execute(fullInstructions);

      // Wait for completion with timeout handling
      try {
        await this.stagehand.page.waitForLoadState('networkidle', { timeout: 60000 });
      } catch (timeoutError) {
        console.log('⚠️  Page load timeout after job submission, but job may have been created successfully');
      }

      console.log('✅ Successfully added job to Teal tracker');
      return true;

    } catch (error) {
      console.error('❌ Failed to add job to Teal:', error);
      return false;
    }
  }


  private async navigateToJobTracker(): Promise<void> {
    if (!this.stagehand) return;

    try {
      const currentUrl = this.stagehand.page.url();
      
      // Check if we're already on job tracker page
      if (currentUrl.includes('/job-tracker') || currentUrl.includes('/tracker') || currentUrl.includes('/jobs')) {
        console.log('📍 Already on job tracker page');
        return;
      }

      console.log('🧭 Navigating to job tracker...');
      
      // Fallback: try direct navigation
      try {
        await this.stagehand.page.goto('https://app.tealhq.com/job-tracker');
        await this.stagehand.page.waitForLoadState('networkidle');
        console.log('✅ Navigated to job tracker directly');
      } catch (directError) {
        // Try alternative URLs
        const altUrls = [
          'https://app.tealhq.com/tracker',
          'https://app.tealhq.com/jobs',
          'https://app.tealhq.com/dashboard'
        ];
        
        for (const altUrl of altUrls) {
          try {
            await this.stagehand.page.goto(altUrl);
            await this.stagehand.page.waitForLoadState('networkidle');
            console.log(`✅ Navigated to job tracker at: ${altUrl}`);
            return;
          } catch {
            // Continue to next URL
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not navigate to job tracker, continuing with current page');
    }
  }

  async close(): Promise<void> {
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
      this.isLoggedIn = false;
    }
  }
}

// Helper function to get Teal credentials from environment or user input
export function getTealCredentials(): TealCredentials | null {
  const email = process.env.TEAL_EMAIL;
  const password = process.env.TEAL_PASSWORD;

  if (email && password) {
    return { email, password };
  }

  console.warn('⚠️  Teal credentials not found in environment variables');
  console.warn('   Set TEAL_EMAIL and TEAL_PASSWORD environment variables');
  return null;
}