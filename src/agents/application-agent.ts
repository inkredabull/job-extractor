import { BaseAgent } from './base-agent';
import { AgentConfig, ExtractorResult, ApplicationFormField, ApplicationFormData, ApplicationResult } from '../types';
import { ResumeCreatorAgent } from './resume-creator-agent';
import { InterviewPrepAgent } from './interview-prep-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import axios from 'axios';

export class ApplicationAgent extends BaseAgent {
  private resumeAgent: ResumeCreatorAgent;
  private interviewAgent: InterviewPrepAgent;

  constructor(config: AgentConfig, anthropicApiKey: string) {
    super(config);
    // Initialize sub-agents for data retrieval
    this.resumeAgent = new ResumeCreatorAgent(anthropicApiKey);
    this.interviewAgent = new InterviewPrepAgent(anthropicApiKey);
  }

  async extract(url: string): Promise<ExtractorResult> {
    throw new Error('ApplicationAgent does not implement extract method. Use fillApplication instead.');
  }

  async fillApplication(applicationUrl: string, jobId: string): Promise<ApplicationResult> {
    try {
      console.log('🎯 Starting application form analysis...');
      console.log(`📋 Application URL: ${applicationUrl}`);
      console.log(`📊 Job ID: ${jobId}`);

      // Step 1: Parse the application form
      const formData = await this.parseApplicationForm(applicationUrl);
      
      // Step 2: Load existing resume and interview prep data
      const applicationData = await this.loadApplicationData(jobId);
      
      // Step 3: Fill the form fields using AI
      const filledFields = await this.fillFormFields(formData, applicationData);
      
      // Step 4: Log the results
      this.logApplicationSession(jobId, applicationUrl, formData, filledFields);
      
      // Step 5: Display results and instructions
      this.displayApplicationResults(formData, filledFields);
      
      return {
        success: true,
        formData,
        filledFields,
        readyToSubmit: true,
        instructions: this.generateSubmissionInstructions(applicationUrl, filledFields)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
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

  private extractFieldLabel($: cheerio.CheerioAPI, $el: cheerio.Cheerio<cheerio.Element>): string {
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

  private getElementSelector(element: cheerio.Cheerio<cheerio.Element>): string {
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

  private displayApplicationResults(formData: ApplicationFormData, filledFields: Record<string, string>): void {
    console.log('\n🎯 Application Form Analysis Complete');
    console.log('=' .repeat(80));
    console.log(`📋 Form URL: ${formData.url}`);
    console.log(`📊 Total Fields: ${formData.fields.length}`);
    console.log(`✅ Filled Fields: ${Object.keys(filledFields).length}`);
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
    
    console.log('\n⚠️  IMPORTANT: Review all field values before submitting!');
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

  private logApplicationSession(jobId: string, url: string, formData: ApplicationFormData, filledFields: Record<string, string>): void {
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
        filledCount: Object.keys(filledFields).length
      };
      
      const logPath = path.join(jobDir, `application-${timestamp}.json`);
      fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
      console.log(`📝 Application session logged to: ${logPath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to log application session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}