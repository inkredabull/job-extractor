# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth credentials for Gmail and Sheets integration.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown (top left)
3. Click "New Project"
4. Enter a project name (e.g., "Career Catalyst")
5. Click "Create"

## Step 2: Enable Required APIs

1. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Search for "Gmail API" and click on it
3. Click "Enable"
4. Go back and search for "Google Sheets API"
5. Click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to [APIs & Services > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Choose "External" (unless you have a Google Workspace account)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Career Catalyst (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact email**: Your email address
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Find and select these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/spreadsheets`
8. Click "Update" then "Save and Continue"
9. On the "Test users" page, click "Add Users"
10. Add your email address as a test user
11. Click "Save and Continue"
12. Review and click "Back to Dashboard"

## Step 4: Create OAuth 2.0 Credentials

1. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Desktop app" as the application type
4. Enter a name (e.g., "Career Catalyst Desktop")
5. Click "Create"

### ⚠️ IMPORTANT: Add Redirect URI

After creating the credentials, you **must** add the localhost redirect URI:

1. Click on the credential you just created to edit it
2. Under "Authorized redirect URIs", click "Add URI"
3. Add: `http://localhost:3000/oauth2callback`
4. Click "Save"

**Without this redirect URI, authentication will fail!**

## Step 5: Copy Credentials to .env

1. Click on your OAuth client to view details
2. Copy the **Client ID**
3. Copy the **Client secret**
4. Add them to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

## Step 6: Run the Setup Script

```bash
npm run setup-gmail
```

This will:
1. Start a local server on port 3000
2. Open your browser to Google's authorization page
3. Ask you to sign in and grant permissions
4. Automatically receive the authorization code
5. Exchange it for a refresh token
6. Display the refresh token for you to copy

Add the refresh token to your `.env`:

```bash
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
```

## Verification

Test that everything works:

```bash
# Test Gmail integration
npm run dev whogothired

# Test Sheets integration
ts-node scripts/test-sheets-integration.ts
```

## Troubleshooting

### "Error 400: invalid_request - OOB flow has been blocked"

**Cause**: The redirect URI is not configured correctly.

**Solution**:
1. Go to your OAuth credentials in Google Cloud Console
2. Click "Edit" on your Desktop app credential
3. Under "Authorized redirect URIs", ensure you have:
   - `http://localhost:3000/oauth2callback`
4. Click "Save" and try again

### "Error 403: access_denied"

**Cause**: Your app is not published or you're not added as a test user.

**Solution**:
1. Go to OAuth consent screen
2. Add your email as a test user
3. Try authenticating again

### "Error: redirect_uri_mismatch"

**Cause**: The redirect URI in the code doesn't match what's in Google Cloud Console.

**Solution**:
1. Verify the redirect URI in `scripts/setup-gmail-auth.js` is:
   ```javascript
   const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
   ```
2. Verify it matches exactly in Google Cloud Console (including the port)

### "Browser doesn't open automatically"

**Solution**: The URL will be printed in the terminal. Copy and paste it into your browser manually.

### "Port 3000 already in use"

**Solution**:
1. Stop any process using port 3000
2. Or edit `setup-gmail-auth.js` to use a different port
3. Update the redirect URI in Google Cloud Console to match

## Security Best Practices

1. **Never commit credentials**: Ensure `.env` is in your `.gitignore`
2. **Rotate tokens regularly**: If compromised, revoke and regenerate
3. **Minimal scopes**: Only request the permissions you need
4. **Test users only**: Keep app in "Testing" mode unless you need it published

## Revoking Access

To revoke access at any time:

1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "Career Catalyst" (or your app name)
3. Click "Remove Access"
4. Delete the `GOOGLE_REFRESH_TOKEN` from your `.env`

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
