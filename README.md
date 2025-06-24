# Job Extractor

A TypeScript CLI tool that extracts and automatically scores job information from job posting URLs using dual extraction strategies. Built with Commander.js, Cheerio for HTML parsing, and OpenAI's GPT models for intelligent data extraction and job matching.

## Features

- 🎯 **Smart Dual Extraction Strategy:**
  - **Primary**: JSON-LD structured data extraction (instant, no LLM needed)
  - **Fallback**: AI-powered HTML scraping with OpenAI GPT models
- 🏗️ **JSON-LD Support**: Automatically detects and parses Schema.org JobPosting structured data
- 💰 **Advanced Salary Parsing**: Extracts salary ranges from various text formats in job descriptions
- 📊 **Job Scoring & Matching**: AI-powered job scoring against customizable criteria with detailed rationale
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

#### Job Extraction (with Automatic Scoring)

Extract job information from a URL and automatically score it:

```bash
# Extract and score automatically (recommended workflow)
job-extractor extract "https://example.com/job-posting"

# Extract with custom criteria for scoring
job-extractor extract "https://example.com/job-posting" -c my-criteria.json

# Extract only (skip automatic scoring)
job-extractor extract "https://example.com/job-posting" --no-score
```

**Extract Options:**
- `-o, --output <file>`: Save output to a file
- `-f, --format <format>`: Output format (`json` or `pretty`, default: `pretty`)
- `-c, --criteria <file>`: Path to criteria file for scoring (default: `criteria.json`)
- `--no-score`: Skip automatic scoring after extraction

#### Manual Job Scoring

Score previously extracted jobs against customizable criteria:

```bash
# Score a job using its ID from the log filename
job-extractor score "4c32e01e"

# Score with custom criteria file
job-extractor score "4c32e01e" -c my-criteria.json
```

**Score Options:**
- `-c, --criteria <file>`: Path to criteria file (default: `criteria.json`)

### Examples

```bash
# Extract and automatically score job (recommended workflow)
job-extractor extract "https://example.com/job-posting"

# Extract with custom criteria for auto-scoring
job-extractor extract "https://example.com/job" -c senior-engineer-criteria.json

# Extract only without scoring
job-extractor extract "https://example.com/job" --no-score

# Extract with JSON format output and auto-scoring
job-extractor extract "https://example.com/job" -f json

# Extract and save to additional file with auto-scoring
job-extractor extract "https://example.com/job" -o job-data.json

# Works great with structured data sites (Workday, Greenhouse, etc.)
job-extractor extract "https://company.myworkdaysite.com/job-posting"

# Manually score an extracted job (use the job ID from log filename)
job-extractor score "a1b2c3d4"

# Manually score with custom criteria
job-extractor score "a1b2c3d4" -c senior-engineer-criteria.json
```

## Output Schemas

### Job Extraction Schema

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

### Job Scoring Schema

Job scoring produces detailed analysis with percentage scores:

```json
{
  "jobId": "4c32e01e",
  "overallScore": 74,
  "rationale": "This job posting received a 74% match score because it closely aligns with the candidate's experience level...",
  "breakdown": {
    "required_skills": 50,
    "preferred_skills": 50,
    "experience_level": 100,
    "salary": 100,
    "location": 100,
    "company_match": 70
  },
  "timestamp": "2024-06-24T22:09:23.762Z"
}
```

### Criteria Configuration

The scoring system uses a configurable `criteria.json` file. You can customize it based on your specific requirements:

#### Basic Example (Simple Criteria)
```json
{
  "required_skills": ["JavaScript", "React", "Node.js"],
  "preferred_skills": ["AWS", "Docker", "GraphQL"],
  "experience_levels": {
    "senior": 5,
    "lead": 7,
    "director": 10
  },
  "salary_range": {
    "min": 120000,
    "max": 300000,
    "currency": "USD"
  },
  "locations": ["Remote", "San Francisco"],
  "weights": {
    "required_skills": 0.3,
    "preferred_skills": 0.2,
    "experience_level": 0.2,
    "salary": 0.15,
    "location": 0.1,
    "company_match": 0.05
  }
}
```

