# Unified Server

Combined server that merges CLI server and MCP server functionality.

## Overview

The unified server provides a single Express-based API that combines both CLI server and MCP server capabilities, making it easier to use all functionality from one endpoint.

## Features

- **Single Server**: One server for all functionality
- **Express API**: RESTful API endpoints
- **CV Response Engine**: Intelligent CV-based responses
- **LLM Support**: Optional Claude 3.5 integration

## Installation

```bash
npm install
```

## Usage

```bash
# Start server (pattern matching)
npm run start

# Start with LLM support
npm run start:llm
```

The server runs on port 3000 by default.

## API Endpoints

- `POST /cv/answer` - Answer CV-based questions
- `GET /health` - Health check

## Configuration

Set `ANTHROPIC_API_KEY` in your `.env` file to enable LLM support.

## Source Code

[View on GitHub](https://github.com/inkredabull/career-catalyst/tree/main/packages/unified-server)
