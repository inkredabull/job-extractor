# Chrome Extension

Browser extension for job application assistance and CV-aware responses.

## Overview

The Chrome extension provides seamless integration with job application forms, offering CV-aware responses and automated assistance.

## Features

- **Page Analysis**: Automatically detects job application questions
- **CV-Aware Responses**: Generates responses based on your CV content
- **Privacy-First**: All CV data stays local, no remote storage
- **Seamless Integration**: Works without overlays or intrusive UI

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `packages/chrome-extension/extension` directory

## Usage

The extension automatically activates on job application pages. It:
- Analyzes form fields
- Generates CV-aware responses
- Provides one-click filling assistance

## Architecture

- **Background Service Worker**: CV parsing and response generation
- **Content Script**: Page analysis and question detection
- **MCP Integration**: Connects to local MCP server for CV data

## Source Code

[View on GitHub](https://github.com/inkredabull/career-catalyst/tree/main/packages/chrome-extension)
