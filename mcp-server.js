#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

class CVMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'cv-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_cv',
            description: 'Read the CV/resume content from cv.txt file',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'search_cv_experience',
            description: 'Search for specific experience, skills, or accomplishments in the CV',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (e.g., "JavaScript", "project management", "2023")',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'answer_cv_question',
            description: 'Answer a question about the CV content and work history',
            inputSchema: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'Question about work experience, skills, accomplishments, or background',
                },
              },
              required: ['question'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_cv':
            return await this.readCV();
          
          case 'search_cv_experience':
            return await this.searchCVExperience(args.query);
            
          case 'answer_cv_question':
            return await this.answerCVQuestion(args.question);
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error.message}`
        );
      }
    });
  }

  async readCV() {
    try {
      const cvPath = path.join(__dirname, 'cv.txt');
      console.log('  -> Attempting to read CV from:', cvPath);
      
      if (!fs.existsSync(cvPath)) {
        console.log('  -> cv.txt not found, checking for sample-cv.txt...');
        const samplePath = path.join(__dirname, 'sample-cv.txt');
        if (fs.existsSync(samplePath)) {
          console.log('  -> Using sample-cv.txt instead');
          const content = fs.readFileSync(samplePath, 'utf8');
          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
          };
        }
        throw new Error('Neither cv.txt nor sample-cv.txt found in project directory');
      }
      
      const content = fs.readFileSync(cvPath, 'utf8');
      console.log('  -> CV file read successfully, size:', content.length, 'bytes');
      
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      console.error('  -> readCV error:', error);
      throw new Error(`Failed to read CV: ${error.message}`);
    }
  }

  async searchCVExperience(query) {
    try {
      const cvContent = await this.readCV();
      const content = cvContent.content[0].text;
      
      // Simple search - find lines containing the query (case-insensitive)
      const lines = content.split('\\n');
      const matchingLines = lines
        .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
        .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))
        .filter(({ line }) => line.length > 0);
      
      if (matchingLines.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No matches found for "${query}" in the CV.`,
            },
          ],
        };
      }
      
      const results = matchingLines
        .map(({ line, lineNumber }) => `Line ${lineNumber}: ${line}`)
        .join('\\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${matchingLines.length} matches for "${query}":\\n\\n${results}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to search CV: ${error.message}`);
    }
  }

  async answerCVQuestion(question) {
    try {
      console.log('  -> answerCVQuestion called with:', question);
      const cvContent = await this.readCV();
      console.log('  -> CV content loaded, length:', cvContent.content[0].text.length);
      const content = cvContent.content[0].text;
      
      // Parse key sections from CV
      console.log('  -> Parsing CV sections...');
      const sections = this.parseCV(content);
      console.log('  -> CV sections parsed:', {
        name: sections.name,
        accomplishments: sections.accomplishments.length,
        strengths: sections.strengths.length,
        experience: sections.experience.length
      });
      
      // Generate contextual response based on question
      console.log('  -> Generating CV response...');
      const response = this.generateCVResponse(question, sections);
      console.log('  -> CV response generated, length:', response.length);
      
      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      console.error('  -> answerCVQuestion error:', error);
      throw new Error(`Failed to answer CV question: ${error.message}`);
    }
  }
  
  parseCV(content) {
    const sections = {
      name: '',
      contact: '',
      accomplishments: [],
      strengths: [],
      experience: [],
      skills: [],
    };
    
    const lines = content.split('\\n').map(line => line.trim()).filter(line => line);
    
    let currentSection = '';
    
    for (const line of lines) {
      if (line.includes('@') || line.includes('linkedin.com') || line.includes('+1')) {
        sections.contact = '[Contact information available]';
      } else if (line.toUpperCase().includes('KEY ACCOMPLISHMENTS')) {
        currentSection = 'accomplishments';
      } else if (line.toUpperCase().includes('STRENGTHS')) {
        currentSection = 'strengths';
      } else if (line.toUpperCase().includes('EXPERIENCE') || line.toUpperCase().includes('WORK')) {
        currentSection = 'experience';
      } else if (line.includes('___') || line === '') {
        // Skip dividers and empty lines
        continue;
      } else {
        // Add content to current section
        if (currentSection === 'accomplishments' && !line.toUpperCase().includes('ACCOMPLISHMENTS')) {
          sections.accomplishments.push(line);
        } else if (currentSection === 'strengths' && !line.toUpperCase().includes('STRENGTHS')) {
          sections.strengths.push(line.replace(/^\\*\\s*/, '')); // Remove bullet points
        } else if (currentSection === 'experience') {
          sections.experience.push(line);
        } else if (!sections.name && !currentSection && !line.includes('|') && !line.includes('@')) {
          // First non-contact line is likely the name
          sections.name = '[Name from CV]';
        }
      }
    }
    
    return sections;
  }
  
  generateCVResponse(question, sections) {
    const lowerQuestion = question.toLowerCase();
    
    // Experience and accomplishments
    if (lowerQuestion.includes('experience') || lowerQuestion.includes('work') || lowerQuestion.includes('job')) {
      return `Based on the CV, here are the key accomplishments and experience:\\n\\n` +
        `**Key Accomplishments:**\\n${sections.accomplishments.map(a => `• ${a}`).join('\\n')}\\n\\n` +
        `**Experience Details:**\\n${sections.experience.map(e => `• ${e}`).join('\\n')}`;
    }
    
    // Skills and strengths
    if (lowerQuestion.includes('skill') || lowerQuestion.includes('strength') || lowerQuestion.includes('good at')) {
      return `Based on the CV, here are the key strengths and skills:\\n\\n` +
        `${sections.strengths.map(s => `• ${s}`).join('\\n')}`;
    }
    
    // Accomplishments
    if (lowerQuestion.includes('accomplishment') || lowerQuestion.includes('achievement') || lowerQuestion.includes('success')) {
      return `Key accomplishments from the CV:\\n\\n` +
        `${sections.accomplishments.map(a => `• ${a}`).join('\\n')}`;
    }
    
    // Leadership
    if (lowerQuestion.includes('leadership') || lowerQuestion.includes('lead') || lowerQuestion.includes('manage')) {
      const leadership = sections.accomplishments.filter(a => 
        a.toLowerCase().includes('launched') || a.toLowerCase().includes('drove') || a.toLowerCase().includes('delivered')
      );
      const leadershipStrengths = sections.strengths.filter(s =>
        s.toLowerCase().includes('leadership') || s.toLowerCase().includes('communication') || s.toLowerCase().includes('team')
      );
      
      return `Leadership experience and qualities:\\n\\n` +
        `**Leadership Accomplishments:**\\n${leadership.map(l => `• ${l}`).join('\\n')}\\n\\n` +
        `**Leadership Strengths:**\\n${leadershipStrengths.map(s => `• ${s}`).join('\\n')}`;
    }
    
    // Technical/AI
    if (lowerQuestion.includes('technical') || lowerQuestion.includes('ai') || lowerQuestion.includes('technology')) {
      const techAccomplishments = sections.accomplishments.filter(a =>
        a.toLowerCase().includes('ai') || a.toLowerCase().includes('data') || a.toLowerCase().includes('platform')
      );
      
      return `Technical accomplishments and experience:\\n\\n` +
        `${techAccomplishments.map(t => `• ${t}`).join('\\n')}`;
    }
    
    // Default response with full context
    return `Based on the CV:\\n\\n` +
      `**Key Accomplishments:**\\n${sections.accomplishments.map(a => `• ${a}`).join('\\n')}\\n\\n` +
      `**Core Strengths:**\\n${sections.strengths.map(s => `• ${s}`).join('\\n')}\\n\\n` +
      `This provides a comprehensive overview to help answer your question: "${question}"`;
  }

  async run() {
    // Start HTTP server for Chrome extension
    this.startHTTPServer();
    
    // Also start MCP stdio server for CLI tools
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('CV MCP server running on stdio and HTTP port 3000');
  }
  
  startHTTPServer() {
    const server = http.createServer((req, res) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.headers['user-agent']?.slice(0, 50) || 'Unknown'}`);
      
      // Enable CORS for Chrome extension
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        console.log('  -> CORS preflight request');
        res.writeHead(200);
        res.end();
        return;
      }
      
      const parsedUrl = url.parse(req.url, true);
      
      if (req.method === 'GET' && parsedUrl.pathname === '/health') {
        console.log('  -> Health check request');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'CV MCP Server' }));
        console.log('  -> Health check response sent');
        return;
      }
      
      if (req.method === 'POST' && parsedUrl.pathname === '/cv-question') {
        console.log('  -> CV question request received');
        let body = '';
        req.on('data', chunk => {
          body += chunk;
          console.log(`  -> Received ${chunk.length} bytes of data`);
        });
        req.on('end', async () => {
          console.log(`  -> Full request body received (${body.length} bytes):`, body);
          try {
            const { question } = JSON.parse(body);
            console.log('  -> Parsed question:', question);
            if (!question) {
              console.log('  -> ERROR: No question provided');
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Question parameter is required' }));
              return;
            }
            
            console.log('  -> Processing CV question with answerCVQuestion...');
            const response = await this.answerCVQuestion(question);
            console.log('  -> CV response generated:', response.content[0].text.slice(0, 100) + '...');
            
            const jsonResponse = { 
              success: true, 
              response: response.content[0].text 
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jsonResponse));
            console.log('  -> CV question response sent successfully');
          } catch (error) {
            console.error('  -> HTTP CV question error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Failed to process CV question',
              details: error.message 
            }));
            console.log('  -> Error response sent');
          }
        });
        return;
      }
      
      // 404 for unknown endpoints
      console.log(`  -> 404 - Unknown endpoint: ${req.method} ${parsedUrl.pathname}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    });
    
    server.listen(3000, '127.0.0.1', () => {
      console.log('=====================================');
      console.log('🚀 CV MCP Server Started Successfully');
      console.log('=====================================');
      console.log('HTTP Server: http://localhost:3000');
      console.log('Available endpoints:');
      console.log('  GET  /health      - Server health check');
      console.log('  POST /cv-question - Answer CV questions');
      console.log('MCP stdio server also running for CLI tools');
      console.log('=====================================');
      console.log('Waiting for requests...\n');
    });
    
    server.on('error', (error) => {
      console.error('HTTP Server Error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error('Port 3000 is already in use. Please stop any other services on port 3000.');
        process.exit(1);
      }
    });
  }
}

// Run the server
const server = new CVMCPServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});