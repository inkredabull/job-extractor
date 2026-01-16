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
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

class CVMCPServer {
  constructor(useLLM = false) {
    this.useLLM = useLLM;
    this.anthropic = null;
    
    if (this.useLLM) {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error('ERROR: ANTHROPIC_API_KEY not found in environment variables');
        console.error('Please set ANTHROPIC_API_KEY in your .env file to use Claude 3.5');
        process.exit(1);
      }
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('🧠 Claude 3.5 Sonnet LLM enabled for CV responses');
    } else {
      console.log('📝 Using pattern-matching for CV responses (use --llm flag to enable Claude)');
    }
    
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
            description: 'Answer a question about the CV content and work history, optionally with job description context',
            inputSchema: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'Question about work experience, skills, accomplishments, or background',
                },
                jobDescription: {
                  type: 'string',
                  description: 'Job description context to frame the response (optional)',
                },
              },
              required: ['question'],
            },
          },
          {
            name: 'analyze_job_posting',
            description: 'Analyze a job posting from a webpage and provide insights based on CV match',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL of the job posting to analyze',
                },
                pageContent: {
                  type: 'string',
                  description: 'HTML content of the job posting page (optional, will fetch if not provided)',
                },
                question: {
                  type: 'string',
                  description: 'Specific question about the job posting (optional)',
                },
              },
              required: ['url'],
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
            return await this.answerCVQuestion(args.question, args.jobDescription);
            
          case 'analyze_job_posting':
            return await this.analyzeJobPosting(args.url, args.pageContent, args.question);
            
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
      const lines = content.split('\n');
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
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${matchingLines.length} matches for "${query}":\n\n${results}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to search CV: ${error.message}`);
    }
  }

  async answerCVQuestion(question, jobDescription = '') {
    try {
      console.log('  -> answerCVQuestion called with:', question, jobDescription ? '(with job context)' : '(no job context)');
      const cvContent = await this.readCV();
      console.log('  -> CV content loaded, length:', cvContent.content[0].text.length);
      const content = cvContent.content[0].text;
      
      let response;
      
      if (this.useLLM && this.anthropic) {
        console.log('  -> Using Claude 3.5 Sonnet for response generation...');
        response = await this.generateLLMResponse(question, content, jobDescription);
        console.log('  -> Claude response generated, length:', response.length);
      } else {
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
        console.log('  -> Generating pattern-based CV response...');
        response = this.generateCVResponse(question, sections, jobDescription);
        console.log('  -> Pattern-based response generated, length:', response.length);
      }
      
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
  
  async generateLLMResponse(question, cvContent, jobDescription = '') {
    try {
      // Build context-aware prompt
      const jobContextSection = jobDescription.trim() ? `

Job Description Context:
${jobDescription}

IMPORTANT: Frame your response considering the requirements and vocabulary from this job description. Use similar terminology and emphasize experiences that align with the role.` : '';

      const prompt = `You are responding to an interview question as the person whose CV/resume is provided below. Answer in first person voice as if you are this person being interviewed. Be specific and reference actual accomplishments from the CV when relevant.

CV/Resume:
${cvContent}${jobContextSection}

Interview Question: ${question}

