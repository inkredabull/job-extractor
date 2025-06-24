import { ResumeCreatorAgent } from '../src/agents/resume-creator-agent';
import { AgentConfig, JobListing, CVData } from '../src/types';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('openai');
jest.mock('fs');
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    splitTextToSize: jest.fn().mockReturnValue(['test line']),
    text: jest.fn(),
    addPage: jest.fn(),
    save: jest.fn(),
    internal: {
      pageSize: {
        width: 210,
        height: 297
      }
    }
  }))
}));

describe('ResumeCreatorAgent', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let agent: ResumeCreatorAgent;
  let config: AgentConfig;
  let mockJob: JobListing;
  let mockCVData: CVData;

  beforeEach(() => {
    config = {
      openaiApiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 2000,
    };

    mockJob = {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'Remote',
      description: 'We are looking for a Senior Software Engineer with experience in React, Node.js, and TypeScript.',
      salary: {
        min: '$130000',
        max: '$180000',
        currency: 'USD'
      }
    };

    mockCVData = {
      personalInfo: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0123',
        location: 'San Francisco, CA',
        linkedin: 'https://linkedin.com/in/johndoe',
        github: 'https://github.com/johndoe'
      },
      summary: 'Experienced software engineer with 5+ years in full-stack development.',
      experience: [
        {
          title: 'Software Engineer',
          company: 'Previous Corp',
          duration: '2020 - Present',
          description: 'Developed web applications using React and Node.js',
          achievements: ['Improved performance by 30%', 'Led team of 3 developers']
        }
      ],
      education: [
        {
          degree: 'BS Computer Science',
          institution: 'University of California',
          year: '2019',
          details: 'Graduated Magna Cum Laude'
        }
      ],
      skills: {
        technical: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
        languages: ['English', 'Spanish'],
        certifications: ['AWS Certified Developer']
      },
      projects: [
        {
          name: 'E-commerce Platform',
          description: 'Built a full-stack e-commerce platform',
          technologies: ['React', 'Node.js', 'MongoDB'],
          url: 'https://github.com/johndoe/ecommerce'
        }
      ]
    };

    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<OpenAI>;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    // Mock fs functions
    (fs.readdirSync as jest.Mock).mockReturnValue(['job-test123-2024-01-01.json']);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('job-test123')) {
        return JSON.stringify(mockJob);
      }
      if (filePath.includes('cv.txt')) {
        return 'John Doe\nEmail: john.doe@example.com\nExperience: Software Engineer at Previous Corp...';
      }
      return '{}';
    });

    agent = new ResumeCreatorAgent(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createResume', () => {
    it('should create a resume successfully', async () => {
      // Mock CV parsing response
      const cvParsingResponse = JSON.stringify(mockCVData);
      
      // Mock tailoring response
      const tailoringResponse = JSON.stringify({
        tailoredCV: mockCVData,
        changes: [
          'Emphasized React and Node.js experience',
          'Reordered skills to highlight relevant technologies',
          'Updated summary to match job requirements'
        ]
      });

      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ choices: [{ message: { content: cvParsingResponse } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: tailoringResponse } }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
      expect(result.tailoringChanges).toHaveLength(3);
      expect(result.tailoringChanges).toContain('Emphasized React and Node.js experience');
    });

    it('should handle missing job file', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      const result = await agent.createResume('nonexistent', 'cv.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Job file not found for ID: nonexistent');
    });

    it('should handle CV parsing errors', async () => {
      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Invalid JSON response' } }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse CV data');
    });

    it('should handle tailoring errors', async () => {
      const cvParsingResponse = JSON.stringify(mockCVData);
      
      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ choices: [{ message: { content: cvParsingResponse } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Invalid tailoring response' } }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate tailored content');
    });

    it('should handle missing CV file', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await agent.createResume('test123', 'nonexistent.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('extract method', () => {
    it('should throw error when extract is called', async () => {
      await expect(agent.extract()).rejects.toThrow(
        'ResumeCreatorAgent does not implement extract method. Use createResume instead.'
      );
    });
  });

  describe('CV parsing', () => {
    it('should parse CV content correctly', async () => {
      const cvParsingResponse = JSON.stringify(mockCVData);
      const tailoringResponse = JSON.stringify({
        tailoredCV: mockCVData,
        changes: ['Test change']
      });

      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ choices: [{ message: { content: cvParsingResponse } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: tailoringResponse } }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
      
      // Check that CV parsing prompt was used
      const firstCall = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).toContain('Parse the following CV/resume text');
    });
  });

  describe('content tailoring', () => {
    it('should generate tailored content based on job requirements', async () => {
      const cvParsingResponse = JSON.stringify(mockCVData);
      const tailoringResponse = JSON.stringify({
        tailoredCV: {
          ...mockCVData,
          summary: 'Senior software engineer with expertise in React, Node.js, and TypeScript - perfect for this role.'
        },
        changes: [
          'Updated summary to emphasize React and TypeScript experience',
          'Reordered technical skills to highlight job-relevant technologies'
        ]
      });

      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ choices: [{ message: { content: cvParsingResponse } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: tailoringResponse } }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toContain('Updated summary to emphasize React and TypeScript experience');
      
      // Check that tailoring prompt included job information
      const secondCall = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];
      expect(secondCall.messages[0].content).toContain('Senior Software Engineer');
      expect(secondCall.messages[0].content).toContain('Tech Corp');
    });
  });
});