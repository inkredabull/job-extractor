/**
 * Resume & Achievement Management System
 *
 * A comprehensive Google Apps Script for managing work history,
 * generating achievements, and creating tailored resumes using AI.
 *
 * @author Anthony Bull
 * @version 2.0.0
 * @description Refactored from monolithic script to modular ES6+ architecture
 *
 * SETUP INSTRUCTIONS:
 * 1. Run setupAPIKeys() to configure API credentials
 * 2. Ensure required sheets exist (Work History : Story Bank, etc.)
 * 3. Open spreadsheet to trigger onOpen() and create menu
 *
 * CONFIGURATION:
 * - Edit CONFIG object for customization
 * - Sheet column mappings in CONFIG.COLUMNS
 * - AI provider settings in CONFIG.AI
 *
 * DEPENDENCIES:
 * - Google Apps Script services (SpreadsheetApp, DocumentApp, etc.)
 * - External APIs: Anthropic Claude, Google Vertex AI, OpenAI
 */

// ====================
// 1. CONFIGURATION
// ====================
// #region Configuration

/**
 * Global configuration object containing all constants and settings
 */
const CONFIG = {
  // Sheet names
  SHEETS: {
    STORY_BANK: 'Work History : Story Bank',
    COMPANIES: 'Work History : Companies & Sequence',
    CUSTOMIZER: 'Resume : Customizer',
    CONFIG: 'Config',
    CV_VIEW: 'CV (View)',
    CV_TXT: 'CV.txt (all)',
    WORK_HISTORY: 'Work History',
    FUNCTION: 'Work History : Function',
    POSITIONING: 'Positioning : Mnookin PT',
    CUSTOMIZATION: 'Customization'
  },

  // Column mappings for Story Bank sheet
  COLUMNS: {
    STORY_BANK: {
      COMPANY: 'Company',
      SEQUENCE: 'Seq',
      CHALLENGE: 'Challenge',
      ACTIONS: 'Actions',
      RESULT: 'Result',
      CLIENT: 'Client',
      ACHIEVEMENT: 'Achievement',
      SHORT: 'Short',
      LONG: 'Long',
      RESUME_BULLET_POINT: 'Resume Bullet Point',
      WOW: 'Wow',
      DOMAIN: 'Domain',
      INCLUDE: 'Include?',
      FOCUS: 'Focus',
      ID: 'ID',
      TEAL_ID: 'TealHQ ID',
      TIMING: 'Timing'
    },
    COMPANIES: {
      COMPANY: 'Company',
      SEQUENCE: 'Sequence',
      TITLE: 'Title',
      DURATION: 'Duration',
      SUMMARY: 'Summary',
      STACK: 'Stack',
      DOMAIN: 'Domain'
    },
    CUSTOMIZER: {
      JOB_DESCRIPTION: 0,  // Column A (0-indexed)
      RESUME: 1            // Column B (0-indexed)
    }
  },

  // AI Provider settings - Using OpenRouter for unified access
  AI: {
    ENDPOINT: 'https://openrouter.ai/api/v1/chat/completions',
    MODELS: {
      CLAUDE: 'anthropic/claude-3.7-sonnet',
      GEMINI: 'google/gemini-1.5-flash',
      OPENAI: 'openai/gpt-4o-mini'
    },
    MAX_TOKENS: {
      ACHIEVEMENT: 150,
      RESUME: 2048,
      CATEGORIZATION: 15,
      ARCHETYPE: 20
    },
    TEAL_BULLET_POINT_MIN_LENGTH: 140,
    TEAL_BULLET_POINT_MAX_LENGTH: 190,
    SHORT_SCALE: 2.2,
    LONG_SCALE: 1.33,
    SCALE_FACTOR: 1.33  // Use LONG_SCALE as default
  },

  // Document generation settings
  DOCUMENT: {
    DEFAULT_PADDING: 4,
    DEFAULT_FONT_SIZE: 11,
    RESUME_TEMPLATE_ID: '1E7ttSQEnpsO5LMX1anSQ_dg2RJsqOQ_4WlO1Oadc-GY',
    INCLUDE_TECH_STACK: false
  },

  // Resume filtering thresholds
  THRESHOLDS: {
    WOW_MIN: 6,
    WOW_THRESHOLD: 6,
    SEQUENCE_THRESHOLD: 4,
    COMPLETE_WOW: 3,
    COMPLETE_SEQUENCE: 10
  },

  // Strengths to display on resume
  STRENGTHS: [
    "Process & Structure - Instills order and clarity to scale engineering with aligned execution",
    "Communication - Trusted communicator who fosters clarity, alignment, and cross-team collaboration",
    "Action-Oriented - Unblocks teams and delivers fast, practical solutions",
    "Leadership - Inspires vision, uplifts teams, and accelerates positive change",
    "Detail-Oriented - Brings structure, clarity, and accountability to complex ideas"
  ],

  // Key accomplishments to display on resume
  KEY_ACCOMPLISHMENTS: [
    "Drove 35% productivity gain via AI in 2024",
    "Launched 0-1 marketplace in 2023; 1st $1M",
    "Boosted ARR 50% via data platform in 2022",
    "Delivered 1200% productivity gain in 2022"
  ],

  // Prompt templates
  PROMPTS: {
    SYSTEM_ROLE: "You are a professional, experienced copywriter specializing in writing resumes for executive product engineering roles.",

    BULLET_CHAR: "Start with a Unicode bullet character e.g. U+2022",

    MARKS: `Omit any reference marks; do not use symbols like '*,' '**,' or '-.'
Omit use definite or indefinite articles such as 'the' or 'a'.
Do not end with a period.`,

    SPECIFICS: "Do not provide any reasoning or contextualization; simply return the output without any prefix or suffix.",

    FORMATTING_TEMPLATE: `An achievement must be at least minOuputSizeInChars characters long and cannot be more than maxOuputSizeInChars characters long and must be a singular sentence.

For the achievement, start it with one and only one action verb. Avoid passive language that conveys 'Doing' versus 'Achieving.'

Here is an example of passive language or 'Doing': "Negotiated contracts with vendors"
Here is an example of action language or 'Achieving': "Slashed payroll/benefits administration costs 30% by negotiating pricing and fees, while ensuring the continuation and enhancements of services."

If proper noun references are made, include those.`,

    NORMALIZE: `Convert the Achievement below into a resume bullet point that meets ALL of the following criteria:

REQUIRED CRITERIA:

Length: 40-60 characters total (strict requirement)
Structure: [Action Verb] + [Object/Outcome] + "by" + [Number/Percentage/Timeframe]
Action Verb: Must start with a past-tense action verb (e.g., Built, Reduced, Increased, Delivered, Improved, Launched)
Quantification: Must include exactly ONE specific number, percentage, or timeframe
Single Focus: Describe only ONE achievement or metric (not multiple outcomes)
Conciseness: No complex clauses, no conjunctions (and, or), no sub-clauses

VALID Examples:

Improved search results by 400%.
Increased test coverage by 300%.
Improved email deliverability by 25%.
Built payment system in 6 weeks.
Reduced server costs by 40%.

INVALID Examples (and why they fail):

"Streamlined documentation process of company's core data model through use of dbdiagram.io"
❌ Exceeds 60 characters, no quantification, too complex
"Spearheaded cultural transformation, shifting organization from Waterfall to Agile+Scrum, resulting in 25% increase in team velocity and 30% reduction in project delivery timelines"
❌ Far exceeds 60 characters, multiple metrics, compound structure
"Boosted team performance via strategic exits, coaching, Agile training, clarified career paths"
❌ Exceeds 60 characters, multiple activities, no quantification

Output Requirements:

Return ONLY the reformatted bullet point
Do NOT end with puncutation
No quotation marks, explanations, or additional text
Must pass all 6 criteria above`,

    IS_IMPACTFUL: `Evaluate if the following achievement meets ALL criteria:

1. Character count between 40-60? (YES/NO)
2. Starts with action verb? (YES/NO)
3. Contains exactly ONE quantifiable metric? (YES/NO)
4. Follows structure [Verb + Object + by + Number]? (YES/NO)
5. Single focus (not compound)? (YES/NO)
6. No complex clauses or conjunctions? (YES/NO)

Return TRUE only if all 6 = YES. Otherwise return FALSE. Return only TRUE or FALSE.`,

    ACHIEVEMENT_SIMPLIFIED: `Given the following CHALLENGE, ACTIONS, and RESULT, summarize into a single achievement which:

* follows the format of: "<Action verb in active voice> <what was done> <with whom (specific peer/leader/function/team)> to <achieve result - preferably quantifiable (e.g. revenue generated, hours saved, % more throughput, etc.)>."
* is approximately maxOuputSizeInChars characters`,

    BEST_EFFORT: `If any of the Challenge, Actions, or Result contains the following, make a best effort to incorporate it/them in the summary:

* mention of 'Agile' or 'Scrum'
* a reference to working with and/or collaborating an individual or team
* a reference to anyone in the C-Suite (e.g. CEO, CTO) or leadership (e.g. VP or Director)
* any mention of identifying problem and then solving them
* any mention of something being '1st' or 'first'
* any quantitative values
* references to proper nouns and/or specific technologies
* a time-based reference (e.g. 'over X weeks' or 'in Y months')
* a reference to 'hands-on'
* a reference to a country

Lead the summary with any quantitative improvement outcome as followed by implementation or other details.`
  },

  // Contact information
  CONTACT: {
    NAME: 'Anthony Bull',
    LOCATION: 'San Francisco, CA',
    PHONE: '+1 415-269-4893',
    EMAIL: 'anthony at bluxomelabs.com',
    LINKEDIN: 'linkedin.com/in/anthony-bull'
  },

  // Education
  EDUCATION: [
    {
      degree: 'MS Information Science @ UNC Chapel Hill',
      details: ['Focus on Information Retrieval, Bayesian Classification, & Recommendation Systems']
    },
    {
      degree: 'BA in Mathematics @ Hope College',
      details: []
    }
  ],

  // Debug flag
  DEBUG: false
};
// #endregion Configuration

