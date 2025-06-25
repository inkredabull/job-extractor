import { ResumeCreatorAgent } from '../src/agents/resume-creator-agent';
import { JobListing } from '../src/types';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

jest.mock('@anthropic-ai/sdk');
jest.mock('fs');
jest.mock('child_process');

describe('ResumeCreatorAgent', () => {
  let mockAnthropic: jest.Mocked<Anthropic>;
  let agent: ResumeCreatorAgent;
  let mockJob: JobListing;
  beforeEach(() => {
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

    mockAnthropic = {
      messages: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<Anthropic>;

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic);

    // Mock fs functions - job file now in job subdirectory
    (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
      if (dirPath.includes('test123')) {
        return ['job-2024-01-01.json']; // Job file in subdirectory
      }
      return [];
    });
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('job-') && filePath.includes('test123')) {
        return JSON.stringify(mockJob);
      }
      if (filePath.includes('cv.txt')) {
        return 'John Doe\nEmail: john.doe@example.com\nExperience: Software Engineer at Previous Corp...';
      }
      return '{}';
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
    (fs.statSync as jest.Mock).mockReturnValue({
      mtime: new Date('2024-01-01T12:00:00.000Z')
    });
    
    // Mock execSync for pandoc
    (execSync as jest.Mock).mockImplementation(() => {});

    agent = new ResumeCreatorAgent('test-anthropic-api-key', 'claude-3-5-sonnet-20241022', 4000);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createResume', () => {
    it('should create a resume successfully', async () => {
      // Mock tailoring response (no CV parsing needed anymore)
      const tailoringResponse = JSON.stringify({
        markdownContent: `# John Doe - Senior Software Engineer\n\n## SUMMARY\nExperienced software engineer...\n\n## EXPERIENCE\n### Software Engineer | Previous Corp | 2020 - Present\n...`,
        changes: [
          'Emphasized React and Node.js experience',
          'Reordered skills to highlight relevant technologies',
          'Updated summary to match job requirements'
        ]
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
      expect(result.tailoringChanges).toHaveLength(3);
      expect(result.tailoringChanges).toContain('Emphasized React and Node.js experience');
    });

    it('should handle missing job file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false); // Job directory doesn't exist

      const result = await agent.createResume('nonexistent', 'cv.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Job directory not found for ID: nonexistent');
    });

    it('should handle tailoring errors', async () => {
      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Invalid JSON response' }] });

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



  describe('content tailoring', () => {
    it('should generate tailored content based on job requirements', async () => {
      const tailoringResponse = JSON.stringify({
        markdownContent: `# John Doe - Senior Software Engineer\n\n## SUMMARY\nSenior software engineer with expertise in React, Node.js, and TypeScript - perfect for this role.\n\n## EXPERIENCE\n...`,
        changes: [
          'Updated summary to emphasize React and TypeScript experience',
          'Reordered technical skills to highlight job-relevant technologies'
        ]
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toContain('Updated summary to emphasize React and TypeScript experience');
      
      // Check that tailoring prompt included job information and raw CV content
      const firstCall = (mockAnthropic.messages.create as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).toContain('Senior Software Engineer');
      expect(firstCall.messages[0].content).toContain('Tech Corp');
      expect(firstCall.messages[0].content).toContain('Current CV Content:');
    });
  });

  describe('content generation', () => {
    it('should always regenerate tailored content', async () => {
      // Mock tailoring response (no CV parsing needed)
      const tailoringResponse = JSON.stringify({
        markdownContent: '# Fresh Resume Content',
        changes: ['Fresh change 1', 'Fresh change 2']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toEqual(['Fresh change 1', 'Fresh change 2']);
      
      // Should call Claude API once for tailoring (no CV parsing)
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
      
      // Should save both JSON metadata and markdown files
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/test123\/tailored-.*\.md$/),
        '# Fresh Resume Content',
        'utf-8'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/test123\/tailored-.*\.json$/),
        expect.stringContaining('markdownFilename'),
        'utf-8'
      );
    });
  });
});