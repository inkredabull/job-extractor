# Google Sheets Integration

This integration allows you to automatically track job applications in a Google Sheets spreadsheet.

## Setup

### 1. Enable Google Sheets API

The Google Sheets API access uses the same OAuth credentials as the Gmail integration.

If you haven't already set up Google OAuth:

```bash
npm run setup-gmail
```

This will:
1. Prompt you to visit a Google authorization URL
2. Ask you to grant access to your Google account
3. Save the `GOOGLE_REFRESH_TOKEN` to your `.env` file

### 2. Update OAuth Scopes (if needed)

If you set up Gmail auth before, you may need to update the scopes to include Sheets access.

Edit `scripts/setup-gmail-auth.js` and add the Sheets scope:

```javascript
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/spreadsheets' // Add this
];
```

Then re-run:
```bash
npm run setup-gmail
```

### 3. Configure Your Spreadsheet

Edit `scripts/add-job-to-sheet.ts` and update:

```typescript
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID';
const SHEET_NAME = 'Sheet1'; // Update to your sheet tab name
```

## Usage

### Insert a Row at the Top

Insert a new job entry at the top of the sheet (row 2, below headers):

```bash
ts-node scripts/add-job-to-sheet.ts
```

With custom data:

```bash
ts-node scripts/add-job-to-sheet.ts \
  --id "JOB-123" \
  --role "Senior Software Engineer" \
  --company "Acme Corp" \
  --status "Applied" \
  --score "85%" \
  --jobUrl "https://example.com/careers/123"
```

### List All Jobs

```bash
ts-node scripts/add-job-to-sheet.ts list
```

### Update a Job Status

```bash
ts-node scripts/add-job-to-sheet.ts update JOB-123
```

## Programmatic Usage

### Import the Client

```typescript
import { GoogleSheetsClient, extractSpreadsheetId, JobRow } from './components/core/src/utils/google-sheets';

const client = new GoogleSheetsClient();
const spreadsheetId = extractSpreadsheetId(SPREADSHEET_URL);
```

### Insert a Row

```typescript
const jobData: JobRow = {
  id: 'JOB-123',
  role: 'Senior Engineer',
  company: 'Acme Corp',
  status: 'Applied',
  applied: '2026-02-26',
  updated: '2026-02-26',
  score: '85%',
  threshold: 'Yes',
  jobUrl: 'https://example.com/job',
  resumeUrl: 'https://drive.google.com/...',
};

// Insert at top (row 2)
await client.insertRowAtTop(spreadsheetId, 'Sheet1', jobData);

// Or append to bottom
await client.appendRow(spreadsheetId, 'Sheet1', jobData);
```

### Read All Rows

```typescript
const jobs = await client.readAll(spreadsheetId, 'Sheet1');
console.log(`Found ${jobs.length} jobs`);
```

### Update a Row

```typescript
await client.updateRowById(spreadsheetId, 'Sheet1', 'JOB-123', {
  status: 'Interview Scheduled',
  updated: '2026-02-27',
  notes: 'Phone screen on Friday'
});
```

## Integration with Job Scoring

You can integrate this with the existing job scoring workflow. Here's an example:

```typescript
// In your job scoring agent
import { GoogleSheetsClient, formatDate } from './utils/google-sheets';

async function scoreJob(jobUrl: string) {
  // ... existing scoring logic ...

  const jobData = {
    id: extractJobId(jobUrl),
    role: extractedRole,
    company: extractedCompany,
    status: 'Analyzed',
    applied: formatDate(),
    updated: formatDate(),
    score: `${score}%`,
    threshold: score >= 75 ? 'Yes' : 'No',
    analysis: analysisText,
    jobUrl: jobUrl,
    origin: 'CLI'
  };

  // Add to Google Sheets
  const sheets = new GoogleSheetsClient();
  await sheets.insertRowAtTop(spreadsheetId, sheetName, jobData);
}
```

## Column Mapping

The `JobRow` interface maps to these spreadsheet columns:

| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | id | string | Unique job identifier |
| B | role | string | Job title/role |
| C | company | string | Company name |
| D | status | string | Application status |
| E | applied | string | Date applied (YYYY-MM-DD) |
| F | updated | string | Last updated date |
| G | rejectionRationale | string | Why rejected |
| H | notes | string | Additional notes |
| I | origin | string | Source (LinkedIn, CLI, etc.) |
| J | score | string | Match score (e.g., "85%") |
| K | threshold | string | Meets threshold? |
| L | analysis | string | Full analysis text |
| M | jobUrl | string | Job posting URL |
| N | resumeUrl | string | Resume PDF URL |
| O | critique | string | Resume critique |
| P | whoGotHired | string | Who got the job |
| Q | jobTitleShorthand | string | Short job title |
| R | control | string | Control flag |

## Error Handling

The client will throw errors for:

- **Missing OAuth token**: Run `npm run setup-gmail` to authenticate
- **Expired token**: Re-run `npm run setup-gmail` to refresh
- **Invalid sheet name**: Verify the sheet tab name matches
- **Invalid spreadsheet URL**: Check the URL format

All errors are logged with helpful emoji indicators:
- ✅ Success
- ❌ Error
- 🔑 Authentication issue
- 📊 Spreadsheet operation

## Scopes Required

The integration requires these Google OAuth scopes:

- `https://www.googleapis.com/auth/spreadsheets` - Read/write access to Google Sheets

If using Gmail integration:
- `https://www.googleapis.com/auth/gmail.readonly` - Read-only access to Gmail
