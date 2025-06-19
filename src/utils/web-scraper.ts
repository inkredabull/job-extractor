import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebScraper {
  private static readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private static readonly TIMEOUT = 10000;

  static async fetchHtml(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: this.TIMEOUT,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
      }
      throw new Error(`Unknown error fetching URL: ${error}`);
    }
  }

  static extractStructuredData(html: string): any {
    const $ = cheerio.load(html);
    
    // Look for JSON-LD structured data
    const jsonLdScripts = $('script[type="application/ld+json"]');
    
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const scriptContent = $(jsonLdScripts[i]).html();
        if (scriptContent) {
          const jsonData = JSON.parse(scriptContent);
          
          // Check if it's JobPosting structured data
          if (jsonData['@type'] === 'JobPosting') {
            console.log('🔍 DEBUG: Found JobPosting JSON-LD structured data');
            return jsonData;
          }
        }
      } catch (error) {
        console.log('🔍 DEBUG: Failed to parse JSON-LD script:', error);
        continue;
      }
    }
    
    return null;
  }

  static simplifyHtml(html: string): string {
    const $ = cheerio.load(html);

    // Remove script and style tags
    $('script, style, noscript, svg').remove();

    // Remove comments
    $('*').contents().filter((_, node) => node.type === 'comment').remove();

    // Remove attributes that don't add semantic value
    $('*').each((_, element) => {
      const $element = $(element);
      const attributesToKeep = ['href', 'src', 'alt', 'title'];
      
      // Get all attributes
      const attributes = (element as any).attribs || {};
      
      // Remove all attributes except the ones we want to keep
      Object.keys(attributes).forEach(attr => {
        if (!attributesToKeep.includes(attr)) {
          $element.removeAttr(attr);
        }
      });
    });

    // Remove empty elements (except self-closing ones)
    const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link'];
    $('*').each((_, element) => {
      const $element = $(element);
      const tagName = (element as any).tagName?.toLowerCase();
      
      if (!selfClosingTags.includes(tagName || '') && $element.text().trim() === '' && $element.children().length === 0) {
        $element.remove();
      }
    });

    // Get the body content or fallback to full HTML
    const bodyContent = $('body').html() || $.html();
    
    // Clean up extra whitespace
    return bodyContent
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }
}