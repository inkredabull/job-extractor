import { WebScraper } from '../src/utils/web-scraper';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebScraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchHtml', () => {
    it('should fetch HTML from a URL successfully', async () => {
      const mockHtml = '<html><body><h1>Test</h1></body></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await WebScraper.fetchHtml('https://example.com');

      expect(result).toBe(mockHtml);
      expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com', {
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Mozilla'),
        }),
        timeout: 10000,
      });
    });

    it('should throw an error when fetch fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(WebScraper.fetchHtml('https://example.com')).rejects.toThrow(
        'Unknown error fetching URL'
      );
    });
  });

  describe('simplifyHtml', () => {
    it('should remove script and style tags', () => {
      const html = '<html><body><h1>Title</h1><script>alert("test")</script><style>body{}</style></body></html>';
      const result = WebScraper.simplifyHtml(html);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<style>');
      expect(result).toContain('<h1>Title</h1>');
    });

    it('should remove unnecessary attributes', () => {
      const html = '<div class="test" id="test" data-foo="bar" href="link">Content</div>';
      const result = WebScraper.simplifyHtml(html);

      expect(result).not.toContain('class=');
      expect(result).not.toContain('id=');
      expect(result).not.toContain('data-foo=');
      expect(result).toContain('href=');
      expect(result).toContain('Content');
    });

    it('should remove empty elements', () => {
      const html = '<div><p></p><span>Content</span><div></div></div>';
      const result = WebScraper.simplifyHtml(html);

      expect(result).toContain('Content');
      expect(result.match(/<p><\/p>/g)).toBeNull();
    });

    it('should preserve self-closing tags', () => {
      const html = '<div><br><img src="test.jpg" alt="test"><hr></div>';
      const result = WebScraper.simplifyHtml(html);

      expect(result).toContain('<br>');
      expect(result).toContain('<img');
      expect(result).toContain('<hr>');
    });
  });
});