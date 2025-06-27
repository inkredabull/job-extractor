import { StatementAgent } from '../src/agents/statement-agent';
import { JobListing, StatementType, StatementOptions } from '../src/types';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@anthropic-ai/sdk');
jest.mock('fs');
jest.mock('path');

describe('StatementAgent', () => {
  let mockAnthropic: jest.Mocked<Anthropic>;
  let agent: StatementAgent;
  let mockJob: JobListing;
  let mockCvContent: string;

  beforeEach(() => {
    mockJob = {
      title: 'Head of Engineering',
      company: 'Tech Startup',
      location: 'San Francisco',
      description: 'We are looking for a Head of Engineering to lead our technical team and drive product development. Must have experience with AI/ML, team leadership, and scalable architecture.',
      salary: {
        min: '$200000',
        max: '$300000',
        currency: 'USD'
      }
    };

    mockCvContent = `Anthony Bull - Software Engineering Leader

EXPERIENCE:
CTO @ Myna.co (2022-2024)
- Led 12-person engineering team
- Implemented GenAI solutions
- Scaled from 0 to 1K DAUs

VP Engineering @ CourseKey (2021-2022)
- Led 23-person engineering organization
- Scaled from 750K to 1M DAUs
- Established SRE practices

SKILLS:
- Engineering Leadership
- AI/ML Implementation
- Team Scaling
- Architecture Design`;

    mockAnthropic = {
      messages: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<Anthropic>;

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic);

    agent = new StatementAgent('test-key', 'claude-3-5-sonnet-20241022', 4000);

    // Mock file system operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['job-2025-01-01.json']);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('job-')) {
        return JSON.stringify(mockJob);
      } else if (filePath.includes('cv.txt')) {
        return mockCvContent;
      } else if (filePath.includes('statement-')) {
        return 'Mock prompt template for {{job.title}} at {{job.company}}';
      }
      return '{}';
    });
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (path.resolve as jest.Mock).mockImplementation((...paths) => paths.join('/'));
    (path.join as jest.Mock).mockImplementation((...paths) => paths.join('/'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateStatement', () => {
    it('should generate a cover letter statement', async () => {
      const mockResponse = {
        content: [
          {
            text: 'Greetings:\n\nI am excited about the Head of Engineering position at Tech Startup. With my experience leading engineering teams at Myna.co and CourseKey, I bring proven expertise in scaling technical organizations and implementing AI/ML solutions. My track record includes growing teams from 12 to 23 members while successfully scaling user bases from 0 to 1M+ DAUs.\n\nRegards, Anthony'
          }
        ]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      const result = await agent.generateStatement(
        'cover-letter',
        'test-job-id',
        'cv.txt',
        { emphasis: 'Focus on AI/ML experience' }
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('cover-letter');
      expect(result.content).toContain('Greetings:');
      expect(result.content).toContain('Regards, Anthony');
      expect(result.characterCount).toBeGreaterThan(0);
    });

    it('should generate an endorsement statement', async () => {
      const mockResponse = {
        content: [
          {
            text: 'Anthony is an exceptional engineering leader with proven experience scaling technical teams and implementing cutting-edge AI/ML solutions. At Myna.co, he successfully led a 12-person team while implementing GenAI technologies that transformed development processes. His ability to scale organizations is evident from his work at CourseKey, where he grew the engineering team to 23 members and scaled the platform to over 1M daily active users.'
          }
        ]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      const result = await agent.generateStatement(
        'endorsement',
        'test-job-id',
        'cv.txt'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('endorsement');
      expect(result.content).toContain('Anthony');
      expect(result.characterCount).toBeGreaterThan(375);
      expect(result.characterCount).toBeLessThan(500);
    });

    it('should generate an about-me statement with bullet points', async () => {
      const mockResponse = {
        content: [
          {
            text: '- **Technical Leadership**\n  - Led 12-person engineering team at Myna.co, scaling from 0 to 1K DAUs\n  - Implemented GenAI solutions reducing development cycles by 35%\n- **Team Scaling**\n  - Grew engineering organization to 23 members at CourseKey\n  - Successfully scaled platform to 1M+ daily active users'
          }
        ]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      const result = await agent.generateStatement(
        'about-me',
        'test-job-id',
        'cv.txt',
        { companyInfo: 'Tech Startup because of their innovative AI platform' }
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('about-me');
      expect(result.content).toContain('-');
      expect(result.characterCount).toBeLessThan(900);
    });

    it('should generate a general statement', async () => {
      const mockResponse = {
        content: [
          {
            text: 'Anthony brings over a decade of engineering leadership experience, progressing from individual contributor roles to executive positions. His expertise spans from early-stage startups to scaling platforms serving millions of users, with particular strength in AI/ML implementation and team building across distributed organizations.'
          }
        ]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      const result = await agent.generateStatement(
        'general',
        'test-job-id',
        'cv.txt'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('general');
      expect(result.content).toContain('Anthony');
      expect(result.characterCount).toBeGreaterThan(250);
      expect(result.characterCount).toBeLessThan(425);
    });

    it('should handle errors gracefully', async () => {
      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockRejectedValueOnce(new Error('API Error'));

      const result = await agent.generateStatement(
        'cover-letter',
        'test-job-id',
        'cv.txt'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
      expect(result.type).toBe('cover-letter');
    });

    it('should handle missing job directory', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await agent.generateStatement(
        'cover-letter',
        'invalid-job-id',
        'cv.txt'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Job directory not found');
    });

    it('should validate statement types', async () => {
      const validTypes: StatementType[] = ['cover-letter', 'endorsement', 'about-me', 'general'];
      
      for (const type of validTypes) {
        const mockResponse = {
          content: [{ text: 'Sample statement content' }]
        };

        (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

        const result = await agent.generateStatement(type, 'test-job-id', 'cv.txt');
        expect(result.success).toBe(true);
        expect(result.type).toBe(type);
      }
    });
  });

  describe('prompt template loading', () => {
    it('should use fallback prompt when template file is missing', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('statement-')) {
          throw new Error('File not found');
        } else if (filePath.includes('job-')) {
          return JSON.stringify(mockJob);
        } else if (filePath.includes('cv.txt')) {
          return mockCvContent;
        }
        return '{}';
      });

      const mockResponse = {
        content: [{ text: 'Fallback statement content' }]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      const result = await agent.generateStatement(
        'cover-letter',
        'test-job-id',
        'cv.txt'
      );

      expect(result.success).toBe(true);
      // Should still work with fallback prompt
    });
  });

  describe('statement options', () => {
    it('should handle custom emphasis for cover letters', async () => {
      const mockResponse = {
        content: [{ text: 'Greetings:\nStatement with custom emphasis.\nRegards, Anthony' }]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      const options: StatementOptions = {
        emphasis: 'Focus on technical architecture experience',
        customInstructions: 'Keep it concise'
      };

      const result = await agent.generateStatement(
        'cover-letter',
        'test-job-id',
        'cv.txt',
        options
      );

      expect(result.success).toBe(true);
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Focus on technical architecture experience')
            })
          ])
        })
      );
    });

    it('should handle company info for about-me statements', async () => {
      const mockResponse = {
        content: [{ text: '- Technical Leadership\n  - Sample achievement' }]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      const options: StatementOptions = {
        companyInfo: 'innovative AI platform and strong engineering culture'
      };

      const result = await agent.generateStatement(
        'about-me',
        'test-job-id',
        'cv.txt',
        options
      );

      expect(result.success).toBe(true);
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('innovative AI platform')
            })
          ])
        })
      );
    });
  });

  describe('logging', () => {
    it('should log statements to job directory', async () => {
      const mockResponse = {
        content: [{ text: 'Sample statement' }]
      };

      (mockAnthropic.messages.create as jest.MockedFunction<any>)\n        .mockResolvedValueOnce(mockResponse);

      await agent.generateStatement(
        'cover-letter',
        'test-job-id',
        'cv.txt'
      );

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('statement-cover-letter-'),
        expect.stringContaining('"type":"cover-letter"'),
        expect.objectContaining({ encoding: expect.any(String) })
      );
    });
  });
});