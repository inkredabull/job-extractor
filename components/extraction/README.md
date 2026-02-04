# @inkredabull/career-catalyst-extraction

> **Status**: Package structure created, implementation pending

Job extraction service with multiple strategies (JSON-LD, LLM, RegEx) for robust job posting data extraction.

## Overview

This package will consolidate all job extraction logic from the codebase into a single, reusable service. Currently, the extraction logic resides in `components/core/src/agents/career-catalyst-agent.ts` and is accessed via the unified server.

## Current State

As of the latest refactoring (Jan 2026), we've successfully consolidated the extraction implementations:

### Before
- **Chrome Extension**: Used regex-based extraction in `content.js`
- **CLI**: Used robust LLM-based extraction in `career-catalyst-agent.ts`
- **Result**: Two different implementations with different quality levels

### After
- **Unified Approach**: Both Chrome extension and CLI now use the same robust extraction logic
- **Architecture**: Chrome extension → Background script → Unified server → CLI extraction logic
- **Benefits**: Single source of truth, better data quality, full job descriptions, comprehensive salary detection

## Planned Architecture

```
components/extraction/
├── src/
│   ├── extractors/
│   │   ├── json-ld-extractor.ts      # Structured data extraction (JSON-LD)
│   │   ├── llm-extractor.ts          # LLM-based fallback extraction
│   │   ├── regex-extractor.ts        # Pattern-based extraction
│   │   └── applicant-counter.ts      # Competition level detection
│   ├── types.ts                      # TypeScript interfaces
│   ├── extraction-service.ts         # Main orchestrator
│   └── index.ts                      # Public API
├── tests/
│   ├── json-ld-extractor.test.ts
│   ├── llm-extractor.test.ts
│   └── integration.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Extraction Strategies

### 1. JSON-LD Extraction (Primary)
- Parses structured data from `<script type="application/ld+json">` tags
- Looks for `JobPosting` schema
- Highest accuracy when available
- Used by major job sites (LinkedIn, Indeed, etc.)

### 2. LLM Extraction (Fallback)
- Uses Claude/OpenAI to extract job data from simplified HTML
- Handles complex layouts and dynamic content
- Validates and normalizes extracted data
- 4000 token output limit for complete descriptions

### 3. RegEx Extraction (Legacy Fallback)
- Pattern-based extraction for common formats
- Fast but less reliable
- Used only when other methods fail

## Features to Extract

### Core Methods (from career-catalyst-agent.ts)

1. **extractApplicantCount(html: string)**
   - Detects applicant count from HTML
   - Determines competition level (low/medium/high/extreme)
   - Supports "Over X" patterns with conservative multipliers
   - Threshold: 200 applicants

2. **extractSalaryFromText(description: string)**
   - 10+ regex patterns for salary ranges
   - Handles: $150k-$200k, $150,000-$200,000, "up to $X", "starting from $X"
   - Normalizes amounts (handles 'k' suffix)
   - Returns min/max/currency structure

3. **parseStructuredData(jsonLd: any)**
   - Extracts from JSON-LD JobPosting schema
   - Maps to internal JobListing format
   - Fallback to description-based salary extraction

4. **extractJobDataFromHtml(html: string)**
   - Orchestrates extraction: JSON-LD → LLM → RegEx
   - Simplifies HTML before LLM processing
   - Returns complete JobListing object

## Usage (Planned)

```typescript
import { ExtractionService } from '@inkredabull/career-catalyst-extraction';

const extractor = new ExtractionService({
  llmApiKey: process.env.ANTHROPIC_API_KEY,
  llmModel: 'claude-sonnet-4.5'
});

// Extract from HTML
const result = await extractor.extractFromHtml(htmlContent, {
  sourceUrl: 'https://...',
  ignoreCompetition: false
});

if (result.success) {
  console.log('Job Data:', result.data);
  console.log('Extraction Source:', result.source); // 'json-ld', 'llm', or 'regex'
}
```

## Dependencies

- `cheerio`: HTML parsing and manipulation
- `openai`: LLM API client (works with Anthropic API too)

## Testing

```bash
npm test
```

Test fixtures should include:
- LinkedIn job postings (JSON-LD)
- Indeed job postings (JSON-LD)
- Custom career pages (LLM fallback)
- Various salary formats
- Applicant count patterns

## Migration Path

### Phase 1: Extract Core Logic ✅ DONE
- Consolidated Chrome extension and CLI to use same extraction logic
- Chrome extension sends HTML to unified server
- Unified server calls CLI extraction methods

### Phase 2: Create Extraction Package (Future)
- Move extraction methods from `career-catalyst-agent.ts` to this package
- Create `ExtractionService` class
- Separate extractors for each strategy

### Phase 3: Update Consumers (Future)
- Update `career-catalyst-agent.ts` to import from extraction package
- Update unified server to use extraction package directly
- Remove old extraction code

### Phase 4: Add Tests & Documentation (Future)
- Comprehensive unit tests for each extractor
- Integration tests with real job posting samples
- Performance benchmarks

## Key Extraction Methods to Move

From `components/core/src/agents/career-catalyst-agent.ts`:

- `extractApplicantCount()` → `applicant-counter.ts`
- `extractSalaryFromText()` → `regex-extractor.ts`
- `normalizeSalaryAmount()` → `regex-extractor.ts`
- `parseStructuredData()` → `json-ld-extractor.ts`
- `extractJobDataFromHtml()` → `extraction-service.ts`
- `parseJobData()` → `llm-extractor.ts`
- `extractBalancedJson()` → `llm-extractor.ts`
- `extractPartialJobData()` → `llm-extractor.ts`
- `createExtractionPrompt()` → `llm-extractor.ts`

From `components/core/src/utils/web-scraper.ts`:

- `extractStructuredData()` → `json-ld-extractor.ts`
- `simplifyHtml()` → `extraction-service.ts`

## Benefits of Extraction Package

1. **Single Source of Truth**: One implementation for all consumers
2. **Better Testing**: Isolated unit tests for each strategy
3. **Clear Dependencies**: Explicit imports instead of agent coupling
4. **Reusability**: Can be used by other tools (web scraper, API, etc.)
5. **Easier Maintenance**: Changes to extraction logic in one place
6. **Performance Monitoring**: Can add metrics and benchmarks
7. **Strategy Pattern**: Easy to add new extraction strategies

## Related Files

- `components/core/src/agents/career-catalyst-agent.ts` - Current implementation
- `components/core/src/utils/web-scraper.ts` - HTML utilities
- `components/unified-server/unified-server.js` - Server orchestration
- `components/chrome-extension/extension/content.js` - Chrome extension consumer
- `components/chrome-extension/extension/background.js` - Background script

## License

MIT
