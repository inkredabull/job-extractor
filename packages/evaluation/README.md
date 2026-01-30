# @job-extractor/evaluation

LangSmith-powered evaluation and monitoring for Job Extractor agents.

## Overview

This package provides comprehensive evaluation capabilities for the Job Extractor system:
- **Job extraction quality assessment** - Validate parsing accuracy
- **Resume generation evaluation** - Assess AI-generated content quality
- **Scoring algorithm validation** - Test criteria matching consistency
- **Production monitoring** - Real-time LLM API tracing and metrics

## Architecture

The package uses a **hybrid approach**:
- **Python** - Native LangSmith integration for evaluation logic
- **TypeScript** - Node.js wrapper for seamless monorepo integration

```
packages/evaluation/
├── python/              # Python package with LangSmith
│   ├── src/
│   │   └── job_extractor_eval/
│   │       ├── evaluators.py    # Core evaluation logic
│   │       ├── cli.py           # CLI interface
│   │       └── __init__.py
│   ├── pyproject.toml           # Python package config
│   └── requirements.txt
└── src/                 # TypeScript wrapper
    ├── langsmith-runner.ts      # Python process spawner
    ├── types.ts                 # TypeScript types
    └── index.ts
```

## Installation

### Python Setup

```bash
cd packages/evaluation/python

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install package
pip install -e .

# Or just dependencies
pip install -r requirements.txt
```

### Node.js Setup

```bash
# From monorepo root
npm install

# Build TypeScript
cd packages/evaluation
npm run build
```

## Usage

### Python CLI

```bash
# Activate virtual environment
source packages/evaluation/python/venv/bin/activate

# Evaluate a job
evaluate-jobs abc123

# Or use module syntax
python -m job_extractor_eval.cli abc123

# Check LangSmith setup
python -m job_extractor_eval.cli --check-setup

# Specific evaluations
python -m job_extractor_eval.cli abc123 --terms-only
python -m job_extractor_eval.cli abc123 --completeness-only
```

### TypeScript/Node.js

```typescript
import { evaluateJob, checkLangSmithSetup } from '@job-extractor/evaluation';

// Check if LangSmith is configured
const isConfigured = await checkLangSmithSetup({ verbose: true });

if (isConfigured) {
  // Run evaluation
  const result = await evaluateJob('abc123', {
    termsOnly: false,
    completenessOnly: false,
    verbose: true,
  });

  if (result.success) {
    console.log('Evaluation metrics:', result.metrics);
  } else {
    console.error('Evaluation failed:', result.error);
  }
}
```

### Programmatic Python

```python
from job_extractor_eval import (
    evaluate_required_terms_quality,
    evaluate_extraction_completeness,
)

# Evaluate required terms
metrics = evaluate_required_terms_quality("abc123")
print(f"Terms count: {metrics['terms_count']}")
print(f"Coverage: {metrics['terms_coverage']}")

# Evaluate completeness
completeness = evaluate_extraction_completeness("abc123")
print(f"Score: {completeness['completeness_score']}")
```

## Configuration

Set your LangSmith API key in `.env` at project root:

```bash
LANGSMITH_API_KEY=your_api_key_here
```

Get your API key from: https://smith.langchain.com/

## Development

### Python Development

```bash
cd packages/evaluation/python

# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/

# Type checking
mypy src/
```

### TypeScript Development

```bash
cd packages/evaluation

# Watch mode
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## Integration with Core

This package can access job data through the core package:

```typescript
import { evaluateJob } from '@job-extractor/evaluation';
import { JobExtractorAgent } from '@job-extractor/core';

// Extract and evaluate in one workflow
const agent = new JobExtractorAgent(config);
const job = await agent.extract(url);

const evaluation = await evaluateJob(job.id, { verbose: true });
console.log('Job quality score:', evaluation.metrics?.completeness_score);
```

## What Gets Evaluated

### Required Terms Quality
- Validates critical job requirements are extracted
- Measures coverage of skills, experience levels, technologies
- Tracks technical term identification

### Extraction Completeness
- Ensures mandatory fields are populated (title, company, location, description)
- Validates optional field presence (salary, benefits)
- Calculates overall completeness score

### Prompt Performance
- A/B tests different prompt strategies
- Compares model outputs (OpenAI vs Anthropic)
- Measures consistency across runs

## Example Workflow

```bash
# 1. Extract a job
npm run dev -- extract "https://example.com/job"

# 2. Get the job ID from output (e.g., abc123)

# 3. Evaluate extraction quality
cd packages/evaluation/python
source venv/bin/activate
evaluate-jobs abc123

# 4. View results in LangSmith dashboard
# Visit: https://smith.langchain.com/
```

## Related Documentation

- [LangSmith Documentation](https://docs.smith.langchain.com/)
- [Main README - LangSmith Section](../../README.md#langsmith-evaluation--monitoring)
- [Python Package README](./python/README.md)

## License

MIT License
