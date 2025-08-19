# WhoGotHired Gmail Setup Guide

Complete step-by-step guide to set up Gmail API integration for the WhoGotHired Agent.

## Step 1: Google Cloud Platform Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your project ID

### 1.2 Enable Gmail API
1. In GCP Console, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Enable**

### 1.3 Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. If prompted, configure OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields (App name, User support email, Developer email)
   - Add your email to Test users
   - Skip optional fields and save
4. For Application type, select **Desktop application**
5. Name it "WhoGotHired Agent"
6. Click **Create**
7. **Download** the JSON file or copy the Client ID and Client Secret

## Step 2: Environment Configuration

### 2.1 Update .env File
Add your OAuth credentials to `.env`:

```bash
# Gmail API OAuth Credentials
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=will_be_generated_in_next_step
```

### 2.2 Generate Refresh Token
Run the setup script to get your refresh token:

```bash
npm run setup-gmail
```

This will:
1. Generate an authorization URL
2. Open your browser to Google OAuth
3. Ask you to sign in and grant permissions
4. Provide an authorization code
5. Exchange the code for a refresh token
6. Display the refresh token to add to your `.env`

**Copy the refresh token** and update your `.env` file:

```bash
GOOGLE_REFRESH_TOKEN=1//0abc123def456ghi789...
```

## Step 3: Gmail Label Setup

### 3.1 Create the Label
1. Open [Gmail](https://mail.google.com)
2. In the left sidebar, click **More** → **Create new label**
3. Name it exactly: `professional-search-whogothired`
4. Click **Create**

### 3.2 Apply Label to Rejection Emails
For existing rejection emails:
1. Search Gmail for rejection emails (e.g., `"unfortunately" OR "not moving forward" OR "position has been filled"`)
2. Select relevant emails
3. Click the labels icon and apply `professional-search-whogothired`

For future emails:
1. Create Gmail filters to auto-apply the label
2. Go to Gmail Settings → **Filters and Blocked Addresses**
3. Click **Create a new filter**
4. Set criteria like:
   - **From**: contains common rejection senders
   - **Subject**: contains "unfortunately", "not moving forward", etc.
   - **Has the words**: "thank you for your interest" OR "position has been filled"
5. Click **Create filter**
6. Check **Apply the label** and select `professional-search-whogothired`

## Step 4: Test Setup

### 4.1 Test Gmail Connection
```bash
npm run dev whogothired:status
```

This should show:
- Connection to Gmail API
- Number of emails found with the label
- No errors about missing credentials

### 4.2 Test Email Fetching
```bash
npm run dev whogothired
```

This should:
- Connect to Gmail API
- Find emails with the label
- Parse company and job title information
- Show processing results

## Step 5: Verification

### 5.1 Check Data File
After running the agent, check if tracking data was created:

```bash
cat data/whogothired-tracker.json
```

Should show structure like:
```json
{
  "rejections": [
    {
      "id": "gmail_message_id",
      "subject": "Thank you for your interest in...",
      "company": "Google",
      "jobTitle": "Software Engineer",
      "receivedDate": "2024-01-15T10:00:00Z",
      "checkCount": 0,
      "status": "pending"
    }
  ],
  "lastSync": "2024-03-15T10:00:00Z"
}
```

### 5.2 Verify Parsing
Check that company names and job titles are being extracted correctly. If not, you may need to adjust the regex patterns in `parseRejectionEmail()`.

## Troubleshooting

### Common Issues

**"No GOOGLE_REFRESH_TOKEN found"**
- Run `npm run setup-gmail` to generate the refresh token
- Make sure you copied it correctly to `.env`

**"OAuth token expired"**
- Re-run `npm run setup-gmail` to get a new refresh token
- Update `.env` with the new token

**"Label not found"**
- Create the exact label: `professional-search-whogothired`
- Apply it to at least one rejection email

**"No emails found"**
- Check that emails have the correct label
- Verify emails are newer than the last sync date
- Look at Gmail search query in the logs

**"Permission denied"**
- Make sure OAuth consent screen is properly configured
- Add your email to test users if using external app type
- Grant Gmail read permissions during OAuth flow

### Debug Mode

For detailed logging, modify the agent to add debug output:

```typescript
console.log('Debug: Gmail query:', query);
console.log('Debug: Found messages:', messagesResponse.data);
console.log('Debug: Parsed email:', email);
```

### OAuth Scopes

The agent uses minimal scope for security:
- `https://www.googleapis.com/auth/gmail.readonly` - Read-only access to Gmail

If you need additional permissions, update the scope in `scripts/setup-gmail-auth.js`.

## Security Best Practices

1. **Secure .env**: Never commit `.env` file to git
2. **Minimal Scope**: Only request Gmail read permissions
3. **Token Rotation**: Refresh tokens occasionally for security
4. **Local Storage**: Keep credentials local, don't share
5. **Project Access**: Limit GCP project access to necessary users

## Next Steps

Once Gmail integration is working:

1. **Set up LinkedIn integration** (see main setup guide)
2. **Configure notifications** (email/Slack alerts)
3. **Set up automation** (cron job for daily runs)
4. **Test with real rejection emails**
5. **Monitor and tune parsing accuracy**

The agent is now ready to automatically track your job rejections and help you discover who got hired! 🎯