// ====================
// 2. UTILITIES
// ====================
// #region Utilities

//#region Logger

/**
 * Logger utility class for consistent logging
 */
class Logger {
  /**
   * Log a message
   * @param {string} message - Message to log
   * @param {string} level - Log level (INFO, WARN, ERROR)
   */
  static log(message, level = 'INFO') {
    console.log(`[${level}] ${message}`);
  }

  /**
   * Log an error with stack trace
   * @param {string} message - Error message
   * @param {Error} error - Error object
   */
  static error(message, error) {
    console.error(`[ERROR] ${message}`, error);
    if (error && error.stack) {
      console.error(error.stack);
    }
  }

  /**
   * Log a warning
   * @param {string} message - Warning message
   */
  static warn(message) {
    console.warn(`[WARN] ${message}`);
  }
}
//#endregion Logger

//#region ValidationUtils
/**
 * Validation utility class
 */
class ValidationUtils {
  /**
   * Validate that a sheet exists
   * @param {string} sheetName - Name of the sheet
   * @returns {boolean} True if sheet exists
   */
  static validateSheetExists(sheetName) {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" does not exist`);
    }
    return true;
  }

  /**
   * Validate cell value type
   * @param {*} value - Value to validate
   * @param {string} type - Expected type
   * @returns {boolean} True if valid
   */
  static validateCellValue(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true;
    }
  }

  /**
   * Validate API key exists
   * @param {string} keyName - Name of the API key
   * @returns {boolean} True if key exists
   */
  static validateAPIKey(keyName) {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty(keyName);
    if (!key) {
      throw new Error(`API key "${keyName}" not found. Run setupAPIKeys() first.`);
    }
    return true;
  }
}
//#endregion ValidationUtils

//#region TextUtils
/**
 * Text utility class
 */
class TextUtils {
  /**
   * Generate unique hash for text
   * @param {string} text - Text to hash
   * @param {number} length - Length of hash (default: 6)
   * @returns {string} Hex hash
   */
  static generateHash(text, length = 6) {
    let hexstr = '';
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
    for (let i = 0; i < digest.length; i++) {
      const val = (digest[i] + 256) % 256;
      hexstr += ('0' + val.toString(16)).slice(-2);
    }
    return hexstr.slice(0, length);
  }

  /**
   * Truncate text to maximum length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  static truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Escape markdown characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeMarkdown(text) {
    return text
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  /**
   * Convert basic Markdown to HTML
   * @param {string} markdown - Markdown text
   * @returns {string} HTML text
   */
  static convertMarkdownToHtml(markdown) {
    let html = markdown
      // Replace Markdown headings (#, ##, ###, etc.)
      .replace(/^(#{1,6})\s+(.*)/gm, (_, hashes, title) => {
        const level = hashes.length;
        return `<h${level}>${title}</h${level}>`;
      })
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      // Italic *text*
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      // Convert newlines to <br>
      .replace(/\n/g, '<br>');

    return `<html><body>${html}</body></html>`;
  }

  /**
   * Replace size placeholders in text
   * @param {string} text - Text with placeholders
   * @param {string} targetAudience - Target audience ('cv' or 'linkedin')
   * @returns {string} Text with replaced values
   */
  static replaceSizePlaceholders(text, targetAudience = 'linkedin') {
    const scaleFactor = (targetAudience !== 'linkedin')
      ? CONFIG.AI.LONG_SCALE
      : CONFIG.AI.SHORT_SCALE;

    const minLength = Math.round(CONFIG.AI.TEAL_BULLET_POINT_MIN_LENGTH / scaleFactor);
    const maxLength = Math.round(CONFIG.AI.TEAL_BULLET_POINT_MAX_LENGTH / scaleFactor);

    return text
      .replace(/minOuputSizeInChars/g, minLength)
      .replace(/maxOuputSizeInChars/g, maxLength);
  }

  /**
   * Extract first word (verb) from text
   * @param {string} input - Input text
   * @returns {string} First word
   */
  static extractVerb(input) {
    if (typeof input !== 'string') return '';
    const words = input.split(' ');
    return words.length > 0 ? words[0] : '';
  }
}
//#endregion TextUtils
// #endregion Utilities

// ====================
// 3. DATA ACCESS LAYER
// ====================
// #region Data Access Layer

//#region SheetService

/**
 * Service for interacting with Google Sheets
 */
class SheetService {
  /**
   * Create a new SheetService
   * @param {Spreadsheet} spreadsheet - Optional spreadsheet object
   */
  constructor(spreadsheet = null) {
    this.spreadsheet = spreadsheet || SpreadsheetApp.getActive();
  }

  /**
   * Get a sheet by name
   * @param {string} sheetName - Name of the sheet
   * @returns {Sheet} Sheet object
   * @throws {Error} If sheet doesn't exist
   */
  getSheet(sheetName) {
    const sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    return sheet;
  }

  /**
   * Ensure a sheet exists, create if not
   * @param {string} sheetName - Name of the sheet
   * @returns {Sheet} Sheet object
   */
  ensureSheet(sheetName) {
    let sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet(sheetName);
    }
    return sheet;
  }

  /**
   * Get all data from a sheet
   * @param {string} sheetName - Name of the sheet
   * @returns {Array<Array>} 2D array of values
   */
  getSheetData(sheetName) {
    const sheet = this.getSheet(sheetName);
    return sheet.getDataRange().getValues();
  }

  /**
   * Get headers from a sheet
   * @param {string} sheetName - Name of the sheet
   * @returns {Array<string>} Array of header names
   */
  getHeaders(sheetName) {
    const data = this.getSheetData(sheetName);
    return data.length > 0 ? data[0] : [];
  }

  /**
   * Get cell value
   * @param {string} sheetName - Name of the sheet
   * @param {number} row - Row number (1-indexed)
   * @param {number} col - Column number (1-indexed)
   * @returns {*} Cell value
   */
  getCellValue(sheetName, row, col) {
    const sheet = this.getSheet(sheetName);
    return sheet.getRange(row, col).getValue();
  }

  /**
   * Set cell value
   * @param {string} sheetName - Name of the sheet
   * @param {number} row - Row number (1-indexed)
   * @param {number} col - Column number (1-indexed)
   * @param {*} value - Value to set
   */
  setCellValue(sheetName, row, col, value) {
    const sheet = this.getSheet(sheetName);
    sheet.getRange(row, col).setValue(value);
  }

  /**
   * Sort a sheet by columns
   * @param {string} sheetName - Name of the sheet
   * @param {Array<Object>} sortColumns - Array of {column: number, ascending: boolean}
   */
  sortSheet(sheetName, sortColumns) {
    const sheet = this.getSheet(sheetName);
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    dataRange.sort(sortColumns);
  }

  /**
   * Get Story Bank data with headers
   * @returns {Object} {headers: Array, rows: Array<Array>}
   */
  getStoryBankData() {
    const data = this.getSheetData(CONFIG.SHEETS.STORY_BANK);
    const headers = data.shift();
    return { headers, rows: data };
  }

  /**
   * Get Company data as object
   * @returns {Object} Company data keyed by company name
   */
  getCompanyData() {
    const sheet = this.getSheet(CONFIG.SHEETS.COMPANIES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const companyIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.COMPANY);
    const sequenceIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.SEQUENCE);
    const titleIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.TITLE);
    const durationIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.DURATION);
    const summaryIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.SUMMARY);
    const stackIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.STACK);
    const domainIndex = headers.indexOf(CONFIG.COLUMNS.COMPANIES.DOMAIN);

    const companyData = {};

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const company = row[companyIndex];

      if (company) {
        companyData[company] = {
          sequence: row[sequenceIndex] || '',
          title: row[titleIndex] || '',
          duration: row[durationIndex] || '',
          summary: row[summaryIndex] || '',
          stack: row[stackIndex] || '',
          domain: row[domainIndex] || ''
        };
      }
    }

    return companyData;
  }

  /**
   * Get active cell
   * @returns {Range} Active cell range
   */
  getActiveCell() {
    return this.spreadsheet.getActiveSheet().getActiveCell();
  }

  /**
   * Get active row data
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} {rowIndex: number, row: Array, headers: Array}
   */
  getActiveRowData(sheetName) {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const currentCell = sheet.getActiveCell();
    const rowIndex = currentCell.getRow();
    const rowAsRange = sheet.getRange(`${rowIndex}:${rowIndex}`);
    const row = rowAsRange.getValues()[0];

    return { rowIndex, row, headers };
  }
}
//#endregion SheetService

//#region ConfigService
/**
 * Service for managing configuration
 */
class ConfigService {
  /**
   * Create a new ConfigService
   * @param {SheetService} sheetService - Sheet service instance
   */
  constructor(sheetService) {
    this.sheetService = sheetService;
    this.cache = {};
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = null) {
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }

    try {
      const sheet = this.sheetService.getSheet(CONFIG.SHEETS.CONFIG);
      const data = sheet.getDataRange().getValues();

      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === key) {
          this.cache[key] = data[i][1];
          return this.cache[key];
        }
      }
    } catch (error) {
      Logger.warn(`Config key "${key}" not found, using default: ${defaultValue}`);
    }

    return defaultValue;
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Value to set
   */
  set(key, value) {
    const sheet = this.sheetService.getSheet(CONFIG.SHEETS.CONFIG);
    const data = sheet.getDataRange().getValues();

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        this.cache[key] = value;
        return;
      }
    }

    // If key doesn't exist, append it
    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1).setValue(key);
    sheet.getRange(newRow, 2).setValue(value);
    this.cache[key] = value;
  }

  /**
   * Get API key from Script Properties
   * @param {string} provider - Provider name (CLAUDE, GEMINI, OPENAI)
   * @returns {string} API key
   * @throws {Error} If key not found
   */
  getAPIKey(provider) {
    const props = PropertiesService.getScriptProperties();
    const keyName = `${provider.toUpperCase()}_API_KEY`;
    const key = props.getProperty(keyName);

    if (!key) {
      throw new Error(`API key not found for ${provider}. Run setupAPIKeys() first.`);
    }

    return key;
  }

  /**
   * Set API key in Script Properties
   * @param {string} provider - Provider name
   * @param {string} key - API key
   */
  setAPIKey(provider, key) {
    const props = PropertiesService.getScriptProperties();
    const keyName = `${provider.toUpperCase()}_API_KEY`;
    props.setProperty(keyName, key);
  }

  /**
   * Get minimum wow threshold
   * @returns {number} Minimum wow value
   */
  getMinWow() {
    return this.get('MIN_WOW', CONFIG.THRESHOLDS.WOW_MIN);
  }

  /**
   * Get respect include flag
   * @returns {boolean} Whether to respect include flag
   */
  getRespectIncludeFlag() {
    return this.get('RESPECT_INCLUDE_FLAG', true);
  }

  /**
   * Get wow threshold
   * @returns {number} Wow threshold
   */
  getWowThreshold() {
    return CONFIG.THRESHOLDS.WOW_THRESHOLD;
  }

  /**
   * Get sequence threshold
   * @returns {number} Sequence threshold
   */
  getSequenceThreshold() {
    return CONFIG.THRESHOLDS.SEQUENCE_THRESHOLD;
  }
}
//#endregion ConfigService
// #endregion Data Access Layer

