import { BaseAgent } from './base-agent';
import { AgentConfig, ExtractorResult, ApplicationFormField, ApplicationFormData, ApplicationResult } from '../types';
import { ResumeCreatorAgent } from './resume-creator-agent';
import { InterviewPrepAgent } from './interview-prep-agent';
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
  private stagehand: Stagehand | null = null;

  constructor(config: AgentConfig, anthropicApiKey: string) {
    super(config);
    // Initialize sub-agents for data retrieval
    this.resumeAgent = new ResumeCreatorAgent(anthropicApiKey);
    this.interviewAgent = new InterviewPrepAgent(anthropicApiKey);
  }

  async extract(url: string): Promise<ExtractorResult> {
    throw new Error('ApplicationAgent does not implement extract method. Use fillApplication instead.');
  }

  private async initializeStagehand(): Promise<void> {
    console.log('🎭 Initializing Stagehand browser automation...');
    
    this.stagehand = new Stagehand({
      env: 'LOCAL',
      logger: (message: any) => {
        console.log(`🎭 Stagehand: ${message}`);
      }
    });
    
    await this.stagehand.init();
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
    
    console.log('🤖 Filling form fields with AI-generated values...');
    console.log('👀 You can watch the form being filled in the browser window');
    
    const filledFields: Record<string, string> = {};
    
    for (const field of formData.fields) {
      try {
        // Generate value using AI
        const value = await this.generateFieldValue(field, applicationData);
        if (!value) continue;
        
        console.log(`📝 Filling field: ${field.label} = "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);
        
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

      // Step 1: Initialize Stagehand for browser automation
      await this.initializeStagehand();
      
      // Step 2: Load existing resume and interview prep data
      const applicationData = await this.loadApplicationData(jobId);
      
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
      this.displayApplicationResults(formData, filledFields, submitted);
      
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
      statements: {}
    };
    
    // Load resume data
    const resumeFiles = fs.readdirSync(jobDir).filter(f => f.startsWith('tailored-') && f.endsWith('.json'));
    if (resumeFiles.length > 0) {
      const resumeFile = resumeFiles.sort().reverse()[0]; // Most recent
      const resumePath = path.join(jobDir, resumeFile);
      data.resume = JSON.parse(fs.readFileSync(resumePath, 'utf-8'));
    }
    
    // Load interview prep statements
    const statementFiles = fs.readdirSync(jobDir).filter(f => f.startsWith('interview-prep-') && f.endsWith('.json'));
    for (const file of statementFiles) {
      const filePath = path.join(jobDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const type = file.split('-')[2]; // Extract type from filename
      data.statements[type] = content;
    }
    
    return data;
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

Instructions:
1. If this is a personal information field (name, email, phone, etc.), use the exact personal info provided
2. If this is a dropdown/select field, choose the most appropriate option from the available choices
3. If this is a text field asking for experience, use information from the resume or interview statements
4. If this is a cover letter or motivation field, use the cover letter or about-me statement content
5. Keep responses within the character limit if specified
6. Be professional and accurate
7. If you cannot determine an appropriate value, return "SKIP"

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

  private displayApplicationResults(formData: ApplicationFormData, filledFields: Record<string, string>, submitted: boolean = false): void {
    console.log('\n🎯 Application Form Processing Complete');
    console.log('=' .repeat(80));
    console.log(`📋 Form URL: ${formData.url}`);
    console.log(`📊 Total Fields: ${formData.fields.length}`);
    console.log(`✅ Filled Fields: ${Object.keys(filledFields).length}`);
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