# Job Extractor Monorepo

Welcome to the Job Extractor monorepo - an AI-powered career toolkit that delivers **10x improvement in job search efficiency**.

## Components

This monorepo contains the following components:

### [Core CLI Tool](./job-extractor-core/)
The main TypeScript CLI tool for job extraction, scoring, resume creation, and interview preparation.

**Features:**
- Job information extraction from URLs, HTML, or JSON
- Intelligent job scoring against personal criteria
- AI-powered resume tailoring and optimization
- Interview preparation materials generation
- Automated application form filling

[View Documentation →](./job-extractor-core/)

### [Chrome Extension](./chrome-extension/)
Browser extension for job application assistance and CV-aware responses.

**Features:**
- Page analysis and question detection
- CV-aware response generation
- Seamless web page integration

[View Documentation →](./chrome-extension/)

### [MCP Server](./mcp-server/)
Model Context Protocol server for secure CV data access.

**Features:**
- Secure, local-only CV information exposure
- Privacy-first design
- Tool-based interface for CV queries

[View Documentation →](./mcp-server/)

### [Unified Server](./unified-server/)
Combined server that merges CLI server and MCP server functionality.

**Features:**
- Single server for all functionality
- Express-based API
- CV response engine with LLM support

[View Documentation →](./unified-server/)

### [AMA App](./ama-app/)
React/Vite application (work in progress).

[View Documentation →](./ama-app/)

## Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run core CLI tool
npm run dev

# Start unified server
npm run unified-server
```

## Repository Structure

```
packages/
├── core/              # Main CLI tool and agents
├── chrome-extension/  # Browser extension
├── mcp-server/        # MCP server component
├── unified-server/    # Combined server
└── ama-app/          # React/Vite app
```

## Links

- **GitHub Repository**: [View on GitHub](https://github.com/inkredabull/job-extractor)
- **Core Component**: [packages/core/](https://github.com/inkredabull/job-extractor/tree/main/packages/core)
- **Chrome Extension**: [packages/chrome-extension/](https://github.com/inkredabull/job-extractor/tree/main/packages/chrome-extension)

## License

MIT
