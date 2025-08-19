#!/usr/bin/env node

// Unified Server - Combines CLI server and MCP server functionality
const express = require('express');
const cors = require('cors');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = 3000; // Using port 3000 (was MCP server port)

// CV MCP Server functionality
class CVResponseEngine {
  constructor(useLLM = false) {
    this.useLLM = useLLM;
    this.anthropic = null;
    
    if (this.useLLM) {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error('WARNING: ANTHROPIC_API_KEY not found in environment variables');
        console.error('CV responses will use pattern-matching instead of Claude 3.5');
        this.useLLM = false;
      } else {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        console.log('🧠 Claude 3.5 Sonnet LLM enabled for CV responses');
      }
    }
    
    if (!this.useLLM) {
      console.log('📝 Using pattern-matching for CV responses (set ANTHROPIC_API_KEY for Claude)');
    }
  }

  async answerCVQuestion(question, jobDescription = '') {
    if (this.useLLM && this.anthropic) {
      return this.answerWithLLM(question, jobDescription);
    } else {
      return this.answerWithPatternMatching(question, jobDescription);
    }
  }

  async answerWithLLM(question, jobDescription = '') {
    try {
      const cvContent = this.loadCVContent();
      
      const contextPrompt = jobDescription 
        ? `Context: This question relates to a specific job opportunity: "${jobDescription.substring(0, 500)}..."`
        : '';
      
      const prompt = `You are an expert career consultant helping someone answer questions about their professional background. Based on the CV information below, please provide a comprehensive and compelling response to the question.

${contextPrompt}

CV Information:
${cvContent}

Question: ${question}

Please provide a detailed response that:
1. Draws specific examples from the CV
2. Highlights relevant achievements and quantifiable results
3. Shows clear connections between past experience and the question
4. Uses a professional, confident tone
5. Is tailored to showcase the candidate's strengths
${jobDescription ? '6. Relates the experience to the specific job opportunity mentioned' : ''}

Response:`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return {
        content: [{ text: response.content[0].text }]
      };
    } catch (error) {
      console.error('LLM Error:', error);
      // Fallback to pattern matching
      return this.answerWithPatternMatching(question, jobDescription);
    }
  }

  answerWithPatternMatching(question, jobDescription = '') {
    const cvData = this.parseCV();
    const questionType = this.classifyQuestion(question);
    
    const jobContext = jobDescription.trim() ? ` given this job opportunity: "${jobDescription.substring(0, 300)}..."` : '';
    
    const responses = {
      experience: () => this.generateExperienceResponse(cvData, jobContext),
      skills: () => this.generateSkillsResponse(cvData, jobContext),
      leadership: () => this.generateLeadershipResponse(cvData, jobContext),
      technical: () => this.generateTechnicalResponse(cvData, jobContext),
      default: () => this.generateDefaultResponse(cvData, question, jobContext)
    };
    
    const responseText = responses[questionType]();
    return {
      content: [{ text: responseText }]
    };
  }

  loadCVContent() {
    const possiblePaths = [
      'cv.txt',
      './cv.txt',
      'CV.txt', 
      './CV.txt',
      'sample-cv.txt',
      './sample-cv.txt'
    ];
    
    for (const cvPath of possiblePaths) {
      try {
        if (fs.existsSync(cvPath)) {
          return fs.readFileSync(cvPath, 'utf-8');
        }
      } catch (error) {
        continue;
      }
    }
    
    // Return sample CV if none found
    return `KEY ACCOMPLISHMENTS

Built scalable web applications serving 10K+ users with 99.9% uptime
Led cross-functional team of 5 engineers to deliver product features ahead of schedule
Implemented automated testing pipeline reducing deployment time by 60%
Optimized database queries improving application performance by 40%

STRENGTHS

* Technical Leadership - Guides engineering teams through complex technical challenges
* Problem Solving - Analyzes issues systematically and implements effective solutions
* Communication - Translates technical concepts for both technical and non-technical stakeholders  
* Continuous Learning - Stays current with emerging technologies and industry best practices
* Collaboration - Works effectively across departments to achieve shared business goals`;
  }

  parseCV() {
    const content = this.loadCVContent();
    const sections = {
      name: '',
      accomplishments: [],
      strengths: [],
      experience: []
    };
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    let currentSection = '';
    
    for (const line of lines) {
      if (line.toUpperCase().includes('KEY ACCOMPLISHMENTS') || line.toUpperCase().includes('ACCOMPLISHMENTS')) {
        currentSection = 'accomplishments';
      } else if (line.toUpperCase().includes('STRENGTHS')) {
        currentSection = 'strengths';
      } else if (line.toUpperCase().includes('EXPERIENCE') || line.toUpperCase().includes('WORK')) {
        currentSection = 'experience';
      } else if (line.includes('___') || line === '' || line.includes('@') || line.includes('+1')) {
        continue;
      } else if (!line.toUpperCase().includes('ACCOMPLISHMENTS') && !line.toUpperCase().includes('STRENGTHS')) {
        if (currentSection === 'accomplishments') {
          sections.accomplishments.push(line);
        } else if (currentSection === 'strengths') {
          sections.strengths.push(line.replace(/^\*\s*/, ''));
        } else if (currentSection === 'experience') {
          sections.experience.push(line);
        } else if (!sections.name && !line.includes('|') && !line.includes('@')) {
          sections.name = line;
        }
      }
    }
    
    return sections;
  }

  classifyQuestion(question) {
    const lowerQuestion = question.toLowerCase();
    
    const questionTypes = [
      { keywords: ['experience', 'work', 'job', 'career', 'background'], type: 'experience' },
      { keywords: ['skill', 'strength', 'good at', 'expertise', 'ability'], type: 'skills' },
      { keywords: ['leadership', 'lead', 'manage', 'team', 'management'], type: 'leadership' },
      { keywords: ['technical', 'ai', 'technology', 'engineering', 'development'], type: 'technical' }
    ];
    
    for (const { keywords, type } of questionTypes) {
      if (keywords.some(keyword => lowerQuestion.includes(keyword))) {
        return type;
      }
    }
    
    return 'default';
  }

  generateExperienceResponse(cvData, jobContext = '') {
    const experienceAreas = this.extractExperienceAreas(cvData.accomplishments);
    const contextSuffix = jobContext ? `\n\nThis background aligns well${jobContext}` : '';
    
    return `Based on the CV, here are key work experiences:\n\n${this.formatBulletList(cvData.accomplishments)}\n\nStrong experience in ${experienceAreas.join(', ')} with measurable business impact.${contextSuffix}`;
  }

  generateSkillsResponse(cvData, jobContext = '') {
    const contextSuffix = jobContext ? `\n\nThese skills are particularly relevant${jobContext}` : '';
    
    return `Core strengths include:\n\n${this.formatBulletList(cvData.strengths)}\n\nExcels at combining technical leadership with strong communication and process optimization.${contextSuffix}`;
  }

  generateLeadershipResponse(cvData, jobContext = '') {
    const leadershipKeywords = ['launched', 'drove', 'delivered', 'led', 'managed'];
    const communicationKeywords = ['leadership', 'communication', 'collaboration'];
    
    const leadershipAccomplishments = this.filterByKeywords(cvData.accomplishments, leadershipKeywords);
    const leadershipStrengths = this.filterByKeywords(cvData.strengths, communicationKeywords);
    const contextSuffix = jobContext ? `\n\nThis leadership experience directly applies${jobContext}` : '';
    
    return `Demonstrates strong leadership through:\n\n**Accomplishments:**\n${this.formatBulletList(leadershipAccomplishments)}\n\n**Leadership Style:**\n${this.formatBulletList(leadershipStrengths)}${contextSuffix}`;
  }

  generateTechnicalResponse(cvData, jobContext = '') {
    const techKeywords = ['ai', 'data', 'platform', 'technical', 'system', 'application'];
    const techAccomplishments = this.filterByKeywords(cvData.accomplishments, techKeywords);
    const contextSuffix = jobContext ? `\n\nThis technical expertise is well-suited${jobContext}` : '';
    
    return `Technical background and achievements:\n\n${this.formatBulletList(techAccomplishments.length > 0 ? techAccomplishments : cvData.accomplishments)}\n\nCombines technical depth with business impact and measurable results.${contextSuffix}`;
  }

  generateDefaultResponse(cvData, question, jobContext = '') {
    const contextSuffix = jobContext ? `\n\nThis expertise is particularly relevant${jobContext}` : '';
    
    return `Based on the CV:\n\n**Key Accomplishments:**\n${this.formatBulletList(cvData.accomplishments)}\n\n**Core Strengths:**\n${this.formatBulletList(cvData.strengths)}\n\nThis provides expertise relevant to: "${question}"${contextSuffix}`;
  }

  formatBulletList(items) {
    return items.map(item => `• ${item}`).join('\n');
  }

  filterByKeywords(items, keywords) {
    return items.filter(item => 
      keywords.some(keyword => item.toLowerCase().includes(keyword))
    );
  }

  extractExperienceAreas(accomplishments) {
    const areas = new Set();
    
    accomplishments.forEach(acc => {
      const lower = acc.toLowerCase();
      if (lower.includes('marketplace')) areas.add('marketplace development');
      if (lower.includes('ai')) areas.add('AI implementation');
      if (lower.includes('data') && lower.includes('platform')) areas.add('data platform creation');
      if (lower.includes('productivity')) areas.add('productivity optimization');
      if (lower.includes('arr')) areas.add('revenue growth');
    });
    
    return Array.from(areas);
  }
}

