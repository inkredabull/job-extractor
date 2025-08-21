import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { JobListing } from '../types';

interface ReminderConfig {
  list_name: string;
  default_priority: number;
  tags: string;
  due_date: {
    today: boolean;
    days_offset: number;
    time: string;
  };
  title_template: string;
  notes_template: string;
}

interface ReminderData {
  title: string;
  notes: string;
  list: string;
  priority: number;
  tags: string[];
  dueDate?: string;
  dueTime?: string;
}

export class MacOSReminderService {
  private config!: ReminderConfig; // Definite assignment assertion
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.resolve('macos-reminder-config.yaml');
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      // If the config file doesn't exist, try to use the example file
      let configFile = this.configPath;
      if (!fs.existsSync(this.configPath)) {
        const examplePath = this.configPath + '.example';
        if (fs.existsSync(examplePath)) {
          console.log(`⚠️  Config file not found at ${this.configPath}, using example file`);
          console.log(`💡 Copy ${examplePath} to ${this.configPath} to customize settings`);
          configFile = examplePath;
        } else {
          throw new Error(`Config file not found: ${this.configPath} (and no .example file found)`);
        }
      }

      const configContent = fs.readFileSync(configFile, 'utf8');
      const configData = yaml.load(configContent) as { reminder_config: ReminderConfig };
      this.config = configData.reminder_config;

      console.log('📋 macOS reminder config loaded from:', configFile);
    } catch (error) {
      console.error('❌ Failed to load macOS reminder config:', error);
      throw new Error(`Failed to load reminder config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a reminder for a tracked job
   */
  async createJobReminder(jobData: JobListing, jobId: string, jobUrl?: string): Promise<boolean> {
    try {
      const reminderData = this.prepareReminderData(jobData, jobId, jobUrl);
      
      console.log('📝 Creating macOS reminder for job:', {
        title: reminderData.title,
        list: reminderData.list,
        priority: reminderData.priority
      });

      const success = await this.createReminder(reminderData);
      
      if (success) {
        console.log('✅ Successfully created job tracking reminder');
        return true;
      } else {
        console.error('❌ Failed to create job tracking reminder');
        return false;
      }
    } catch (error) {
      console.error('❌ Error creating job reminder:', error);
      return false;
    }
  }

  private prepareReminderData(jobData: JobListing, jobId: string, jobUrl?: string): ReminderData {
    // Prepare template variables
    const variables = {
      title: jobData.title || 'Unknown Position',
      company: jobData.company || 'Unknown Company',
      location: jobData.location || 'Unknown Location',
      url: jobUrl || 'No URL provided',
      jobId: jobId
    };

    // Replace variables in title template
    let title = this.config.title_template;
    Object.entries(variables).forEach(([key, value]) => {
      title = title.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    // Replace variables in notes template
    let notes = this.config.notes_template;
    Object.entries(variables).forEach(([key, value]) => {
      notes = notes.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    // Parse tags
    const tags = this.config.tags.split(/\s+/).filter(tag => tag.length > 0);

    // Calculate due date
    let dueDate: string | undefined;
    let dueTime: string | undefined;

    if (this.config.due_date.today) {
      dueDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
    } else if (this.config.due_date.days_offset > 0) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + this.config.due_date.days_offset);
      dueDate = targetDate.toISOString().split('T')[0];
    }

    if (this.config.due_date.time && this.config.due_date.time.trim()) {
      dueTime = this.config.due_date.time;
    }

    return {
      title,
      notes,
      list: this.config.list_name,
      priority: this.config.default_priority,
      tags,
      dueDate,
      dueTime
    };
  }

  private async createReminder(reminderData: ReminderData): Promise<boolean> {
    try {
      console.log('📝 Creating reminder using AppleScript:', {
        list: reminderData.list,
        title: reminderData.title
      });

      // Build AppleScript to create reminder (create list if it doesn't exist)
      let appleScript = `
tell application "Reminders"
  -- Try to get the list, create it if it doesn't exist
  try
    set reminderList to list "${reminderData.list}"
  on error
    set reminderList to make new list with properties {name:"${reminderData.list}"}
  end try
  
  set newReminder to make new reminder in reminderList with properties {name:"${reminderData.title.replace(/"/g, '\\"')}"`;

      // Add notes if provided
      if (reminderData.notes && reminderData.notes.trim()) {
        const escapedNotes = reminderData.notes.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        appleScript += `, body:"${escapedNotes}"`;
      }

      // Add due date if provided
      if (reminderData.dueDate) {
        appleScript += `, due date:date "${reminderData.dueDate}"`;
      }

      // Note: Skip priority for now - AppleScript priority handling is complex

      appleScript += `}
end tell`;

      console.log('🔧 Executing AppleScript to create reminder');
      
      // Execute AppleScript using osascript (write to temp file to avoid quoting issues)
      const { execSync } = await import('child_process');
      const tempScriptFile = path.join(__dirname, '../../temp-reminder-script.scpt');
      
      // Write script to temporary file
      fs.writeFileSync(tempScriptFile, appleScript, 'utf8');
      
      try {
        const result = execSync(`osascript "${tempScriptFile}"`, {
          encoding: 'utf8',
          timeout: 10000 // 10 second timeout
        });
        
        // Clean up temp file
        fs.unlinkSync(tempScriptFile);
      } catch (error) {
        // Clean up temp file even on error
        try { fs.unlinkSync(tempScriptFile); } catch {}
        throw error;
      }

      console.log('✅ Reminder created successfully via AppleScript');
      return true;

    } catch (error) {
      console.error('❌ Failed to create reminder via AppleScript:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.error('⏰ AppleScript execution timed out');
        } else if (error.message.includes('execution error')) {
          console.error('📱 Reminders app permission may be required');
          console.error('💡 Go to System Preferences > Privacy & Security > Automation to grant permissions');
        }
      }
      
      return false;
    }
  }

  /**
   * Test the AppleScript reminder creation
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing AppleScript access to Reminders app...');
      
      // Test simple AppleScript execution
      const { execSync } = await import('child_process');
      const testScript = `tell application "Reminders" to get name of lists`;
      
      const result = execSync(`osascript -e '${testScript}'`, {
        encoding: 'utf8',
        timeout: 5000
      });

      console.log('✅ Reminders app access successful');
      console.log('📝 Available reminder lists:', result.trim());
      return true;

    } catch (error) {
      console.error('❌ Reminders app access test failed:', error);
      
      if (error instanceof Error && error.message.includes('execution error')) {
        console.error('📱 Reminders app permission may be required');
        console.error('💡 Go to System Preferences > Privacy & Security > Automation to grant permissions');
      }
      
      return false;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): ReminderConfig {
    return { ...this.config };
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(): void {
    this.loadConfig();
  }
}