// ====================
// 4. AI INTEGRATION LAYER
// ====================
// #region AI Integration Layer

//#region AIProviderBase

/**
 * Base class for AI providers
 */
class AIProviderBase {
  /**
   * Create an AI provider
   * @param {string} apiKey - API key
   * @param {string} model - Model name
   * @param {string} name - Provider name
   */
  constructor(apiKey, model, name) {
    this.apiKey = apiKey;
    this.model = model;
    this.name = name;
  }

  /**
   * Generate API endpoint URL
   * @returns {string} Endpoint URL
   */
  getEndpoint() {
    throw new Error('getEndpoint() must be implemented by subclass');
  }

  /**
   * Generate request payload
   * @param {string} prompt - Prompt text
   * @param {number} maxTokens - Maximum output tokens
   * @returns {Object} Request payload
   */
  generatePayload(prompt, maxTokens) {
    throw new Error('generatePayload() must be implemented by subclass');
  }

  /**
   * Generate authentication headers
   * @returns {Object} Headers object
   */
  generateAuthHeader() {
    throw new Error('generateAuthHeader() must be implemented by subclass');
  }

  /**
   * Parse API response
   * @param {Object} response - HTTP response
   * @returns {string} Extracted text
   */
  parseResponse(response) {
    throw new Error('parseResponse() must be implemented by subclass');
  }

  /**
   * Query the AI provider
   * @param {string} prompt - Prompt text
   * @param {number} maxTokens - Maximum output tokens
   * @returns {string} AI response
   */
  query(prompt, maxTokens = 1000) {
    try {
      const payload = this.generatePayload(prompt, maxTokens);
      const headers = this.generateAuthHeader();
      const options = {
        method: 'post',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        contentType: 'application/json'
      };

      const url = this.getEndpoint();
      const response = UrlFetchApp.fetch(url, options);

      if (response.getResponseCode() === 200) {
        const result = this.parseResponse(response);
        Logger.log(`AI response length: ${result.length}`);
        return result;
      } else {
        const errorText = response.getContentText();
        Logger.error(`AI query failed: ${errorText}`);
        throw new Error(errorText);
      }
    } catch (error) {
      Logger.error(`AI query failed: ${error.message}`, error);
      throw error;
    }
  }
}
//#endregion AIProviderBase

//#region OpenRouterProvider
/**
 * OpenRouter unified AI provider
 * Access to Claude, Gemini, OpenAI, and 200+ models through single API
 */
class OpenRouterProvider extends AIProviderBase {
  /**
   * Create an OpenRouter provider
   * @param {string} apiKey - OpenRouter API key
   */
  constructor(apiKey) {
    super(apiKey, '', 'openrouter');
  }

  /**
   * Get OpenRouter API endpoint
   * @returns {string} Endpoint URL
   */
  getEndpoint() {
    return CONFIG.AI.ENDPOINT;
  }

  /**
   * Generate OpenRouter request payload
   * @param {string} prompt - Prompt text
   * @param {number} maxTokens - Maximum output tokens
   * @param {string} modelName - Model identifier (e.g., 'anthropic/claude-3.7-sonnet')
   * @returns {Object} Request payload
   */
  generatePayload(prompt, maxTokens, modelName) {
    return {
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens
    };
  }

  /**
   * Generate OpenRouter authentication headers
   * @returns {Object} Headers object
   */
  generateAuthHeader() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://sheets.google.com',  // For OpenRouter rankings
      'X-Title': 'Resume Achievement Generator'      // For OpenRouter rankings
    };
  }

  /**
   * Parse OpenRouter response
   * @param {Object} response - HTTP response
   * @returns {string} Extracted text
   */
  parseResponse(response) {
    const json = JSON.parse(response.getContentText());
    return String(json.choices[0].message.content).trim();
  }

  /**
   * Query OpenRouter with specific model
   * @param {string} prompt - Prompt text
   * @param {number} maxTokens - Maximum output tokens
   * @param {string} modelName - Model identifier
   * @returns {string} AI response
   */
  queryWithModel(prompt, maxTokens, modelName) {
    try {
      const payload = this.generatePayload(prompt, maxTokens, modelName);
      const headers = this.generateAuthHeader();
      const options = {
        method: 'post',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        contentType: 'application/json'
      };

      const url = this.getEndpoint();
      const response = UrlFetchApp.fetch(url, options);

      if (response.getResponseCode() === 200) {
        const result = this.parseResponse(response);
        Logger.log(`OpenRouter response (${modelName}): ${result.length} chars`);
        return result;
      } else {
        const errorText = response.getContentText();
        Logger.error(`OpenRouter query failed: ${errorText}`);
        throw new Error(errorText);
      }
    } catch (error) {
      Logger.error(`OpenRouter query failed: ${error.message}`, error);
      throw error;
    }
  }
}
//#endregion OpenRouterProvider

//#region AIService
/**
 * AI Service using OpenRouter for unified model access
 */
class AIService {
  /**
   * Create an AI service
   * @param {ConfigService} configService - Configuration service
   */
  constructor(configService) {
    this.configService = configService;
    this.provider = this.initializeProvider();
    this.defaultModel = 'claude';
    this.modelMap = {
      'claude': CONFIG.AI.MODELS.CLAUDE,
      'gemini': CONFIG.AI.MODELS.GEMINI,
      'openai': CONFIG.AI.MODELS.OPENAI
    };
  }

  /**
   * Initialize OpenRouter provider
   * @returns {OpenRouterProvider} OpenRouter provider instance
   */
  initializeProvider() {
    try {
      const apiKey = this.configService.getAPIKey('OPENROUTER');
      return new OpenRouterProvider(apiKey);
    } catch (error) {
      Logger.error(`OpenRouter provider initialization failed: ${error.message}`);
      throw new Error('Failed to initialize OpenRouter. Run setupAPIKeys() first.');
    }
  }

  /**
   * Query an AI model via OpenRouter
   * @param {string} prompt - Prompt text
   * @param {Object} options - Query options {provider: string, maxTokens: number}
   * @returns {string} AI response
   */
  query(prompt, options = {}) {
    const { provider = this.defaultModel, maxTokens = 1000 } = options;

    const modelName = this.modelMap[provider];
    if (!modelName) {
      throw new Error(`Model "${provider}" not available. Valid options: claude, gemini, openai`);
    }

    Logger.log(`Querying ${modelName} via OpenRouter with maxTokens: ${maxTokens}`);
    return this.provider.queryWithModel(prompt, maxTokens, modelName);
  }

  /**
   * Set default model
   * @param {string} provider - Model name ('claude', 'gemini', 'openai')
   */
  setDefaultProvider(provider) {
    if (!this.modelMap[provider]) {
      throw new Error(`Model "${provider}" not available`);
    }
    this.defaultModel = provider;
  }
}
//#endregion AIService
// #endregion AI Integration Layer

// ====================
// 5. DOCUMENT GENERATION LAYER
// ====================
// #region Document Generation Layer

//#region DocumentService

/**
 * Service for document operations
 */
class DocumentService {
  constructor() {
    this.defaultPadding = CONFIG.DOCUMENT.DEFAULT_PADDING;
    this.defaultFontSize = CONFIG.DOCUMENT.DEFAULT_FONT_SIZE;
  }

  /**
   * Create a new Google Doc
   * @param {string} title - Document title
   * @returns {Document} Document object
   */
  createDocument(title) {
    return DocumentApp.create(title);
  }

  /**
   * Open existing document by ID
   * @param {string} docId - Document ID
   * @returns {Document} Document object
   */
  openDocument(docId) {
    return DocumentApp.openById(docId);
  }

  /**
   * Copy template document
   * @param {string} templateId - Template document ID
   * @param {string} newName - New document name
   * @returns {Document} Copied document
   */
  copyTemplate(templateId, newName) {
    const template = DriveApp.getFileById(templateId);
    const newDocId = template.makeCopy(newName).getId();
    return DocumentApp.openById(newDocId);
  }

  /**
   * Append heading to body
   * @param {Body} body - Document body
   * @param {string} text - Heading text
   * @param {number} level - Heading level (1-4)
   * @param {string} alignment - Text alignment
   */
  appendHeading(body, text, level = 1, alignment = 'CENTER') {
    const headingType = [
      DocumentApp.ParagraphHeading.HEADING1,
      DocumentApp.ParagraphHeading.HEADING2,
      DocumentApp.ParagraphHeading.HEADING3,
      DocumentApp.ParagraphHeading.HEADING4
    ][level - 1];

    const alignmentType = DocumentApp.HorizontalAlignment[alignment];

    return body.appendParagraph(text)
      .setHeading(headingType)
      .setAlignment(alignmentType);
  }

