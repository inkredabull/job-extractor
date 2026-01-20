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
      
      const prompt = `You are answering this interview question in first person using your CV below. Provide a compelling response that showcases your relevant experience.

${contextPrompt}

CV Information:
${cvContent}

Question: ${question}

Please provide a response that:
1. Draws specific examples from the CV
2. Highlights relevant achievements and quantifiable results  
3. Shows clear connections between past experience and the question
4. Uses a professional, confident tone
5. Is tailored to showcase the candidate's strengths
6. Formats the response with proper paragraph breaks and bullet points for readability
${jobDescription ? '7. Relates the experience to the specific job opportunity mentioned' : ''}

Format your response with:
- Short opening paragraph (2-3 sentences)
- Bullet points for key achievements/examples
- Brief closing statement

Keep under 250 words and answer in first person:`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 300,
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
    const topAccomplishments = cvData.accomplishments.slice(0, 3);
    return `My experience includes ${topAccomplishments.join(', ').toLowerCase()}. These accomplishments demonstrate my ability to deliver measurable business impact across different organizations and technical challenges.`;
  }

  generateSkillsResponse(cvData, jobContext = '') {
    const topStrengths = cvData.strengths.slice(0, 4);
    return `My core strengths include ${topStrengths.join(', ').toLowerCase()}. I excel at combining technical leadership with strong communication and process optimization to drive results.`;
  }

  generateLeadershipResponse(cvData, jobContext = '') {
    const leadershipKeywords = ['launched', 'drove', 'delivered', 'led', 'managed'];
    const leadershipAccomplishments = this.filterByKeywords(cvData.accomplishments, leadershipKeywords);
    const topLeadership = leadershipAccomplishments.length > 0 ? leadershipAccomplishments.slice(0, 2) : cvData.accomplishments.slice(0, 2);
    
    return `My leadership experience demonstrates strong results through ${topLeadership.join(' and ').toLowerCase()}. I believe in hands-on technical leadership while empowering teams to own their implementations and grow their skills.`;
  }

  generateTechnicalResponse(cvData, jobContext = '') {
    const techKeywords = ['ai', 'data', 'platform', 'technical', 'system', 'application'];
    const techAccomplishments = this.filterByKeywords(cvData.accomplishments, techKeywords);
    const topTech = techAccomplishments.length > 0 ? techAccomplishments.slice(0, 3) : cvData.accomplishments.slice(0, 3);
    
    return `My technical background includes ${topTech.join(', ').toLowerCase()}. I combine deep technical expertise with business impact, focusing on scalable solutions that deliver measurable results.`;
  }

  generateDefaultResponse(cvData, question, jobContext = '') {
    const topAccomplishments = cvData.accomplishments.slice(0, 2);
    const topStrengths = cvData.strengths.slice(0, 3);
    
    return `My background includes ${topAccomplishments.join(' and ').toLowerCase()}. My core strengths are ${topStrengths.join(', ').toLowerCase()}. This experience positions me well to tackle complex challenges and deliver measurable business impact.`;
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

// Enable CORS for Chrome extension and AMA app
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Helper function to log chats
function logChat(question, answer, metadata = {}) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      question,
      answer,
      metadata,
      sessionId: metadata.sessionId || 'unknown'
    };
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, 'logs', 'ama-chats');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create log filename with date
    const dateStr = timestamp.split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(logsDir, `ama-chat-${dateStr}.jsonl`);
    
    // Append to JSONL file (one JSON object per line)
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFile, logLine, 'utf-8');
    
    console.log(`  -> Chat logged to: ${logFile}`);
  } catch (error) {
    console.error('  -> Error logging chat:', error.message);
  }
}

