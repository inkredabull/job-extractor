# Chrome Extension Quick Start

## Installation

1. **Load Extension in Developer Mode**
   ```bash
   # Navigate to Chrome extensions
   # chrome://extensions/
   
   # Enable "Developer mode" (top right toggle)
   # Click "Load unpacked"
   # Select: /Users/inkredabull/Code/inkredabull/job-extractor/extension/
   ```

2. **Start MCP Server** (for CV-aware responses)
   ```bash
   cd /Users/inkredabull/Code/inkredabull/job-extractor
   npm run mcp-server
   ```

## Usage

- **Open Panel**: Click extension icon or `Ctrl+Shift+J`
- **Ask Questions**: Type CV-related questions in the input field
- **Page Analysis**: Automatically detects questions on web pages
- **CV-Aware Responses**: Powered by your local cv.txt file

## Features

- ✅ **Right-side panel** at 33% screen width (doesn't overlay content)  
- ✅ **Page question detection** with bullet list display
- ✅ **CV-aware AI responses** using local MCP server
- ✅ **Privacy-first design** - no PII sent to remote servers
- ✅ **Keyboard shortcuts** and responsive design

Perfect for job hunting with personalized, CV-based assistance!