// Initialize CV response engine
const cvEngine = new CVResponseEngine(process.argv.includes('--llm'));

// Enable CORS for Chrome extension
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  console.log(`[${new Date().toISOString()}] Health check request`);
  res.json({ 
    status: 'ok', 
    message: 'Unified server is running',
    services: ['CLI', 'MCP', 'CV'],
    llm: cvEngine.useLLM ? 'enabled' : 'disabled'
  });
});

// CV Question endpoint (from MCP server)
app.post('/cv-question', async (req, res) => {
  console.log(`[${new Date().toISOString()}] CV question request`);
  try {
    const { question, jobDescription } = req.body;
    console.log('  -> Question:', question);
    console.log('  -> Job description provided:', jobDescription ? 'Yes' : 'No');
    
    if (!question) {
      console.log('  -> ERROR: No question provided');
      return res.status(400).json({ error: 'Question parameter is required' });
    }
    
    console.log('  -> Processing CV question...');
    const response = await cvEngine.answerCVQuestion(question, jobDescription);
    console.log('  -> CV response generated:', response.content[0].text.slice(0, 100) + '...');
    
    const jsonResponse = { 
      success: true, 
      response: response.content[0].text 
    };
    
    res.json(jsonResponse);
    console.log('  -> CV question response sent successfully');
  } catch (error) {
    console.error('  -> CV question error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Extract endpoint (from CLI server)
app.post('/extract', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Extract request`);
  try {
    const { url, type, data } = req.body;
    
    // Handle different extraction types
    if (type === 'json') {
      // Handle JSON extraction
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Job data is required for JSON extraction'
        });
      }
      
      console.log(`  -> Processing JSON data:`, data);
      
      // Change to the main project directory
      const projectDir = path.resolve(__dirname);
      process.chdir(projectDir);
      
      // Create a temporary JSON file with the job data
      const tempJsonFile = path.join(projectDir, 'temp-job-extract.json');
      fs.writeFileSync(tempJsonFile, JSON.stringify(data, null, 2));
      
      try {
        // Execute the extract command using the temp file path
        console.log(`  -> Executing extract with JSON file: ${tempJsonFile}`);
        
        const output = await new Promise((resolve, reject) => {
          const child = spawn('npx', ['ts-node', 'src/cli.ts', 'extract', '--type', 'jsonfile', tempJsonFile], {
            cwd: projectDir,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          child.stdout.on('data', (data) => {
            stdout += data;
          });
          
          child.stderr.on('data', (data) => {
            stderr += data;
          });
          
          child.on('close', (code) => {
            console.log(`  -> Command finished with code ${code}`);
            console.log(`  -> STDOUT: ${stdout}`);
            console.log(`  -> STDERR: ${stderr}`);
            
            if (code === 0) {
              resolve(stdout);
            } else {
              reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
          });
          
          // Set timeout
          setTimeout(() => {
            child.kill();
            reject(new Error('Command timed out after 30 seconds'));
          }, 30000);
        });
        
        console.log(`  -> Command output: ${output}`);
        
        // Parse the output to extract job ID
        const jobIdMatch = output.match(/([a-f0-9]{8})\s*$/m);
        const jobId = jobIdMatch ? jobIdMatch[1] : null;
        
        if (!jobId) {
          return res.status(500).json({
            success: false,
            error: 'Could not extract job ID from command output'
          });
        }
        
        // Try to read the job file to get processed job data
        let jobData = null;
        try {
          const jobDir = path.join(projectDir, 'logs', jobId);
          const files = fs.readdirSync(jobDir);
          const jobFile = files.find(file => file.startsWith('job-') && file.endsWith('.json'));
          
          if (jobFile) {
            const jobFilePath = path.join(jobDir, jobFile);
            const jobDataRaw = fs.readFileSync(jobFilePath, 'utf-8');
            jobData = JSON.parse(jobDataRaw);
          }
        } catch (error) {
          console.log('  -> Could not read processed job data:', error.message);
        }
        
        res.json({
          success: true,
          jobId: jobId,
          filePath: `logs/${jobId}/`,
          jobData: jobData || data // Return original data if processed data not available
        });
        
      } finally {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempJsonFile);
        } catch (cleanupError) {
          console.log('  -> Could not clean up temp JSON file:', cleanupError.message);
        }
      }
      
    } else {
      // Handle URL extraction (existing behavior)
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required for URL extraction'
        });
      }
      
      console.log(`  -> Extracting job from URL: ${url}`);
      
      // Change to the main project directory
      const projectDir = path.resolve(__dirname);
      process.chdir(projectDir);
      
      // Execute the extract command
      const command = `npx ts-node src/cli.ts extract "${url}"`;
      console.log(`  -> Executing command: ${command}`);
      
      const output = execSync(command, { 
        encoding: 'utf-8',
        timeout: 60000, // 60 second timeout
        cwd: projectDir
      });
      
      console.log(`  -> Command output: ${output}`);
      
      // Parse the output to extract job ID and other information
      const jobIdMatch = output.match(/([a-f0-9]{8})\s*$/m);
      const jobId = jobIdMatch ? jobIdMatch[1] : null;
      
      if (!jobId) {
        return res.status(500).json({
          success: false,
          error: 'Could not extract job ID from command output'
        });
      }
      
      // Try to read the job file to get job data
      let jobData = null;
      try {
        const jobDir = path.join(projectDir, 'logs', jobId);
        const files = fs.readdirSync(jobDir);
        const jobFile = files.find(file => file.startsWith('job-') && file.endsWith('.json'));
        
        if (jobFile) {
          const jobFilePath = path.join(jobDir, jobFile);
          const jobDataRaw = fs.readFileSync(jobFilePath, 'utf-8');
          jobData = JSON.parse(jobDataRaw);
        }
      } catch (error) {
        console.log('  -> Could not read job data:', error.message);
      }
      
      res.json({
        success: true,
        jobId: jobId,
        filePath: `logs/${jobId}/`,
        jobData: jobData
      });
    }
    
  } catch (error) {
    console.error('  -> Extract failed:', error);
    
    let errorMessage = error.message;
    if (error.message.includes('TIMEOUT')) {
      errorMessage = 'Extraction timed out - job sites may take a while to process';
    } else if (error.message.includes('competition')) {
      errorMessage = 'Job skipped due to high competition (too many applicants)';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Teal tracking endpoint (legacy - now handled by Chrome extension)
app.post('/teal-track', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Teal track request (deprecated)`);
  res.status(400).json({
    success: false,
    error: 'Teal automation is now handled by the Chrome extension. Use the Track button in the extension panel.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Unified Job Extractor Server');
  console.log('=' .repeat(50));
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`🧠 LLM mode: ${cvEngine.useLLM ? 'ENABLED (Claude 3.5)' : 'DISABLED (Pattern matching)'}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`  • GET  /health        - Health check`);
  console.log(`  • POST /cv-question   - CV question answering`);
  console.log(`  • POST /extract       - Job extraction (URL or JSON)`);
  console.log(`  • POST /teal-track    - Deprecated (use Chrome extension)`);
  console.log('');
  console.log('💡 Usage:');
  console.log(`  • Chrome Extension: Will connect automatically`);
  console.log(`  • CLI Commands: Use 'npm run dev' commands as usual`);
  console.log(`  • CV Questions: Enable with ANTHROPIC_API_KEY in .env`);
  console.log('');
  console.log('🛑 To stop: Press Ctrl+C');
  console.log('=' .repeat(50));
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Unified Server: Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Unified Server: Received SIGINT, shutting down gracefully');
  process.exit(0);
});