  /**
   * Append paragraph to body
   * @param {Body} body - Document body
   * @param {string} text - Paragraph text
   * @param {Object} options - Style options
   * @returns {Paragraph} Paragraph element
   */
  appendParagraph(body, text, options = {}) {
    const para = body.appendParagraph(text);

    const {
      fontSize = this.defaultFontSize,
      bold = false,
      italic = false,
      alignment = 'LEFT',
      spacingBefore = this.defaultPadding,
      spacingAfter = this.defaultPadding
    } = options;

    para.setFontSize(fontSize);
    if (bold) para.setBold(bold);
    if (italic) para.setItalic(italic);
    para.setAlignment(DocumentApp.HorizontalAlignment[alignment]);
    para.setAttributes({
      [DocumentApp.Attribute.SPACING_BEFORE]: spacingBefore,
      [DocumentApp.Attribute.SPACING_AFTER]: spacingAfter
    });

    return para;
  }

  /**
   * Append list item to body
   * @param {Body} body - Document body
   * @param {string} text - List item text
   * @param {string} glyphType - Glyph type (BULLET, NUMBER, etc.)
   * @returns {ListItem} List item element
   */
  appendListItem(body, text, glyphType = 'BULLET') {
    const item = body.appendListItem(text);
    item.setFontSize(this.defaultFontSize);
    item.setGlyphType(DocumentApp.GlyphType[glyphType]);
    return item;
  }

  /**
   * Append table to body
   * @param {Body} body - Document body
   * @param {Array<Array>} data - Table data
   * @param {Object} options - Table options
   * @returns {Table} Table element
   */
  appendTable(body, data, options = {}) {
    const table = body.appendTable(data);
    const { borderWidth = 0 } = options;
    table.setBorderWidth(borderWidth);
    return table;
  }

  /**
   * Append horizontal rule
   * @param {Body} body - Document body
   * @returns {HorizontalRule} Rule element
   */
  appendHorizontalRule(body) {
    return body.appendHorizontalRule();
  }
}
//#endregion DocumentService
// #endregion Document Generation Layer

// ====================
// 6. BUSINESS LOGIC LAYER
// ====================
// #region Business Logic Layer

//#region AchievementService

/**
 * Service for generating achievements from CAR (Challenge-Action-Result)
 */
class AchievementService {
  /**
   * Create an AchievementService
   * @param {AIService} aiService - AI service instance
   */
  constructor(aiService) {
    this.aiService = aiService;
  }

  /**
   * Generate achievement from Challenge, Actions, and Result
   * @param {string} challenge - The challenge faced
   * @param {string} actions - Actions taken
   * @param {string} result - Result achieved
   * @param {boolean} client - Whether this was client work
   * @param {string} targetAudience - Target audience ('cv' or 'linkedin')
   * @returns {string} Generated achievement
   */
  generateAchievement(challenge, actions, result, client = false, targetAudience = 'cv') {
    const prompt = this._buildPrompt(challenge, actions, result, client, targetAudience);
    Logger.log(prompt)
    let output = this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.ACHIEVEMENT,
      provider: 'claude'
    });
    Logger.log("OUTPUT")
    return output
  }

  /**
   * Build prompt for achievement generation (public wrapper)
   * @param {string} challenge - Challenge text
   * @param {string} actions - Actions text
   * @param {string} result - Result text
   * @param {boolean} client - Client work flag
   * @param {string} targetAudience - Target audience
   * @returns {string} Formatted prompt
   */
  buildPrompt(challenge, actions, result, client, targetAudience) {
    return this._buildPrompt(challenge, actions, result, client, targetAudience);
  }

  /**
   * Build prompt for achievement generation
   * @param {string} challenge - Challenge text
   * @param {string} actions - Actions text
   * @param {string} result - Result text
   * @param {boolean} client - Client work flag
   * @param {string} targetAudience - Target audience
   * @returns {string} Formatted prompt
   * @private
   */
  _buildPrompt(challenge, actions, result, client, targetAudience) {
    const carBlock = this._formatCAR(challenge, actions, result);
    let basePrompt = `${CONFIG.PROMPTS.ACHIEVEMENT_SIMPLIFIED}

${CONFIG.PROMPTS.SPECIFICS}
${CONFIG.PROMPTS.MARKS}
${carBlock}`;

    return TextUtils.replaceSizePlaceholders(basePrompt, targetAudience);
  }

  /**
   * Format Challenge-Actions-Result block
   * @param {string} challenge - Challenge text
   * @param {string} actions - Actions text
   * @param {string} result - Result text
   * @returns {string} Formatted CAR block
   * @private
   */
  _formatCAR(challenge, actions, result) {
    return `CHALLENGE:

${challenge}

ACTIONS:

${actions}

RESULT:

${result}`;
  }

  /**
   * Normalize achievement to standard format
   * @param {string} achievement - Achievement to normalize
   * @returns {string} Normalized achievement
   */
  normalizeAchievement(achievement) {
    const prompt = `${CONFIG.PROMPTS.NORMALIZE}

Achievement:
${achievement}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION,
      provider: 'claude'
    });
  }

  /**
   * Shorten achievement text
   * @param {string} text - Text to shorten
   * @returns {string} Shortened text
   */
  shortenAchievement(text) {
    const scaleFactor = CONFIG.AI.SCALE_FACTOR * 2;
    const minLength = Math.round(CONFIG.AI.TEAL_BULLET_POINT_MIN_LENGTH / scaleFactor);
    const maxLength = Math.round(CONFIG.AI.TEAL_BULLET_POINT_MAX_LENGTH / scaleFactor);

    const prompt = `Shorten the following to between ${minLength} and ${maxLength} characters in length and return only the summary, ending with a period:

${text}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.ACHIEVEMENT,
      provider: 'claude'
    });
  }

  /**
   * Categorize achievement by function
   * @param {string} achievement - Achievement to categorize
   * @param {Array<string>} functions - List of functions
   * @returns {string} Category
   */
  categorizeAchievement(achievement, functions) {
    const prompt = `Given the following resume bullet-point achievement, which of the following functions provided best describes what the achievement is about?

Return only one. If a word in the achievement matches a function, return that function.

ACHIEVEMENT: ${achievement}

FUNCTIONS: ${functions.join(", ")}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.ARCHETYPE,
      provider: 'claude'
    });
  }

  /**
   * Generate unique ID for achievement
   * @param {string} text - Text to hash
   * @returns {string} Unique ID
   */
  generateUniqueId(text) {
    return TextUtils.generateHash(text, 6);
  }
}
//#endregion AchievementService

//#region EvaluationService
/**
 * Service for evaluating achievements
 */
class EvaluationService {
  /**
   * Create an EvaluationService
   * @param {AIService} aiService - AI service instance
   */
  constructor(aiService) {
    this.aiService = aiService;
  }

  /**
   * Evaluate if achievement meets quality criteria
   * @param {string} achievement - Achievement to evaluate
   * @returns {string} Evaluation result (TRUE/FALSE)
   */
  evaluateAchievement(achievement) {
    const prompt = `${CONFIG.PROMPTS.IS_IMPACTFUL}

Achievement: ${achievement}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION,
      provider: 'claude'
    });
  }

  /**
   * Check if achievement is impactful
   * @param {string} achievement - Achievement to check
   * @returns {boolean} True if impactful
   */
  isImpactful(achievement) {
    const result = this.evaluateAchievement(achievement);
    return result.toUpperCase().includes('TRUE');
  }

  /**
   * Get judgement score for achievement
   * @param {string} achievement - Achievement to judge
   * @returns {string} Judgement score
   */
  getJudgement(achievement) {
    const prompt = `On a scale of 1 to 10, where 1 means 'Boring.' and 10 means 'Amazing!' - how impressed are you by the following achievement?

Only return the numeric digit value.

Achievement: ${achievement}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION,
      provider: 'openai'
    });
  }

  /**
   * Check if achievement is relevant to job description
   * @param {string} achievement - Achievement to check
   * @param {string} jobDescription - Job description
   * @returns {string} Relevance score
   */
  isRelevant(achievement, jobDescription) {
    const prompt = `Given the following job description:

${jobDescription}

Score the achievement:

'${achievement}'

... against the responsibilities defined in the job according to a 5-point Likert Scale of 'Not at all applicable' to 'Extremely applicable.'

Return only the score. If not applicable, return 'Not at all applicable')

${CONFIG.PROMPTS.MARKS}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION,
      provider: 'openai'
    });
  }

  /**
   * Check if sequence meets threshold criteria
   * @param {number|string} sequence - Sequence number
   * @returns {boolean} True if meets criteria
   */
  meetsSequenceCriteria(sequence) {
    return sequence && Number(sequence) <= CONFIG.THRESHOLDS.SEQUENCE_THRESHOLD;
  }

  /**
   * Determine if achievement should be included
   * @param {number} wowFactor - Wow factor score
   * @param {number|string} sequence - Sequence number
   * @param {boolean} meetsAdditionalCriteria - Additional criteria flag
   * @returns {boolean} True if should include
   */
  shouldInclude(wowFactor, sequence, meetsAdditionalCriteria = true) {
    return this.meetsSequenceCriteria(sequence) &&
      (wowFactor === 10 ||
        (wowFactor >= CONFIG.THRESHOLDS.WOW_THRESHOLD && meetsAdditionalCriteria));
  }
}
//#endregion EvaluationService

//#region CustomizationService
/**
 * Service for customizing resumes
 */
class CustomizationService {
  /**
   * Create a CustomizationService
   * @param {AIService} aiService - AI service instance
   * @param {SheetService} sheetService - Sheet service instance
   */
  constructor(aiService, sheetService) {
    this.aiService = aiService;
    this.sheetService = sheetService;
  }

  /**
   * Customize resume for job description
   * @returns {string} Customized resume in Markdown
   */
  customizeResume() {
    const resume = this._getResume();
    const jobDescription = this._getJobDescription();
    const basis = this._getCustomizationBasis();

    const prompt = `${basis}

JOB DESCRIPTION: ${jobDescription}

RESUME: ${resume}`;

    return this.aiService.query(prompt, {
      maxTokens: CONFIG.AI.MAX_TOKENS.RESUME,
      provider: 'claude'
    });
  }

