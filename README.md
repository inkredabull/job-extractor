# Job Extractor

A TypeScript CLI tool that extracts and automatically scores job information from job posting URLs using dual extraction strategies. Built with Commander.js, Cheerio for HTML parsing, and OpenAI's GPT models for intelligent data extraction and job matching.

## Features

- 🎯 **Smart Dual Extraction Strategy:**
  - **Primary**: JSON-LD structured data extraction (instant, no LLM needed)
  - **Fallback**: AI-powered HTML scraping with OpenAI GPT models
- 🏗️ **JSON-LD Support**: Automatically detects and parses Schema.org JobPosting structured data
- 💰 **Advanced Salary Parsing**: Extracts salary ranges from various text formats in job descriptions
- 📊 **Job Scoring & Matching**: AI-powered job scoring against customizable criteria with detailed rationale
- 📄 **Resume Generation**: Create tailored PDF resumes optimized for specific job postings
- 🤖 **Auto-Resume Generation**: Automatically generate tailored resumes when job scores exceed a configurable threshold
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

4. Edit `.env` and add your API keys:
```
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Auto-resume generation settings
AUTO_RESUME_THRESHOLD=85
AUTO_RESUME_CV_PATH=./sample-cv.txt
```

5. Install pandoc (required for PDF generation):
```bash
# macOS with Homebrew
brew install pandoc

# Ubuntu/Debian
sudo apt-get install pandoc

# Windows (download from https://pandoc.org/installing.html)
```

6. Build the project:
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

#### Resume Generation

Generate a tailored PDF resume for a specific job posting:

```bash
# Generate a tailored resume for a job
job-extractor resume "4c32e01e" sample-cv.txt

# Specify custom output path
job-extractor resume "4c32e01e" my-cv.txt -o tailored-resume.pdf
```

**Resume Options:**
- `-o, --output <file>`: Output path for the generated PDF

#### Auto-Resume Generation

The tool can automatically generate tailored resumes when job scores exceed a configurable threshold. This feature integrates seamlessly with the job scoring workflow:

**Setup:**
1. Set `AUTO_RESUME_THRESHOLD` in your `.env` file (0-100, default: 80)
2. Set `AUTO_RESUME_CV_PATH` to point to your CV file (e.g., `./sample-cv.txt`)

**How it works:**
- When extracting and scoring jobs, if a job score ≥ threshold, a resume is automatically generated
- Uses the same Claude 3.5 Sonnet AI for tailoring content to match job requirements
- Saves generated resumes to the `logs/` directory with timestamp
- Reports tailoring changes made during the process

**Example workflow:**
```bash
# With auto-resume enabled (score ≥ 85% threshold)
job-extractor extract "https://example.com/great-job"

# Output will include:
# ✅ Job extracted and scored: 87%
# 🎯 Score of 87% exceeds threshold of 85% - generating tailored resume...
# ✅ Auto-generated resume: logs/resume-a1b2c3d4-2024-06-24T15-30-45.pdf
# 🔧 Tailoring changes made: 4 modifications
```

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

# Generate a tailored resume for a specific job
job-extractor resume "a1b2c3d4" my-cv.txt

# Generate resume with custom output path
job-extractor resume "a1b2c3d4" my-cv.txt -o "resumes/google-resume.pdf"
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

### Resume Generation Schema

Resume generation requires a plain text CV file and produces:

```json
{
  "success": true,
  "pdfPath": "logs/resume-a1b2c3d4-2024-06-24T15-30-45-123Z.pdf",
  "tailoringChanges": [
    "Emphasized React and Node.js experience to match job requirements",
    "Reordered technical skills to highlight relevant technologies",
    "Updated professional summary to include keywords from job description",
    "Moved relevant project to top of projects section"
  ]
}
```

#### CV File Format

Your CV text file should include structured information:

