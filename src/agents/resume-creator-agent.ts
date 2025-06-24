import { BaseAgent } from './base-agent';
import { JobListing, CVData, ResumeResult, AgentConfig } from '../types';
import { jsPDF } from 'jspdf';
import * as fs from 'fs';
import * as path from 'path';

export class ResumeCreatorAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async extract(): Promise<never> {
    throw new Error('ResumeCreatorAgent does not implement extract method. Use createResume instead.');
  }

  async createResume(jobId: string, cvFilePath: string, outputPath?: string): Promise<ResumeResult> {
    try {
      // Load job data
      const jobData = this.loadJobData(jobId);
      
      // Parse CV data
      const cvData = await this.parseCVFile(cvFilePath);
      
      // Generate tailored content using AI
      const tailoredContent = await this.generateTailoredContent(jobData, cvData);
      
      // Create PDF
      const pdfPath = await this.generatePDF(tailoredContent, outputPath, jobId);
      
      return {
        success: true,
        pdfPath,
        tailoringChanges: tailoredContent.changes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private loadJobData(jobId: string): JobListing {
    const logsDir = path.resolve('logs');
    const files = fs.readdirSync(logsDir);
    
    const jobFile = files.find(file => file.includes(jobId) && file.endsWith('.json') && file.startsWith('job-'));
    if (!jobFile) {
      throw new Error(`Job file not found for ID: ${jobId}`);
    }

    const jobPath = path.join(logsDir, jobFile);
    const jobData = fs.readFileSync(jobPath, 'utf-8');
    return JSON.parse(jobData);
  }

  private async parseCVFile(cvFilePath: string): Promise<CVData> {
    const cvContent = fs.readFileSync(cvFilePath, 'utf-8');
    
    const prompt = `
Parse the following CV/resume text and extract structured information. Return a JSON object with this exact schema:

{
  "personalInfo": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number if found",
    "location": "city, state/country if found",
    "linkedin": "LinkedIn URL if found",
    "github": "GitHub URL if found"
  },
  "summary": "Professional summary or objective if found",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start - End dates",
      "description": "Job description",
      "achievements": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Type",
      "institution": "School Name",
      "year": "Graduation year",
      "details": "Additional details if any"
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "languages": ["language1", "language2"],
    "certifications": ["cert1", "cert2"]
  },
  "projects": [
    {
      "name": "Project Name",
      "description": "Project description",
      "technologies": ["tech1", "tech2"],
      "url": "project URL if found"
    }
  ]
}

CV Content:
${cvContent}

Return ONLY the JSON object, no other text:`;

    const response = await this.makeOpenAIRequest(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in CV parsing response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse CV data: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  private async generateTailoredContent(job: JobListing, cv: CVData): Promise<{
    tailoredCV: CVData;
    changes: string[];
  }> {
    const prompt = `
You are a professional resume writer. Given a job posting and a candidate's CV, create a tailored version that optimizes the CV for this specific job while maintaining truthfulness.

Job Posting:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}

Current CV Data:
${JSON.stringify(cv, null, 2)}

Instructions:
1. Reorder and emphasize relevant experience and skills
2. Tailor the summary to match the job requirements
3. Highlight relevant achievements and projects
4. Use keywords from the job description where appropriate
5. Maintain all factual information - do not fabricate anything

Return a JSON object with:
{
  "tailoredCV": { /* The optimized CV with same structure as input */ },
  "changes": ["List of specific changes made to tailor the resume"]
}

Respond with ONLY the JSON object:`;

    const response = await this.makeOpenAIRequest(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in tailoring response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to generate tailored content: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  private async generatePDF(content: { tailoredCV: CVData; changes: string[] }, outputPath?: string, jobId?: string): Promise<string> {
    const cv = content.tailoredCV;
    const doc = new jsPDF();
    
    // Set up fonts and styles
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const maxWidth = doc.internal.pageSize.width - 2 * margin;
    
    // Helper function to add text with word wrapping
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      if (isBold) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      
      const lines = doc.splitTextToSize(text, maxWidth);
      
      // Check if we need a new page
      if (yPosition + (lines.length * fontSize * 0.5) > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.text(lines, margin, yPosition);
      yPosition += lines.length * fontSize * 0.5 + 5;
    };

    // Header - Personal Info
    addText(cv.personalInfo.name, 18, true);
    
    const contactInfo = [
      cv.personalInfo.email,
      cv.personalInfo.phone,
      cv.personalInfo.location,
      cv.personalInfo.linkedin,
      cv.personalInfo.github
    ].filter(Boolean).join(' | ');
    
    addText(contactInfo, 10);
    yPosition += 5;

    // Summary
    if (cv.summary) {
      addText('PROFESSIONAL SUMMARY', 12, true);
      addText(cv.summary, 10);
      yPosition += 5;
    }

    // Experience
    if (cv.experience && cv.experience.length > 0) {
      addText('EXPERIENCE', 12, true);
      
      cv.experience.forEach(exp => {
        addText(`${exp.title} | ${exp.company}`, 11, true);
        addText(exp.duration, 10);
        addText(exp.description, 10);
        
        if (exp.achievements && exp.achievements.length > 0) {
          exp.achievements.forEach(achievement => {
            addText(`• ${achievement}`, 10);
          });
        }
        yPosition += 5;
      });
    }

    // Skills
    if (cv.skills) {
      addText('SKILLS', 12, true);
      
      if (cv.skills.technical && cv.skills.technical.length > 0) {
        addText(`Technical: ${cv.skills.technical.join(', ')}`, 10);
      }
      
      if (cv.skills.languages && cv.skills.languages.length > 0) {
        addText(`Languages: ${cv.skills.languages.join(', ')}`, 10);
      }
      
      if (cv.skills.certifications && cv.skills.certifications.length > 0) {
        addText(`Certifications: ${cv.skills.certifications.join(', ')}`, 10);
      }
      
      yPosition += 5;
    }

    // Education
    if (cv.education && cv.education.length > 0) {
      addText('EDUCATION', 12, true);
      
      cv.education.forEach(edu => {
        addText(`${edu.degree} | ${edu.institution} | ${edu.year}`, 10, true);
        if (edu.details) {
          addText(edu.details, 10);
        }
      });
      yPosition += 5;
    }

    // Projects
    if (cv.projects && cv.projects.length > 0) {
      addText('PROJECTS', 12, true);
      
      cv.projects.forEach(project => {
        addText(project.name, 11, true);
        addText(project.description, 10);
        
        if (project.technologies && project.technologies.length > 0) {
          addText(`Technologies: ${project.technologies.join(', ')}`, 10);
        }
        
        if (project.url) {
          addText(`URL: ${project.url}`, 10);
        }
        yPosition += 3;
      });
    }

    // Generate output path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `resume-${jobId || 'custom'}-${timestamp}.pdf`;
    const finalPath = outputPath || path.join('logs', fileName);
    
    // Save PDF
    doc.save(finalPath);
    
    console.log(`✅ Resume generated: ${finalPath}`);
    return finalPath;
  }
}