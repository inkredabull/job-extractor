# MCP Server Migration Note

**Date**: January 26, 2026

## Why the MCP Server Was Archived

The `packages/mcp-server` package has been archived because its functionality was fully consolidated into the unified server (`packages/unified-server`).

## Background

Previously, the architecture had two separate servers:

1. **MCP Server** (`packages/mcp-server`) - Provided CV-aware AI responses using Claude 3.5 Sonnet
2. **Unified Server** (`packages/unified-server`) - Handled job extraction and Chrome extension integration

This created several issues:
- **Port conflicts**: Both servers tried to use port 3000
- **Redundant functionality**: CVResponseEngine was duplicated
- **Confusion**: Users didn't know which server to run
- **Maintenance burden**: Changes needed to be made in two places

## The Solution

The unified server now includes a built-in `CVResponseEngine` class that handles all CV-aware AI responses. When run with the `--llm` flag via `npm run unified-server:llm`, it enables the full feature set:

- Job extraction from URLs and HTML
- CV-aware AI responses using Claude 3.5 Sonnet
- Chrome extension integration
- Secure local CV data access

## Migration Instructions

### Before (❌ Old Way)
```bash
# Don't do this - causes port conflicts
npm run unified-server:llm    # Port 3000
npm run mcp-server:llm        # Port 3000 (conflict!)
```

### After (✅ New Way)
```bash
# Only need one server
npm run unified-server:llm
```

## What Changed

### Unified Server Enhancement
The unified server (`packages/unified-server/unified-server.js`) now includes:

```javascript
class CVResponseEngine {
  constructor(anthropicApiKey) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
  }

  async generateLLMResponse(question, cvContent, jobDescription = '') {
    // Intelligent, job-specific responses using Claude 3.5 Sonnet
    // Comprehensive context (title, company, URL, description)
    // Specific prompts requiring company/role references
    // Temperature 0.8, max_tokens 250 for authentic voice
  }
}
```

### Chrome Extension
No changes needed - the extension already communicates with the unified server on port 3000.

### Configuration
The unified server loads the `.env` file from the project root, including:
- `ANTHROPIC_API_KEY` - For CV-aware AI responses
- Other environment variables remain unchanged

## Archived Files

The following package has been moved to `archive/mcp-server/`:
- `package.json` - MCP server package configuration
- `mcp-server.js` - Model Context Protocol server implementation
- `README.md` - Original MCP server documentation

These files are preserved for reference but are no longer part of the active codebase.

## Benefits of Consolidation

1. **Single Service**: One server to run, one port to manage
2. **No Conflicts**: Eliminates port 3000 conflicts
3. **Simpler Setup**: Users only need to run `npm run unified-server:llm`
4. **Easier Maintenance**: Changes only need to be made in one place
5. **Better Documentation**: Clear instructions with no confusion

## Related Changes

- [README.md](../README.md) - Updated to document single server architecture
- [package.json](../package.json) - Removed `mcp-server` and `mcp-server:llm` scripts
- Chrome extension - No changes needed (already uses unified server)

## Questions?

If you need to understand how the MCP server worked for historical reference, the archived code is available in `archive/mcp-server/`.

For current implementation details, see:
- `packages/unified-server/unified-server.js` - Main server implementation
- `packages/unified-server/README.md` - Unified server documentation
