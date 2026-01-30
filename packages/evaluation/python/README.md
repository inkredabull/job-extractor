# Job Extractor Evaluation (Python Package)

LangSmith-powered evaluation and monitoring for Job Extractor agents.

## Installation

```bash
# From packages/evaluation/python directory
pip install -e .

# Or install dependencies only
pip install -r requirements.txt
```

## Usage

### CLI Interface

```bash
# Evaluate a specific job
evaluate-jobs abc123

# Or use module syntax
python -m job_extractor_eval.cli abc123

# Check LangSmith setup
python -m job_extractor_eval.cli --check-setup

# Evaluate only terms quality
python -m job_extractor_eval.cli abc123 --terms-only

# Evaluate only completeness
python -m job_extractor_eval.cli abc123 --completeness-only
```

### Programmatic Usage

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
print(f"Completeness score: {completeness['completeness_score']}")
```

## Configuration

Set your LangSmith API key:

```bash
# In .env file at project root
LANGSMITH_API_KEY=your_api_key_here
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/

# Type checking
mypy src/
```

## Architecture

This package provides:
- **evaluators.py**: Core evaluation logic for job extraction quality
- **cli.py**: Command-line interface for running evaluations
- **__init__.py**: Public API exports

Integrates with:
- LangSmith for evaluation tracking and monitoring
- Job Extractor core package for data access
- Project-wide .env configuration
