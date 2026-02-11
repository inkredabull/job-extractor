# Career Catalyst Chrome Extension

A Chrome extension companion for the Career Catalyst CLI tool that provides a right-side gutter panel for job application assistance.

## Features

- **Right Gutter Panel**: Opens at 33% of screen width on the right side
- **Hello World Display**: Shows welcome message and feature preview
- **Keyboard Shortcut**: `Ctrl+Shift+J` (or `Cmd+Shift+J` on Mac) to toggle the panel
- **Popup Control**: Click the extension icon to open/close the panel
- **Responsive Design**: Adapts to different screen sizes

## Installation (Developer Mode)

1. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

2. Start the CLI server (required for Extract functionality):
   ```bash
   npm run cli-server
   ```
   This runs a local server on http://localhost:3001 that executes CLI commands.

3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked" and select the `extension` directory
6. The extension will appear in your extensions toolbar

## Usage

### Opening/Closing the Panel

**Method 1: Browser Icon Click**
- Click the 🎯 Career Catalyst Assistant icon in your browser toolbar
- The panel will toggle open/closed directly (no popup required)

**Method 2: Keyboard Shortcut**
- Press `Ctrl+Shift+J` (Windows/Linux) or `Cmd+Shift+J` (Mac)
- This toggles the panel open/closed

**Method 3: Close Button**
- When the panel is open, click the "×" button in the panel header

### Current Features

- **Extract Section**: One-click job extraction using the CLI tool
  - Click "Extract" button to run `npm run dev extract` on current URL
  - Shows real-time extraction status and results
  - Automatically populates job description when successful
- **AI Assistant**: Interactive Q&A with CV-aware responses
- **Job Description**: Auto-extracted and editable job description
- **Current URL Display**: Shows the URL of the current page
- **Responsive Layout**: Panel width adjusts based on screen size:
  - Large screens (>1200px): 33% width
  - Medium screens (900-1200px): 40% width  
  - Small screens (600-900px): 50% width
  - Mobile (<600px): 100% width

## Development

### File Structure
```
extension/
├── manifest.json       # Extension manifest (Manifest V3)
├── content.js        # Content script (main functionality)
├── content.css       # Styling for the gutter panel
├── background.js     # Background service worker
├── popup.html.unused # Former popup interface (unused)
├── popup.js.unused   # Former popup functionality (unused)
├── icons/            # Extension icons
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md         # This file
```

### Key Components

**Content Script (`content.js`)**
- Creates and manages the right gutter panel
- Handles show/hide animations
- Listens for messages from popup and keyboard shortcuts

**Browser Action**
- Clicking the extension icon directly toggles the panel
- No popup interface required - streamlined user experience

**Background Script (`background.js`)**
- Handles extension installation and settings
- Provides messaging infrastructure for future features

### Future Integration

This extension is designed to integrate with the Career Catalyst CLI tool's functionality:

- **Real-time job analysis** from the CLI's extraction agents
- **Application form assistance** using the CLI's form filling capabilities
- **Interview prep suggestions** from the CLI's interview preparation features
- **LinkedIn integration** leveraging the CLI's outreach functionality

## Technical Notes

- Built using **Manifest V3** (latest Chrome extension standard)
- Uses **CSS transitions** for smooth panel animations
- **Responsive design** with mobile-first approach
- **No external dependencies** - pure vanilla JavaScript
- **Cross-origin ready** - works on all websites

## Permissions

- `activeTab`: Access to the current tab for content script injection
- `storage`: For saving user preferences and settings