```text
Full Name
Email: your.email@example.com
Phone: +1-555-0123
Location: City, State
LinkedIn: https://linkedin.com/in/yourprofile
GitHub: https://github.com/yourusername

PROFESSIONAL SUMMARY
Brief overview of your experience and skills...

EXPERIENCE
Job Title | Company Name | Duration
• Achievement or responsibility
• Another achievement with metrics

EDUCATION
Degree | Institution | Year
Additional details if relevant

TECHNICAL SKILLS
Languages: JavaScript, Python, etc.
Frameworks: React, Node.js, etc.
Tools: Git, Docker, AWS, etc.

PROJECTS
Project Name | Year
Description of the project and technologies used
GitHub: https://github.com/username/project
```

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

### Resume Generation Process

The ResumeCreatorAgent follows a 4-step process:

1. **CV Parsing**: Uses AI to extract structured data from your plain text CV
2. **Job Analysis**: Loads the specific job posting data from extraction logs
3. **Content Tailoring**: AI generates optimized Markdown resume content:
   - Reorders experience to highlight relevant roles
   - Emphasizes matching skills and technologies
   - Updates summary with job-specific keywords
   - Prioritizes relevant projects and achievements
   - Follows professional resume formatting guidelines
4. **PDF Generation**: Uses pandoc to convert Markdown to professional PDF

**Key Features:**
- **Maintains truthfulness**: Only reorders and emphasizes existing content
- **Job-specific optimization**: Uses actual job description for tailoring
- **Professional formatting**: Pandoc-generated PDF with clean layout
- **Markdown intermediate**: Allows for easy customization and review
- **Change tracking**: Reports what modifications were made

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

Generated resumes are saved as:
```
logs/resume-{job-id}-{timestamp}.pdf
```

Example: `logs/resume-a1b2c3d4-2024-06-19T15-40-33-789Z.pdf`

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
│   ├── resume-creator-agent.ts # AI-powered resume generation and PDF creation
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
├── resume-creator-agent.test.ts # Tests for CV parsing, tailoring, and PDF generation
└── web-scraper.test.ts        # Tests for structured data extraction

logs/                          # Auto-generated job extraction and scoring logs
├── job-*.json                 # Timestamped extraction results
├── score-*.json               # Timestamped scoring results
└── resume-*.pdf               # Generated tailored resumes

criteria.json                  # Configurable job scoring criteria
sample-cv.txt                  # Example CV format for resume generation
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
4. **ResumeCreatorAgent**: Claude 3.5 Sonnet-powered resume tailoring system:
   - Parses plain text CV files into structured data
   - Analyzes job requirements and optimizes resume content
   - Generates professional PDF resumes with tailored content
   - Tracks and reports all modifications made
5. **WebScraper**: Utility for:
   - HTML fetching with proper headers
   - JSON-LD structured data extraction
   - HTML simplification for AI processing
6. **CLI**: Commander.js interface with automatic logging to unique files

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required for extraction/scoring) | - |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-3.5-turbo` |
| `OPENAI_TEMPERATURE` | Model temperature (0-1) | `0.3` |
| `OPENAI_MAX_TOKENS` | Maximum tokens in response | `2000` |
| `ANTHROPIC_API_KEY` | Anthropic API key (required for resume generation) | - |
| `ANTHROPIC_MODEL` | Anthropic model to use | `claude-3-5-sonnet-20241022` |
| `ANTHROPIC_MAX_TOKENS` | Maximum tokens in response | `4000` |
| `AUTO_RESUME_THRESHOLD` | Score threshold for automatic resume generation (0-100) | `80` |
| `AUTO_RESUME_CV_PATH` | Path to CV file for automatic resume generation | - |

## Testing

Run the test suite:

```bash
npm test
```

The project includes comprehensive unit tests for:
- Base agent functionality and OpenAI integration
- Job extractor agent with dual strategy testing
- Job scorer agent with scoring algorithm validation
- Resume creator agent with CV parsing and PDF generation
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

2. **"ANTHROPIC_API_KEY environment variable is required"**
   - Make sure you've added your Anthropic API key to the `.env` file
   - Get your Anthropic API key from the Anthropic Console

3. **Network/fetch errors**
   - Some websites may block automated requests
   - Try with different URLs or check your internet connection

4. **Parsing errors**
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
