# Job Extractor

A TypeScript CLI tool that extracts job information from job posting URLs using dual extraction strategies. Built with Commander.js, Cheerio for HTML parsing, and OpenAI's GPT models for intelligent data extraction.

## Features

- 🎯 **Smart Dual Extraction Strategy:**
  - **Primary**: JSON-LD structured data extraction (instant, no LLM needed)
  - **Fallback**: AI-powered HTML scraping with OpenAI GPT models
- 🏗️ **JSON-LD Support**: Automatically detects and parses Schema.org JobPosting structured data
- 💰 **Advanced Salary Parsing**: Extracts salary ranges from various text formats in job descriptions
- 🌐 **Robust Web Scraping**: Intelligent HTML simplification with error handling
- 📁 **Automatic Logging**: Saves all extracted data to uniquely named JSON files in logs/
- 📋 **Structured JSON Output**: Standardized job schema with optional salary information
- 🧪 **Comprehensive Testing**: Full unit test coverage with mocking for external dependencies
- 🔧 **TypeScript**: Full type safety and modern development experience

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd job-extractor
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

5. Build the project:
```bash
npm run build
```

## Usage

### Command Line Interface

Extract job information from a URL:

```bash
# Using npm run dev (development)
npm run dev extract "https://example.com/job-posting"

# Using built version
npm start extract "https://example.com/job-posting"

# Or install globally and use directly
npm install -g .
job-extractor extract "https://example.com/job-posting"
```

### Options

- `-o, --output <file>`: Save output to a file
- `-f, --format <format>`: Output format (`json` or `pretty`, default: `pretty`)

### Examples

```bash
# Extract job data (automatically logs to logs/ folder)
job-extractor extract "https://example.com/job-posting"

# Extract with JSON format output
job-extractor extract "https://example.com/job" -f json

# Extract and save to additional file
job-extractor extract "https://example.com/job" -o job-data.json

# Works great with structured data sites (Workday, Greenhouse, etc.)
job-extractor extract "https://company.myworkdaysite.com/job-posting"
```

## Output Schema

The tool extracts job information into the following JSON schema:

```json
{
  "title": "Software Engineer",
  "company": "TechCorp",
  "location": "San Francisco, CA",
  "description": "We are looking for a talented software engineer...",
  "salary": {
    "min": "$120,000",
    "max": "$180,000",
    "currency": "USD"
  }
}
```

**Note:** The `salary` field is optional and will be omitted if no salary information is found.

## How It Works

### Dual Extraction Strategy

1. **JSON-LD Structured Data (Primary)**
   - Scans for `<script type="application/ld+json">` tags
   - Looks for Schema.org JobPosting structured data
   - Instantly extracts: title, company, location, description
   - Parses salary from description text using regex patterns
   - **Advantage**: No LLM calls needed, very fast and reliable

2. **HTML Scraping + AI (Fallback)**
   - Simplifies HTML by removing scripts, styles, and empty elements
   - Sends cleaned HTML to OpenAI GPT models
   - Uses AI to intelligently extract job information
   - **Advantage**: Works with any job site format

### Salary Extraction Patterns

The tool recognizes various salary formats in job descriptions:

- `"Salary Range: $100,000 - $150,000"`
- `"$80,000 to $120,000 annually"`
- `"between $90,000 and $130,000"`
- `"Compensation: $125,000"`

### Automatic Logging

All extracted job data is automatically saved to:
```
logs/job-{8-char-hash}-{timestamp}.json
```

Example: `logs/job-a1b2c3d4-2024-06-19T15-30-45-123Z.json`

## Development

### Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run in development mode with ts-node
- `npm start` - Run the built version
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run clean` - Clean the dist directory

### Project Structure

```
src/
├── agents/
│   ├── base-agent.ts          # Abstract base class for all agents  
│   └── job-extractor-agent.ts # Job extraction with dual strategy
├── types/
│   └── index.ts               # TypeScript type definitions
├── utils/
│   └── web-scraper.ts         # HTML fetching, JSON-LD extraction, simplification
├── config.ts                  # Environment configuration
├── cli.ts                     # Command-line interface with logging
└── index.ts                   # Main exports

__tests__/
├── base-agent.test.ts         # Tests for base OpenAI agent functionality
├── job-extractor-agent.test.ts # Tests for JSON-LD, salary parsing, fallback
└── web-scraper.test.ts        # Tests for structured data extraction

logs/                          # Auto-generated job extraction logs
└── job-*.json                 # Timestamped extraction results
```

### Architecture

The project follows a modular architecture with smart extraction strategies:

1. **BaseAgent**: Abstract base class that handles OpenAI API communication
2. **JobExtractorAgent**: Implements dual extraction strategy:
   - JSON-LD structured data parsing (primary)
   - HTML scraping + AI extraction (fallback)
   - Advanced salary parsing from description text
3. **WebScraper**: Utility for:
   - HTML fetching with proper headers
   - JSON-LD structured data extraction
   - HTML simplification for AI processing
4. **CLI**: Commander.js interface with automatic logging to unique files

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-3.5-turbo` |
| `OPENAI_TEMPERATURE` | Model temperature (0-1) | `0.3` |
| `OPENAI_MAX_TOKENS` | Maximum tokens in response | `2000` |

## Testing

Run the test suite:

```bash
npm test
```

The project includes comprehensive unit tests for:
- Base agent functionality
- Job extractor agent
- Web scraper utility
- Error handling scenarios

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY environment variable is required"**
   - Make sure you've created a `.env` file with your OpenAI API key

2. **Network/fetch errors**
   - Some websites may block automated requests
   - Try with different URLs or check your internet connection

3. **Parsing errors**
   - The AI may occasionally struggle with unusual page layouts
   - Try with more standard job posting formats

### Getting Help

If you encounter issues:
1. Check the error message and troubleshooting section above
2. Ensure your OpenAI API key is valid and has sufficient credits
3. Verify the target URL is accessible and contains job information
4. Open an issue on the project repository with details about the problem

### Misc

- created with Claude Code `$ claude "$(cat prompt.txt)"` and iterated on with Windsurf
