# WhoGotHired Agent Setup Guide

The WhoGotHired Agent monitors Gmail rejection emails and tracks who got hired for those positions on LinkedIn.

## Features

- 🔍 **Gmail Integration**: Monitors emails with label `professional-search-whogothired`
- ⏰ **Smart Scheduling**: Starts checking 6 weeks after rejection, retries monthly
- 🎯 **LinkedIn Search**: Identifies who got hired for the same position
- 📊 **Tracking**: Maintains persistent state across runs
- 🔔 **Notifications**: Alerts when someone is found or search is abandoned

## Setup Requirements

### 1. Gmail API Setup

1. **Enable Gmail API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select a project
   - Enable Gmail API
   - Create credentials (OAuth 2.0 or Service Account)

2. **Create Gmail Label**:
   - In Gmail, create label: `professional-search-whogothired`
   - Apply this label to rejection emails you want to track

3. **Install Dependencies**:
   ```bash
   npm install googleapis google-auth-library
   ```

### 2. LinkedIn Integration (Choose One)

**Option A: LinkedIn API (Recommended)**
- Apply for LinkedIn API access
- Requires company verification for People Search API

**Option B: Web Scraping (Advanced)**
- Use tools like Puppeteer or Playwright
- Implement rate limiting and detection avoidance
- Handle LinkedIn's anti-bot measures

**Option C: Manual Integration**
- Agent generates search URLs for manual checking
- You manually report findings back to the system

### 3. Configuration

Create `.env` file with:
```bash
# Gmail API
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token

# LinkedIn API (if using)
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Notification Settings
NOTIFICATION_EMAIL=your@email.com
SLACK_WEBHOOK_URL=your_slack_webhook_url
```

## Usage

### Basic Commands

```bash
# Run the agent (check for new rejections and process scheduled checks)
npm run dev whogothired

# Check status and statistics
npm run dev whogothired:status

# Force check a specific company/position
npm run dev whogothired:check "Google" "Software Engineer"
```

### Automation

Set up a cron job to run the agent regularly:

```bash
# Add to crontab (runs daily at 9 AM)
0 9 * * * cd /path/to/job-extractor && npm run dev whogothired
```

## How It Works

### 1. Email Processing
- Fetches new emails with `professional-search-whogothired` label
- Parses rejection emails to extract:
  - Company name
  - Job title
  - Rejection date

### 2. Scheduling Logic
- **6 weeks**: Wait period before starting LinkedIn checks
- **Monthly**: Retry interval for LinkedIn searches
- **4 months**: Give up if position is too old
- **6 attempts**: Maximum retry count before giving up

### 3. LinkedIn Search
- Search for recent hires at the company
- Filter by job title similarity
- Check start dates around rejection timeframe
- Return match with confidence score

### 4. Notifications
- **Found**: When someone is identified as hired
- **Given Up**: When search is abandoned (too old or max retries)
- **Error**: When issues occur during processing

## Data Storage

The agent maintains state in `data/whogothired-tracker.json`:

```json
{
  "rejections": [
    {
      "id": "email_id",
      "subject": "Thank you for your interest...",
      "company": "Google",
      "jobTitle": "Software Engineer",
      "receivedDate": "2024-01-15T10:00:00Z",
      "lastChecked": "2024-03-01T10:00:00Z",
      "checkCount": 2,
      "status": "pending",
      "hiredPerson": {
        "name": "John Doe",
        "linkedinUrl": "https://linkedin.com/in/johndoe",
        "title": "Software Engineer",
        "startDate": "2024-02-01"
      }
    }
  ],
  "lastSync": "2024-03-15T10:00:00Z"
}
```

## Implementation TODO

The agent is currently a template. To make it functional:

### 1. Gmail Integration (`fetchGmailRejections`)
```typescript
// Implement Gmail API client
const gmail = google.gmail({ version: 'v1', auth });
const response = await gmail.users.messages.list({
  userId: 'me',
  labelIds: ['professional-search-whogothired'],
  q: `after:${lastSync.toISOString().split('T')[0]}`
});
```

### 2. LinkedIn Search (`searchLinkedInForHire`)
```typescript
// Option A: LinkedIn API
const linkedinApi = new LinkedInApi(accessToken);
const employees = await linkedinApi.searchPeople({
  company: rejection.company,
  title: rejection.jobTitle,
  startDateAfter: rejection.receivedDate
});

// Option B: Web Scraping
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(`https://linkedin.com/search/results/people/?keywords=${rejection.company}`);
```

### 3. Notifications (`sendNotification`)
```typescript
// Email notification
await nodemailer.sendMail({
  to: process.env.NOTIFICATION_EMAIL,
  subject: subject,
  text: message
});

// Slack notification
await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  body: JSON.stringify({ text: message })
});
```

## Privacy & Ethics

- **Respect LinkedIn Terms**: Follow rate limits and ToS
- **Data Privacy**: Store minimal personal information
- **Professional Use**: Only track professional networking data
- **Transparency**: Be clear about tracking purposes

## Troubleshooting

### Common Issues

1. **Gmail API Quota**: Implement exponential backoff
2. **LinkedIn Rate Limits**: Add delays between requests
3. **Parsing Failures**: Improve email parsing patterns
4. **False Positives**: Add manual verification step

### Debug Mode

```bash
# Run with debug logging
DEBUG=whogothired npm run dev whogothired

# Check specific email parsing
npm run dev whogothired:check "Company Name" "Job Title"
```

## Future Enhancements

- 🤖 **AI-Powered Parsing**: Use LLMs for better email parsing
- 🔍 **Multi-Platform Search**: Check other platforms beyond LinkedIn
- 📈 **Analytics**: Track hiring patterns and success rates
- 🎯 **Smart Matching**: Better algorithms for identifying correct hires
- 📱 **Mobile App**: Mobile interface for manual verification