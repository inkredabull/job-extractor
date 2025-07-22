# Job Extractor Chrome Extension

A Chrome extension companion for the Job Extractor CLI tool that provides a right-side gutter panel for job application assistance.

## Features

- **Right Gutter Panel**: Opens at 33% of screen width on the right side
- **Hello World Display**: Shows welcome message and feature preview
- **Keyboard Shortcut**: `Ctrl+Shift+J` (or `Cmd+Shift+J` on Mac) to toggle the panel
- **Popup Control**: Click the extension icon to open/close the panel
- **Responsive Design**: Adapts to different screen sizes

## Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `extension` directory
4. The extension will appear in your extensions toolbar

## Usage

### Opening/Closing the Panel

**Method 1: Extension Popup**
- Click the 🎯 Job Extractor Assistant icon in your browser toolbar
- Click "Open Assistant Panel" or "Close Assistant Panel"

**Method 2: Keyboard Shortcut**
- Press `Ctrl+Shift+J` (Windows/Linux) or `Cmd+Shift+J` (Mac)
- This toggles the panel open/closed

**Method 3: Close Button**
- When the panel is open, click the "×" button in the panel header

### Current Features

- **Welcome Message**: Displays "Hello World!" and introduction
- **Feature Preview**: Shows upcoming functionality
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
├── popup.html         # Popup interface
├── popup.js          # Popup functionality
├── content.js        # Content script (main functionality)
├── content.css       # Styling for the gutter panel
├── background.js     # Background service worker
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

**Popup (`popup.html/js`)**
- Provides browser toolbar interface
- Communicates with content script to control panel state

**Background Script (`background.js`)**
- Handles extension installation and settings
- Provides messaging infrastructure for future features

### Future Integration

This extension is designed to integrate with the Job Extractor CLI tool's functionality:

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