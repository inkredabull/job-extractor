import { BaseAgent } from './base-agent';
import { AgentConfig, ExtractorResult } from '../types';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface RejectionEmail {
  id: string;
  subject: string;
  body: string;
  receivedDate: Date;
  company?: string;
  jobTitle?: string;
  lastChecked?: Date;
  checkCount: number;
  status: 'pending' | 'found' | 'given_up';
  hiredPerson?: {
    name: string;
    linkedinUrl?: string;
    title: string;
    startDate?: string;
  };
}

interface WhoGotHiredTracker {
  rejections: RejectionEmail[];
  lastSync: Date;
}

export class WhoGotHiredAgent extends BaseAgent {
  private trackerFile: string;
  private tracker: WhoGotHiredTracker;
  private gmail: any;
  private oauth2Client: OAuth2Client;

  constructor(config: AgentConfig) {
    super(config);
    this.trackerFile = path.join('data', 'whogothired-tracker.json');
    this.tracker = this.loadTracker();
    this.initializeGmailClient();
  }

  private initializeGmailClient(): void {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Set refresh token if available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
    }

    // Initialize Gmail API client
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  private loadTracker(): WhoGotHiredTracker {
    try {
      if (fs.existsSync(this.trackerFile)) {
        const data = fs.readFileSync(this.trackerFile, 'utf-8');
        const parsed = JSON.parse(data);
        // Convert date strings back to Date objects
        parsed.lastSync = new Date(parsed.lastSync);
        parsed.rejections = parsed.rejections.map((r: any) => ({
          ...r,
          receivedDate: new Date(r.receivedDate),
          lastChecked: r.lastChecked ? new Date(r.lastChecked) : undefined
        }));
        return parsed;
      }
    } catch (error) {
      console.error('Error loading tracker file:', error);
    }

    return {
      rejections: [],
      lastSync: new Date(0) // Start from epoch to catch all emails on first run
    };
  }

  private saveTracker(): void {
    try {
      const dataDir = path.dirname(this.trackerFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.trackerFile, JSON.stringify(this.tracker, null, 2));
    } catch (error) {
      console.error('Error saving tracker file:', error);
    }
  }

  async checkForNewRejections(): Promise<void> {
    console.log('🔍 Checking Gmail for new rejection emails...');
    
    try {
      // Fetch emails from Gmail with the professional-search-whogothired label
      const newEmails = await this.fetchGmailRejections();
      
      let newCount = 0;
      for (const email of newEmails) {
        if (!this.tracker.rejections.find(r => r.id === email.id)) {
          // Parse company and job title from email
          const parsed = await this.parseRejectionEmail(email);
          
          this.tracker.rejections.push({
            ...email,
            ...parsed,
            checkCount: 0,
            status: 'pending'
          });
          newCount++;
        }
      }

      this.tracker.lastSync = new Date();
      this.saveTracker();

      if (newCount > 0) {
        console.log(`✅ Found ${newCount} new rejection email(s)`);
      } else {
        console.log('📭 No new rejection emails found');
      }
    } catch (error) {
      console.error('❌ Error checking for new rejections:', error);
    }
  }

