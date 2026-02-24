cd components/network-followups

# 1. Link to a new Google Sheet (creates the sheet + bound script, updates .clasp.json)
npx clasp login           # skip if already logged in
npx clasp create --type sheets --title "LinkedIn Network Followups"

# 2. Deploy the compiled code
npm run deploy            # runs webpack + clasp push

# 3. Open the sheet, then from Apps Script editor:
#    Run setupApiKey() → paste your Anthropic API key
#    Run setupTriggers() → creates the monthly 1st-of-month trigger
