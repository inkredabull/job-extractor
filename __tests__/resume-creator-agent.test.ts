import { ResumeCreatorAgent } from '../src/agents/resume-creator-agent';
import { JobListing, CVData } from '../src/types';
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
  let mockCVData: CVData;

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
      // Mock CV parsing response
      const cvParsingResponse = JSON.stringify(mockCVData);
      
      // Mock tailoring response
      const tailoringResponse = JSON.stringify({
        markdownContent: `# John Doe - Senior Software Engineer\n\n## SUMMARY\nExperienced software engineer...\n\n## EXPERIENCE\n### Software Engineer | Previous Corp | 2020 - Present\n...`,
        changes: [
          'Emphasized React and Node.js experience',
          'Reordered skills to highlight relevant technologies',
          'Updated summary to match job requirements'
        ]
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: cvParsingResponse }] })
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

    it('should handle CV parsing errors', async () => {
      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Invalid JSON response' }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse CV data');
    });

    it('should handle tailoring errors', async () => {
      const cvParsingResponse = JSON.stringify(mockCVData);
      
      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: cvParsingResponse }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Invalid tailoring response' }] });

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


  describe('CV parsing', () => {
    it('should parse CV content correctly', async () => {
      const cvParsingResponse = JSON.stringify(mockCVData);
      const tailoringResponse = JSON.stringify({
        markdownContent: `# John Doe - Senior Software Engineer\n\n## SUMMARY\nTest content...`,
        changes: ['Test change']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: cvParsingResponse }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);
      
      // Check that CV parsing prompt was used
      const firstCall = (mockAnthropic.messages.create as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).toContain('Parse the following CV/resume text');
    });
  });

  describe('content tailoring', () => {
    it('should generate tailored content based on job requirements', async () => {
      const cvParsingResponse = JSON.stringify(mockCVData);
      const tailoringResponse = JSON.stringify({
        markdownContent: `# John Doe - Senior Software Engineer\n\n## SUMMARY\nSenior software engineer with expertise in React, Node.js, and TypeScript - perfect for this role.\n\n## EXPERIENCE\n...`,
        changes: [
          'Updated summary to emphasize React and TypeScript experience',
          'Reordered technical skills to highlight job-relevant technologies'
        ]
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: cvParsingResponse }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toContain('Updated summary to emphasize React and TypeScript experience');
      
      // Check that tailoring prompt included job information
      const secondCall = (mockAnthropic.messages.create as jest.Mock).mock.calls[1][0];
      expect(secondCall.messages[0].content).toContain('Senior Software Engineer');
      expect(secondCall.messages[0].content).toContain('Tech Corp');
    });
  });

  describe('caching functionality', () => {
    it('should use cached content when available', async () => {
      // Mock cached content
      const cachedContent = {
        markdownContent: '# Cached Resume Content',
        changes: ['Cached change 1', 'Cached change 2']
      };
      
      // Create consistent CV content for hash generation
      const cvContent = 'John Doe\nEmail: john.doe@example.com\nExperience: Software Engineer at Previous Corp...';
      const mtime = new Date('2024-01-01T12:00:00.000Z');
      
      // Calculate the expected hash for the test
      const combinedData = cvContent + mtime.toISOString();
      let hash = 0;
      for (let i = 0; i < combinedData.length; i++) {
        const char = combinedData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const expectedHash = Math.abs(hash).toString(16).substring(0, 8);
      
      // Mock the cache file exists with correct hash in job subdirectory
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('logs') && !dirPath.includes('test123')) {
          return ['test123']; // Job subdirectory exists
        }
        if (dirPath.includes('test123')) {
          return [
            'job-2024-01-01.json', // Job file
            `tailored-${expectedHash}-2024-01-01.json`, // Metadata file
            `tailored-${expectedHash}-2024-01-01.md`    // Markdown file
          ]; 
        }
        return [];
      });
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('job-') && filePath.includes('test123') && filePath.endsWith('.json') && !filePath.includes('tailored-')) {
          return JSON.stringify(mockJob);
        }
        if (filePath.includes('tailored-') && filePath.endsWith('.json')) {
          return JSON.stringify({
            jobId: 'test123',
            cvFilePath: 'cv.txt',
            timestamp: '2024-01-01T12:00:00.000Z',
            markdownFilename: `tailored-${expectedHash}-2024-01-01.md`,
            changes: cachedContent.changes
          });
        }
        if (filePath.includes('tailored-') && filePath.endsWith('.md')) {
          return cachedContent.markdownContent;
        }
        if (filePath.includes('cv.txt')) {
          return cvContent;
        }
        return '{}';
      });
      
      // Mock file stats for hash generation
      (fs.statSync as jest.Mock).mockReturnValue({
        mtime: mtime
      });

      // Make sure existsSync returns true for the job directory and markdown file
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        // Always return true for any path in test - this is for the cache test
        return true;
      });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toEqual(cachedContent.changes);
      
      // Should not call Claude API when using cache
      expect(mockAnthropic.messages.create).not.toHaveBeenCalled();
    });

    it('should generate new content when no cache exists', async () => {
      // Mock no cache file exists - job directory doesn't exist for cache but exists for job
      (fs.existsSync as jest.Mock).mockImplementation((dirPath: string) => {
        // Job directory exists
        return true;
      });
      
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('test123')) {
          return ['job-2024-01-01.json']; // Only job file, no cache files
        }
        return ['test123']; // Job subdirectory exists
      });
      
      // Mock CV parsing and tailoring responses
      const cvParsingResponse = JSON.stringify(mockCVData);
      const tailoringResponse = JSON.stringify({
        markdownContent: '# Fresh Resume Content',
        changes: ['Fresh change 1', 'Fresh change 2']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: cvParsingResponse }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toEqual(['Fresh change 1', 'Fresh change 2']);
      
      // Should call Claude API twice (CV parsing + tailoring)
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);
      
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

    it('should regenerate content when CV file is modified', async () => {
      // Mock cache file exists but with different hash
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('logs') && !dirPath.includes('test123')) {
          return ['test123']; // Job dir exists
        }
        if (dirPath.includes('test123')) {
          return [
            'job-2024-01-01.json', // Job file
            'tailored-oldHash-2024-01-01.json', // Cache file with different hash
            'tailored-oldHash-2024-01-01.md'
          ];
        }
        return [];
      });
      
      // Mock newer CV file modification time
      (fs.statSync as jest.Mock).mockReturnValue({
        mtime: new Date('2024-01-02T12:00:00.000Z')  // Newer than cache
      });
      
      // Mock CV parsing and tailoring responses
      const cvParsingResponse = JSON.stringify(mockCVData);
      const tailoringResponse = JSON.stringify({
        markdownContent: '# Updated Resume Content',
        changes: ['Updated change 1']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: cvParsingResponse }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toEqual(['Updated change 1']);
      
      // Should call Claude API for fresh content
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);
    });

    it('should handle cache loading errors gracefully', async () => {
      // Mock cache file exists but is corrupted
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('logs') && !dirPath.includes('test123')) {
          return ['test123']; // Job dir exists
        }
        if (dirPath.includes('test123')) {
          return [
            'job-2024-01-01.json', // Job file
            'tailored-abcd1234-2024-01-01.json', // Corrupted cache file
            'tailored-abcd1234-2024-01-01.md'
          ];
        }
        return [];
      });
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('job-') && filePath.includes('test123') && !filePath.includes('tailored-')) {
          return JSON.stringify(mockJob);
        }
        if (filePath.includes('tailored-')) {
          return 'invalid json content';  // Corrupted cache
        }
        if (filePath.includes('cv.txt')) {
          return 'John Doe\nEmail: john.doe@example.com\nExperience: Software Engineer at Previous Corp...';
        }
        return '{}';
      });
      
      // Mock CV parsing and tailoring responses
      const cvParsingResponse = JSON.stringify(mockCVData);
      const tailoringResponse = JSON.stringify({
        markdownContent: '# Fallback Resume Content',
        changes: ['Fallback change 1']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: cvParsingResponse }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toEqual(['Fallback change 1']);
      
      // Should fall back to generating fresh content
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);
    });
  });
});