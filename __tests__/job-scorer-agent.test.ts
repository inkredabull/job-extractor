import { JobScorerAgent } from '../src/agents/job-scorer-agent';
import { ResumeCreatorAgent } from '../src/agents/resume-creator-agent';
import { AgentConfig, JobListing, JobCriteria } from '../src/types';
import { getAnthropicConfig, getAutoResumeConfig } from '../src/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('openai');
jest.mock('fs');
jest.mock('../src/agents/resume-creator-agent');
jest.mock('../src/config');

describe('JobScorerAgent', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let agent: JobScorerAgent;
  let config: AgentConfig;
  let mockCriteria: JobCriteria;
  let mockJob: JobListing;

  beforeEach(() => {
    config = {
      openaiApiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 2000,
    };
    
    // Mock config functions
    (getAnthropicConfig as jest.Mock).mockReturnValue({
      anthropicApiKey: 'test-anthropic-key',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4000
    });
    
    (getAutoResumeConfig as jest.Mock).mockReturnValue({
      threshold: 80,
      cvPath: 'test-cv.txt'
    });

    mockCriteria = {
      required_skills: ['JavaScript', 'React', 'Node.js'],
      preferred_skills: ['TypeScript', 'AWS'],
      experience_levels: {
        senior: 5,
        director: 10
      },
      salary_range: {
        min: 120000,
        max: 200000,
        currency: 'USD'
      },
      locations: ['Remote', 'San Francisco'],
      company_size: ['startup', 'enterprise'],
      job_types: ['full-time'],
      weights: {
        required_skills: 0.3,
        preferred_skills: 0.2,
        experience_level: 0.2,
        salary: 0.15,
        location: 0.1,
        company_match: 0.05
      }
    };

    mockJob = {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'Remote',
      description: 'We are looking for a Senior Software Engineer with 5+ years of experience in JavaScript, React, and Node.js. TypeScript experience is a plus.',
      salary: {
        min: '$130000',
        max: '$180000',
        currency: 'USD'
      }
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
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('criteria.json')) {
        return JSON.stringify(mockCriteria);
      }
      if (filePath.includes('job-test123')) {
        return JSON.stringify(mockJob);
      }
      return '{}';
    });
    (fs.readdirSync as jest.Mock).mockReturnValue(['job-test123-2024-01-01.json']);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

    // Mock ResumeCreatorAgent
    const mockResumeCreator = {
      createResume: jest.fn().mockResolvedValue({
        success: true,
        pdfPath: 'test-resume.pdf',
        tailoringChanges: ['Test change 1', 'Test change 2']
      })
    };
    (ResumeCreatorAgent as jest.MockedClass<typeof ResumeCreatorAgent>).mockImplementation(() => mockResumeCreator as any);
    
    agent = new JobScorerAgent(config, 'test-criteria.json');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreJob', () => {
    it('should score a job successfully', async () => {
      const mockRationale = 'This job is a good match because it includes the required skills and offers competitive salary.';
      
      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue({
        choices: [{ message: { content: mockRationale } }]
      });

      const result = await agent.scoreJob('test123');

      expect(result.jobId).toBe('test123');
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.rationale).toBe(mockRationale);
      expect(result.breakdown).toHaveProperty('required_skills');
      expect(result.breakdown.required_skills).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should throw error for non-existent job', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      await expect(agent.scoreJob('nonexistent')).rejects.toThrow(
        'Job file not found for ID: nonexistent'
      );
    });

    it('should throw error for missing criteria file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => new JobScorerAgent(config, 'missing-criteria.json')).toThrow(
        'Criteria file not found'
      );
    });
  });

  describe('scoring logic', () => {
    beforeEach(async () => {
      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue({
        choices: [{ message: { content: 'Test rationale' } }]
      });
    });

    it('should score required skills correctly', async () => {
      const jobWithAllSkills = {
        ...mockJob,
        description: 'We need JavaScript, React, and Node.js experience'
      };
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('criteria.json')) {
          return JSON.stringify(mockCriteria);
        }
        return JSON.stringify(jobWithAllSkills);
      });

      const result = await agent.scoreJob('test123');
      expect(result.breakdown.required_skills).toBe(100);
    });

    it('should score salary match correctly', async () => {
      const result = await agent.scoreJob('test123');
      expect(result.breakdown.salary).toBeGreaterThan(50); // Should be a good match
    });

    it('should score location match correctly', async () => {
      const result = await agent.scoreJob('test123');
      expect(result.breakdown.location).toBe(100); // Remote matches criteria
    });

    it('should handle missing salary information', async () => {
      const jobWithoutSalary = { ...mockJob };
      delete jobWithoutSalary.salary;
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('criteria.json')) {
          return JSON.stringify(mockCriteria);
        }
        return JSON.stringify(jobWithoutSalary);
      });

      const result = await agent.scoreJob('test123');
      expect(result.breakdown.salary).toBe(50); // Default score for missing salary
    });
  });

  describe('extract method', () => {
    it('should throw error when extract is called', async () => {
      await expect(agent.extract()).rejects.toThrow(
        'JobScorerAgent does not implement extract method. Use scoreJob instead.'
      );
    });
  });

  describe('logging', () => {
    it('should log score results to file', async () => {
      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue({
        choices: [{ message: { content: 'Test rationale' } }]
      });

      await agent.scoreJob('test123');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toMatch(/score-test123-.*\.json$/);
      
      const loggedData = JSON.parse(writeCall[1]);
      expect(loggedData).toHaveProperty('jobId', 'test123');
      expect(loggedData).toHaveProperty('score');
      expect(loggedData).toHaveProperty('rationale');
      expect(loggedData).toHaveProperty('breakdown');
    });
  });

  describe('auto-resume generation', () => {
    let consoleSpy: jest.SpyInstance;
    let mockResumeCreatorInstance: jest.Mocked<ResumeCreatorAgent>;
    
    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Reset the mock and create a fresh instance
      jest.clearAllMocks();
      
      mockResumeCreatorInstance = {
        createResume: jest.fn().mockResolvedValue({
          success: true,
          pdfPath: 'test-resume.pdf',
          tailoringChanges: ['Test change 1', 'Test change 2']
        })
      } as any;
      
      (ResumeCreatorAgent as jest.MockedClass<typeof ResumeCreatorAgent>).mockImplementation(() => mockResumeCreatorInstance);
    });
    
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should generate resume when score exceeds threshold', async () => {
      // Mock high-scoring job
      const highScoringJob = {
        ...mockJob,
        description: 'We need JavaScript, React, Node.js, TypeScript, and AWS experience. Senior level position with 5+ years required.',
        location: 'Remote'
      };
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('criteria.json')) {
          return JSON.stringify(mockCriteria);
        }
        return JSON.stringify(highScoringJob);
      });

      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue({
        choices: [{ message: { content: 'High scoring job rationale' } }]
      });

      await agent.scoreJob('test123');

      expect(ResumeCreatorAgent).toHaveBeenCalledWith(
        'test-anthropic-key',
        'claude-3-5-sonnet-20241022',
        4000
      );
      
      expect(mockResumeCreatorInstance.createResume).toHaveBeenCalledWith('test123', 'test-cv.txt');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('generating tailored resume')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-generated resume: test-resume.pdf')
      );
    });

    it('should not generate resume when score is below threshold', async () => {
      // Mock low-scoring job (missing required skills)
      const lowScoringJob = {
        ...mockJob,
        description: 'We need Python and Django experience. Junior level position.',
        location: 'New York' // Not in preferred locations
      };
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('criteria.json')) {
          return JSON.stringify(mockCriteria);
        }
        return JSON.stringify(lowScoringJob);
      });

      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue({
        choices: [{ message: { content: 'Low scoring job rationale' } }]
      });

      await agent.scoreJob('test123');

      expect(mockResumeCreatorInstance.createResume).not.toHaveBeenCalled();
    });

    it('should not generate resume when CV path is not configured', async () => {
      // Mock config with no CV path
      (getAutoResumeConfig as jest.Mock).mockReturnValue({
        threshold: 80,
        cvPath: null
      });

      // Create new agent with updated config
      const newAgent = new JobScorerAgent(config, 'test-criteria.json');

      // Mock high-scoring job
      const highScoringJob = {
        ...mockJob,
        description: 'We need JavaScript, React, Node.js, TypeScript, and AWS experience.',
        location: 'Remote'
      };
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('criteria.json')) {
          return JSON.stringify(mockCriteria);
        }
        return JSON.stringify(highScoringJob);
      });

      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue({
        choices: [{ message: { content: 'High scoring job rationale' } }]
      });

      await newAgent.scoreJob('test123');

      expect(mockResumeCreatorInstance.createResume).not.toHaveBeenCalled();
    });

    it('should handle resume generation errors gracefully', async () => {
      // Mock resume generation failure
      mockResumeCreatorInstance.createResume.mockResolvedValueOnce({
        success: false,
        error: 'CV file not found'
      } as any);

      // Mock high-scoring job
      const highScoringJob = {
        ...mockJob,
        description: 'We need JavaScript, React, Node.js, TypeScript, and AWS experience.',
        location: 'Remote'
      };
      
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('criteria.json')) {
          return JSON.stringify(mockCriteria);
        }
        return JSON.stringify(highScoringJob);
      });

      (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue({
        choices: [{ message: { content: 'High scoring job rationale' } }]
      });

      await agent.scoreJob('test123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resume generation failed: CV file not found')
      );
      expect(mockResumeCreatorInstance.createResume).toHaveBeenCalledWith('test123', 'test-cv.txt');
    });
  });
});