// CV Question endpoint (from MCP server)
app.post('/cv-question', async (req, res) => {
  console.log(`[${new Date().toISOString()}] CV question request`);
  try {
    const { question, jobDescription, sessionId, userAgent, referrer } = req.body;
    console.log('  -> Question:', question);
    console.log('  -> Job description provided:', jobDescription ? 'Yes' : 'No');
    
    if (!question) {
      console.log('  -> ERROR: No question provided');
      return res.status(400).json({ error: 'Question parameter is required' });
    }
    
    console.log('  -> Processing CV question...');
    const response = await cvEngine.answerCVQuestion(question, jobDescription);
    const answerText = response.content[0].text;
    console.log('  -> CV response generated:', answerText.slice(0, 100) + '...');
    
    // Log the chat interaction
    logChat(question, answerText, {
      sessionId: sessionId || 'web-session-' + Date.now(),
      userAgent,
      referrer,
      jobDescription: jobDescription ? 'provided' : 'none',
      responseLength: answerText.length,
      source: 'ama-web-app'
    });
    
    const jsonResponse = { 
      success: true, 
      response: answerText 
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
    const { url, type, data, reminderPriority } = req.body;
    
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
      console.log(`  -> Reminder priority:`, reminderPriority || 'default');
      
      // Change to the main project directory (two levels up from packages/unified-server)
      const projectDir = path.resolve(__dirname, '..', '..');
      process.chdir(projectDir);
      
      // Create a temporary JSON file with the job data
      const tempJsonFile = path.join(projectDir, 'temp-job-extract.json');
      fs.writeFileSync(tempJsonFile, JSON.stringify(data, null, 2));
      
      try {
        // Execute the extract command using the temp file path
        console.log(`  -> Executing extract with JSON file: ${tempJsonFile}`);
        
        const output = await new Promise((resolve, reject) => {
          const args = ['ts-node', 'src/cli.ts', 'extract', '--type', 'jsonfile'];
          if (reminderPriority) {
            args.push('--reminder-priority', reminderPriority.toString());
          }
          // Skip post-workflow (scoring, resume generation) for Chrome extension requests
          // This allows immediate response to the extension
          args.push('--skip-post-workflow');
          args.push(tempJsonFile);

          console.log(`  -> Command: npx ${args.join(' ')}`);

          const child = spawn('npx', args, {
            cwd: projectDir,
            stdio: ['pipe', 'pipe', 'pipe']
          });

          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            // Log stdout in real-time with prefix
            output.split('\n').filter(line => line.trim()).forEach(line => {
              console.log(`     [CLI] ${line}`);
            });
          });

          child.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            // Log stderr in real-time with prefix (errors/warnings)
            output.split('\n').filter(line => line.trim()).forEach(line => {
              console.log(`     [CLI:err] ${line}`);
            });
          });

          child.on('close', (code) => {
            console.log(`  -> Command finished with exit code ${code}`);

            if (code === 0) {
              resolve(stdout);
            } else {
              console.log(`  -> Command failed. Full stderr: ${stderr}`);
              reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
          });

          // Set timeout
          setTimeout(() => {
            child.kill();
            reject(new Error('Command timed out after 30 seconds'));
          }, 30000);
        });
        
        // Parse the output to extract job ID
        const jobIdMatch = output.match(/([a-f0-9]{8})\s*$/m);
        const jobId = jobIdMatch ? jobIdMatch[1] : null;

        if (!jobId) {
          console.log(`  -> ❌ Failed to extract job ID from output`);
          return res.status(500).json({
            success: false,
            error: 'Could not extract job ID from command output'
          });
        }

        console.log(`  -> ✅ Job extracted successfully with ID: ${jobId}`);
        
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
            console.log(`  -> 📄 Job data saved to: logs/${jobId}/${jobFile}`);
          }
        } catch (error) {
          console.log(`  -> ⚠️  Could not read processed job data: ${error.message}`);
        }
        
        res.json({
          success: true,
          jobId: jobId,
          filePath: `logs/${jobId}/`,
          jobData: jobData || data // Return original data if processed data not available
        });

        console.log(`  -> 🎉 Response sent to Chrome extension`);

        // Async background processing for Medium/High priority jobs
        // Priority: 1=High, 5=Medium, 9=Low
        const priority = parseInt(reminderPriority) || 5;
        if (priority <= 5) { // Medium (5) or High (1) priority
          console.log(`  -> 🔄 Triggering async background scoring and resume generation for priority ${priority} job`);
          setImmediate(async () => {
            try {
              await triggerAsyncJobProcessing(jobId, priority, projectDir);
            } catch (error) {
              console.log(`  -> ❌ Background processing failed for job ${jobId}: ${error.message}`);
            }
          });
        } else {
          console.log(`  -> ⏭️  Skipping background processing for Low priority (${priority}) job`);
        }
        
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
      
      // Change to the main project directory (two levels up from packages/unified-server)
      const projectDir = path.resolve(__dirname, '..', '..');
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

