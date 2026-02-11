# Chrome Extension Architecture

## Overview

The Career Catalyst Chrome Extension is now organized into separate components with clear separation of concerns.

## Component Structure

```
extension/
├── components/
│   └── linkedin-networking/
│       └── linkedin-networking-content.js    # LinkedIn networking features
├── shared/
│   └── message-types.js                      # Shared message type constants
├── popup/
│   ├── popup.html                            # Settings UI
│   ├── popup.css                             # Settings styles
│   └── popup.js                              # Settings logic
├── background.js                             # Service worker & message handlers
├── content.js                                # Main job tracking content script
├── content.css                               # Job tracking styles
└── linkedin-inject.js                        # LinkedIn feed API interceptor
```

## Components

### 1. Job Tracker (Main Component)

**Files:** `content.js`, `content.css`

**Purpose:** Core job tracking and AI assistant functionality

**Features:**
- Job description extraction
- AI-powered interview assistance
- CV-aware question answering
- Third-person blurb generation
- Job tracking to unified server

**Triggers:** Loads on all URLs, shows panel when job sites detected

**Always Enabled:** Yes

### 2. LinkedIn Networking Component

**Files:** `components/linkedin-networking/linkedin-networking-content.js`

**Purpose:** LinkedIn connection extraction and networking features

**Features:**
- Company people page connection extraction
- Profile mutual connections detection
- LinkedIn feed post save monitoring
- Reminder creation for saved posts

**Triggers:** Only on LinkedIn URLs when enabled in settings

**Opt-In:** Yes (disabled by default, enable via popup settings)

**Context Menu Actions:**
- Right-click on LinkedIn company pages → "Extract LinkedIn Connections"
- Right-click on LinkedIn profiles → "Extract Mutual Connections"

### 3. Settings Popup

**Files:** `popup/popup.html`, `popup/popup.css`, `popup/popup.js`

**Purpose:** Extension configuration UI

**Features:**
- Toggle LinkedIn networking features
- View component status
- Settings persistence via Chrome storage

**Access:** Click extension icon in toolbar

## Message Flow

### Chrome Storage
- Settings stored in `chrome.storage.sync`
- `linkedInNetworkingEnabled`: Boolean toggle for LinkedIn features

### Message Types (shared/message-types.js)
```javascript
// Job Tracker
TRACK_JOB
GENERATE_BLURB
ASK_QUESTION

// LinkedIn Networking
EXTRACT_CONNECTIONS
EXTRACT_MUTUAL_CONNECTIONS
CREATE_LINKEDIN_POST_REMINDER

// Settings
GET_SETTINGS
UPDATE_SETTINGS
```

### Message Handlers (background.js)
- `trackJob` → Unified server `/extract` endpoint
- `generateBlurb` → Unified server `/generate-blurb` endpoint
- `askQuestion` → MCP server `/cv-question` endpoint
- `createLinkedInPostReminder` → iMCP reminder creation
- `extractLinkedInConnections` → Context menu action
- `extractMutualConnections` → Context menu action

## Content Script Injection

### Manifest V3 Configuration

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["content.css"],
    "run_at": "document_end"
  },
  {
    "matches": [
      "https://www.linkedin.com/in/*",
      "https://www.linkedin.com/company/*",
      "https://www.linkedin.com/feed/*",
      "https://www.linkedin.com/search/results/people/*"
    ],
    "js": ["components/linkedin-networking/linkedin-networking-content.js"],
    "run_at": "document_idle"
  },
  {
    "matches": ["https://www.linkedin.com/feed*"],
    "js": ["linkedin-inject.js"],
    "run_at": "document_start",
    "world": "MAIN"
  }
]
```

**Strategy:**
1. Job tracker loads on all URLs
2. LinkedIn networking only loads on LinkedIn URLs when enabled
3. LinkedIn inject script runs in MAIN world for API interception

## Context Menus

### Setup (background.js)
```javascript
chrome.contextMenus.create({
  id: 'extract-linkedin-connections',
  title: 'Extract LinkedIn Connections',
  contexts: ['page'],
  documentUrlPatterns: [
    'https://www.linkedin.com/company/*/people/*',
    'https://www.linkedin.com/company/*'
  ]
});