  async processScheduledChecks(): Promise<void> {
    console.log('⏰ Processing scheduled LinkedIn checks...');
    
    const now = new Date();
    const sixWeeksMs = 6 * 7 * 24 * 60 * 60 * 1000;
    const fourMonthsMs = 4 * 30 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    let checkedCount = 0;
    let foundCount = 0;
    let givenUpCount = 0;

    for (const rejection of this.tracker.rejections) {
      if (rejection.status !== 'pending') continue;

      const timeSinceRejection = now.getTime() - rejection.receivedDate.getTime();
      const timeSinceLastCheck = rejection.lastChecked 
        ? now.getTime() - rejection.lastChecked.getTime()
        : Infinity;

      // Check if email is too old (> 4 months) and we should give up
      if (timeSinceRejection > fourMonthsMs) {
        rejection.status = 'given_up';
        await this.notifyGiveUp(rejection, 'Email is older than 4 months');
        givenUpCount++;
        continue;
      }

      // Check if we should start checking (6 weeks after rejection)
      if (timeSinceRejection < sixWeeksMs) continue;

      // Check if enough time has passed since last check (1 month)
      if (rejection.lastChecked && timeSinceLastCheck < oneMonthMs) continue;

      // Perform LinkedIn search
      console.log(`🔍 Checking LinkedIn for: ${rejection.company} - ${rejection.jobTitle}`);
      
      try {
        const hiredPerson = await this.searchLinkedInForHire(rejection);
        
        rejection.lastChecked = new Date();
        rejection.checkCount++;

        if (hiredPerson) {
          rejection.status = 'found';
          rejection.hiredPerson = hiredPerson;
          await this.notifyFound(rejection);
          foundCount++;
        } else if (rejection.checkCount >= 6) { // Give up after 6 attempts
          rejection.status = 'given_up';
          await this.notifyGiveUp(rejection, 'Reached maximum retry attempts (6)');
          givenUpCount++;
        }
        
        checkedCount++;
        
        // Add delay between LinkedIn searches to avoid rate limiting
        await this.delay(2000);
        
      } catch (error) {
        console.error(`❌ Error checking ${rejection.company}:`, error);
        rejection.lastChecked = new Date();
        rejection.checkCount++;
      }
    }

    this.saveTracker();

    console.log(`📊 Check summary: ${checkedCount} checked, ${foundCount} found, ${givenUpCount} given up`);
  }

  private async fetchGmailRejections(): Promise<Array<{id: string, subject: string, body: string, receivedDate: Date}>> {
    try {
      if (!process.env.GOOGLE_REFRESH_TOKEN) {
        console.log('⚠️ No GOOGLE_REFRESH_TOKEN found. Run: node scripts/setup-gmail-auth.js');
        return [];
      }

      console.log('📧 Fetching emails from Gmail API...');

      // First, get the label ID for "professional-search-whogothired"
      const labelsResponse = await this.gmail.users.labels.list({ userId: 'me' });
      const targetLabel = labelsResponse.data.labels?.find(
        (label: any) => label.name === 'professional-search-whogothired'
      );

      if (!targetLabel) {
        console.log('⚠️ Label "professional-search-whogothired" not found in Gmail');
        console.log('Please create this label and apply it to rejection emails');
        return [];
      }

      // Build query to get emails since last sync
      const sinceDate = this.tracker.lastSync.toISOString().split('T')[0]; // YYYY-MM-DD format
      const query = `label:${targetLabel.name} after:${sinceDate}`;

      console.log(`  🔍 Searching with query: ${query}`);

      // Get list of message IDs
      const messagesResponse = await this.gmail.users.messages.list({
        userId: 'me',
        labelIds: [targetLabel.id],
        q: `after:${sinceDate}`
      });

      if (!messagesResponse.data.messages || messagesResponse.data.messages.length === 0) {
        console.log('  📭 No new emails found');
        return [];
      }

      console.log(`  📧 Found ${messagesResponse.data.messages.length} emails to process`);

      // Fetch full email content for each message
      const emails = [];
      for (const message of messagesResponse.data.messages) {
        try {
          const emailResponse = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });

          const email = this.parseGmailMessage(emailResponse.data);
          if (email) {
            emails.push(email);
          }

          // Small delay to avoid rate limiting
          await this.delay(100);
        } catch (error) {
          console.error(`  ❌ Error fetching email ${message.id}:`, error);
        }
      }