  /**
   * Get resume text from sheet
   * @returns {string} Resume text
   * @private
   */
  _getResume() {
    const data = this.sheetService.getSheetData(CONFIG.SHEETS.CUSTOMIZER);
    return data[1][CONFIG.COLUMNS.CUSTOMIZER.RESUME];
  }

  /**
   * Get job description from sheet
   * @returns {string} Job description
   * @private
   */
  _getJobDescription() {
    const data = this.sheetService.getSheetData(CONFIG.SHEETS.CUSTOMIZER);
    return data[1][CONFIG.COLUMNS.CUSTOMIZER.JOB_DESCRIPTION];
  }

  /**
   * Build customization basis prompt
   * @returns {string} Customization instructions
   * @private
   */
  _getCustomizationBasis() {
    const bullets = "Each bullet point should be no more than 86 characters and begin with an asterisk.";
    const roles = "Include only the most recent three roles.";
    const format = "Return output as Markdown in the format of a reverse chronological resume.";

    return `Take the following RESUME and modify it to fit the needs of the following JOB DESCRIPTION.

Include 4-5 bullet points for the most recent job, 3-4 for the next job, and 2-3 for each job after that. ${bullets}

${roles} Always include dates for roles on the same line as title and company name.

Stipulate "Complete work history available upon request." in italics.

Include a "SKILLS" section with a bulleted overview of relevant skills.

For each role, include a summary overview of no more than two sentences.

Do not include a cover letter.

If an achievement in RESUME includes the name of the company for the JOB DESCRIPTION, be sure to include that explicit reference in the adapted version.

Include and begin with a professional summary.
${format}`;
  }

  /**
   * Get summary for resume
   * @returns {string} Summary text
   */
  getSummaryForResume() {
    // Default summary - could be enhanced to be dynamic
    const asENGLeader = [
      "Hands-on technical leader who's scaled SaaS and data-driven products as well as global teams of up to 50 over 13+ years.",
      "Solid track record of ownership with a bias-to-action, especially around unblocking teams in support of execution.",
      "Proven ability to harness AI/ML to sharpen operations and accelerate time-to-market.",
      "Skilled at driving operational excellence, streamlining cross-functional communication, and consistently delivering high-impact products.",
      "Known for a servant-leadership that fosters mentorship, innovation, and cross-functional collaboration."
    ];

    return asENGLeader.join(" ");
  }
}
//#endregion CustomizationService

//#region ResumeFormatter
/**
 * Service for formatting resumes as Google Docs
 */
class ResumeFormatter {
  /**
   * Create a ResumeFormatter
   * @param {DocumentService} documentService - Document service
   * @param {SheetService} sheetService - Sheet service
   */
  constructor(documentService, sheetService) {
    this.documentService = documentService;
    this.sheetService = sheetService;
  }

  /**
   * Generate a formatted resume document
   * @returns {string} URL of generated document
   */
  generateResume() {
    const companyData = this.sheetService.getCompanyData();
    const { headers, rows } = this.sheetService.getStoryBankData();

    // Create document from template
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    const documentName = `Resume for ${CONFIG.CONTACT.NAME} - ${timestamp}`;
    const doc = this.documentService.copyTemplate(CONFIG.DOCUMENT.RESUME_TEMPLATE_ID, documentName);
    const body = doc.getBody();

    // Build resume sections
    this._addHeader(body);
    this._addSummary(body);
    this._addKeyAccomplishments(body);
    this._addStrengths(body);
    this._addExperience(body, headers, rows, companyData);
    this._addEducation(body);

    doc.saveAndClose();
    return doc.getUrl();
  }

  /**
   * Add header section
   * @param {Body} body - Document body
   * @private
   */
  _addHeader(body) {
    const firstParagraph = body.getChild(0).asParagraph();
    firstParagraph.setText(CONFIG.CONTACT.NAME)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setAttributes({
        [DocumentApp.Attribute.SPACING_BEFORE]: 0,
        [DocumentApp.Attribute.SPACING_AFTER]: 4
      });

    const contactInfo = `${CONFIG.CONTACT.LOCATION} | ${CONFIG.CONTACT.PHONE} | ${CONFIG.CONTACT.EMAIL} | ${CONFIG.CONTACT.LINKEDIN}`;
    this.documentService.appendParagraph(body, contactInfo, {
      fontSize: 10,
      alignment: 'CENTER'
    });

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add summary section
   * @param {Body} body - Document body
   * @private
   */
  _addSummary(body) {
    this.documentService.appendHeading(body, 'SUMMARY', 4);

    const customizationService = new CustomizationService(null, this.sheetService);
    const summary = customizationService.getSummaryForResume();

    this.documentService.appendParagraph(body, summary, {
      alignment: 'LEFT',
      spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING,
      spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING
    });

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add key accomplishments section
   * @param {Body} body - Document body
   * @private
   */
  _addKeyAccomplishments(body) {
    this.documentService.appendHeading(body, 'KEY ACCOMPLISHMENTS', 4);

    const table = this.documentService.appendTable(body, [
      [
        `${CONFIG.KEY_ACCOMPLISHMENTS[0]}\n${CONFIG.KEY_ACCOMPLISHMENTS[1]}`,
        `${CONFIG.KEY_ACCOMPLISHMENTS[2]}\n${CONFIG.KEY_ACCOMPLISHMENTS[3]}`
      ]
    ], { borderWidth: 0 });

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add strengths section
   * @param {Body} body - Document body
   * @private
   */
  _addStrengths(body) {
    this.documentService.appendHeading(body, 'STRENGTHS', 4);

    CONFIG.STRENGTHS.forEach(strength => {
      if (strength) {
        const listItem = this.documentService.appendListItem(body, strength);
        const colonIndex = strength.indexOf(':');
        if (colonIndex > -1) {
          listItem.editAsText().setBold(0, colonIndex - 1, true);
        }
      }
    });

    this.documentService.appendHorizontalRule(body);
  }

  /**
   * Add experience section
   * @param {Body} body - Document body
   * @param {Array<string>} headers - Column headers
   * @param {Array<Array>} rows - Data rows
   * @param {Object} companyData - Company metadata
   * @private
   */
  _addExperience(body, headers, rows, companyData) {
    this.documentService.appendHeading(body, 'EXPERIENCE', 4);

    const companyIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.COMPANY);
    const seqIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.SEQUENCE);
    const includeIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.INCLUDE);
    const wowIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.WOW);
    const achievementIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.SHORT);

    // Filter and group achievements by company
    const companyMap = {};
    rows.forEach(row => {
      const toBeIncluded = row[includeIndex];
      if (toBeIncluded) {
        const company = row[companyIndex];
        const achievement = row[achievementIndex];
        if (!companyMap[company]) {
          companyMap[company] = [];
        }
        companyMap[company].push(achievement);
      }
    });

    // Add each company section
    for (const company in companyMap) {
      if (companyMap.hasOwnProperty(company)) {
        this._addCompanySection(body, company, companyMap[company], companyData[company]);
      }
    }

    this.documentService.appendParagraph(body, "Complete work history available upon request", {
      fontSize: CONFIG.DOCUMENT.DEFAULT_FONT_SIZE - 1,
      italic: true,
      alignment: 'CENTER',
      spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING * 2,
      spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING * 2
    });
  }

  /**
   * Add company section
   * @param {Body} body - Document body
   * @param {string} company - Company name
   * @param {Array<string>} achievements - Achievements list
   * @param {Object} metadata - Company metadata
   * @private
   */
  _addCompanySection(body, company, achievements, metadata) {
    const role = metadata.title;
    const duration = metadata.duration;
    const combo = `${role} @ ${company}`;

    const table = this.documentService.appendTable(body, [[combo, duration]], { borderWidth: 0 });
    const row = table.getRow(0);

    const companyCell = row.getCell(0);
    companyCell.setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0)
      .setPaddingTop(CONFIG.DOCUMENT.DEFAULT_PADDING * 2);
    companyCell.getChild(0).asParagraph()
      .setAlignment(DocumentApp.HorizontalAlignment.LEFT)
      .setBold(true)
      .setFontSize(12);

    const datesCell = row.getCell(1);
    datesCell.setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0)
      .setPaddingTop(CONFIG.DOCUMENT.DEFAULT_PADDING * 2);
    datesCell.getChild(0).asParagraph()
      .setAlignment(DocumentApp.HorizontalAlignment.RIGHT)
      .setBold(false)
      .setFontSize(11);

    // Add domain and summary if available
    if (metadata.domain || metadata.summary) {
      const lastIndex = body.getNumChildren() - 1;
      const lastChild = body.getChild(lastIndex);
      if (lastChild.getType() === DocumentApp.ElementType.PARAGRAPH) {
        const paragraph = lastChild.asParagraph();
        if (paragraph.getText().trim() === "" && metadata.summary) {
          paragraph.setText(metadata.domain || "");
          paragraph.setAttributes({
            [DocumentApp.Attribute.SPACING_BEFORE]: CONFIG.DOCUMENT.DEFAULT_PADDING,
            [DocumentApp.Attribute.SPACING_AFTER]: CONFIG.DOCUMENT.DEFAULT_PADDING
          }).setItalic(true).setFontSize(CONFIG.DOCUMENT.DEFAULT_FONT_SIZE);

          this.documentService.appendParagraph(body, metadata.summary, {
            italic: false,
            spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING,
            spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING
          });
        }
      }
    }

    // Add achievements
    achievements.forEach(achievement => {
      if (achievement) {
        this.documentService.appendListItem(body, achievement);
      }
    });

    // Add tech stack if configured
    if (CONFIG.DOCUMENT.INCLUDE_TECH_STACK && metadata.stack) {
      this.documentService.appendParagraph(body, metadata.stack, {
        fontSize: CONFIG.DOCUMENT.DEFAULT_FONT_SIZE - 1,
        spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING * 2,
        spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING
      });
    }
  }

  /**
   * Add education section
   * @param {Body} body - Document body
   * @private
   */
  _addEducation(body) {
    this.documentService.appendHeading(body, 'EDUCATION', 4);

    CONFIG.EDUCATION.forEach(edu => {
      this.documentService.appendParagraph(body, edu.degree, {
        bold: true,
        fontSize: 12,
        alignment: 'LEFT',
        spacingBefore: CONFIG.DOCUMENT.DEFAULT_PADDING,
        spacingAfter: CONFIG.DOCUMENT.DEFAULT_PADDING
      });

      edu.details.forEach(detail => {
        this.documentService.appendListItem(body, detail);
      });
    });
  }
}
//#endregion ResumeFormatter

