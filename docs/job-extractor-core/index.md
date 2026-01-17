# Job Extractor Core

The main CLI tool and agent system for job extraction, scoring, resume creation, and interview preparation.

## Overview

The core package provides a comprehensive TypeScript CLI tool that combines multiple AI-powered agents to streamline the job search process.

## Features

### Job Extraction
- Automated parsing of job postings from URLs, HTML, or JSON
- Dual extraction strategy: JSON-LD structured data + AI HTML scraping fallback
- LinkedIn company integration

### Job Scoring
- AI-powered compatibility scoring against personal criteria
- Configurable weighted categories and deal-breakers
- Detailed rationale for scoring decisions

### Resume Creation
- AI-powered resume tailoring with leader/builder modes
- PDF generation
- Automatic optimization based on job requirements

### Interview Preparation
- About-me statement generation with granular section control
- Cover letter generation
- Theme extraction and enrichment
- Company evaluation rubrics

### Application Automation
- Automated form filling with AI-powered field generation
- Human-in-the-loop verification
- Stagehand integration for complex forms

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Extract and score a job
npm run dev extract <job-url>

# Generate tailored resume
npm run dev resume <job-id>

# Generate interview prep materials
npm run dev prep about-me <job-id>

# Fill application form
npm run dev apply <job-id> <application-url>
```

## Architecture

The core package is organized into:

- **Agents**: Specialized AI-powered components
  - `JobExtractorAgent` - Job extraction
  - `JobScorerAgent` - Job scoring
  - `ResumeCreatorAgent` - Resume generation
  - `ResumeCriticAgent` - Resume analysis
  - `InterviewPrepAgent` - Interview materials
  - `ApplicationAgent` - Form filling
  - `OutreachAgent` - LinkedIn outreach

- **Types**: TypeScript type definitions
- **Utils**: Shared utilities (web scraping, etc.)
- **CLI**: Command-line interface

## Source Code

[View on GitHub](https://github.com/inkredabull/job-extractor/tree/main/packages/core)

## Documentation

See the main [README.md](https://github.com/inkredabull/job-extractor/blob/main/README.md) for comprehensive documentation.