IMPORTANT: Keep your response between 200-400 characters. Be concise, direct, and impactful. Focus on the most relevant accomplishment or experience that answers the question.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 150,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      console.error('  -> Claude API error:', error);
      // Fallback to pattern-based response
      console.log('  -> Falling back to pattern-based response due to LLM error');
      const sections = this.parseCV(cvContent);
      return this.generateCVResponse(question, sections);
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
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
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
          sections.strengths.push(line.replace(/^\*\s*/, '')); // Remove bullet points
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

  async analyzeJobPosting(url, pageContent, question) {
    try {
      console.log('  -> analyzeJobPosting called with:', { url, hasContent: !!pageContent, question });
      
      // Get CV content for comparison
      const cvContent = await this.readCV();
      const cvText = cvContent.content[0].text;
      const cvSections = this.parseCV(cvText);
      
      // Fetch job posting content if not provided
      let jobContent = pageContent;
      if (!jobContent) {
        console.log('  -> Fetching job posting content from URL...');
        try {
          const https = require('https');
          const http = require('http');
          const urlLib = url.startsWith('https:') ? https : http;
          
          jobContent = await new Promise((resolve, reject) => {
            const req = urlLib.get(url, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.setTimeout(10000, () => reject(new Error('Request timeout')));
          });
        } catch (error) {
          console.error('  -> Failed to fetch job posting:', error);
          return {
            content: [{
              type: 'text',
              text: `Unable to fetch job posting from ${url}. Error: ${error.message}`
            }]
          };
        }
      }
      
      console.log('  -> Job content length:', jobContent.length);
      
      // Extract and clean job posting content
      const jobData = this.extractJobInfo(jobContent);
      
      let response;
      if (this.useLLM && this.anthropic) {
        console.log('  -> Using Claude 3.5 Sonnet for job analysis...');
        response = await this.generateJobAnalysisLLMResponse(jobData, cvSections, question);
      } else {
        console.log('  -> Using pattern-based job analysis...');
        response = this.generateJobAnalysisResponse(jobData, cvSections, question);
      }
      
      return {
        content: [{
          type: 'text',
          text: response
        }]
      };
      
    } catch (error) {
      console.error('  -> analyzeJobPosting error:', error);
      throw new Error(`Failed to analyze job posting: ${error.message}`);
    }
  }
  
  extractJobInfo(htmlContent) {
    // Simple HTML parsing to extract job information
    const jobData = {
      title: '',
      company: '',
      location: '',
      description: '',
      requirements: [],
      benefits: []
    };
    
    // Remove script and style tags
    const cleanContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                   .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Extract text content
    const textContent = cleanContent.replace(/<[^>]*>/g, ' ')
                                   .replace(/\s+/g, ' ')
                                   .trim();
    
    // Try to extract job title (common patterns)
    const titlePatterns = [
      /<title[^>]*>([^<]*)/i,
      /<h1[^>]*>([^<]*)/i,
      /job.?title[^>]*>([^<]*)/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        jobData.title = match[1].trim();
        break;
      }
    }
    
    // Extract company name (common patterns)
    const companyPatterns = [
      /company[^>]*>([^<]*)/i,
      /employer[^>]*>([^<]*)/i
    ];
    
    for (const pattern of companyPatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        jobData.company = match[1].trim();
        break;
      }
    }
    
    // Use full text as description
    jobData.description = textContent.slice(0, 5000); // Limit length
    
    return jobData;
  }
  
  generateJobAnalysisResponse(jobData, cvSections, question) {
    const analysis = this.analyzeJobMatch(jobData, cvSections);
    
    if (question) {
      const lowerQuestion = question.toLowerCase();
      
      if (lowerQuestion.includes('salary') || lowerQuestion.includes('compensation')) {
        return `**Salary Analysis:**
${analysis.salaryEstimate}

**Market Context:**
Based on the job requirements and location, this role typically offers competitive compensation in the market range.`;
      }
      
      if (lowerQuestion.includes('interview') || lowerQuestion.includes('prepare')) {
        return `**Interview Preparation:**

**Key areas to highlight:**
${analysis.strengths.map(s => `• ${s}`).join('\n')}

**Potential questions to prepare for:**
• Technical challenges you've solved
• Leadership experience examples
• How you handle scalability issues
• Your approach to team collaboration`;
      }
      
      if (lowerQuestion.includes('fit') || lowerQuestion.includes('match')) {
        return `**Job Fit Analysis:**

**Strong Matches:**
${analysis.strengths.map(s => `• ${s}`).join('\n')}

**Areas to Address:**
${analysis.gaps.map(g => `• ${g}`).join('\n')}

**Overall Assessment:** ${analysis.overallMatch}`;
      }
    }
    
    // Default comprehensive analysis
    return `**Job Analysis:**

**Position:** ${jobData.title || 'Software Engineering Role'}
**Company:** ${jobData.company || 'Technology Company'}

**CV Match Strengths:**
${analysis.strengths.map(s => `• ${s}`).join('\n')}

**Potential Gaps to Address:**
${analysis.gaps.map(g => `• ${g}`).join('\n')}

**Recommendation:** ${analysis.overallMatch}`;
  }
  
  analyzeJobMatch(jobData, cvSections) {
    const jobText = (jobData.description || '').toLowerCase();
    const strengths = [];
    const gaps = [];
    
    // Analyze technical match
    const techKeywords = ['javascript', 'react', 'node', 'python', 'data', 'ai', 'ml', 'api', 'database'];
    const foundTechSkills = techKeywords.filter(keyword => jobText.includes(keyword));
    
    if (foundTechSkills.length > 0) {
      strengths.push(`Technical skills alignment with ${foundTechSkills.join(', ')}`);
    }
    
    // Analyze leadership match
    if (jobText.includes('lead') || jobText.includes('senior') || jobText.includes('architect')) {
      const hasLeadership = cvSections.accomplishments.some(acc => 
        acc.toLowerCase().includes('led') || acc.toLowerCase().includes('managed')
      );
      if (hasLeadership) {
        strengths.push('Leadership experience matches senior role requirements');
      } else {
        gaps.push('Limited leadership experience for senior role');
      }
    }
    
    // Analyze experience level
    if (jobText.includes('5+ years') || jobText.includes('senior')) {
      strengths.push('Experience level matches senior requirements');
    }
    
    // Default gaps if none found
    if (gaps.length === 0) {
      gaps.push('Consider highlighting specific achievements that match job requirements');
    }
    
    // Default strengths if none found
    if (strengths.length === 0) {
      strengths.push('Strong technical background applicable to this role');
      strengths.push('Proven track record of delivering results');
    }
    
    const overallMatch = strengths.length >= gaps.length ? 
      'Strong candidate - recommend applying with targeted cover letter' :
      'Good potential - address gaps in application materials';
    
    return {
      strengths,
      gaps,
      overallMatch,
      salaryEstimate: 'Competitive salary expected based on role requirements and seniority level'
    };
  }
  
  async generateJobAnalysisLLMResponse(jobData, cvSections, question) {
    try {
      const cvText = `KEY ACCOMPLISHMENTS
${cvSections.accomplishments.join('\n')}

STRENGTHS  
${cvSections.strengths.join('\n')}`;

      const prompt = `You are a career advisor analyzing a job posting against a candidate's CV. Provide specific, actionable insights.

CV/Resume:
${cvText}

Job Posting Information:
Title: ${jobData.title || 'Not specified'}
Company: ${jobData.company || 'Not specified'}  
Description: ${jobData.description.slice(0, 2000)}

${question ? `Specific Question: ${question}` : ''}

IMPORTANT: Keep your response between 200-400 characters. Be concise and focus on the most critical insights: key strengths to highlight and one major gap to address.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 150,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      console.error('  -> Claude API error in job analysis:', error);
      // Fallback to pattern-based response
      return this.generateJobAnalysisResponse(jobData, cvSections, question);
    }
  }
  
  generateCVResponse(question, sections, jobDescription = '') {
    const lowerQuestion = question.toLowerCase();
    const jobContext = jobDescription.trim() ? `\n\n**Job Context Alignment:**\nThis aligns with the job requirements: "${jobDescription.substring(0, 150)}..."` : '';
    
    // Technical details/delegation
    if (lowerQuestion.includes('technical details') || lowerQuestion.includes('delegate') || lowerQuestion.includes('involve yourself')) {
      const techAccomplishments = sections.accomplishments.filter(a =>
        a.toLowerCase().includes('technical') || a.toLowerCase().includes('platform') || 
        a.toLowerCase().includes('data') || a.toLowerCase().includes('ai') || a.toLowerCase().includes('system')
      );
      const teamStrengths = sections.strengths.filter(s =>
        s.toLowerCase().includes('leadership') || s.toLowerCase().includes('team') || s.toLowerCase().includes('collaboration')
      );
      
      return `I enjoy getting involved in architectural decisions, data modeling, and complex problem-solving challenges. From my experience:\n\n` +
        `**Technical Areas I Dive Into:**\n${techAccomplishments.length > 0 ? techAccomplishments.map(a => `• ${a}`).join('\n') : '• Platform architecture and scalability decisions\n• Data pipeline optimization\n• Performance bottlenecks and system design'}\n\n` +
        `**What I Delegate:**\n• Routine implementation tasks once the approach is clear\n• Unit testing and code reviews (with oversight)\n• Documentation and deployment processes\n\n` +
        `I believe in being hands-on with the complex technical decisions while empowering my team to own their implementations.${jobContext}`;
    }
    
    // Experience and accomplishments  
    if (lowerQuestion.includes('experience') || lowerQuestion.includes('work') || lowerQuestion.includes('job')) {
      return `Here are my key accomplishments and experience:\n\n` +
        `**My Key Accomplishments:**\n${sections.accomplishments.map(a => `• ${a}`).join('\n')}\n\n` +
        `**Experience Details:**\n${sections.experience.length > 0 ? sections.experience.map(e => `• ${e}`).join('\n') : 'See accomplishments above for detailed work history'}${jobContext}`;
    }
    
    // Skills and strengths
    if (lowerQuestion.includes('skill') || lowerQuestion.includes('strength') || lowerQuestion.includes('good at')) {
      return `My core strengths include:\n\n` +
        `${sections.strengths.map(s => `• ${s}`).join('\n')}${jobContext}`;
    }
    
    // Accomplishments
    if (lowerQuestion.includes('accomplishment') || lowerQuestion.includes('achievement') || lowerQuestion.includes('success')) {
      return `Here are my key accomplishments:\n\n` +
        `${sections.accomplishments.map(a => `• ${a}`).join('\n')}${jobContext}`;
    }
    
    // Leadership
    if (lowerQuestion.includes('leadership') || lowerQuestion.includes('lead') || lowerQuestion.includes('manage')) {
      const leadership = sections.accomplishments.filter(a => 
        a.toLowerCase().includes('led') || a.toLowerCase().includes('launched') || 
        a.toLowerCase().includes('drove') || a.toLowerCase().includes('delivered') || a.toLowerCase().includes('team')
      );
      const leadershipStrengths = sections.strengths.filter(s =>
        s.toLowerCase().includes('leadership') || s.toLowerCase().includes('communication') || s.toLowerCase().includes('team')
      );
      
      return `My leadership experience includes:\n\n` +
        `**Leadership Accomplishments:**\n${leadership.length > 0 ? leadership.map(l => `• ${l}`).join('\n') : sections.accomplishments.slice(0,3).map(a => `• ${a}`).join('\n')}\n\n` +
        `**My Leadership Style:**\n${leadershipStrengths.length > 0 ? leadershipStrengths.map(s => `• ${s}`).join('\n') : '• Technical leadership with strong communication\n• Collaborative approach to team management'}${jobContext}`;
    }
    
    // Technical/AI
    if (lowerQuestion.includes('technical') || lowerQuestion.includes('ai') || lowerQuestion.includes('technology')) {
      const techAccomplishments = sections.accomplishments.filter(a =>
        a.toLowerCase().includes('ai') || a.toLowerCase().includes('data') || 
        a.toLowerCase().includes('platform') || a.toLowerCase().includes('technical') || a.toLowerCase().includes('system')
      );
      
      return `My technical background includes:\n\n` +
        `${techAccomplishments.length > 0 ? techAccomplishments.map(t => `• ${t}`).join('\n') : sections.accomplishments.map(a => `• ${a}`).join('\n')}${jobContext}`;
    }
    
    // Default response with full context
    return `Based on my background:\n\n` +
      `**My Key Accomplishments:**\n${sections.accomplishments.map(a => `• ${a}`).join('\n')}\n\n` +
      `**My Core Strengths:**\n${sections.strengths.map(s => `• ${s}`).join('\n')}\n\n` +
      `I'd be happy to elaborate on how this relates to: "${question}"${jobContext}`;
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
            const { question, jobDescription } = JSON.parse(body);
            console.log('  -> Parsed question:', question);
            console.log('  -> Job description provided:', jobDescription ? 'Yes' : 'No');
            if (!question) {
              console.log('  -> ERROR: No question provided');
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Question parameter is required' }));
              return;
            }
            
            console.log('  -> Processing CV question with answerCVQuestion...');
            const response = await this.answerCVQuestion(question, jobDescription);
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
      
      if (req.method === 'POST' && parsedUrl.pathname === '/analyze-job') {
        console.log('  -> Job analysis request received');
        let body = '';
        req.on('data', chunk => {
          body += chunk;
          console.log(`  -> Received ${chunk.length} bytes of data`);
        });
        req.on('end', async () => {
          console.log(`  -> Full request body received (${body.length} bytes):`, body);
          try {
            const { url, pageContent, question } = JSON.parse(body);
            console.log('  -> Parsed job analysis request:', { url, hasContent: !!pageContent, question });
            if (!url) {
              console.log('  -> ERROR: No URL provided');
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'URL parameter is required' }));
              return;
            }
            
            console.log('  -> Processing job analysis with analyzeJobPosting...');
            const response = await this.analyzeJobPosting(url, pageContent, question);
            console.log('  -> Job analysis response generated:', response.content[0].text.slice(0, 100) + '...');
            
            const jsonResponse = { 
              success: true, 
              response: response.content[0].text 
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jsonResponse));
            console.log('  -> Job analysis response sent successfully');
          } catch (error) {
            console.error('  -> HTTP job analysis error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Failed to process job analysis',
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
      console.log('Response Mode:', this.useLLM ? 'Claude 3.5 Sonnet 🧠' : 'Pattern Matching 📝');
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

// Parse command line arguments
const args = process.argv.slice(2);
const useLLM = args.includes('--llm') || args.includes('--claude');

if (useLLM) {
  console.log('🤖 Starting CV MCP Server with Claude 3.5 Sonnet...');
} else {
  console.log('📚 Starting CV MCP Server with pattern-matching (use --llm to enable Claude)...');
}

// Run the server
const server = new CVMCPServer(useLLM);
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
