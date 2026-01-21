import { ResumeCriticAgent } from '../packages/core/src/agents/resume-critic-agent';
import { JobListing, ResumeCritique } from '../packages/core/src/types';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@anthropic-ai/sdk');
jest.mock('fs');

describe('ResumeCriticAgent', () => {
  let mockAnthropic: jest.Mocked<Anthropic>;
  let agent: ResumeCriticAgent;
  let mockJob: JobListing;
  let mockCritique: ResumeCritique;

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

    mockCritique = {
      success: true,
      jobId: 'test123',
      resumePath: 'logs/test123/resume-2024-01-01.pdf',
      overallRating: 8,
      strengths: [
        'Strong technical background in React and Node.js',
        'Well-quantified achievements with specific metrics',
        'Professional formatting and clear structure'
      ],
      weaknesses: [
        'Missing TypeScript experience emphasis',
        'Could include more recent project examples',
        'Summary could be more tailored to the role'
      ],
      recommendations: [
        'Add TypeScript projects to showcase relevant experience',
        'Quantify impact of recent work with specific numbers',
        'Rewrite summary to match job requirements more closely'
      ],
      detailedAnalysis: 'This resume demonstrates solid technical competency and relevant experience. The candidate shows strong React and Node.js skills which align well with the job requirements. However, there are opportunities to better highlight TypeScript experience and provide more recent, quantified examples of impact.',
      timestamp: '2024-01-01T12:00:00.000Z'
    };

    mockAnthropic = {
      messages: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<Anthropic>;

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic);

    // Mock fs functions - files now in job subdirectory
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
      if (dirPath.includes('test123')) {
        return [
          'job-2024-01-01.json',
          'resume-2024-01-01.pdf',
          'resume-2024-01-02.pdf', // More recent resume
          'score-2024-01-01.json'
        ];
      }
      return ['test123']; // Job directory exists
    });
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('job-') && filePath.includes('test123')) {
        return JSON.stringify(mockJob);
      }
      return '{}';
    });
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.appendFileSync as jest.Mock).mockImplementation(() => {});

    agent = new ResumeCriticAgent('test-anthropic-api-key', 'claude-3-7-sonnet-20250219', 4000);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('critiqueResume', () => {
    it('should critique a resume successfully', async () => {
      const mockResponse = JSON.stringify({
        overallRating: 8,
        strengths: mockCritique.strengths,
        weaknesses: mockCritique.weaknesses,
        recommendations: mockCritique.recommendations,
        detailedAnalysis: mockCritique.detailedAnalysis
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: mockResponse }] });

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('test123');
      expect(result.resumePath).toContain('resume-2024-01-02.pdf'); // Most recent
      expect(result.overallRating).toBe(8);
      expect(result.strengths).toHaveLength(3);
      expect(result.weaknesses).toHaveLength(3);
      expect(result.recommendations).toHaveLength(3);
      expect(result.detailedAnalysis).toBeDefined();
    });

    it('should handle missing resume file', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['job-2024-01-01.json']);

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No resume found for job ID: test123');
    });

    it('should handle missing job file', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['resume-2024-01-01.pdf']);

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Job file not found for ID: test123');
    });

    it('should handle invalid JSON response from Claude', async () => {
      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Invalid JSON response' }] });

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse critique response');
    });

    it('should extract JSON from Claude response with extra text', async () => {
      const validJson = JSON.stringify({
        overallRating: 7,
        strengths: ['Good skills', 'Nice format'],
        weaknesses: ['Missing keywords'],
        recommendations: ['Add more details'],
        detailedAnalysis: 'Overall good resume'
      });
      
      const responseWithExtraText = `I apologize for any confusion. Here's the analysis: ${validJson} Hope this helps!`;

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: responseWithExtraText }] });

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(true);
      expect(result.overallRating).toBe(7);
      expect(result.strengths).toHaveLength(2);
    });

    it('should handle Claude API errors', async () => {
      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockRejectedValueOnce(new Error('API error'));

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API error');
    });

    it('should find the most recent resume when multiple exist', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'resume-2024-01-01.pdf',
        'resume-2024-01-03.pdf', // Most recent
        'resume-2024-01-02.pdf',
        'job-2024-01-01.json'
      ]);

      const mockResponse = JSON.stringify({
        overallRating: 7,
        strengths: ['Good technical skills'],
        weaknesses: ['Could improve presentation'],
        recommendations: ['Add more metrics'],
        detailedAnalysis: 'Overall solid resume'
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: mockResponse }] });

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(true);
      expect(result.resumePath).toContain('resume-2024-01-03.pdf');
    });

    it('should handle missing logs directory', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No resume found for job ID: test123');
    });
  });

  describe('unused inherited methods', () => {
    it('should throw error when extract is called', async () => {
      await expect(agent.extract()).rejects.toThrow(
        'ResumeCriticAgent does not implement extract method. Use critiqueResume instead.'
      );
    });

    it('should throw error when createResume is called', async () => {
      await expect(agent.createResume()).rejects.toThrow(
        'ResumeCriticAgent does not implement createResume method. Use critiqueResume instead.'
      );
    });
  });

  describe('critique analysis', () => {
    it('should generate comprehensive critique with all components', async () => {
      const mockResponse = JSON.stringify({
        overallRating: 9,
        strengths: [
          'Excellent alignment with job requirements',
          'Strong quantified achievements',
          'Professional presentation'
        ],
        weaknesses: [
          'Missing some advanced technical skills',
          'Could expand on leadership experience'
        ],
        recommendations: [
          'Add certifications section',
          'Include more diverse project examples',
          'Highlight cross-functional collaboration'
        ],
        detailedAnalysis: 'This is an exceptionally strong resume that demonstrates clear career progression and technical expertise. The candidate has successfully highlighted relevant experience and quantified their impact. Minor improvements in showcasing advanced technical skills and leadership would make this resume even stronger.'
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: mockResponse }] });

      const result = await agent.critiqueResume('test123');

      expect(result.success).toBe(true);
      expect(result.overallRating).toBe(9);
      expect(result.strengths).toHaveLength(3);
      expect(result.weaknesses).toHaveLength(2);
      expect(result.recommendations).toHaveLength(3);
      expect(result.detailedAnalysis).toContain('exceptionally strong resume');
      
      // Verify Claude was called with appropriate context
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Senior Software Engineer')
            })
          ])
        })
      );
    });
  });

  describe('logging', () => {
    it('should log critique results to file', async () => {
      const mockResponse = JSON.stringify({
        overallRating: 8,
        strengths: ['Strong skills'],
        weaknesses: ['Minor issues'],
        recommendations: ['Add more details'],
        detailedAnalysis: 'Good overall resume'
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: mockResponse }] });

      await agent.critiqueResume('test123');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toMatch(/test123\/critique-.*\.json$/); // Now in job subdirectory
      
      const loggedData = JSON.parse(writeCall[1]);
      expect(loggedData).toHaveProperty('jobId', 'test123');
      expect(loggedData).toHaveProperty('overallRating', 8);
      expect(loggedData).toHaveProperty('strengths');
      expect(loggedData).toHaveProperty('weaknesses');
      expect(loggedData).toHaveProperty('recommendations');
      expect(loggedData).toHaveProperty('detailedAnalysis');
    });

    it('should append recommendations to recommendations.txt file', async () => {
      const mockResponse = JSON.stringify({
        overallRating: 7,
        strengths: ['Good technical skills'],
        weaknesses: ['Missing some keywords'],
        recommendations: [
          'Add more TypeScript experience',
          'Include specific project metrics',
          'Highlight team leadership'
        ],
        detailedAnalysis: 'Overall solid resume with room for improvement'
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: mockResponse }] });

      await agent.critiqueResume('test123');

      // Should append to recommendations.txt file
      expect(fs.appendFileSync).toHaveBeenCalled();
      const appendCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      expect(appendCall[0]).toMatch(/test123\/recommendations\.txt$/);
      
      const appendedContent = appendCall[1];
      expect(appendedContent).toContain('# Recommendations from critique on');
      expect(appendedContent).toContain('Add more TypeScript experience');
      expect(appendedContent).toContain('Include specific project metrics');
      expect(appendedContent).toContain('Highlight team leadership');
    });

    it('should handle missing recommendations gracefully', async () => {
      const mockResponse = JSON.stringify({
        overallRating: 9,
        strengths: ['Excellent resume'],
        weaknesses: [],
        recommendations: [], // No recommendations
        detailedAnalysis: 'Perfect resume'
      });

      (mockAnthropic.messages.create as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: mockResponse }] });

      await agent.critiqueResume('test123');

      // Should not try to append recommendations when none exist
      expect(fs.appendFileSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1); // Only the JSON critique file
    });
  });
});
