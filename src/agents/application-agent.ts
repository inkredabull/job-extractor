import { BaseAgent } from './base-agent';
import { AgentConfig, ExtractorResult, ApplicationFormField, ApplicationFormData, ApplicationResult } from '../types';
import { ResumeCreatorAgent } from './resume-creator-agent';
import { InterviewPrepAgent } from './interview-prep-agent';
import { OutreachAgent } from './outreach-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { Element } from 'domhandler';
import axios from 'axios';
import { Stagehand } from '@browserbasehq/stagehand';
import * as readline from 'readline';

export class ApplicationAgent extends BaseAgent {
  private resumeAgent: ResumeCreatorAgent;
  private interviewAgent: InterviewPrepAgent;
  private outreachAgent: OutreachAgent;
  private stagehand: Stagehand | null = null;

  constructor(config: AgentConfig, anthropicApiKey: string) {
    super(config);
    // Initialize sub-agents for data retrieval
    this.resumeAgent = new ResumeCreatorAgent(anthropicApiKey);
    this.interviewAgent = new InterviewPrepAgent(anthropicApiKey);
    this.outreachAgent = new OutreachAgent();
  }

  async extract(url: string): Promise<ExtractorResult> {
    throw new Error('ApplicationAgent does not implement extract method. Use fillApplication instead.');
  }

  private async initializeStagehand(jobId: string): Promise<void> {
    console.log('🎭 Initializing Stagehand browser automation...');
    
    this.stagehand = new Stagehand({
      env: 'LOCAL',
      logger: (message: any) => {
        console.log(`🎭 Stagehand: ${message}`);
      }
    });
    
    await this.stagehand.init();
    
    // Invoke OutreachAgent to help with networking during application process
    console.log('');
    console.log('🤝 Setting up networking outreach...');
    console.log('💡 This will open LinkedIn connections page to help with networking while applying');
    try {
      const outreachResult = await this.outreachAgent.findConnections(jobId);
      if (outreachResult.success) {
        console.log(`✅ LinkedIn networking setup complete for ${outreachResult.company}`);
        console.log('🌐 LinkedIn connections page opened - you can network while form is being filled');
        console.log('📝 Outreach instructions and template saved to job logs');
      } else {
        console.log(`⚠️  Outreach setup completed with issues: ${outreachResult.error}`);
      }
    } catch (error) {
      console.log('⚠️  Outreach setup failed (application will continue):', error instanceof Error ? error.message : 'Unknown error');
    }
    console.log('');
  }

  private async cleanupStagehand(): Promise<void> {
    if (this.stagehand) {
      console.log('🧹 Cleaning up Stagehand...');
      await this.stagehand.close();
      this.stagehand = null;
    }
  }