// LinkedIn post reminder creation endpoint
app.post('/linkedin-reminder', async (req, res) => {
  console.log(`[${new Date().toISOString()}] LinkedIn reminder creation request`);
  const { title, notes, priority = 5, dueDate = null, listName = 'LinkedIn Saved Posts' } = req.body;
  
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Title is required for reminder creation'
    });
  }
  
  console.log(`  -> Creating reminder: ${title.substring(0, 50)}...`);
  
  try {
    // Change to the main project directory (two levels up from packages/unified-server)
    const projectDir = path.resolve(__dirname, '..', '..');
    
    // Use the MacOS reminder creation via CLI
    const output = await new Promise((resolve, reject) => {
      const args = ['ts-node', 'src/cli.ts', 'reminder'];
      
      // Add title (required)
      args.push('--title', title);
      
      // Add notes if provided
      if (notes) {
        args.push('--notes', notes);
      }
      
      // Add priority
      args.push('--priority', priority.toString());
      
      // Add list name
      args.push('--list', listName);
      
      // Add due date if provided
      if (dueDate) {
        args.push('--due', dueDate);
      }
      
      console.log(`  -> Running command: npx ${args.join(' ')}`);
      
      const child = spawn('npx', args, {
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
          reject(new Error(`Reminder creation failed with code ${code}: ${stderr}`));
        }
      });
      
      // Set timeout
      setTimeout(() => {
        child.kill();
        reject(new Error('Reminder creation timed out after 10 seconds'));
      }, 10000);
    });
    
    console.log(`  -> Reminder created successfully`);
    
    res.json({
      success: true,
      reminderId: 'created',
      message: 'LinkedIn post reminder created successfully'
    });
    
  } catch (error) {
    console.error(`  -> Reminder creation failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate third-person blurb endpoint
app.post('/generate-blurb', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Generate blurb request`);
  try {
    const { jobId, companyWebsite, person } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const perspective = person || 'third';
    console.log(`  -> Generating ${perspective}-person blurb for job: ${jobId}`);
    if (companyWebsite) {
      console.log(`  -> Using company website: ${companyWebsite}`);
    }

    // Change to the main project directory
    const projectDir = path.resolve(__dirname, '..', '..');
    process.chdir(projectDir);

    // Verify job exists
    const jobDir = path.join(projectDir, 'logs', jobId);
    if (!fs.existsSync(jobDir)) {
      return res.status(404).json({
        success: false,
        error: `Job ID ${jobId} not found`
      });
    }

    const output = await new Promise((resolve, reject) => {
      const args = ['run', 'dev', '--workspace=@inkredabull/job-extractor-core', '--', 'prep', 'cover-letter', jobId, '--person', perspective, '--content', '--regen'];

      // Add company URL if provided
      if (companyWebsite) {
        args.push('--company-url', companyWebsite);
      }

      console.log(`  -> Command: npm ${args.join(' ')}`);

      const child = spawn('npm', args, {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log stdout in real-time with prefix
        output.split('\n').filter(line => line.trim()).forEach(line => {
          console.log(`     [BLURB] ${line}`);
        });
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Log stderr in real-time with prefix (errors/warnings)
        output.split('\n').filter(line => line.trim()).forEach(line => {
          console.log(`     [BLURB:err] ${line}`);
        });
      });

      child.on('close', (code) => {
        console.log(`  -> Command finished with exit code ${code}`);

        if (code === 0) {
          resolve(stdout);
        } else {
          console.log(`  -> Command failed. Full stderr: ${stderr}`);
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      // Set timeout (cover letter generation can take a bit longer)
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timed out after 60 seconds'));
      }, 60000);
    });

    // The output contains CLI logs + actual content
    // With --content flag, the actual content is output after all the logging
    // Extract only the content part (after the last emoji/arrow line)
    const lines = output.split('\n');

    // Find where the actual content starts (after the last line with emoji/logging markers)
    let contentStartIndex = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      // Skip empty lines
      if (!line.trim()) continue;

      // If line contains logging markers, content starts after this
      if (line.includes('📝') || line.includes('✅') || line.includes('🤖') ||
          line.includes('📄') || line.includes('->') || line.includes('📋') ||
          line.includes('🔍') || line.includes('🌐')) {
        contentStartIndex = i + 1;
        break;
      }
    }

    // Extract the actual content
    let blurb = lines.slice(contentStartIndex).join('\n').trim();

    // Remove em dashes (— or --) from the output
    blurb = blurb.replace(/—/g, '-').replace(/\s+--\s+/g, ' - ');

    if (!blurb) {
      return res.status(500).json({
        success: false,
        error: 'No blurb content generated'
      });
    }

    console.log(`  -> ✅ Blurb generated successfully (${blurb.length} characters)`);

    res.json({
      success: true,
      jobId: jobId,
      blurb: blurb,
      characterCount: blurb.length
    });

  } catch (error) {
    console.error('  -> Blurb generation failed:', error);

    let errorMessage = error.message;
    if (error.message.includes('timeout')) {
      errorMessage = 'Blurb generation timed out - this can take up to 60 seconds';
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Get scoring report HTML
app.get('/report/:jobId', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Scoring report request for job: ${req.params.jobId}`);

  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    // Change to the main project directory (two levels up from packages/unified-server)
    const projectDir = path.resolve(__dirname, '..', '..');
    const jobDir = path.join(projectDir, 'logs', jobId);

    if (!fs.existsSync(jobDir)) {
      return res.status(404).json({
        success: false,
        error: `Job ID ${jobId} not found`
      });
    }

    // Find the most recent score report HTML file
    const files = fs.readdirSync(jobDir);
    const reportFiles = files.filter(f => f.startsWith('score-report-') && f.endsWith('.html'));

    if (reportFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No scoring report found for this job. Score the job first.'
      });
    }

    // Sort by filename (timestamp) and get the most recent
    reportFiles.sort().reverse();
    const reportPath = path.join(jobDir, reportFiles[0]);

    console.log(`  -> Serving report: ${reportFiles[0]}`);

    // Read and serve the HTML file
    const htmlContent = fs.readFileSync(reportPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);

  } catch (error) {
    console.error('  -> Report retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Unified Job Extractor Server');
  console.log('=' .repeat(50));
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`🧠 LLM mode: ${cvEngine.useLLM ? 'ENABLED (Claude 3.5)' : 'DISABLED (Pattern matching)'}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`  • GET  /health           - Health check`);
  console.log(`  • POST /cv-question      - CV question answering`);
  console.log(`  • POST /extract          - Job extraction (URL or JSON)`);
  console.log(`  • GET  /report/:jobId    - View scoring report HTML`);
  console.log(`  • POST /generate-blurb   - Generate third-person blurb`);
  console.log(`  • POST /linkedin-reminder - Create reminder for saved LinkedIn posts`);
  console.log(`  • POST /teal-track       - Deprecated (use Chrome extension)`);
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

// Async background job processing function
async function triggerAsyncJobProcessing(jobId, priority, projectDir) {
  console.log(`🔄 Starting async background processing for job ${jobId} (priority: ${priority})`);
  
  try {
    // Step 1: Score the job
    console.log(`  -> Scoring job ${jobId}...`);
    const scoreOutput = await new Promise((resolve, reject) => {
      const scoreArgs = ['ts-node', 'src/cli.ts', 'score', jobId];
      
      const scoreChild = spawn('npx', scoreArgs, {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';

      scoreChild.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log scoring progress in real-time
        output.split('\n').filter(line => line.trim()).forEach(line => {
          console.log(`     [SCORE] ${line}`);
        });
      });

      scoreChild.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        output.split('\n').filter(line => line.trim()).forEach(line => {
          console.log(`     [SCORE:err] ${line}`);
        });
      });

      scoreChild.on('close', (code) => {
        console.log(`  -> Job scoring finished with exit code ${code}`);
        if (code === 0) {
          resolve(stdout);
        } else {
          console.log(`  -> Scoring failed. Full stderr: ${stderr}`);
          reject(new Error(`Job scoring failed with code ${code}: ${stderr}`));
        }
      });
      
      // Set timeout for scoring
      setTimeout(() => {
        scoreChild.kill();
        reject(new Error('Job scoring timed out after 60 seconds'));
      }, 60000);
    });
    
    console.log(`  -> Job scoring completed for ${jobId}`);
    
    // Step 2: Check if resume generation should be triggered
    // Parse the score from the output
    const scoreMatch = scoreOutput.match(/Overall Score:\s*(\d+)%/);
    const jobScore = scoreMatch ? parseInt(scoreMatch[1]) : null;
    
    if (!jobScore) {
      console.log(`  -> Could not parse job score, skipping resume generation`);
      console.log(`✅ Async background processing completed (scoring only) for job ${jobId}`);
      return;
    }
    
    console.log(`  -> Job score: ${jobScore}%`);
    
    // Load workflow config to check if resume generation is enabled
    let shouldGenerateResume = false;
    let scoreThreshold = 70; // default
    
    try {
      const yaml = require('js-yaml');
      const configPath = path.join(projectDir, 'auto-workflow-config.yaml');
      
      if (fs.existsSync(configPath)) {
        const workflowConfig = yaml.load(fs.readFileSync(configPath, 'utf8'));
        
        if (workflowConfig && workflowConfig.workflow_config) {
          const config = workflowConfig.workflow_config;
          scoreThreshold = config.score_threshold || 70;
          
          // Check if resume generation is enabled and score meets threshold
          if (config.steps && config.steps.resume === true) {
            shouldGenerateResume = jobScore >= scoreThreshold;
          } else {
            console.log(`  -> Resume generation disabled in workflow config`);
          }
        }
      } else {
        console.log(`  -> No workflow config found at ${configPath}, skipping resume generation`);
      }
    } catch (configError) {
      console.log(`  -> Error loading workflow config: ${configError.message}`);
    }
    
    if (!shouldGenerateResume) {
      if (jobScore < scoreThreshold) {
        console.log(`  -> Job score ${jobScore}% is below threshold ${scoreThreshold}%, skipping resume generation`);
      }
      console.log(`✅ Async background processing completed (scoring only) for job ${jobId}`);
      return;
    }
    
    // Step 3: Generate resume (only if enabled and score meets threshold)
    console.log(`  -> Generating resume for job ${jobId} (score ${jobScore}% >= ${scoreThreshold}%)...`);
    const resumeOutput = await new Promise((resolve, reject) => {
      const resumeArgs = ['ts-node', 'src/cli.ts', 'resume', jobId];
      
      const resumeChild = spawn('npx', resumeArgs, {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';

      resumeChild.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log resume generation progress in real-time
        output.split('\n').filter(line => line.trim()).forEach(line => {
          console.log(`     [RESUME] ${line}`);
        });
      });

      resumeChild.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        output.split('\n').filter(line => line.trim()).forEach(line => {
          console.log(`     [RESUME:err] ${line}`);
        });
      });

      resumeChild.on('close', (code) => {
        console.log(`  -> Resume generation finished with exit code ${code}`);
        if (code === 0) {
          resolve(stdout);
        } else {
          console.log(`  -> Resume generation failed. Full stderr: ${stderr}`);
          reject(new Error(`Resume generation failed with code ${code}: ${stderr}`));
        }
      });
      
      // Set timeout for resume generation
      setTimeout(() => {
        resumeChild.kill();
        reject(new Error('Resume generation timed out after 120 seconds'));
      }, 120000);
    });
    
    console.log(`✅ Async background processing completed successfully for job ${jobId}`);
    console.log(`  -> Scoring: ✅ Complete`);
    console.log(`  -> Resume: ✅ Complete`);
    
  } catch (error) {
    console.log(`❌ Async background processing failed for job ${jobId}: ${error.message}`);
    // Don't throw - we don't want background failures to affect the main flow
  }
}
