# Comprehensive Job Listing Type - Usage Guide

## Overview

The `ComprehensiveJobListing` type is designed as a superset that covers:
- **Current extraction needs** - All fields we currently capture
- **Teal requirements** - Fields needed for Teal job tracker integration  
- **Future extensibility** - Additional fields for enhanced job analysis

## Key Design Principles

1. **Backward Compatible** - All existing `JobListing` fields are preserved
2. **Teal Compatible** - Includes conversion utilities for Teal API
3. **Extensible** - Optional fields allow gradual feature addition
4. **Type Safe** - Full TypeScript support with type guards

## Usage Examples

### Frontend (Chrome Extension)

```typescript
import { ComprehensiveJobListing, convertToTealFormat } from '../types/comprehensive-job-listing';

// Form data collection
const jobData: ComprehensiveJobListing = {
  title: document.getElementById('job-title')?.value || '',
  company: document.getElementById('company-name')?.value || '',  
  location: document.getElementById('job-location')?.value || '',
  description: document.getElementById('job-description')?.value || '',
  url: document.getElementById('job-url')?.value || window.location.href,
  
  // Enhanced fields (optional)
  jobDetails: {
    employmentType: 'full-time',
    workArrangement: 'remote',
    experienceLevel: 'senior'
  },
  
  metadata: {
    source: 'manual',
    extractedAt: new Date().toISOString()
  }
};

// Convert for Teal API
const tealData = convertToTealFormat(jobData);
```

### Backend (CLI/Server)

```typescript
import { ComprehensiveJobListing, convertFromCurrentFormat } from '../types/comprehensive-job-listing';

// Migration from current format
const legacyJob = { title: 'Engineer', company: 'Acme', /* ... */ };
const comprehensiveJob = convertFromCurrentFormat(legacyJob);

// Enhanced extraction
const extractedJob: ComprehensiveJobListing = {
  ...comprehensiveJob,
  
  // Add competition data
  applicantCount: 150,
  competitionLevel: 'high',
  competitionMetrics: {
    applicantCount: 150,
    threshold: 100,
    daysPosted: 3
  },
  
  // Add requirements analysis
  requirements: {
    requiredSkills: ['TypeScript', 'React', 'Node.js'],
    preferredSkills: ['GraphQL', 'AWS'],
    yearsOfExperience: { min: 3, max: 8 }
  },
  
  // Add scoring
  analysis: {
    score: 85,
    matchPercentage: 92,
    pros: ['Great tech stack', 'Remote friendly'],
    cons: ['High competition']
  }
};
```

## Migration Strategy

### Phase 1: Basic Migration
1. Update `JobListing` type imports to use `ComprehensiveJobListing`
2. Use conversion utilities for existing data
3. Maintain backward compatibility

### Phase 2: Enhanced Fields
1. Add optional fields gradually (salary enhancement, company info)
2. Update extractors to populate new fields
3. Enhance Teal integration with additional data

### Phase 3: Advanced Features  
1. Add analytics and scoring integration
2. Implement external API integrations
3. Add application tracking features

## Field Mapping

### Current → Comprehensive
```typescript
// Before
interface JobListing {
  title: string;           → title: string;
  company: string;         → company: string;  
  location: string;        → location: string;
  description: string;     → description: string;
  applicantCount?: number; → applicantCount?: number;
  competitionLevel?: ...;  → competitionLevel?: ...;
  salary?: { ... };        → salary?: { ... }; (enhanced)
}
```

### Comprehensive → Teal
```typescript
// Teal API fields
ComprehensiveJobListing {
  title        → role (Teal field name)
  company      → company_name (Teal field name)
  location     → location
  url          → url  
  description  → description (contenteditable)
}
```

## Type Safety Features

### Type Guards
```typescript
import { isTealJobData, isComprehensiveJobListing } from '../types/comprehensive-job-listing';

// Runtime type checking
if (isComprehensiveJobListing(data)) {
  // TypeScript knows this is ComprehensiveJobListing
  console.log(data.title, data.analysis?.score);
}

if (isTealJobData(tealData)) {
  // Safe to send to Teal API
  await sendToTeal(tealData);
}
```

### Utility Functions
```typescript
// Convert between formats
const tealFormat = convertToTealFormat(comprehensiveJob);
const comprehensive = convertFromCurrentFormat(legacyJob);

// Partial updates
const updated: Partial<ComprehensiveJobListing> = {
  teal: { stage: 'applied', rating: 4 },
  analysis: { score: 90 }
};
```

## Best Practices

1. **Use Optional Fields** - Only populate fields you have data for
2. **Type Guards** - Always validate data at boundaries
3. **Conversion Utils** - Use provided utilities for format conversion  
4. **Gradual Migration** - Migrate incrementally to avoid breaking changes
5. **Metadata Tracking** - Always populate metadata for auditing

## Future Extensions

The type structure allows for easy extension:

- **AI Analysis** - Sentiment analysis, skill extraction
- **Market Data** - Salary benchmarking, company metrics  
- **Application Tracking** - Interview scheduling, status updates
- **Integration APIs** - LinkedIn, Glassdoor, Crunchbase data
- **Team Features** - Job sharing, collaborative scoring