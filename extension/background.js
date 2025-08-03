// Job Extractor Assistant - Background Script

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Job Extractor Assistant installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      firstInstall: Date.now(),
      gutterWidth: 33.333,
      autoDetectJobSites: true
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // The popup will handle the interaction, but we can add additional logic here if needed
  console.log('Extension icon clicked for tab:', tab.url);
});

// Message handling for future communication between components
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'log':
      console.log('Job Extractor:', request.message);
      sendResponse({success: true});
      break;
      
    case 'callMCPServer':
      handleMCPServerCall(request, sendResponse);
      return true; // Keep message channel open for async response
      
    default:
      sendResponse({success: false, error: 'Unknown action'});
  }
});

// Handle MCP server communication
async function handleMCPServerCall(request, sendResponse) {
  try {
    console.log('Job Extractor Background: Handling MCP server call for:', request.args.question);
    
    // Test if local MCP server is running
    const mcpServerRunning = await testMCPServerConnection();
    
    if (mcpServerRunning) {
      console.log('Job Extractor Background: MCP server is running, using real CV data');
      
      // Make request to local MCP server
      const mcpResponse = await callLocalMCPServer(request.args.question);
      
      sendResponse({
        success: true,
        data: mcpResponse
      });
    } else {
      console.error('Job Extractor Background: MCP server is not running on localhost:3000');
      console.error('Job Extractor Background: Please start MCP server with: npm run mcp-server');
      
      // Fallback to sample CV content for testing
      const sampleCV = `KEY ACCOMPLISHMENTS

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

      const cvResponse = generateCVResponse(request.args.question, sampleCV);
      console.warn('Job Extractor Background: Using fallback sample CV data (MCP server not available)');
      
      sendResponse({
        success: true,
        data: cvResponse,
        warning: 'Using sample CV data - MCP server not running. Start with: npm run mcp-server'
      });
    }
    
  } catch (error) {
    console.error('Job Extractor: MCP Server call failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Test if MCP server is running
async function testMCPServerConnection() {
  try {
    console.log('Job Extractor Background: Testing MCP server connection...');
    const response = await fetch('http://localhost:3000/health', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    console.log('Job Extractor Background: Health check response status:', response.status);
    const result = response.ok;
    console.log('Job Extractor Background: MCP server connection test result:', result);
    return result;
  } catch (error) {
    console.error('Job Extractor Background: MCP server connection test failed:', error.message, error);
    return false;
  }
}

// Call local MCP server
async function callLocalMCPServer(question) {
  try {
    console.log('Job Extractor Background: Calling MCP server with question:', question);
    const response = await fetch('http://localhost:3000/cv-question', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: question }),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    console.log('Job Extractor Background: MCP server response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`MCP server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Job Extractor Background: MCP server response data:', data);
    const result = data.response || data.answer || 'No response from MCP server';
    console.log('Job Extractor Background: Returning CV response, length:', result.length);
    return result;
    
  } catch (error) {
    console.error('Job Extractor Background: Failed to call MCP server:', error);
    throw error;
  }
}

// Generate CV-aware response from parsed CV content
function generateCVResponse(question, cvContent) {
  const cvData = parseCV(cvContent);
  const questionType = classifyQuestion(question);
  
  const responses = {
    experience: () => generateExperienceResponse(cvData),
    skills: () => generateSkillsResponse(cvData),
    leadership: () => generateLeadershipResponse(cvData),
    technical: () => generateTechnicalResponse(cvData),
    default: () => generateDefaultResponse(cvData, question)
  };
  
  return responses[questionType]();
}

// Classify question type based on keywords
function classifyQuestion(question) {
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

// Generate experience-focused response
function generateExperienceResponse(cvData) {
  const experienceAreas = extractExperienceAreas(cvData.accomplishments);
  
  return `Based on the CV, here are key work experiences:

${formatBulletList(cvData.accomplishments)}

Strong experience in ${experienceAreas.join(', ')} with measurable business impact.`;
}

// Generate skills-focused response  
function generateSkillsResponse(cvData) {
  return `Core strengths include:

${formatBulletList(cvData.strengths)}

Excels at combining technical leadership with strong communication and process optimization.`;
}

// Generate leadership-focused response
function generateLeadershipResponse(cvData) {
  const leadershipKeywords = ['launched', 'drove', 'delivered', 'led', 'managed'];
  const communicationKeywords = ['leadership', 'communication', 'collaboration'];
  
  const leadershipAccomplishments = filterByKeywords(cvData.accomplishments, leadershipKeywords);
  const leadershipStrengths = filterByKeywords(cvData.strengths, communicationKeywords);
  
  return `Demonstrates strong leadership through:

**Accomplishments:**
${formatBulletList(leadershipAccomplishments)}

**Leadership Style:**
${formatBulletList(leadershipStrengths)}`;
}

// Generate technical-focused response
function generateTechnicalResponse(cvData) {
  const techKeywords = ['ai', 'data', 'platform', 'technical', 'system', 'application'];
  const techAccomplishments = filterByKeywords(cvData.accomplishments, techKeywords);
  
  return `Technical background and achievements:

${formatBulletList(techAccomplishments.length > 0 ? techAccomplishments : cvData.accomplishments)}

Combines technical depth with business impact and measurable results.`;
}

// Generate comprehensive default response
function generateDefaultResponse(cvData, question) {
  return `Based on the CV:

**Key Accomplishments:**
${formatBulletList(cvData.accomplishments)}

**Core Strengths:**
${formatBulletList(cvData.strengths)}

This provides expertise relevant to: "${question}"`;
}

// Helper function to format bullet lists consistently
function formatBulletList(items) {
  return items.map(item => `• ${item}`).join('\n');
}

// Helper function to filter items by keywords
function filterByKeywords(items, keywords) {
  return items.filter(item => 
    keywords.some(keyword => item.toLowerCase().includes(keyword))
  );
}

// Parse CV content into structured data
function parseCV(content) {
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
      // Skip dividers, empty lines, and contact info
      continue;
    } else if (!line.toUpperCase().includes('ACCOMPLISHMENTS') && !line.toUpperCase().includes('STRENGTHS')) {
      // Add content to current section
      if (currentSection === 'accomplishments') {
        sections.accomplishments.push(line);
      } else if (currentSection === 'strengths') {
        sections.strengths.push(line.replace(/^\*\s*/, '')); // Remove bullet points
      } else if (currentSection === 'experience') {
        sections.experience.push(line);
      } else if (!sections.name && !line.includes('|') && !line.includes('@')) {
        // First non-contact line is likely the name
        sections.name = line;
      }
    }
  }
  
  return sections;
}

// Extract experience areas from accomplishments
function extractExperienceAreas(accomplishments) {
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

console.log('Job Extractor Assistant: Background script loaded');