  private async navigateToForm(url: string): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }
    
    console.log(`🌐 Navigating to: ${url}`);
    await this.stagehand.page.goto(url);
    
    // Wait for page to load
    await this.stagehand.page.waitForLoadState('networkidle');
    console.log('✅ Page loaded successfully');
  }

  private async extractFormDataFromPage(url: string): Promise<ApplicationFormData> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }
    
    console.log('🔍 Extracting form fields from page...');
    
    // Use Stagehand to extract form information
    const formFields = await this.stagehand.page.evaluate(() => {
      const fields: ApplicationFormField[] = [];
      
      // Get all form inputs
      const inputs = document.querySelectorAll('input, textarea, select');
      
      Array.from(inputs).forEach((element, index: number) => {
        const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const name = input.name || input.id || `field_${index}`;
        const type = input.type || input.tagName.toLowerCase();
        const required = input.required || input.classList.contains('required');
        
        // Handle placeholder safely
        let placeholder = '';
        if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
          placeholder = (input as HTMLInputElement | HTMLTextAreaElement).placeholder || '';
        }
        
        // Handle maxLength safely
        let maxLength: number | undefined;
        if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
          const maxLengthAttr = (input as HTMLInputElement | HTMLTextAreaElement).maxLength;
          maxLength = maxLengthAttr > 0 ? maxLengthAttr : undefined;
        }
        
        // Find label
        let label = '';
        const id = input.id;
        if (id) {
          const labelEl = document.querySelector(`label[for="${id}"]`);
          if (labelEl) {
            label = labelEl.textContent?.trim() || '';
          }
        }
        
        if (!label) {
          // Look for closest label
          const closest = input.closest('label');
          if (closest) {
            label = closest.textContent?.trim() || '';
          }
        }
        
        if (!label) {
          // Look for previous sibling labels
          const prevSibling = input.previousElementSibling;
          if (prevSibling && prevSibling.tagName === 'LABEL') {
            label = prevSibling.textContent?.trim() || '';
          }
        }
        
        if (!label) {
          label = placeholder || name || 'Unknown Field';
        }
        
        // Handle select options
        let options: string[] | undefined;
        if (type === 'select' && input.tagName === 'SELECT') {
          const select = input as HTMLSelectElement;
          options = Array.from(select.options)
            .map(option => option.text.trim())
            .filter(text => text && text !== 'Select...');
        }
        
        fields.push({
          name,
          type,
          label,
          required,
          options,
          placeholder,
          maxLength
        });
      });
      
      return fields;
    });
    
    // Find submit button
    const submitButton = await this.stagehand.page.evaluate(() => {
      const buttons = document.querySelectorAll('input[type="submit"], button[type="submit"], button');
      
      for (const button of Array.from(buttons)) {
        const text = button.textContent?.toLowerCase() || '';
        const value = (button as HTMLInputElement).value?.toLowerCase() || '';
        
        if (text.includes('submit') || text.includes('apply') || text.includes('send') || 
            value.includes('submit') || value.includes('apply') || value.includes('send')) {
          return {
            text: button.textContent || (button as HTMLInputElement).value || 'Submit',
            selector: button.id ? `#${button.id}` : button.className ? `.${button.className.split(' ')[0]}` : 'button'
          };
        }
      }
      
      return null;
    });
    
    return {
      url,
      fields: formFields,
      submitButton: submitButton || undefined
    };
  }

  private async fillFormWithStagehand(formData: ApplicationFormData, applicationData: any): Promise<Record<string, string>> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }
    
    const hasCachedFields = applicationData.cachedFields && Object.keys(applicationData.cachedFields).length > 0;
    
    if (hasCachedFields) {
      console.log('🔄 Using cached field values from previous application...');
      console.log('👀 You can watch the form being filled in the browser window');
    } else {
      console.log('🤖 Filling form fields with AI-generated values...');
      console.log('👀 You can watch the form being filled in the browser window');
    }
    
    const filledFields: Record<string, string> = {};
    
    for (const field of formData.fields) {
      try {
        let value = '';
        
        // First, try to use cached value if available
        if (hasCachedFields && applicationData.cachedFields[field.name]) {
          value = applicationData.cachedFields[field.name];
          console.log(`🔄 Using cached value for field: ${field.label} = "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);
        } else {
          // Generate value using AI if no cached value
          value = await this.generateFieldValue(field, applicationData);
          if (!value) continue;
          console.log(`🤖 Generated new value for field: ${field.label} = "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);
        }
        
        // Fill the field using Stagehand
        await this.fillFieldWithStagehand(field, value);
        
        filledFields[field.name] = value;
        
        // Small delay to make it visible to user
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.warn(`⚠️  Failed to fill field ${field.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return filledFields;
  }

  private async fillFieldWithStagehand(field: ApplicationFormField, value: string): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }
    
    // Try different selector strategies
    const selectors = [
      `input[name="${field.name}"]`,
      `textarea[name="${field.name}"]`,
      `select[name="${field.name}"]`,
      `#${field.name}`,
      `[name="${field.name}"]`
    ];
    
    for (const selector of selectors) {
      try {
        const element = await this.stagehand.page.locator(selector).first();
        const isVisible = await element.isVisible();
        
        if (isVisible) {
          if (field.type === 'select') {
            // For select fields, select by text or value
            await element.selectOption({ label: value });
          } else if (field.type === 'checkbox' || field.type === 'radio') {
            // For checkboxes/radios, check if value indicates selection
            if (value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value === '1') {
              await element.check();
            }
          } else {
            // For text fields, clear and type
            await element.clear();
            await element.fill(value);
          }
          
          return; // Success, exit the loop
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    // If we get here, we couldn't find the field
    console.warn(`⚠️  Could not locate field: ${field.name} (${field.label})`);
  }

  private async askUserForSubmission(): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise<boolean>((resolve) => {
      console.log('\\n🚀 Form filling complete! Review the filled form in the browser.');
      console.log('=' .repeat(50));
      rl.question('Do you want to submit the form? (y/n): ', (answer: string) => {
        rl.close();
        const response = answer.toLowerCase().trim();
        const shouldSubmit = response === 'y' || response === 'yes';
        
        if (shouldSubmit) {
          console.log('✅ Form will be submitted');
        } else {
          console.log('❌ Form will not be submitted');
        }
        console.log('');
        
        resolve(shouldSubmit);
      });
    });
  }

  private async submitForm(formData: ApplicationFormData): Promise<boolean> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }
    
    if (!formData.submitButton) {
      console.log('⚠️  No submit button found, cannot submit form');
      return false;
    }
    
    try {
      console.log('🚀 Submitting form...');
      
      // Click the submit button
      await this.stagehand.page.click(formData.submitButton.selector);
      
      // Wait for navigation or success indication
      await this.stagehand.page.waitForLoadState('networkidle');
      
      console.log('✅ Form submitted successfully!');
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to submit form: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async fillApplication(applicationUrl: string, jobId: string): Promise<ApplicationResult> {
    try {
      console.log('🎯 Starting automated application form filling...');
      console.log(`📋 Application URL: ${applicationUrl}`);
      console.log(`📊 Job ID: ${jobId}`);

      // Step 1: Load existing resume and interview prep data (generate resume if needed)
      const applicationData = await this.loadApplicationData(jobId);
      
      // Step 2: Initialize Stagehand for browser automation (only after resume is ready)
      await this.initializeStagehand(jobId);
      
      // Step 3: Navigate to the application form
      await this.navigateToForm(applicationUrl);
      
      // Step 4: Extract form fields from the page
      const formData = await this.extractFormDataFromPage(applicationUrl);
      
      // Step 5: Fill the form using Stagehand with AI-generated values
      const filledFields = await this.fillFormWithStagehand(formData, applicationData);
      
      // Step 6: Ask user if they want to submit
      const shouldSubmit = await this.askUserForSubmission();
      
      // Step 7: Submit if approved
      let submitted = false;
      if (shouldSubmit) {
        submitted = await this.submitForm(formData);
      }
      
      // Step 8: Log the results
      this.logApplicationSession(jobId, applicationUrl, formData, filledFields, submitted);
      
      // Step 9: Display results
      const usedCachedFields = applicationData.cachedFields && Object.keys(applicationData.cachedFields).length > 0;
      this.displayApplicationResults(formData, filledFields, submitted, usedCachedFields);
      
      return {
        success: true,
        formData,
        filledFields,
        readyToSubmit: true,
        submitted,
        instructions: this.generateSubmissionInstructions(applicationUrl, filledFields)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      // Clean up Stagehand
      await this.cleanupStagehand();
    }
  }

  private async parseApplicationForm(url: string): Promise<ApplicationFormData> {
    console.log('🔍 Parsing application form structure...');
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const fields: ApplicationFormField[] = [];
      
      // Parse form fields
      $('input, textarea, select').each((i, element) => {
        const $el = $(element);
        const name = $el.attr('name') || $el.attr('id') || `field_${i}`;
        const type = $el.attr('type') || element.tagName.toLowerCase();
        const label = this.extractFieldLabel($, $el);
        const required = $el.attr('required') !== undefined || $el.hasClass('required');
        const placeholder = $el.attr('placeholder');
        const maxLength = $el.attr('maxlength') ? parseInt($el.attr('maxlength')!) : undefined;
        
        let options: string[] | undefined;
        if (type === 'select') {
          options = [];
          $el.find('option').each((j, option) => {
            const optionText = $(option).text().trim();
            if (optionText && optionText !== 'Select...') {
              options!.push(optionText);
            }
          });
        }
        
        fields.push({
          name,
          type,
          label,
          required,
          options,
          placeholder,
          maxLength
        });
      });
      
      // Find submit button
      const submitButton = $('input[type="submit"], button[type="submit"], button:contains("Submit"), button:contains("Apply")').first();
      
      return {
        url,
        fields,
        submitButton: submitButton.length > 0 ? {
          text: submitButton.text() || submitButton.attr('value') || 'Submit',
          selector: this.getElementSelector(submitButton)
        } : undefined
      };
      
    } catch (error) {
      throw new Error(`Failed to parse application form: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractFieldLabel($: cheerio.CheerioAPI, $el: cheerio.Cheerio<Element>): string {
    // Try to find label by various methods
    const id = $el.attr('id');
    if (id) {
      const label = $(`label[for="${id}"]`).text().trim();
      if (label) return label;
    }
    
    // Look for closest label
    const closestLabel = $el.closest('label').text().trim();
    if (closestLabel) return closestLabel;
    
    // Look for preceding label
    const prevLabel = $el.prev('label').text().trim();
    if (prevLabel) return prevLabel;
    
    // Look for parent with label
    const parentLabel = $el.parent().find('label').first().text().trim();
    if (parentLabel) return parentLabel;
    
    // Fallback to placeholder or name
    return $el.attr('placeholder') || $el.attr('name') || 'Unknown Field';
  }

  private getElementSelector(element: cheerio.Cheerio<Element>): string {
    const id = element.attr('id');
    if (id) return `#${id}`;
    
    const classes = element.attr('class');
    if (classes) return `.${classes.split(' ')[0]}`;
    
    return element.prop('tagName')?.toLowerCase() || 'button';
  }

  private async loadApplicationData(jobId: string): Promise<any> {
    console.log('📄 Loading resume and interview prep data...');
    
    const jobDir = path.resolve('logs', jobId);
    if (!fs.existsSync(jobDir)) {
      throw new Error(`Job directory not found for ID: ${jobId}`);
    }
    
    const data: any = {
      personalInfo: this.extractPersonalInfo(),
      resume: null,
      statements: {},
      cachedFields: null
    };
    
    // Check for existing application data (cached field values)
    const applicationFiles = fs.readdirSync(jobDir).filter(f => f.startsWith('application-') && f.endsWith('.json'));
    if (applicationFiles.length > 0) {
      const mostRecentApp = applicationFiles.sort().reverse()[0]; // Most recent
      const appPath = path.join(jobDir, mostRecentApp);
      const appData = JSON.parse(fs.readFileSync(appPath, 'utf-8'));
      if (appData.filledFields) {
        data.cachedFields = appData.filledFields;
        console.log(`🔄 Found existing application data: ${mostRecentApp}`);
        console.log(`📋 Cached field values available: ${Object.keys(data.cachedFields).length} fields`);
      }
    }
    
    // Load resume data
    const resumeFiles = fs.readdirSync(jobDir).filter(f => f.startsWith('tailored-') && f.endsWith('.json'));
    if (resumeFiles.length > 0) {
      const resumeFile = resumeFiles.sort().reverse()[0]; // Most recent
      const resumePath = path.join(jobDir, resumeFile);
      data.resume = JSON.parse(fs.readFileSync(resumePath, 'utf-8'));
      console.log(`✅ Loaded resume from: ${resumeFile}`);
    } else {
      // Auto-generate resume if it doesn't exist
      console.log('');
      console.log('📄 No resume found for this job. Generating tailored resume...');
      
      try {
        const resumeResult = await this.generateResumeForJob(jobId);
        if (resumeResult.success) {
          console.log(`✅ Resume generated successfully: ${resumeResult.pdfPath}`);
          // Reload the data to include the newly generated resume
          const reloadedData = await this.loadApplicationData(jobId);
          Object.assign(data, reloadedData);
        } else {
          console.log('❌ Failed to generate resume. Application form filling will proceed without resume data.');
        }
      } catch (error) {
        console.log(`❌ Error generating resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('Application form filling will proceed without resume data.');
      }
      console.log('');
    }
    
    // Load interview prep statements
    const statementFiles = fs.readdirSync(jobDir).filter(f => f.startsWith('interview-prep-') && f.endsWith('.json'));
    console.log(`🔍 Found ${statementFiles.length} interview prep files: ${statementFiles.join(', ')}`);
    
    for (const file of statementFiles) {
      const filePath = path.join(jobDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // Extract type from filename - format: interview-prep-{type}-{hash}-{timestamp}.json
      const parts = file.split('-');
      if (parts.length >= 3) {
        const type = parts[2]; // Extract type from filename
        data.statements[type] = content;
        console.log(`📝 Loaded statement type: ${type} from ${file}`);
      }
    }
    
    console.log(`📊 Final statement keys available: ${Object.keys(data.statements).join(', ')}`);
    
    // Warn if no interview prep statements are available
    if (Object.keys(data.statements).length === 0) {
      console.log('');
      console.log('⚠️  WARNING: NO INTERVIEW PREP STATEMENTS FOUND!');
      console.log('🚨 APPLICATION FORM FILLING WILL BE LIMITED WITHOUT INTERVIEW PREP CONTENT.');
      console.log('');
      console.log('RECOMMENDED: Generate interview prep statements first:');
      console.log(`  npm run dev prep cover-letter ${jobId}`);
      console.log(`  npm run dev prep about-me ${jobId}`);
      console.log('');
      console.log('Then retry the apply command for optimal results.');
      console.log('');
    }
    
    return data;
  }

  private async generateResumeForJob(jobId: string): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    try {
      console.log('🔄 Generating tailored resume using ResumeCreatorAgent...');
      
      // Find CV file
      const cvFiles = ['cv.txt', 'CV.txt', 'sample-cv.txt'];
      let cvFilePath = '';
      
      for (const cvFile of cvFiles) {
        if (fs.existsSync(cvFile)) {
          cvFilePath = cvFile;
          break;
        }
      }
      
      if (!cvFilePath) {
        return {
          success: false,
          error: 'No CV file found. Please ensure cv.txt, CV.txt, or sample-cv.txt exists in the current directory.'
        };
      }
      
      // Use ResumeCreatorAgent to generate resume
      const resumeResult = await this.resumeAgent.createResume(jobId, cvFilePath);
      
      if (resumeResult.success && resumeResult.pdfPath) {
        return {
          success: true,
          pdfPath: resumeResult.pdfPath
        };
      } else {
        return {
          success: false,
          error: resumeResult.error || 'Failed to generate resume'
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private extractPersonalInfo(): any {
    // Extract from CV file
    try {
      const cvContent = fs.readFileSync('cv.txt', 'utf-8');
      const lines = cvContent.split('\n');
      
      const personalInfo: any = {};
      
      // Extract name (first line)
      personalInfo.name = lines[0]?.trim() || 'Anthony Bull';
      
      // Extract contact info from second line
      const contactLine = lines[1] || '';
      const emailMatch = contactLine.match(/[\w.-]+@[\w.-]+\.\w+/);
      const phoneMatch = contactLine.match(/\+?[\d\s()-]+/);
      
      personalInfo.email = emailMatch ? emailMatch[0] : 'anthony@bluxomelabs.com';
      personalInfo.phone = phoneMatch ? phoneMatch[0].trim() : '+1 415-269-4893';
      personalInfo.location = 'San Francisco, CA';
      
      return personalInfo;
    } catch (error) {
      // Fallback personal info
      return {
        name: 'Anthony Bull',
        email: 'anthony@bluxomelabs.com',
        phone: '+1 415-269-4893',
        location: 'San Francisco, CA'
      };
    }
  }

  private async fillFormFields(formData: ApplicationFormData, applicationData: any): Promise<Record<string, string>> {
    console.log('🤖 Using AI to fill form fields...');
    
    const filledFields: Record<string, string> = {};
    
    for (const field of formData.fields) {
      try {
        const value = await this.generateFieldValue(field, applicationData);
        if (value) {
          filledFields[field.name] = value;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to fill field ${field.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return filledFields;
  }

  private async generateFieldValue(field: ApplicationFormField, applicationData: any): Promise<string> {
    // Debug logging
    console.log(`🔍 Analyzing field: ${field.label} (${field.name})`);
    console.log(`📋 Available statements: ${Object.keys(applicationData.statements).join(', ')}`);
    
    // First, check if this is a cover letter field and we have cover letter data
    if (this.isCoverLetterField(field)) {
      console.log(`✅ Detected cover letter field: ${field.label}`);
      
      // Try different statement key variations
      const possibleKeys = ['cover', 'letter', 'coverletter', 'cover-letter'];
      for (const key of possibleKeys) {
        if (applicationData.statements[key]?.content) {
          const coverLetterContent = applicationData.statements[key].content;
          console.log(`📝 Using cover letter content from key: ${key}`);
          // Truncate if needed
          if (field.maxLength && coverLetterContent.length > field.maxLength) {
            return coverLetterContent.substring(0, field.maxLength);
          }
          return coverLetterContent;
        }
      }
    }

    // Check for other specific field types
    if (this.isAboutMeField(field)) {
      console.log(`✅ Detected about me field: ${field.label}`);
      const possibleKeys = ['about', 'me', 'aboutme', 'about-me', 'general', 'summary'];
      for (const key of possibleKeys) {
        if (applicationData.statements[key]?.content) {
          const aboutMeContent = applicationData.statements[key].content;
          console.log(`📝 Using about me content from key: ${key}`);
          // Truncate if needed
          if (field.maxLength && aboutMeContent.length > field.maxLength) {
            return aboutMeContent.substring(0, field.maxLength);
          }
          return aboutMeContent;
        }
      }
      console.log(`⚠️  No about me content found in keys: ${possibleKeys.join(', ')}`);
    }

    // Check for experience/leadership questions
    if (this.isExperienceField(field)) {
      console.log(`✅ Detected experience field: ${field.label}`);
      return await this.generateExperienceResponse(field, applicationData);
    }

    const prompt = `You are an expert job application assistant. Based on the candidate's information, provide an appropriate response for this form field.

Field Information:
- Name: ${field.name}
- Type: ${field.type}
- Label: ${field.label}
- Required: ${field.required}
- Max Length: ${field.maxLength || 'No limit'}
- Options: ${field.options ? field.options.join(', ') : 'None'}
- Placeholder: ${field.placeholder || 'None'}

Candidate Information:
- Name: ${applicationData.personalInfo.name}
- Email: ${applicationData.personalInfo.email}
- Phone: ${applicationData.personalInfo.phone}
- Location: ${applicationData.personalInfo.location}

Resume Data Available: ${applicationData.resume ? 'Yes' : 'No'}
Interview Statements Available: ${Object.keys(applicationData.statements).join(', ') || 'None'}

Available Statement Content:
${Object.keys(applicationData.statements).map(key => `- ${key}: ${applicationData.statements[key].content ? 'Available' : 'Not available'}`).join('\n')}

Instructions:
1. If this is a personal information field (name, email, phone, etc.), use the exact personal info provided
2. If this is a dropdown/select field, choose the most appropriate option from the available choices
3. If this is a cover letter field, use the cover-letter statement content if available
4. If this is an about me/motivation field, use the about-me statement content if available
5. If this is a text field asking for experience, use information from the resume or interview statements
6. Keep responses within the character limit if specified
7. Be professional and accurate
8. If you cannot determine an appropriate value, return "SKIP"

Provide only the field value, nothing else:`;

    const response = await this.makeOpenAIRequest(prompt, 500);
    const value = response.trim();
    
    if (value === 'SKIP' || !value) {
      return '';
    }
    
    // Validate against field constraints
    if (field.maxLength && value.length > field.maxLength) {
      return value.substring(0, field.maxLength);
    }
    
    if (field.options && !field.options.includes(value)) {
      // Try to find a close match
      const match = field.options.find(option => 
        option.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(option.toLowerCase())
      );
      return match || field.options[0];
    }
    
    return value;
  }

  private isCoverLetterField(field: ApplicationFormField): boolean {
    const label = field.label.toLowerCase();
    const name = field.name.toLowerCase();
    const placeholder = field.placeholder?.toLowerCase() || '';
    
    // Check for cover letter indicators
    const coverLetterKeywords = [
      'cover letter', 'coverletter', 'cover_letter',
      'motivation', 'motivational', 'letter',
      'why do you want', 'why are you interested',
      'tell us why', 'explain why'
    ];
    
    const isMatch = coverLetterKeywords.some(keyword => 
      label.includes(keyword) || 
      name.includes(keyword) || 
      placeholder.includes(keyword)
    );
    
    if (isMatch) {
      console.log(`🔍 Cover letter field detected: "${field.label}" (matched keywords: ${coverLetterKeywords.filter(k => label.includes(k) || name.includes(k) || placeholder.includes(k)).join(', ')})`);
    }
    
    return isMatch;
  }

  private isAboutMeField(field: ApplicationFormField): boolean {
    const label = field.label.toLowerCase();
    const name = field.name.toLowerCase();
    const placeholder = field.placeholder?.toLowerCase() || '';
    
    // Check for about me indicators
    const aboutMeKeywords = [
      'about me', 'about you', 'about yourself',
      'tell us about', 'describe yourself',
      'your background', 'personal statement',
      'introduction', 'bio', 'biography',
      'summary', 'overview', 'profile'
    ];
    
    const isMatch = aboutMeKeywords.some(keyword => 
      label.includes(keyword) || 
      name.includes(keyword) || 
      placeholder.includes(keyword)
    );
    
    if (isMatch) {
      console.log(`🔍 About me field detected: "${field.label}" (matched keywords: ${aboutMeKeywords.filter(k => label.includes(k) || name.includes(k) || placeholder.includes(k)).join(', ')})`);
    }
    
    return isMatch;
  }

  private isExperienceField(field: ApplicationFormField): boolean {
    const label = field.label.toLowerCase();
    const name = field.name.toLowerCase();
    const placeholder = field.placeholder?.toLowerCase() || '';
    
    // Check for experience/leadership question indicators
    const experienceKeywords = [
      'how have you', 'describe a time', 'tell us about a time',
      'give an example', 'provide an example',
      'scaled', 'scaling', 'growth', 'team', 'teams',
      'leadership', 'management', 'managed',
      'experience with', 'worked with', 'built',
      'challenge', 'problem', 'solved', 'fix', 'fixed',
      'implemented', 'developed', 'created',
      'what broke', 'what did you do', 'how did you handle'
    ];
    
    return experienceKeywords.some(keyword => 
      label.includes(keyword) || 
      name.includes(keyword) || 
      placeholder.includes(keyword)
    );
  }

  private async generateExperienceResponse(field: ApplicationFormField, applicationData: any): Promise<string> {
    // Try to get CV content
    let cvContent = '';
    try {
      cvContent = fs.readFileSync('cv.txt', 'utf-8');
    } catch (error) {
      console.warn('⚠️  Could not load cv.txt for experience response');
    }

    // Also try to get resume content if available
    let resumeContent = '';
    if (applicationData.resume?.content) {
      resumeContent = applicationData.resume.content;
    }

    const prompt = `You are an expert at crafting compelling answers to job application questions based on a candidate's work history. 

Question: ${field.label}

Work History (CV):
${cvContent}

${resumeContent ? `Resume Content:\n${resumeContent}\n\n` : ''}

Instructions:
1. Analyze the work history to find relevant experiences that answer this specific question
2. Focus on concrete examples with measurable outcomes
3. Use the STAR method (Situation, Task, Action, Result) if applicable
4. Be specific about technologies, team sizes, growth metrics, and business impact
5. If the question asks about scaling or growth, look for examples of team expansion, system scaling, or process improvements
6. If the question asks about challenges or problems, look for examples of technical debt, system failures, or organizational issues that were resolved
7. Keep the response within ${field.maxLength || 2000} characters
8. Be professional and confident
9. If no relevant experience is found, return "SKIP"

Provide a compelling, specific response that demonstrates relevant experience:`;

    const response = await this.makeOpenAIRequest(prompt, 1000); // Increased token limit for experience responses
    const value = response.trim();
    
    if (value === 'SKIP' || !value) {
      return '';
    }

    // Truncate if needed
    if (field.maxLength && value.length > field.maxLength) {
      return value.substring(0, field.maxLength);
    }

    return value;
  }

  private displayApplicationResults(formData: ApplicationFormData, filledFields: Record<string, string>, submitted: boolean = false, usedCachedFields: boolean = false): void {
    console.log('\n🎯 Application Form Processing Complete');
    console.log('=' .repeat(80));
    console.log(`📋 Form URL: ${formData.url}`);
    console.log(`📊 Total Fields: ${formData.fields.length}`);
    console.log(`✅ Filled Fields: ${Object.keys(filledFields).length}`);
    console.log(`🔄 Used Cached Values: ${usedCachedFields ? 'Yes' : 'No'}`);
    console.log(`🚀 Submitted: ${submitted ? 'Yes' : 'No'}`);
    console.log('');
    
    console.log('📄 Field Values:');
    console.log('-' .repeat(50));
    
    formData.fields.forEach(field => {
      const value = filledFields[field.name] || '[NOT FILLED]';
      const truncatedValue = value.length > 60 ? value.substring(0, 60) + '...' : value;
      const requiredFlag = field.required ? ' *' : '';
      
      console.log(`${field.label}${requiredFlag}:`);
      console.log(`  Value: ${truncatedValue}`);
      console.log(`  Type: ${field.type}`);
      console.log('');
    });
    
    if (formData.submitButton) {
      console.log('🚀 Submit Button Found:');
      console.log(`  Text: ${formData.submitButton.text}`);
      console.log(`  Selector: ${formData.submitButton.selector}`);
    }
    
    if (submitted) {
      console.log('\n✅ Form has been successfully submitted!');
    } else {
      console.log('\n⚠️  Form was not submitted. You can review it in the browser.');
    }
    
    console.log('\n🤝 Networking Resources:');
    console.log('   • LinkedIn connections page was opened during setup');
    console.log('   • Check job logs for outreach instructions and connection templates');
    console.log('   • Use these resources for follow-up networking after application');
  }

  private generateSubmissionInstructions(url: string, filledFields: Record<string, string>): string {
    return `
🎯 Application Ready for Review

To complete the application:
1. Visit: ${url}
2. Review each field value generated by the AI
3. Make any necessary adjustments
4. Click the submit button when ready

📋 Fields populated: ${Object.keys(filledFields).length}
⚠️  Always review AI-generated content before submitting!
    `.trim();
  }

  private logApplicationSession(jobId: string, url: string, formData: ApplicationFormData, filledFields: Record<string, string>, submitted: boolean = false): void {
    try {
      const jobDir = path.resolve('logs', jobId);
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logData = {
        timestamp: new Date().toISOString(),
        jobId,
        applicationUrl: url,
        formData,
        filledFields,
        fieldCount: formData.fields.length,
        filledCount: Object.keys(filledFields).length,
        submitted,
        automatedFilling: true,
        tool: 'Stagehand'
      };
      
      const logPath = path.join(jobDir, `application-${timestamp}.json`);
      fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
      console.log(`📝 Application session logged to: ${logPath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to log application session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}