//#region WorkHistoryExporter
/**
 * Service for exporting work history to Google Docs
 */
class WorkHistoryExporter {
  /**
   * Create a WorkHistoryExporter
   * @param {DocumentService} documentService - Document service
   * @param {SheetService} sheetService - Sheet service
   * @param {EvaluationService} evaluationService - Evaluation service
   */
  constructor(documentService, sheetService, evaluationService) {
    this.documentService = documentService;
    this.sheetService = sheetService;
    this.evaluationService = evaluationService;
  }

  /**
   * Export work history as Google Doc
   * @returns {string} URL of created document
   */
  exportWorkHistory() {
    const title = `Work History as G Doc : ${Date.now()}`;
    const doc = this.documentService.createDocument(title);
    const body = doc.getBody();

    const { headers, rows } = this.sheetService.getStoryBankData();
    const groupedData = this._groupByCompany(headers, rows);

    let countOfWritten = 0;

    groupedData.forEach((companyData, index) => {
      if (index === 0) {
        const divider = body.appendParagraph(`@ ${companyData.company.toUpperCase()}`);
        divider.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      } else {
        const divider = body.appendParagraph(`@ ${companyData.company.toUpperCase()}`);
        divider.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      }

      companyData.items.forEach(item => {
        countOfWritten++;

        this.documentService.appendHeading(body, item.short, 2);
        this.documentService.appendHeading(body, `Timeframe: ${item.timeFrame}`, 3);
        this.documentService.appendHeading(body, 'CHALLENGE', 3);
        this.documentService.appendParagraph(body, item.challenge);
        this.documentService.appendHeading(body, 'ACTIONS', 3);
        this.documentService.appendParagraph(body, item.actions);
        this.documentService.appendHeading(body, 'RESULT', 3);
        this.documentService.appendParagraph(body, item.result);
        this.documentService.appendHeading(body, `ID : ${item.uniqueID}`, 3);

        body.appendPageBreak();
      });
    });

    doc.saveAndClose();
    Logger.log(`Written ${countOfWritten} items`);
    Logger.log(doc.getUrl());
    return doc.getUrl();
  }

  /**
   * Group data by company
   * @param {Array<string>} headers - Column headers
   * @param {Array<Array>} rows - Data rows
   * @returns {Array<Object>} Grouped data
   * @private
   */
  _groupByCompany(headers, rows) {
    const companyIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.COMPANY);
    const sequenceIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.SEQUENCE);
    const wowIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.WOW);
    const domainIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.DOMAIN);
    const challengeIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CHALLENGE);
    const actionsIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACTIONS);
    const resultIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.RESULT);
    const shortIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.LONG);
    const idIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ID);
    const timingIndex = headers.indexOf(CONFIG.COLUMNS.STORY_BANK.TIMING);

    const companyMap = new Map();

    rows.forEach(row => {
      const sequence = row[sequenceIndex];
      const wow = row[wowIndex];
      const domain = row[domainIndex];
      const isProgramManagement = domain === 'Program Management';

      if (this.evaluationService.shouldInclude(wow, sequence, isProgramManagement)) {
        const company = row[companyIndex].toString();

        if (!companyMap.has(company)) {
          companyMap.set(company, []);
        }

        companyMap.get(company).push({
          challenge: row[challengeIndex].toString(),
          actions: row[actionsIndex].toString(),
          result: row[resultIndex].toString(),
          short: row[shortIndex].toString(),
          uniqueID: row[idIndex].toString(),
          timeFrame: row[timingIndex].toString()
        });
      }
    });

    // Convert to array format
    const result = [];
    let previousCompany = null;

    companyMap.forEach((items, company) => {
      result.push({
        company,
        items,
        isNewCompany: company !== previousCompany
      });
      previousCompany = company;
    });

    return result;
  }
}
//#endregion WorkHistoryExporter
// #endregion Business Logic Layer

// ====================
// 7. UI LAYER
// ====================
// #region UI Layer

//#region MenuService

/**
 * Service for managing menu items
 */
class MenuService {
  /**
   * Create custom menu in spreadsheet
   * @param {Ui} ui - Spreadsheet UI object
   */
  static createCustomMenu(ui) {
    ui.createMenu('Utils')
      .addItem('Generate summary', 'fetch')
      .addItem('Choose Model', 'chooseModel')
      .addItem('Compare Models', 'compareModels')
      .addSeparator()
      .addItem('Shorten', 'shorten')
      .addItem('Evaluate achievement', 'eval')
      .addItem('Categorize', 'findTheme')
      .addItem('Get judgement', 'getJudgement')
      .addItem('Get KPI', 'getKeyPerformanceIndicator')
      .addItem('Get Work History as G Doc', 'getWorkHistoryAsGDoc')
      .addItem('Generate resume', 'showModal')
      .addItem('Sort', 'sortSheet')
      .addItem('Create ID', 'createID')
      .addItem('Customize', 'createCustomization')
      .addToUi();
  }
}
//#endregion MenuService

//#region DialogService
/**
 * Service for managing dialogs and alerts
 */
class DialogService {
  /**
   * Show modal dialog
   * @param {string} templateName - HTML template file name
   * @param {string} title - Dialog title
   * @param {number} width - Dialog width (optional)
   * @param {number} height - Dialog height (optional)
   */
  static showModal(templateName, title, width = null, height = null) {
    let html = HtmlService.createTemplateFromFile(templateName).evaluate();

    if (width) html = html.setWidth(width);
    if (height) html = html.setHeight(height);

    SpreadsheetApp.getUi().showModalDialog(html, title);
  }

  /**
   * Show alert dialog
   * @param {string} message - Alert message
   * @param {string} title - Alert title (optional)
   */
  static showAlert(message, title = 'Alert') {
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
  }

  /**
   * Show prompt dialog
   * @param {string} message - Prompt message
   * @param {string} title - Prompt title
   * @returns {string} User input
   */
  static showPrompt(message, title = 'Input') {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() === ui.Button.OK) {
      return response.getResponseText();
    }
    return null;
  }

  /**
   * Show link in modal dialog
   * @param {string} url - URL to display
   * @param {string} title - Dialog title
   */
  static showLink(url, title = 'Document Created') {
    const htmlContent = `<p><a href="${url}" target="_blank">${url}</a></p>`;
    const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(300)
      .setHeight(100);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, title);
  }
}
//#endregion DialogService
// #endregion UI Layer

// ====================
// 8. ENTRY POINTS
// ====================
// #region Entry Points

/**
 * Global services object - initialized on first use
 */
let SERVICES = null;

/**
 * Initialize all services
 * @returns {Object} Services object
 */
function initializeServices() {
  if (SERVICES) return SERVICES;

  const sheetService = new SheetService();
  const configService = new ConfigService(sheetService);
  const aiService = new AIService(configService);
  const documentService = new DocumentService();
  const achievementService = new AchievementService(aiService);
  const evaluationService = new EvaluationService(aiService);
  const customizationService = new CustomizationService(aiService, sheetService);
  const resumeFormatter = new ResumeFormatter(documentService, sheetService);
  const workHistoryExporter = new WorkHistoryExporter(documentService, sheetService, evaluationService);

  SERVICES = {
    sheet: sheetService,
    config: configService,
    ai: aiService,
    document: documentService,
    achievement: achievementService,
    evaluation: evaluationService,
    customization: customizationService,
    resumeFormatter: resumeFormatter,
    workHistoryExporter: workHistoryExporter
  };

  return SERVICES;
}

/**
 * Triggered when spreadsheet is opened
 * @param {Object} e - Event object
 */
function onOpen(e) {
  try {
    const ui = SpreadsheetApp.getUi();
    MenuService.createCustomMenu(ui);
  } catch (error) {
    Logger.error('Error in onOpen', error);
  }
}

/**
 * Generate achievement from current row
 * Menu item: "Generate summary"
 */
function fetch() {
  try {
    const services = initializeServices();
    const sheet = services.sheet.getSheet(CONFIG.SHEETS.STORY_BANK);
    const { rowIndex, row, headers } = services.sheet.getActiveRowData(CONFIG.SHEETS.STORY_BANK);

    // Get the active cell to determine target audience from column header
    const currentCell = services.sheet.getActiveCell();
    const columnIndex = currentCell.getColumn();
    const columnHeader = headers[columnIndex - 1]; // Convert 1-indexed to 0-indexed

    // Determine target audience based on column header
    let targetAudience = 'cv'; // default
    if (columnHeader) {
      const headerLower = columnHeader.toLowerCase();
      if (headerLower.includes('linkedin')) {
        targetAudience = 'linkedin';
      } else if (headerLower.includes('cv')) {
        targetAudience = 'cv';
      }
    }

    Logger.log(`Column header: "${columnHeader}" -> Target audience: ${targetAudience}`);

    const challenge = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CHALLENGE)];
    const actions = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACTIONS)];
    const result = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.RESULT)];
    const client = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CLIENT)];

    const summary = services.achievement.generateAchievement(
      challenge,
      actions,
      result,
      client,
      targetAudience
    );

    currentCell.setValue(summary);
  } catch (error) {
    Logger.error('Error in fetch', error);
    DialogService.showAlert(`Error generating achievement: ${error.message}`);
  }
}

/**
 * Shorten achievement in current cell
 * Menu item: "Shorten"
 */
