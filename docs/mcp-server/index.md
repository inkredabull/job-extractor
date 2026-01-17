# MCP Server

Model Context Protocol server for secure CV data access.

## Overview

The MCP server provides a secure, local-only interface for accessing CV information. It follows the Model Context Protocol standard for tool-based CV queries.

## Features

- **Privacy-First**: All data stays local, no remote storage
- **Tool-Based Interface**: Standard MCP tools for CV access
- **LLM Support**: Optional Claude 3.5 integration for intelligent responses
- **Pattern Matching**: Fallback pattern-matching when LLM is unavailable

## Installation

```bash
npm install
```

## Usage

```bash
# Start MCP server (pattern matching)
npm run start

# Start with LLM support
npm run start:llm
```

## Tools

The server provides the following MCP tools:

- `read_cv`: Read full CV content
- `search_cv_experience`: Search for specific experience
- `answer_cv_question`: Answer questions based on CV

## Configuration

Set `ANTHROPIC_API_KEY` in your `.env` file to enable LLM support.

## Source Code

[View on GitHub](https://github.com/inkredabull/job-extractor/tree/main/packages/mcp-server)
