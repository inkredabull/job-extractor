import { JobExtractorAgent } from '../packages/core/src/agents/job-extractor-agent';
import { WebScraper } from '../packages/core/src/utils/web-scraper';
import { AgentConfig } from '../packages/core/src/types';

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

  it('should extract job data from JSON-LD structured data', async () => {
    const mockHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "http://schema.org",
              "@type": "JobPosting",
              "title": "Software Engineer",
              "hiringOrganization": {
                "name": "TechCorp",
                "@type": "Organization"
              },
              "jobLocation": {
                "@type": "Place",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": "San Francisco, CA"
                }
              },
              "description": "We are looking for a software engineer with salary range $100,000 - $150,000..."
            }
          </script>
        </head>
        <body><div id="root"></div></body>
      </html>
    `;

    mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
    mockWebScraper.extractStructuredData.mockReturnValue({
      '@context': 'http://schema.org',
      '@type': 'JobPosting',
      title: 'Software Engineer',
      hiringOrganization: { name: 'TechCorp', '@type': 'Organization' },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'San Francisco, CA'
        }
      },
      description: 'We are looking for a software engineer with salary range $100,000 - $150,000...'
    });

    const result = await agent.extract('https://example.com/job');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: 'Software Engineer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      description: 'We are looking for a software engineer with salary range $100,000 - $150,000...',
      salary: {
        min: '$100000',
        max: '$150000',
        currency: 'USD',
      },
    });
  });

  it('should extract job data with HTML scraping fallback', async () => {
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
    mockWebScraper.extractStructuredData.mockReturnValue(null); // No structured data
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
    mockWebScraper.extractStructuredData.mockReturnValue(null);
    mockWebScraper.simplifyHtml.mockReturnValue(mockSimplifiedHtml);
    (agent as any).makeOpenAIRequest.mockResolvedValue(incompleteResponse);

    const result = await agent.extract('https://example.com/job');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
  });

  describe('salary parsing from description', () => {
    it('should extract salary range from "Hiring Range" format', async () => {
      const mockHtml = '<html><body></body></html>';
      const structuredData = {
        '@type': 'JobPosting',
        title: 'Software Engineer',
        hiringOrganization: { name: 'TechCorp' },
        jobLocation: { address: { addressLocality: 'San Francisco, CA' } },
        description: 'Great job opportunity. Hiring Range: $248,700 - $342,000 for this position.'
      };

      mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
      mockWebScraper.extractStructuredData.mockReturnValue(structuredData);

      const result = await agent.extract('https://example.com/job');

      expect(result.success).toBe(true);
      expect(result.data?.salary).toEqual({
        min: '$248700',
        max: '$342000',
        currency: 'USD'
      });
    });

    it('should extract salary range from simple format', async () => {
      const mockHtml = '<html><body></body></html>';
      const structuredData = {
        '@type': 'JobPosting',
        title: 'Software Engineer',
        hiringOrganization: { name: 'TechCorp' },
        jobLocation: { address: { addressLocality: 'San Francisco, CA' } },
        description: 'We offer $120,000 - $180,000 annually for this role.'
      };

      mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
      mockWebScraper.extractStructuredData.mockReturnValue(structuredData);

      const result = await agent.extract('https://example.com/job');

      expect(result.success).toBe(true);
      expect(result.data?.salary).toEqual({
        min: '$120000',
        max: '$180000',
        currency: 'USD'
      });
    });

    it('should extract single salary value', async () => {
      const mockHtml = '<html><body></body></html>';
      const structuredData = {
        '@type': 'JobPosting',
        title: 'Software Engineer',
        hiringOrganization: { name: 'TechCorp' },
        jobLocation: { address: { addressLocality: 'San Francisco, CA' } },
        description: 'This position offers a Salary: $150,000 per year.'
      };

      mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
      mockWebScraper.extractStructuredData.mockReturnValue(structuredData);

      const result = await agent.extract('https://example.com/job');

      expect(result.success).toBe(true);
      expect(result.data?.salary).toEqual({
        min: '$150000',
        max: '$150000',
        currency: 'USD'
      });
    });

    it('should handle descriptions without salary information', async () => {
      const mockHtml = '<html><body></body></html>';
      const structuredData = {
        '@type': 'JobPosting',
        title: 'Software Engineer',
        hiringOrganization: { name: 'TechCorp' },
        jobLocation: { address: { addressLocality: 'San Francisco, CA' } },
        description: 'Great job opportunity with excellent benefits and growth potential.'
      };

      mockWebScraper.fetchHtml.mockResolvedValue(mockHtml);
      mockWebScraper.extractStructuredData.mockReturnValue(structuredData);

      const result = await agent.extract('https://example.com/job');

      expect(result.success).toBe(true);
      expect(result.data?.salary).toBeUndefined();
    });
  });
});