function shorten() {
  try {
    const services = initializeServices();
    const { rowIndex, row, headers } = services.sheet.getActiveRowData(CONFIG.SHEETS.STORY_BANK);

    const achievement = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACHIEVEMENT)];
    const shortened = services.achievement.shortenAchievement(achievement);

    const currentCell = services.sheet.getActiveCell();
    currentCell.setValue(shortened);
  } catch (error) {
    Logger.error('Error in shorten', error);
    DialogService.showAlert(`Error shortening achievement: ${error.message}`);
  }
}

/**
 * Evaluate achievement in current row
 * Menu item: "Evaluate achievement"
 */
function eval() {
  try {
    const services = initializeServices();
    const sheet = services.sheet.getSheet('Work History');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const currentCell = sheet.getActiveCell();
    const rowIndex = currentCell.getRow();
    const row = sheet.getRange(`${rowIndex}:${rowIndex}`).getValues()[0];

    const achievement = row[headers.indexOf('Resume Bullet Point')];

    const prompt = `Does the following describe something accomplished by more of a "Doer" or "Achiever"?

${achievement}

Return either "Doer" or "Achiever" as output.`;

    const summary = services.ai.query(prompt, { maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION });
    currentCell.setValue(summary);
  } catch (error) {
    Logger.error('Error in eval', error);
    DialogService.showAlert(`Error evaluating achievement: ${error.message}`);
  }
}

/**
 * Find theme/category for achievement
 * Menu item: "Categorize"
 */
function findTheme() {
  try {
    const services = initializeServices();
    const sheet = services.sheet.getSheet(CONFIG.SHEETS.STORY_BANK);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const currentCell = sheet.getActiveCell();
    const rowIndex = currentCell.getRow();
    const row = sheet.getRange(`${rowIndex}:${rowIndex}`).getValues()[0];

    const achievement = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACHIEVEMENT)];

    // Get functions from sheet
    const functionsSheet = services.sheet.getSheet(CONFIG.SHEETS.FUNCTION);
    const functionsData = functionsSheet.getRange("F2:F").getValues().flat().filter(r => r !== "");

    const category = services.achievement.categorizeAchievement(achievement, functionsData);
    currentCell.setValue(category);
  } catch (error) {
    Logger.error('Error in findTheme', error);
    DialogService.showAlert(`Error finding theme: ${error.message}`);
  }
}

/**
 * Get judgement score for achievement
 * Menu item: "Get judgement"
 */
function getJudgement() {
  try {
    const services = initializeServices();
    const sheet = services.sheet.getSheet('Work History');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const currentCell = sheet.getActiveCell();
    const rowIndex = currentCell.getRow();
    const row = sheet.getRange(`${rowIndex}:${rowIndex}`).getValues()[0];

    const achievement = row[headers.indexOf('Resume Bullet Point')];
    const score = services.evaluation.getJudgement(achievement);

    currentCell.setValue(score);
  } catch (error) {
    Logger.error('Error in getJudgement', error);
    DialogService.showAlert(`Error getting judgement: ${error.message}`);
  }
}

/**
 * Get KPI for achievement
 * Menu item: "Get KPI"
 */
function getKeyPerformanceIndicator() {
  try {
    const services = initializeServices();
    const sheet = services.sheet.getSheet('Work History');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const currentCell = sheet.getActiveCell();
    const rowIndex = currentCell.getRow();
    const row = sheet.getRange(`${rowIndex}:${rowIndex}`).getValues()[0];

    const achievement = row[headers.indexOf('Resume Bullet Point')];

    // Get KPIs
    const kpiSheet = services.sheet.getSheet('Metrics : KPIs (business & function)');
    const lastRow = kpiSheet.getLastRow();
    const kpis = kpiSheet.getRange(2, 1, lastRow, 1)
      .getValues()
      .flat()
      .filter(String)
      .join('\n');

    const prompt = `Given the following achievement, under what single standard key performance indicator (KPI) from the following KPIs would it most likely belong?

ACHIEVEMENT: ${achievement}

KPIs: ${kpis}

Return only the KPI.`;

    const kpi = services.ai.query(prompt, { maxTokens: CONFIG.AI.MAX_TOKENS.CATEGORIZATION });
    currentCell.setValue(kpi);
  } catch (error) {
    Logger.error('Error in getKeyPerformanceIndicator', error);
    DialogService.showAlert(`Error getting KPI: ${error.message}`);
  }
}

/**
 * Export work history as Google Doc
 * Menu item: "Get Work History as G Doc"
 */
function getWorkHistoryAsGDoc() {
  try {
    const services = initializeServices();
    const url = services.workHistoryExporter.exportWorkHistory();
    DialogService.showLink(url, 'Work History Exported');
  } catch (error) {
    Logger.error('Error in getWorkHistoryAsGDoc', error);
    DialogService.showAlert(`Error exporting work history: ${error.message}`);
  }
}

/**
 * Show modal for resume generation
 * Menu item: "Generate resume"
 */
function showModal() {
  try {
    DialogService.showModal('dialog', 'Sample Modal');
  } catch (error) {
    Logger.error('Error in showModal', error);
    DialogService.showAlert(`Error showing modal: ${error.message}`);
  }
}

/**
 * Sort the active sheet
 * Menu item: "Sort"
 */
function sortSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headerRowRange = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
    const headers = headerRowRange[0];

    const seqColIndex = headers.indexOf('Seq') + 1;
    const clientColIndex = headers.indexOf('Client') + 1;
    const wowColIndex = headers.indexOf('Wow') + 1;

    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());

    dataRange.sort([
      { column: seqColIndex, ascending: true },
      { column: clientColIndex, ascending: true },
      { column: wowColIndex, ascending: false }
    ]);
  } catch (error) {
    Logger.error('Error in sortSheet', error);
    DialogService.showAlert(`Error sorting sheet: ${error.message}`);
  }
}

/**
 * Create unique ID for achievement
 * Menu item: "Create ID"
 */
function createID() {
  try {
    const services = initializeServices();
    const { rowIndex, row, headers } = services.sheet.getActiveRowData(CONFIG.SHEETS.STORY_BANK);

    const achievement = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACHIEVEMENT)];
    const uniqueID = services.achievement.generateUniqueId(achievement);

    const currentCell = services.sheet.getActiveCell();
    currentCell.setValue(uniqueID);
  } catch (error) {
    Logger.error('Error in createID', error);
    DialogService.showAlert(`Error creating ID: ${error.message}`);
  }
}

/**
 * Create customization for job
 * Menu item: "Customize"
 */
function createCustomization() {
  try {
    const services = initializeServices();
    const customized = services.customization.customizeResume();

    const sheet = services.sheet.getSheet(CONFIG.SHEETS.CUSTOMIZER);
    const currentCell = sheet.getActiveCell();
    currentCell.setValue(customized);
  } catch (error) {
    Logger.error('Error in createCustomization', error);
    DialogService.showAlert(`Error creating customization: ${error.message}`);
  }
}

/**
 * Show model selection dialog for single generation
 * Menu item: "Choose Model"
 */