#### Advanced Example (Comprehensive Criteria)
```json
{
  "required_skills": ["React", "Python", "TypeScript", "Leadership"],
  "preferred_skills": ["GCP", "Serverless", "GenAI", "Product Development"],
  "experience_levels": {
    "senior": 7,
    "staff": 8,
    "principal": 10,
    "director": 12,
    "vp": 15
  },
  "salary_range": {
    "min": 245000,
    "max": 400000,
    "currency": "USD"
  },
  "locations": ["Remote", "San Francisco", "Hybrid"],
  "company_requirements": {
    "funding_stage": ["Series A", "Series B"],
    "company_size": {
      "min": 30,
      "max": 50,
      "ideal": 38
    },
    "financial_metrics": {
      "arr_minimum": 5000000,
      "runway_years": 2
    },
    "domains": ["wellness", "coaching", "mental health"],
    "example_companies": ["Spring Health", "Headspace", "Calm"]
  },
  "role_requirements": {
    "leadership_level": "player-coach",
    "autonomy": true,
    "hands_on": true,
    "no_oncall": true
  },
  "cultural_values": [
    "collaborative",
    "mission-driven",
    "product-led growth"
  ],
  "deal_breakers": [
    "5 day RTO policy",
    "evening/weekend on-call",
    "only tactical responsibilities"
  ],
  "weights": {
    "required_skills": 0.15,
    "preferred_skills": 0.10,
    "experience_level": 0.15,
    "salary": 0.20,
    "location": 0.15,
    "company_match": 0.25
  }
}
```

#### Creating Your Own Criteria

To customize the criteria for your job search:

1. **Start with your requirements list** (like the provided `criteria.txt`)
2. **Categorize requirements** into the JSON structure:
   - **Must-haves** → `required_skills`, `salary_range`, `locations`
   - **Nice-to-haves** → `preferred_skills`, `company_requirements`
   - **Deal-breakers** → `deal_breakers` array
3. **Set appropriate weights** (must sum to 1.0):
   - Higher weight = more important in final score
   - Recommended: salary (0.2), company_match (0.25) for senior roles
4. **Test and iterate** by scoring sample jobs and adjusting criteria

#### Criteria Fields Explained

- **`required_skills`**: Must-have technical/leadership skills
- **`preferred_skills`**: Bonus skills that add value  
- **`experience_levels`**: Seniority levels with years of experience
- **`salary_range`**: Your target compensation range
- **`locations`**: Acceptable work locations (Remote, city names, Hybrid)
- **`company_requirements`**: Advanced filtering for company stage, size, domain
- **`role_requirements`**: Leadership style, autonomy level, work-life balance
- **`cultural_values`**: Company culture keywords to match
- **`deal_breakers`**: Automatic disqualifiers (returns 0% match)
- **`weights`**: Importance of each category (0.0 to 1.0, must sum to 1.0)

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

### Job Scoring Algorithm

The JobScorerAgent evaluates jobs across 6 weighted categories:

1. **Required Skills (30%)**: Matches against must-have technical skills
2. **Preferred Skills (20%)**: Bonus points for nice-to-have skills  
3. **Experience Level (20%)**: Compares job seniority level with your target
4. **Salary Match (15%)**: How well the salary aligns with your range
5. **Location Match (10%)**: Remote/location preference matching
6. **Company Match (5%)**: General company compatibility score

Each category receives a 0-100% score, then weighted to produce the final percentage.

### Automatic Logging

All extracted job data is automatically saved to:
```
logs/job-{8-char-hash}-{timestamp}.json
```

Example: `logs/job-a1b2c3d4-2024-06-19T15-30-45-123Z.json`

Job scores are saved separately:
```
logs/score-{job-id}-{timestamp}.json  
```

Example: `logs/score-a1b2c3d4-2024-06-19T15-35-22-456Z.json`

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
│   ├── job-extractor-agent.ts # Job extraction with dual strategy
│   ├── job-scorer-agent.ts    # Job scoring and matching against criteria
│   └── index.ts               # Agent exports
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
├── job-scorer-agent.test.ts   # Tests for job scoring and criteria matching
└── web-scraper.test.ts        # Tests for structured data extraction

logs/                          # Auto-generated job extraction and scoring logs
├── job-*.json                 # Timestamped extraction results
└── score-*.json               # Timestamped scoring results

criteria.json                  # Configurable job scoring criteria
```

### Architecture

The project follows a modular architecture with smart extraction and scoring strategies:

1. **BaseAgent**: Abstract base class that handles OpenAI API communication
2. **JobExtractorAgent**: Implements dual extraction strategy:
   - JSON-LD structured data parsing (primary)
   - HTML scraping + AI extraction (fallback)
   - Advanced salary parsing from description text
3. **JobScorerAgent**: Intelligent job matching system:
   - Configurable scoring criteria (skills, salary, location, etc.)
   - Weighted scoring algorithm across 6 categories
   - AI-generated rationale for match quality
   - Automatic score logging with timestamps
4. **WebScraper**: Utility for:
   - HTML fetching with proper headers
   - JSON-LD structured data extraction
   - HTML simplification for AI processing
5. **CLI**: Commander.js interface with automatic logging to unique files

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
- Base agent functionality and OpenAI integration
- Job extractor agent with dual strategy testing
- Job scorer agent with scoring algorithm validation
- Web scraper utility and structured data extraction
- Error handling scenarios and edge cases

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
