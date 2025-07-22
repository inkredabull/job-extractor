# MCP Server Quick Start

## What is the MCP Server?

The Model Context Protocol (MCP) server provides secure, local access to your CV data for AI applications like the Chrome extension. It's privacy-first - your personal information never leaves your machine.

## Starting the Server

```bash
cd /Users/inkredabull/Code/inkredabull/job-extractor
npm run mcp-server
```

## Available Tools

The MCP server exposes three tools for CV interaction:

### 1. `read_cv`
- **Purpose**: Read the complete CV content
- **Parameters**: None
- **Returns**: Full cv.txt file content

### 2. `search_cv_experience` 
- **Purpose**: Search for specific keywords in CV
- **Parameters**: `query` (string) - search term
- **Returns**: Matching lines with line numbers

### 3. `answer_cv_question`
- **Purpose**: Answer questions about work history/skills
- **Parameters**: `question` (string) - your question
- **Returns**: AI-generated response based on CV content

## Data Security

- ✅ **Local only** - server runs on your machine
- ✅ **No remote calls** - CV data never sent to external APIs
- ✅ **Privacy-first** - personal info stays private
- ✅ **12-factor compliant** - no PII in source code

## Integration

The Chrome extension automatically uses this server to provide CV-aware responses to your questions about work experience, skills, and accomplishments.