      return emails;

    } catch (error) {
      console.error('❌ Error fetching Gmail rejections:', error);
      if (error.message?.includes('invalid_grant')) {
        console.error('🔑 OAuth token expired. Please re-run: node scripts/setup-gmail-auth.js');
      }
      return [];
    }
  }

  private parseGmailMessage(message: any): {id: string, subject: string, body: string, receivedDate: Date} | null {
    try {
      const headers = message.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No subject';
      const dateHeader = headers.find((h: any) => h.name === 'Date')?.value;
      
      let body = '';
      
      // Extract body from different payload structures
      if (message.payload.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString();
      } else if (message.payload.parts) {
        // Multi-part message
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString();
          }
        }
      }

      // Parse date
      let receivedDate = new Date();
      if (dateHeader) {
        receivedDate = new Date(dateHeader);
      }

      return {
        id: message.id,
        subject,
        body,
        receivedDate
      };

    } catch (error) {
      console.error('❌ Error parsing Gmail message:', error);
      return null;
    }
  }

  private async parseRejectionEmail(email: {subject: string, body: string}): Promise<{company?: string, jobTitle?: string}> {
    console.log(`📝 Parsing rejection email: ${email.subject}`);
    
    let company: string | undefined;
    let jobTitle: string | undefined;

    // Common rejection email patterns
    const companyPatterns = [
      /thank you for your interest in (.+?)(?:\.|,|\n)/i,
      /position (?:at|with) (.+?)(?:\.|,|\n)/i,
      /from (.+?) (?:team|recruiting|hr)/i,
      /(.+?) (?:team|recruiting|hr)/i
    ];

    const titlePatterns = [
      /for the (.+?) (?:position|role)/i,
      /regarding the (.+?) (?:position|role)/i,
      /(.+?) (?:position|role) at/i,
      /application for (.+?)(?:\s+at|\s+with|\.|,|\n)/i
    ];

    // Try to extract company name
    for (const pattern of companyPatterns) {
      const match = email.body.match(pattern) || email.subject.match(pattern);
      if (match && match[1]) {
        company = match[1].trim();
        break;
      }
    }

    // Try to extract job title
    for (const pattern of titlePatterns) {
      const match = email.body.match(pattern) || email.subject.match(pattern);
      if (match && match[1]) {
        jobTitle = match[1].trim();
        break;
      }
    }

    // Clean up extracted text
    if (company) {
      company = company.replace(/^(the\s+)?/i, '').replace(/\s+(inc|llc|corp|ltd)\.?$/i, '');
    }

    console.log(`  📍 Extracted - Company: ${company || 'Unknown'}, Title: ${jobTitle || 'Unknown'}`);
    
    return { company, jobTitle };
  }

  private async searchLinkedInForHire(rejection: RejectionEmail): Promise<{name: string, linkedinUrl?: string, title: string, startDate?: string} | null> {
    if (!rejection.company || !rejection.jobTitle) {
      console.log('  ⚠️ Missing company or job title, skipping LinkedIn search');
      return null;
    }

    console.log(`  📧 Generating LinkedIn search for: ${rejection.company} - ${rejection.jobTitle}`);
    
    // Generate LinkedIn search URLs for manual checking
    const searchUrls = this.generateLinkedInSearchUrls(rejection);
    
    // Send email with search links for manual checking
    await this.sendManualCheckEmail(rejection, searchUrls);
    
    // Return null since this is now a manual process
    // The user will need to report back manually or we'll check again next month
    console.log('  ✅ Manual check email sent');
    return null;
  }

  private generateLinkedInSearchUrls(rejection: RejectionEmail): string[] {
    const company = encodeURIComponent(rejection.company!);
    const jobTitle = encodeURIComponent(rejection.jobTitle!);
    
    // Calculate date range for recent hires (around rejection time + 1-3 months)
    const rejectionDate = rejection.receivedDate;
    const searchStartDate = new Date(rejectionDate);
    searchStartDate.setMonth(searchStartDate.getMonth() - 1); // 1 month before rejection
    
    const searchEndDate = new Date(rejectionDate);
    searchEndDate.setMonth(searchEndDate.getMonth() + 3); // 3 months after rejection
    
    const urls = [
      // Search for people at the company with similar job titles
      `https://www.linkedin.com/search/results/people/?keywords=${company}%20${jobTitle}&origin=GLOBAL_SEARCH_HEADER`,
      
      // Search for recent posts about joining the company
      `https://www.linkedin.com/search/results/content/?keywords=%22${company}%22%20(%22excited%20to%20join%22%20OR%20%22thrilled%20to%20join%22%20OR%20%22happy%20to%20announce%22%20OR%20%22new%20role%22%20OR%20%22starting%20at%22)&origin=GLOBAL_SEARCH_HEADER`,
      
      // Search for company page recent activity
      `https://www.linkedin.com/search/results/companies/?keywords=${company}&origin=GLOBAL_SEARCH_HEADER`,
      
      // Search for specific role at company
      `https://www.linkedin.com/search/results/people/?keywords=%22${jobTitle}%22%20%22${company}%22&origin=GLOBAL_SEARCH_HEADER`,
      
      // Search for announcements about the role
      `https://www.linkedin.com/search/results/content/?keywords=%22${company}%22%20%22${jobTitle}%22%20(%22welcome%22%20OR%20%22joined%22%20OR%20%22new%20team%20member%22)&origin=GLOBAL_SEARCH_HEADER`
    ];

    return urls;
  }

  private async sendManualCheckEmail(rejection: RejectionEmail, searchUrls: string[]): Promise<void> {
    const rejectionDate = rejection.receivedDate.toDateString();
    const subject = `🔍 WhoGotHired: Manual Check Required - ${rejection.company} ${rejection.jobTitle}`;
    
    const emailBody = `
Hi!

The WhoGotHired Agent needs your help to check who got hired for a position you were rejected from.

📋 **Job Details:**
• Company: ${rejection.company}
• Position: ${rejection.jobTitle}
• Rejection Date: ${rejectionDate}
• Email Subject: ${rejection.subject}

🔍 **LinkedIn Search Links:**
Please check these LinkedIn searches to see if you can identify who got hired:

${searchUrls.map((url, index) => `${index + 1}. ${url}`).join('\n\n')}

📝 **What to look for:**
• Recent posts about joining ${rejection.company}
• People with "${rejection.jobTitle}" or similar titles at ${rejection.company}
• Company announcements about new hires
• Posts about starting new roles around ${rejectionDate}

📧 **How to report back:**
When you find someone who got the job, you can:

1. **Update the tracker manually:** Edit data/whogothired-tracker.json
2. **Or ignore:** The system will retry this search next month
3. **Or give up:** If it's too hard to find, the system will eventually give up

The system will automatically retry this search monthly until someone is found or it gives up after 6 attempts.

---
🤖 This email was sent by WhoGotHired Agent
Rejection ID: ${rejection.id}
Check Count: ${rejection.checkCount + 1}
    `.trim();

    // Send the email
    await this.sendNotification(subject, emailBody);
    
    // Log the manual check request
    console.log(`  📧 Manual check email sent for ${rejection.company} - ${rejection.jobTitle}`);
    console.log(`  🔗 Generated ${searchUrls.length} LinkedIn search URLs`);
  }

  private async notifyFound(rejection: RejectionEmail): Promise<void> {
    const message = `🎯 Found who got hired!\n\n` +
      `Company: ${rejection.company}\n` +
      `Position: ${rejection.jobTitle}\n` +
      `Hired: ${rejection.hiredPerson?.name}\n` +
      `Title: ${rejection.hiredPerson?.title}\n` +
      `LinkedIn: ${rejection.hiredPerson?.linkedinUrl || 'N/A'}\n` +
      `Start Date: ${rejection.hiredPerson?.startDate || 'Unknown'}\n\n` +
      `Original rejection: ${rejection.receivedDate.toDateString()}`;

    console.log('✅ ' + message);
    
    // TODO: Send notification (email, Slack, etc.)
    await this.sendNotification('WhoGotHired: Found Match!', message);
  }

  private async notifyGiveUp(rejection: RejectionEmail, reason: string): Promise<void> {
    const message = `⏹️ Giving up search\n\n` +
      `Company: ${rejection.company || 'Unknown'}\n` +
      `Position: ${rejection.jobTitle || 'Unknown'}\n` +
      `Reason: ${reason}\n` +
      `Attempts: ${rejection.checkCount}\n` +
      `Original rejection: ${rejection.receivedDate.toDateString()}`;

    console.log('⏹️ ' + message);
    
    // TODO: Send notification
    await this.sendNotification('WhoGotHired: Giving Up Search', message);
  }

  private async sendNotification(subject: string, message: string): Promise<void> {
    // Try multiple notification methods
    const sent = await this.sendEmailNotification(subject, message) || 
                 await this.sendSlackNotification(subject, message) ||
                 await this.logNotification(subject, message);
    
    if (!sent) {
      console.error('❌ Failed to send notification via any method');
    }
  }

  private async sendEmailNotification(subject: string, message: string): Promise<boolean> {
    try {
      if (!process.env.NOTIFICATION_EMAIL) {
        return false;
      }

      // Use nodemailer if configured
      if (process.env.SMTP_HOST) {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: process.env.NOTIFICATION_EMAIL,
          subject: subject,
          text: message,
          html: message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        });

        console.log(`📧 Email notification sent to ${process.env.NOTIFICATION_EMAIL}`);
        return true;
      }

      // Use Gmail API to send email to yourself
      if (this.gmail && process.env.GOOGLE_REFRESH_TOKEN) {
        const emailContent = [
          `To: ${process.env.NOTIFICATION_EMAIL}`,
          `Subject: ${subject}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          message
        ].join('\n');

        const encodedEmail = Buffer.from(emailContent).toString('base64url');

        await this.gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedEmail
          }
        });

        console.log(`📧 Gmail notification sent to ${process.env.NOTIFICATION_EMAIL}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Email notification failed:', error);
      return false;
    }
  }

  private async sendSlackNotification(subject: string, message: string): Promise<boolean> {
    try {
      if (!process.env.SLACK_WEBHOOK_URL) {
        return false;
      }

      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${subject}\n\n${message}`,
          username: 'WhoGotHired Agent',
          icon_emoji: ':detective:'
        })
      });

      if (response.ok) {
        console.log('💬 Slack notification sent');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Slack notification failed:', error);
      return false;
    }
  }

  private async logNotification(subject: string, message: string): Promise<boolean> {
    try {
      // Log to file as fallback
      const logDir = path.join('logs', 'notifications');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const timestamp = new Date().toISOString();
      const logFile = path.join(logDir, `notifications-${timestamp.split('T')[0]}.log`);
      
      const logEntry = `\n[${timestamp}] ${subject}\n${message}\n${'='.repeat(50)}\n`;
      
      fs.appendFileSync(logFile, logEntry);
      
      console.log(`📝 Notification logged to ${logFile}`);
      console.log(`📢 ${subject}`);
      console.log(message);
      
      return true;
    } catch (error) {
      console.error('❌ Log notification failed:', error);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Required abstract method implementation
  async extract(url: string): Promise<ExtractorResult> {
    // This agent doesn't extract from URLs, but we need to implement the abstract method
    return {
      success: false,
      error: 'WhoGotHiredAgent does not support URL extraction. Use the run() method instead.'
    };
  }

  // Public methods for CLI/manual usage
  async run(): Promise<void> {
    console.log('🚀 Starting WhoGotHired Agent...');
    
    await this.checkForNewRejections();
    await this.processScheduledChecks();
    
    console.log('✅ WhoGotHired Agent completed');
  }

  async status(): Promise<void> {
    console.log('📊 WhoGotHired Agent Status\n');
    console.log(`Total rejections tracked: ${this.tracker.rejections.length}`);
    console.log(`Pending checks: ${this.tracker.rejections.filter(r => r.status === 'pending').length}`);
    console.log(`Found hires: ${this.tracker.rejections.filter(r => r.status === 'found').length}`);
    console.log(`Given up: ${this.tracker.rejections.filter(r => r.status === 'given_up').length}`);
    console.log(`Last sync: ${this.tracker.lastSync.toLocaleString()}\n`);
    
    // Show recent rejections
    const recentRejections = this.tracker.rejections
      .sort((a, b) => b.receivedDate.getTime() - a.receivedDate.getTime())
      .slice(0, 10);

    if (recentRejections.length > 0) {
      console.log('Recent rejections:');
      for (const rejection of recentRejections) {
        const status = rejection.status === 'pending' ? `(${rejection.checkCount} checks)` : rejection.status;
        console.log(`  • ${rejection.company || 'Unknown'} - ${rejection.jobTitle || 'Unknown'} [${status}]`);
      }
    }
  }

  async forceCheck(company: string, jobTitle: string): Promise<void> {
    console.log(`🔍 Force checking: ${company} - ${jobTitle}`);
    
    const mockRejection: RejectionEmail = {
      id: 'manual',
      subject: `Manual check: ${company} - ${jobTitle}`,
      body: '',
      receivedDate: new Date(),
      company,
      jobTitle,
      checkCount: 0,
      status: 'pending'
    };

    const result = await this.searchLinkedInForHire(mockRejection);
    
    if (result) {
      console.log('✅ Found hire:', result);
    } else {
      console.log('📧 Manual check email sent');
    }
  }

  async reportHire(rejectionId: string, hiredPersonName: string, hiredPersonTitle: string, linkedinUrl?: string, startDate?: string): Promise<void> {
    console.log(`🎯 Reporting hire for rejection ID: ${rejectionId}`);
    
    const rejection = this.tracker.rejections.find(r => r.id === rejectionId);
    if (!rejection) {
      console.error(`❌ Rejection with ID ${rejectionId} not found`);
      return;
    }

    // Update the rejection with hire information
    rejection.status = 'found';
    rejection.hiredPerson = {
      name: hiredPersonName,
      title: hiredPersonTitle,
      linkedinUrl: linkedinUrl,
      startDate: startDate
    };

    this.saveTracker();

    // Send confirmation notification
    await this.notifyFound(rejection);
    
    console.log(`✅ Successfully reported hire: ${hiredPersonName} got the ${rejection.jobTitle} role at ${rejection.company}`);
  }

  async giveUpSearch(rejectionId: string, reason?: string): Promise<void> {
    console.log(`⏹️ Giving up search for rejection ID: ${rejectionId}`);
    
    const rejection = this.tracker.rejections.find(r => r.id === rejectionId);
    if (!rejection) {
      console.error(`❌ Rejection with ID ${rejectionId} not found`);
      return;
    }

    rejection.status = 'given_up';
    this.saveTracker();

    await this.notifyGiveUp(rejection, reason || 'Manual give up');
    
    console.log(`✅ Search marked as given up for ${rejection.company} - ${rejection.jobTitle}`);
  }

  async listPendingChecks(): Promise<void> {
    const pending = this.tracker.rejections.filter(r => r.status === 'pending');
    
    if (pending.length === 0) {
      console.log('📭 No pending checks');
      return;
    }

    console.log(`📋 ${pending.length} pending check(s):\n`);
    
    for (const rejection of pending) {
      const daysSinceRejection = Math.floor(
        (Date.now() - rejection.receivedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      console.log(`ID: ${rejection.id}`);
      console.log(`Company: ${rejection.company || 'Unknown'}`);
      console.log(`Position: ${rejection.jobTitle || 'Unknown'}`);
      console.log(`Rejected: ${rejection.receivedDate.toDateString()} (${daysSinceRejection} days ago)`);
      console.log(`Checks: ${rejection.checkCount}`);
      console.log(`Last Check: ${rejection.lastChecked?.toDateString() || 'Never'}`);
      console.log('---');
    }

    console.log('\n💡 To report a hire: npm run dev whogothired:report <rejectionId> "<name>" "<title>"');
    console.log('💡 To give up search: npm run dev whogothired:giveup <rejectionId>');
  }
}