function chooseModel() {
  try {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 400px;
      margin: 0 auto;
    }
    h3 {
      margin-top: 0;
      color: #1a73e8;
    }
    select {
      width: 100%;
      padding: 8px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    button {
      width: 100%;
      padding: 10px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover {
      background-color: #1557b0;
    }
    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    .description {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .status {
      margin-top: 15px;
      padding: 10px;
      border-radius: 4px;
      display: none;
    }
    .status.success {
      background-color: #d4edda;
      color: #155724;
      display: block;
    }
    .status.error {
      background-color: #f8d7da;
      color: #721c24;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h3>Choose AI Model</h3>
    <p class="description">Select a model to generate achievement from the current row:</p>

    <select id="modelSelect">
      <option value="" selected disabled>Select a model...</option>
      <option value="claude">Claude 3.7 Sonnet (Recommended)</option>
      <option value="gemini">Gemini 1.5 Flash (Fast)</option>
      <option value="openai">OpenAI GPT-4o Mini (Concise)</option>
    </select>

    <button id="generateBtn" onclick="generateWithModel()">Generate Achievement</button>

    <div id="status" class="status"></div>
  </div>

  <script>
    function generateWithModel() {
      const modelSelect = document.getElementById('modelSelect');
      const selectedModel = modelSelect.value;
      const button = document.getElementById('generateBtn');
      const status = document.getElementById('status');

      if (!selectedModel) {
        showStatus('Please select a model first', 'error');
        return;
      }

      button.disabled = true;
      button.textContent = 'Generating...';
      status.style.display = 'none';

      google.script.run
        .withSuccessHandler(function(result) {
          showStatus('Achievement generated successfully!', 'success');
          button.disabled = false;
          button.textContent = 'Generate Achievement';
          setTimeout(function() {
            google.script.host.close();
          }, 1500);
        })
        .withFailureHandler(function(error) {
          showStatus('Error: ' + error.message, 'error');
          button.disabled = false;
          button.textContent = 'Generate Achievement';
        })
        .fetchWithModel(selectedModel);
    }

    function showStatus(message, type) {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = 'status ' + type;
    }
  </script>
</body>
</html>
`;

    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(450)
      .setHeight(250);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Choose Model');
  } catch (error) {
    Logger.error('Error in chooseModel', error);
    DialogService.showAlert(`Error showing model selector: ${error.message}`);
  }
}

/**
 * Show side-by-side model comparison dialog
 * Menu item: "Compare Models"
 */
function compareModels() {
  try {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h3 {
      margin-top: 0;
      color: #1a73e8;
      text-align: center;
    }
    .description {
      text-align: center;
      color: #666;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .controls {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }
    button {
      padding: 14px 40px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover {
      background-color: #1557b0;
    }
    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    .results {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .result-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      min-height: 250px;
      display: flex;
      flex-direction: column;
    }
    .result-card h4 {
      margin: 0 0 10px 0;
      color: #1a73e8;
      border-bottom: 2px solid #1a73e8;
      padding-bottom: 8px;
      font-size: 15px;
    }
    .model-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 15px;
    }
    .result-content {
      flex: 1;
      line-height: 1.6;
      color: #333;
      font-size: 14px;
      overflow-wrap: break-word;
    }
    .loading {
      text-align: center;
      color: #999;
      font-style: italic;
      padding: 40px 0;
    }
    .char-count {
      font-size: 12px;
      color: #666;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #eee;
      font-weight: 600;
    }
    .winner {
      background: #d4edda;
      border: 2px solid #28a745;
    }
    .winner h4 {
      color: #28a745;
      border-bottom-color: #28a745;
    }
    .winner-badge {
      display: inline-block;
      background: #28a745;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      margin-left: 8px;
      font-weight: normal;
    }
    .status {
      margin-top: 15px;
      padding: 10px;
      border-radius: 4px;
      display: none;
      text-align: center;
    }
    .status.error {
      background-color: #f8d7da;
      color: #721c24;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h3>🔍 Compare All AI Models</h3>
    <p class="description">Generate achievements from all models in parallel and compare results</p>

    <div class="controls">
      <button id="compareBtn" onclick="runComparison()">🚀 Generate All Models</button>
      <div id="status" class="status"></div>
    </div>

    <div class="results" id="results" style="display: none;">
      <div class="result-card" id="resultClaude">
        <h4>Claude 3.7 Sonnet</h4>
        <div class="model-label">Anthropic's most capable model</div>
        <div class="result-content" id="contentClaude">
          <div class="loading">Generating...</div>
        </div>
        <div class="char-count" id="countClaude"></div>
      </div>

      <div class="result-card" id="resultGemini">
        <h4>Gemini 1.5 Flash</h4>
        <div class="model-label">Google's fast multimodal model</div>
        <div class="result-content" id="contentGemini">
          <div class="loading">Generating...</div>
        </div>
        <div class="char-count" id="countGemini"></div>
      </div>

      <div class="result-card" id="resultOpenAI">
        <h4>OpenAI GPT-4o Mini</h4>
        <div class="model-label">OpenAI's efficient model</div>
        <div class="result-content" id="contentOpenAI">
          <div class="loading">Generating...</div>
        </div>
        <div class="char-count" id="countOpenAI"></div>
      </div>
    </div>
  </div>

  <script>
    const MODELS = [
      { key: 'claude', name: 'Claude 3.7 Sonnet', contentId: 'contentClaude', countId: 'countClaude', cardId: 'resultClaude' },
      { key: 'gemini', name: 'Gemini 1.5 Flash', contentId: 'contentGemini', countId: 'countGemini', cardId: 'resultGemini' },
      { key: 'openai', name: 'OpenAI GPT-4o Mini', contentId: 'contentOpenAI', countId: 'countOpenAI', cardId: 'resultOpenAI' }
    ];

    function runComparison() {
      const button = document.getElementById('compareBtn');
      const status = document.getElementById('status');
      const results = document.getElementById('results');

      button.disabled = true;
      button.textContent = '⏳ Generating all models...';
      status.style.display = 'none';
      results.style.display = 'grid';

      // Reset all results
      MODELS.forEach(model => {
        document.getElementById(model.contentId).innerHTML = '<div class="loading">Generating...</div>';
        document.getElementById(model.countId).textContent = '';
        document.getElementById(model.cardId).classList.remove('winner');

        // Remove any existing winner badges
        const header = document.getElementById(model.cardId).querySelector('h4');
        const badge = header.querySelector('.winner-badge');
        if (badge) badge.remove();
      });

      // Store results as they come in
      const modelResults = {};
      let completed = 0;

      // Generate all models in parallel
      MODELS.forEach(model => {
        google.script.run
          .withSuccessHandler(function(result) {
            modelResults[model.key] = result;
            displayResult(model.contentId, model.countId, result);
            completed++;

            if (completed === MODELS.length) {
              finishComparison(modelResults);
              button.disabled = false;
              button.textContent = '🚀 Generate All Models';
            } else {
              button.textContent = \`⏳ Generating... (\${completed}/\${MODELS.length})\`;
            }
          })
          .withFailureHandler(function(error) {
            document.getElementById(model.contentId).innerHTML = '<div style="color: red;">Error: ' + error.message + '</div>';
            completed++;

            if (completed === MODELS.length) {
              button.disabled = false;
              button.textContent = '🚀 Generate All Models';
            }
          })
          .generateAchievementWithModel(model.key);
      });
    }

    function displayResult(contentId, countId, text) {
      document.getElementById(contentId).textContent = text;
      document.getElementById(countId).textContent = 'Characters: ' + text.length;
    }

    function finishComparison(results) {
      // Find the shortest valid result (>= 40 chars)
      let shortest = null;
      let shortestLength = Infinity;
      let shortestKey = null;

      Object.keys(results).forEach(key => {
        const length = results[key].length;
        if (length >= 40 && length < shortestLength) {
          shortest = results[key];
          shortestLength = length;
          shortestKey = key;
        }
      });

      // Highlight the winner
      if (shortestKey) {
        const winnerModel = MODELS.find(m => m.key === shortestKey);
        if (winnerModel) {
          const card = document.getElementById(winnerModel.cardId);
          card.classList.add('winner');

          const header = card.querySelector('h4');
          header.innerHTML += '<span class="winner-badge">Most Concise</span>';
        }
      }
    }

    function showStatus(message, type) {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = 'status ' + type;
    }
  </script>
</body>
</html>
`;

    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(1250)
      .setHeight(650);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Compare All AI Models');
  } catch (error) {
    Logger.error('Error in compareModels', error);
    DialogService.showAlert(`Error showing comparison: ${error.message}`);
  }
}

/**
 * Generate achievement using specific model
 * @param {string} modelName - Name of model ('claude', 'gemini', 'openai')
 */
function fetchWithModel(modelName) {
  try {
    const services = initializeServices();
    const { rowIndex, row, headers } = services.sheet.getActiveRowData(CONFIG.SHEETS.STORY_BANK);

    const challenge = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CHALLENGE)];
    const actions = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACTIONS)];
    const result = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.RESULT)];
    const client = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CLIENT)];

    const prompt = services.achievement.buildPrompt(challenge, actions, result, client, 'cv');
    const response = services.ai.query(prompt, {
      provider: modelName,
      maxTokens: CONFIG.AI.MAX_TOKENS.ACHIEVEMENT
    });

    const currentCell = services.sheet.getActiveCell();
    currentCell.setValue(response);

    Logger.log(`Generated achievement using ${modelName}: ${response.length} chars`);
  } catch (error) {
    Logger.error(`Error in fetchWithModel with ${modelName}`, error);
    throw new Error(`Failed to generate with ${modelName}: ${error.message}`);
  }
}

/**
 * Generate achievement without writing to cell (for comparison)
 * @param {string} modelName - Name of model ('claude', 'gemini', 'openai')
 * @returns {string} Generated achievement
 */
function generateAchievementWithModel(modelName) {
  try {
    const services = initializeServices();
    const { rowIndex, row, headers } = services.sheet.getActiveRowData(CONFIG.SHEETS.STORY_BANK);

    const challenge = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CHALLENGE)];
    const actions = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.ACTIONS)];
    const result = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.RESULT)];
    const client = row[headers.indexOf(CONFIG.COLUMNS.STORY_BANK.CLIENT)];

    const prompt = services.achievement.buildPrompt(challenge, actions, result, client, 'cv');
    const response = services.ai.query(prompt, {
      provider: modelName,
      maxTokens: CONFIG.AI.MAX_TOKENS.ACHIEVEMENT
    });

    Logger.log(`Generated achievement using ${modelName}: ${response.length} chars`);
    return response;
  } catch (error) {
    Logger.error(`Error in generateAchievementWithModel with ${modelName}`, error);
    throw new Error(`Failed to generate with ${modelName}: ${error.message}`);
  }
}

/**
 * Handle form data from modal
 * @param {Object} formData - Form data object
 */
function handleGenerate(formData) {
  try {
    Logger.log(`Focus selected: ${formData.focus}`);
    Logger.log(`Wow selected: ${formData.wow}`);

    const services = initializeServices();
    const url = services.resumeFormatter.generateResume();

    DialogService.showLink(url, 'Resume Generated');
  } catch (error) {
    Logger.error('Error in handleGenerate', error);
    DialogService.showAlert(`Error generating resume: ${error.message}`);
  }
}

/**
 * Include HTML file content (for templating)
 * @param {string} filename - HTML file name
 * @returns {string} HTML content
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}
// #endregion Entry Points

// ====================
// 9. SECURITY & SETUP
// ====================
// #region Security & Setup

/**
 * One-time setup function for OpenRouter API key
 * Run this manually to configure API credentials
 *
 * Get your OpenRouter API key at: https://openrouter.ai/keys
 * This single key provides access to Claude, GPT-4, Gemini, and 200+ models
 */
function setupAPIKeys() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Show info message
    ui.alert(
      'OpenRouter Setup',
      'This script uses OpenRouter for unified AI model access.\n\n' +
      '✓ One API key for all models (Claude, GPT-4, Gemini, etc.)\n' +
      '✓ Simple pay-as-you-go pricing\n' +
      '✓ No vendor lock-in\n\n' +
      'Get your API key at: https://openrouter.ai/keys',
      ui.ButtonSet.OK
    );

    // OpenRouter API Key
    const openrouterResponse = ui.prompt(
      'Setup: OpenRouter API Key',
      'Enter your OpenRouter API key:',
      ui.ButtonSet.OK_CANCEL
    );

    if (openrouterResponse.getSelectedButton() === ui.Button.OK) {
      const openrouterKey = openrouterResponse.getResponseText();
      PropertiesService.getScriptProperties().setProperty('OPENROUTER_API_KEY', openrouterKey);
      Logger.log('OpenRouter API key saved');

      ui.alert(
        'Setup Complete',
        'OpenRouter API key has been saved successfully!\n\nYou can now use all AI features.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('Setup Cancelled', 'No API key was saved.', ui.ButtonSet.OK);
    }
  } catch (error) {
    Logger.error('Error in setupAPIKeys', error);
    SpreadsheetApp.getUi().alert(`Error during setup: ${error.message}`);
  }
}
// #endregion Security & Setup
