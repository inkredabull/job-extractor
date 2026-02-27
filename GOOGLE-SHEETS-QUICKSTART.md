# Google Sheets Integration - Quick Start

This guide helps you set up automatic job tracking in Google Sheets.

## 🎯 What You Get

- **Automatic logging** of job analyses to a Google Sheet
- **Status tracking** as jobs progress (Applied → Interview → Rejected/Offer)
- **Competition insights** by tracking who got hired for jobs you didn't get
- **Centralized dashboard** of all job applications in one place

## 🚀 Quick Setup (10 minutes)

### 1. Set Up Google OAuth Credentials

**First time only**: You need to create OAuth credentials in Google Cloud Console.

📚 **Follow the detailed guide**: [docs/google-oauth-setup.md](docs/google-oauth-setup.md)

**Quick version:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Desktop app)
3. ⚠️ **IMPORTANT**: Add `http://localhost:3000/oauth2callback` as authorized redirect URI
4. Copy Client ID and Client Secret to `.env`:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

### 2. Authenticate

```bash
# This sets up access to both Gmail AND Google Sheets
npm run setup-gmail
```

This will:
1. Start a local server and open your browser automatically
2. Ask you to grant access to Gmail (readonly) and Sheets (read/write)
3. Automatically receive the authorization code
4. Display a `GOOGLE_REFRESH_TOKEN` for you to add to `.env`

### 2. Configure Your Spreadsheet

Add these to your `.env` file:

```bash
# Your job tracking spreadsheet
GOOGLE_SHEETS_URL=https://docs.google.com/spreadsheets/d/13j0Gfao85oJd27oXpyAMyTL2iSkJCxaB3q_U5wyb4Oc

# The sheet tab name (check your spreadsheet)
GOOGLE_SHEETS_SHEET_NAME=Sheet1

# Enable/disable automatic logging
GOOGLE_SHEETS_ENABLED=true
```

### 3. Test the Connection

```bash
ts-node scripts/test-sheets-integration.ts
```

This interactive script will:
- ✅ Verify your OAuth credentials
- ✅ Test reading from your sheet
- ✅ Optionally insert a test row

## 📊 Your Spreadsheet Structure

Make sure Row 1 contains these headers (in this order):

```
ID | Role | Company | Status | Applied | Updated | Rejection Rationale | Notes | Origin |
Score (%) | Threshold? | Analysis | Job URL | Resume URL | Critique | Who Got Hired |
JobTitleShorthand | Control?
```

**That's columns A through R (18 columns total)**

## 💻 Usage Examples

### Manual Insert

```bash
# Insert a job at the top of your sheet
ts-node scripts/add-job-to-sheet.ts \
  --role "Senior Software Engineer" \
  --company "Acme Corp" \
  --status "Applied" \
  --score "87%"
```

### Programmatic Usage

```typescript
import { createSheetsLogger } from './components/core/src/integrations/sheets-logger';

// Initialize from .env
const logger = createSheetsLogger();

// Log a job analysis
await logger.logJobAnalysis(jobId, jobListing, score, jobUrl, {
  origin: 'LinkedIn',
  threshold: 75
});

// Update status when you apply
await logger.markAsApplied(jobId, resumeUrl);

// Mark as interview
await logger.markAsInterview(jobId, 'Phone screen Friday 2pm');

// Track who got hired (for competitive analysis)
await logger.recordWhoGotHired(jobId, 'John Doe', linkedinUrl);
```

### Integration with Job Scoring

```typescript
// In your job scoring workflow
const result = await scoreJob(jobUrl);

// Automatically log to sheets
const logger = createSheetsLogger();
if (logger) {
  await logger.logJobAnalysis(
    result.jobId,
    result.data,
    result.score,
    jobUrl
  );
}
```

## 📁 Files Created

| File | Purpose |
|------|---------|
| `components/core/src/utils/google-sheets.ts` | Core Google Sheets client |
| `components/core/src/integrations/sheets-logger.ts` | High-level logging API |
| `scripts/add-job-to-sheet.ts` | CLI tool to add jobs manually |
| `scripts/test-sheets-integration.ts` | Test/verify the integration |
| `examples/sheets-integration-example.ts` | Code examples |
| `docs/google-sheets-integration.md` | Full documentation |

## 🔧 Troubleshooting

### "GOOGLE_REFRESH_TOKEN not found"

**Solution:** Run `npm run setup-gmail` to authenticate

### "Invalid grant" or token expired

**Solution:** Re-run `npm run setup-gmail` to refresh your token

### "Sheet 'Sheet1' not found"

**Solution:** Update `GOOGLE_SHEETS_SHEET_NAME` in `.env` to match your actual sheet tab name

### Row appears in wrong location

**Issue:** The integration inserts at row 2 (below headers in row 1)

**Solution:** Ensure row 1 contains your headers

## 🎨 Customization

### Change Insert Location

By default, new jobs are inserted at the **top** (row 2, below headers). To append to the bottom instead:

```typescript
// Instead of insertRowAtTop
await client.appendRow(spreadsheetId, sheetName, jobData);
```

### Disable for Specific Commands

```typescript
// Temporarily disable
const logger = new SheetsLogger({
  spreadsheetUrl: process.env.GOOGLE_SHEETS_URL!,
  sheetName: 'Sheet1',
  enabled: false // Disable
});
```

### Custom Column Mapping

Edit `components/core/src/utils/google-sheets.ts` to change the column order or add new fields.

## 📚 Full Documentation

See [docs/google-sheets-integration.md](docs/google-sheets-integration.md) for:
- Detailed API reference
- Advanced usage patterns
- Error handling
- Integration examples

## 🔐 Security Notes

- OAuth tokens are stored in `.env` (make sure it's in `.gitignore`)
- Tokens grant **read/write** access to your Google Sheets
- Tokens grant **read-only** access to your Gmail
- Tokens can be revoked at: https://myaccount.google.com/permissions

## 🚦 Next Steps

1. ✅ Run `npm run setup-gmail` to authenticate
2. ✅ Add `GOOGLE_SHEETS_URL` to your `.env`
3. ✅ Run `ts-node scripts/test-sheets-integration.ts` to verify
4. ✅ Integrate into your job scoring workflow

Happy tracking! 📊