chrome.contextMenus.create({
  id: 'extract-mutual-connections',
  title: 'Extract Mutual Connections',
  contexts: ['page'],
  documentUrlPatterns: [
    'https://www.linkedin.com/in/*',
    'https://www.linkedin.com/search/results/people/*'
  ]
});
```

### Usage
1. Right-click on relevant LinkedIn page
2. Select context menu option
3. Component receives message and executes extraction

## Settings Management

### Reading Settings
```javascript
chrome.storage.sync.get(['linkedInNetworkingEnabled'], (result) => {
  const enabled = result.linkedInNetworkingEnabled || false;
  // Use setting...
});
```

### Writing Settings
```javascript
chrome.storage.sync.set({ linkedInNetworkingEnabled: true }, () => {
  console.log('Setting saved');
});
```

### Listening for Changes
```javascript
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.linkedInNetworkingEnabled) {
    const newValue = changes.linkedInNetworkingEnabled.newValue;
    // React to change...
  }
});
```

## Development Workflow

### Loading the Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `packages/chrome-extension/extension` directory

### Testing Components

**Job Tracker:**
1. Navigate to any job site (Lever, Greenhouse, etc.)
2. Panel should auto-open
3. Test job extraction and AI features

**LinkedIn Networking:**
1. Click extension icon → Enable LinkedIn networking
2. Navigate to LinkedIn company page
3. Right-click → "Extract LinkedIn Connections"
4. Check console for output

### Debugging
- Open DevTools on any page to see content script logs
- Open extension background page for service worker logs:
  - `chrome://extensions/` → Click "service worker" link
- Check popup console:
  - Right-click extension icon → Inspect popup

## Migration Notes

### Previous Architecture
- All LinkedIn code in main `content.js`
- Auto-triggered on page load (noisy)
- No user control or settings
- Mixed concerns (job tracking + networking)

### Current Architecture (Phase 1 & 2)
- Separate component for LinkedIn networking
- Opt-in via settings (disabled by default)
- Manual trigger via context menu
- Clear separation of concerns
- Conditional script loading

### Future Improvements (Phase 3+)
- Separate UI panel for LinkedIn networking results
- Connection history/tracking database
- CSV export functionality
- Better error handling and user feedback
- Analytics and usage metrics

## Best Practices

### Adding New Features

**Job Tracker Features:**
1. Add code to `content.js`
2. No settings required (always enabled)
3. Use existing message handlers

**LinkedIn Networking Features:**
1. Add code to `components/linkedin-networking/linkedin-networking-content.js`
2. Respect `linkedInNetworkingEnabled` setting
3. Add new message types if needed

**New Component:**
1. Create directory in `components/`
2. Add content script file
3. Update `manifest.json` with new content script entry
4. Add settings toggle in popup if needed
5. Document in this file

### Settings
- Always use `chrome.storage.sync` for persistence
- Provide sensible defaults
- Listen for changes with `chrome.storage.onChanged`
- Update UI immediately when settings change

### Context Menus
- Only show on relevant pages (use `documentUrlPatterns`)
- Keep labels concise and action-oriented
- Handle errors gracefully if content script not loaded

### Message Passing
- Use constants from `shared/message-types.js`
- Always return `true` from async message handlers
- Send response even on error
- Include error details in response

## Troubleshooting

### LinkedIn features not working
1. Check extension icon → Ensure "Enable LinkedIn networking features" is checked
2. Reload LinkedIn page after enabling
3. Check console for errors
4. Verify you're on a supported LinkedIn URL

### Context menu not appearing
1. Verify you're on correct URL pattern
2. Right-click on page content (not in omnibox)
3. Check background service worker logs
4. Reload extension if needed

### Settings not persisting
1. Check Chrome sync is enabled
2. Verify `chrome.storage.sync` permissions in manifest
3. Check for storage quota errors in console
4. Try `chrome.storage.local` as fallback

### Content script not loading
1. Check manifest.json `matches` patterns
2. Verify file paths are correct
3. Check for JavaScript syntax errors
4. Reload extension after changes

## Resources

- [Chrome Extension Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Context Menus](https://developer.chrome.com/docs/extensions/reference/contextMenus/)
- [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
