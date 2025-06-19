import { JobExtractorAgent } from '../src/agents/job-extractor-agent';
import { WebScraper } from '../src/utils/web-scraper';
import { AgentConfig } from '../src/types';

jest.mock('../src/utils/web-scraper');
jest.mock('openai');

const mockWebScraper = WebScraper as jest.Mocked<typeof WebScraper>;

describe('JobExtractorAgent', () => {
  let agent: JobExtractorAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      openaiApiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 2000,
    };

    agent = new JobExtractorAgent(config);

    // Mock the makeOpenAIRequest method
    jest.spyOn(agent as any, 'makeOpenAIRequest').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should extract job data successfully', async () => {
    const mockHtml = '<html><body><h1>Software Engineer</h1><p>Company: TechCorp</p></body></html>';
    const mockSimplifiedHtml = '<h1>Software Engineer</h1><p>Company: TechCorp</p>';
    const mockLLMResponse = JSON.stringify({
      title: 'Software Engineer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      description: 'We are looking for a software engineer...',
      salary: {
        min: '$100,000',
        max: '$150,000',
        currency: 'USD',
      },
    });

    mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
    mockWebScraper.simplifyHtml.mockReturnValue(mockSimplifiedHtml);
    (agent as any).makeOpenAIRequest.mockResolvedValue(mockLLMResponse);

    const result = await agent.extract('https://example.com/job');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: 'Software Engineer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      description: 'We are looking for a software engineer...',
      salary: {
        min: '$100,000',
        max: '$150,000',
        currency: 'USD',
      },
    });
  });

  it('should handle web scraping errors', async () => {
    mockWebScraper.fetchHtml.mockRejectedValue(new Error('Failed to fetch'));

    const result = await agent.extract('https://example.com/job');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to fetch');
  });

  it('should handle LLM response errors', async () => {
    const mockHtml = '<html><body><h1>Test</h1></body></html>';
    const mockSimplifiedHtml = '<h1>Test</h1>';

    mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
    mockWebScraper.simplifyHtml.mockReturnValue(mockSimplifiedHtml);
    (agent as any).makeOpenAIRequest.mockRejectedValue(new Error('LLM Error'));

    const result = await agent.extract('https://example.com/job');

    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM Error');
  });

  it('should handle invalid JSON response', async () => {
    const mockHtml = '<html><body><h1>Test</h1></body></html>';
    const mockSimplifiedHtml = '<h1>Test</h1>';
    const invalidResponse = 'This is not JSON';

    mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
    mockWebScraper.simplifyHtml.mockReturnValue(mockSimplifiedHtml);
    (agent as any).makeOpenAIRequest.mockResolvedValue(invalidResponse);

    const result = await agent.extract('https://example.com/job');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse job data');
  });

  it('should handle missing required fields', async () => {
    const mockHtml = '<html><body><h1>Test</h1></body></html>';
    const mockSimplifiedHtml = '<h1>Test</h1>';
    const incompleteResponse = JSON.stringify({
      title: 'Software Engineer',
      // Missing company, location, description
    });

    mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
    mockWebScraper.simplifyHtml.mockReturnValue(mockSimplifiedHtml);
    (agent as any).makeOpenAIRequest.mockResolvedValue(incompleteResponse);

    const result = await agent.extract('https://example.com/job');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
  });
});