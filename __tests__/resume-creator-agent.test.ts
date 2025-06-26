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
    it('should regenerate tailored content by default', async () => {
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

    it('should use configurable number of roles in prompt', async () => {
      // Create agent with different maxRoles
      const customAgent = new ResumeCreatorAgent('test-api-key', 'claude-3-5-sonnet-20241022', 4000, 2);
      
      const tailoringResponse = JSON.stringify({
        markdownContent: '# Resume with 2 roles',
        changes: ['Limited to 2 roles']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await customAgent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      
      // Check that prompt includes "2 roles" instead of "3 roles"
      const firstCall = (mockAnthropic.messages.create as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).toContain('most recent 2 roles');
      expect(firstCall.messages[0].content).not.toContain('most recent 3 roles');
    });

    it('should incorporate recommendations from recommendations.txt file', async () => {
      // Mock recommendations.txt file content
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('recommendations.txt')) {
          return 'Add more TypeScript experience\nHighlight team leadership skills\n# This is a comment\n\nEmphasize cloud architecture';
        }
        if (filePath.includes('job-') && filePath.includes('test123')) {
          return JSON.stringify(mockJob);
        }
        if (filePath.includes('cv.txt')) {
          return 'John Doe\nEmail: john.doe@example.com\nExperience: Software Engineer at Previous Corp...';
        }
        return '{}';
      });

      const tailoringResponse = JSON.stringify({
        markdownContent: '# Resume with recommendations',
        changes: ['Applied recommendations from previous critique']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      
      // Check that prompt includes recommendations section
      const firstCall = (mockAnthropic.messages.create as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).toContain('Previous Recommendations');
      expect(firstCall.messages[0].content).toContain('Add more TypeScript experience');
      expect(firstCall.messages[0].content).toContain('Highlight team leadership skills');
      expect(firstCall.messages[0].content).toContain('Emphasize cloud architecture');
      expect(firstCall.messages[0].content).not.toContain('# This is a comment'); // Comments should be skipped
    });

    it('should incorporate recommendations from critique JSON files', async () => {
      // Mock critique file with recommendations
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('critique-') && filePath.includes('test123')) {
          return JSON.stringify({
            recommendations: [
              'Include more quantified achievements',
              'Add certifications section'
            ]
          });
        }
        if (filePath.includes('job-') && filePath.includes('test123')) {
          return JSON.stringify(mockJob);
        }
        if (filePath.includes('cv.txt')) {
          return 'John Doe\nEmail: john.doe@example.com\nExperience: Software Engineer at Previous Corp...';
        }
        return '{}';
      });

      // Mock finding critique files
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('test123')) {
          return ['job-2024-01-01.json', 'critique-2024-01-02.json', 'critique-2024-01-01.json'];
        }
        return [];
      });

      const tailoringResponse = JSON.stringify({
        markdownContent: '# Resume with critique recommendations',
        changes: ['Applied recommendations from latest critique']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      
      // Check that prompt includes recommendations from critique
      const firstCall = (mockAnthropic.messages.create as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).toContain('Previous Recommendations');
      expect(firstCall.messages[0].content).toContain('Include more quantified achievements');
      expect(firstCall.messages[0].content).toContain('Add certifications section');
    });

    it('should handle missing recommendations gracefully', async () => {
      // Mock no recommendations files
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return !filePath.includes('recommendations.txt');
      });

      const tailoringResponse = JSON.stringify({
        markdownContent: '# Resume without recommendations',
        changes: ['Standard tailoring applied']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt');

      expect(result.success).toBe(true);
      
      // Check that prompt does not include recommendations section
      const firstCall = (mockAnthropic.messages.create as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).not.toContain('Previous Recommendations');
    });
  });

  describe('caching behavior', () => {
    it('should use most recent tailored content when regenerate=false', async () => {
      // Reset all mocks for this test
      jest.clearAllMocks();
      
      // Mock console.log to capture log messages
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock the loadMostRecentTailoredContent method directly to return our cached content
      const mockAgent = agent as any;
      const originalMethod = mockAgent.loadMostRecentTailoredContent;
      mockAgent.loadMostRecentTailoredContent = jest.fn().mockReturnValue({
        markdownContent: '# Most Recent Resume Content',
        changes: ['Most recent change 1', 'Most recent change 2']
      });

      const result = await agent.createResume('test123', 'cv.txt', undefined, false);

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toEqual(['Most recent change 1', 'Most recent change 2']);
      expect(consoleSpy).toHaveBeenCalledWith('📋 Using most recent tailored content for job test123');
      
      // Should not call Claude API when using cached content
      expect(mockAnthropic.messages.create).not.toHaveBeenCalled();

      // Verify that the cache method was called
      expect(mockAgent.loadMostRecentTailoredContent).toHaveBeenCalledWith('test123');

      // Restore original method
      mockAgent.loadMostRecentTailoredContent = originalMethod;
      consoleSpy.mockRestore();
    });

    it('should regenerate when regenerate=false but no cache exists', async () => {
      // Reset all mocks for this test
      jest.clearAllMocks();
      
      // Mock no cached content found
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('test123')) {
          return ['job-2024-01-01.json']; // No cached tailored content
        }
        return [];
      });

      const tailoringResponse = JSON.stringify({
        markdownContent: '# Fresh Resume Content',
        changes: ['Fresh change 1', 'Fresh change 2']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: tailoringResponse }] });

      const result = await agent.createResume('test123', 'cv.txt', undefined, false);

      expect(result.success).toBe(true);
      expect(result.tailoringChanges).toEqual(['Fresh change 1', 'Fresh change 2']);
      
      // Should call Claude API to generate new content
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    });

    it('should always regenerate when regenerate=true (default behavior)', async () => {
      // Reset all mocks for this test
      jest.clearAllMocks();
      
      const tailoringResponse = JSON.stringify({
        markdownContent: '# Regenerated Resume Content',
        changes: ['Regenerated change 1', 'Regenerated change 2']
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValue({ content: [{ type: 'text', text: tailoringResponse }] });

      // Mock console.log to capture log messages
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Test both explicit true and default behavior
      const result1 = await agent.createResume('test123', 'cv.txt', undefined, true);
      const result2 = await agent.createResume('test123', 'cv.txt'); // Default should be true

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.tailoringChanges).toEqual(['Regenerated change 1', 'Regenerated change 2']);
      expect(result2.tailoringChanges).toEqual(['Regenerated change 1', 'Regenerated change 2']);
      
      // Should log regeneration messages
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Regenerating tailored content for job test123');
      
      // Should call Claude API twice (once for each call)
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });
});