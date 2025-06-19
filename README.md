# Job Extractor

A TypeScript CLI tool that extracts job information from job posting URLs using AI. Built with Commander.js, Cheerio for HTML parsing, and OpenAI's GPT models for intelligent data extraction.

## Features

- 🤖 AI-powered job data extraction using OpenAI GPT models
- 🌐 Web scraping with intelligent HTML simplification
- 📋 Structured JSON output with standardized job schema
- 🎨 Pretty-formatted console output
- 💾 Optional file output
- 🧪 Comprehensive unit tests
- 🔧 TypeScript with full type safety

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
# Extract and display in pretty format
job-extractor extract "https://example.com/job-posting"

# Extract and save as JSON
job-extractor extract "https://example.com/job" -f json -o job-data.json

# Extract and save in pretty format
job-extractor extract "https://example.com/job" -o job-info.txt
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
│   └── job-extractor-agent.ts # Job extraction implementation
├── types/
│   └── index.ts               # TypeScript type definitions
├── utils/
│   └── web-scraper.ts         # HTML fetching and simplification
├── config.ts                  # Environment configuration
├── cli.ts                     # Command-line interface
└── index.ts                   # Main exports

__tests__/
├── base-agent.test.ts
├── job-extractor-agent.test.ts
└── web-scraper.test.ts
```

### Architecture

The project follows a modular architecture:

1. **BaseAgent**: Abstract base class that handles OpenAI API communication
2. **JobExtractorAgent**: Specialized agent for job data extraction
3. **WebScraper**: Utility for fetching and simplifying HTML content
4. **CLI**: Commander.js-based command-line interface

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
