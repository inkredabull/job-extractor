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
  console.log('Extension icon clicked for tab:', tab.url);
  
  // Send message to content script to toggle the assistant panel
  chrome.tabs.sendMessage(tab.id, {action: 'toggleGutter'}, function(response) {
    if (chrome.runtime.lastError) {
      console.log('Content script not found, injecting it...');
      // Content script not ready, inject it manually
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        // Wait a moment for script to initialize, then try again
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {action: 'toggleGutter'}, function(response) {
            if (response?.success) {
              console.log('Panel toggled successfully:', response.isOpen ? 'opened' : 'closed');
            } else {
              console.error('Failed to toggle panel after injection');
            }
          });
        }, 300);
      });
      return;
    }
    
    if (response?.success) {
      console.log('Panel toggled successfully:', response.isOpen ? 'opened' : 'closed');
    } else {
      console.error('Failed to toggle panel');
    }
  });
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
      
    case 'extractJob':
      handleExtractJob(request, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'trackInTeal':
      // Legacy - Teal tracking now handled by openTealAndFill
      sendResponse({success: false, error: 'Use openTealAndFill instead'});
      break;
      
    case 'openTealAndFill':
      handleOpenTealAndFill(request, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'extractFromJson':
      handleExtractFromJson(request, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'createLinkedInPostReminder':
      handleCreateLinkedInPostReminder(request, sendResponse);
      return true; // Keep message channel open for async response
      
    default:
      sendResponse({success: false, error: 'Unknown action'});
  }
});

// Handle MCP server communication
async function handleMCPServerCall(request, sendResponse) {
  try {
    console.log('Job Extractor Background: Handling MCP server call for:', request.args.question);
    
    // Extract job description if provided
    const jobDescription = request.args.jobDescription || '';
    console.log('Job Extractor Background: Job description provided:', jobDescription ? 'Yes' : 'No');
    
    // Test if local unified server is running
    const unifiedServerRunning = await testUnifiedServerConnection();
    
    if (unifiedServerRunning) {
      console.log('Job Extractor Background: Unified server is running, using real CV data');
      
      // Make request to local unified server
      const cvResponse = await callLocalUnifiedServer(request.args.question, jobDescription);
      
      sendResponse({
        success: true,
        data: cvResponse
      });
    } else {
      console.error('Job Extractor Background: Unified server is not running on localhost:3000');
      console.error('Job Extractor Background: Please start unified server with: npm run unified-server');
      
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

      const cvResponse = generateCVResponse(request.args.question, sampleCV, jobDescription);
      console.warn('Job Extractor Background: Using fallback sample CV data (MCP server not available)');
      
      sendResponse({
        success: true,
        data: cvResponse,
        warning: 'Using sample CV data - unified server not running. Start with: npm run unified-server'
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

// Test if unified server is running
async function testUnifiedServerConnection() {
  try {
    console.log('Job Extractor Background: Testing unified server connection...');
    const response = await fetch('http://localhost:3000/health', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    console.log('Job Extractor Background: Health check response status:', response.status);
    const result = response.ok;
    console.log('Job Extractor Background: Unified server connection test result:', result);
    return result;
  } catch (error) {
    console.error('Job Extractor Background: Unified server connection test failed:', error.message, error);
    return false;
  }
}

// Call local unified server for CV questions
async function callLocalUnifiedServer(question, jobDescription = '') {
  try {
    console.log('Job Extractor Background: Calling unified server with question:', question);
    const requestBody = { question: question };
    
    // Include job description context if available
    if (jobDescription.trim()) {
      requestBody.jobDescription = jobDescription;
      console.log('Job Extractor Background: Including job description context');
    }
    
    const response = await fetch('http://localhost:3000/cv-question', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    console.log('Job Extractor Background: Unified server response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Unified server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Job Extractor Background: Unified server response data:', data);
    const result = data.response || data.answer || 'No response from unified server';
    console.log('Job Extractor Background: Returning CV response, length:', result.length);
    return result;
    
  } catch (error) {
    console.error('Job Extractor Background: Failed to call unified server:', error);
    throw error;
  }
}

// Generate CV-aware response from parsed CV content
function generateCVResponse(question, cvContent, jobDescription = '') {
  const cvData = parseCV(cvContent);
  const questionType = classifyQuestion(question);
  
  // Add job description context if available
  const jobContext = jobDescription.trim() ? ` given this job description: "${jobDescription.substring(0, 300)}..."` : '';
  
  const responses = {
    experience: () => generateExperienceResponse(cvData, jobContext),
    skills: () => generateSkillsResponse(cvData, jobContext),
    leadership: () => generateLeadershipResponse(cvData, jobContext),
    technical: () => generateTechnicalResponse(cvData, jobContext),
    default: () => generateDefaultResponse(cvData, question, jobContext)
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
function generateExperienceResponse(cvData, jobContext = '') {
  const experienceAreas = extractExperienceAreas(cvData.accomplishments);
  const contextSuffix = jobContext ? `\n\nThis background aligns well${jobContext}` : '';
  
  return `Based on the CV, here are key work experiences:

${formatBulletList(cvData.accomplishments)}

Strong experience in ${experienceAreas.join(', ')} with measurable business impact.${contextSuffix}`;
}

// Generate skills-focused response  
function generateSkillsResponse(cvData, jobContext = '') {
  const contextSuffix = jobContext ? `\n\nThese skills are particularly relevant${jobContext}` : '';
  
  return `Core strengths include:

${formatBulletList(cvData.strengths)}

Excels at combining technical leadership with strong communication and process optimization.${contextSuffix}`;
}

// Generate leadership-focused response
function generateLeadershipResponse(cvData, jobContext = '') {
  const leadershipKeywords = ['launched', 'drove', 'delivered', 'led', 'managed'];
  const communicationKeywords = ['leadership', 'communication', 'collaboration'];
  
  const leadershipAccomplishments = filterByKeywords(cvData.accomplishments, leadershipKeywords);
  const leadershipStrengths = filterByKeywords(cvData.strengths, communicationKeywords);
  const contextSuffix = jobContext ? `\n\nThis leadership experience directly applies${jobContext}` : '';
  
  return `Demonstrates strong leadership through:

**Accomplishments:**
${formatBulletList(leadershipAccomplishments)}

**Leadership Style:**
${formatBulletList(leadershipStrengths)}${contextSuffix}`;
}

// Generate technical-focused response
function generateTechnicalResponse(cvData, jobContext = '') {
  const techKeywords = ['ai', 'data', 'platform', 'technical', 'system', 'application'];
  const techAccomplishments = filterByKeywords(cvData.accomplishments, techKeywords);
  const contextSuffix = jobContext ? `\n\nThis technical expertise is well-suited${jobContext}` : '';
  
  return `Technical background and achievements:

${formatBulletList(techAccomplishments.length > 0 ? techAccomplishments : cvData.accomplishments)}

Combines technical depth with business impact and measurable results.${contextSuffix}`;
}

// Generate comprehensive default response
function generateDefaultResponse(cvData, question, jobContext = '') {
  const contextSuffix = jobContext ? `\n\nThis expertise is particularly relevant${jobContext}` : '';
  
  return `Based on the CV:

**Key Accomplishments:**
${formatBulletList(cvData.accomplishments)}

**Core Strengths:**
${formatBulletList(cvData.strengths)}

This provides expertise relevant to: "${question}"${contextSuffix}`;
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

// Handle extract job CLI execution
async function handleExtractJob(request, sendResponse) {
  try {
    console.log('Job Extractor Background: Handling extract job request for URL:', request.url);
    
    // Make request to local unified server to execute extract command
    const extractResponse = await callLocalUnifiedServerForExtract(request.url);
    
    sendResponse({
      success: true,
      jobId: extractResponse.jobId,
      filePath: extractResponse.filePath,
      jobData: extractResponse.jobData
    });
    
  } catch (error) {
    console.error('Job Extractor Background: Extract job failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Call local unified server to execute extract command
async function callLocalUnifiedServerForExtract(url) {
  try {
    console.log('Job Extractor Background: Calling unified server for extraction');
    
    const response = await fetch('http://localhost:3000/extract', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: url }),
      signal: AbortSignal.timeout(60000) // 60 second timeout for extraction
    });
    
    console.log('Job Extractor Background: Unified server response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Unified server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Job Extractor Background: Unified server response data:', data);
    
    if (!data.success) {
      throw new Error(data.error || 'Unified server extraction failed');
    }
    
    return {
      jobId: data.jobId,
      filePath: data.filePath,
      jobData: data.jobData
    };
    
  } catch (error) {
    console.error('Job Extractor Background: Failed to call unified server:', error);
    
    // Provide a helpful error message
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      throw new Error('Extraction timed out - job sites may take a while to process');
    } else if (error.message.includes('fetch')) {
      throw new Error('Could not connect to unified server. Make sure to run: npm run unified-server');
    } else {
      throw error;
    }
  }
}

// Handle extract from JSON functionality
async function handleExtractFromJson(request, sendResponse) {
  try {
    console.log('Job Extractor Background: Handling extract from JSON request');
    console.log('Job data:', request.jobData);
    console.log('Reminder priority:', request.reminderPriority);
    
    // Send JSON payload to unified server with type='json' flag and reminder priority
    const extractResponse = await callLocalUnifiedServerWithJson(request.jobData, request.reminderPriority);
    
    sendResponse({
      success: true,
      jobId: extractResponse.jobId,
      filePath: extractResponse.filePath,
      jobData: extractResponse.jobData
    });
    
  } catch (error) {
    console.error('Job Extractor Background: Extract from JSON failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Call local unified server with JSON data
async function callLocalUnifiedServerWithJson(jobData, reminderPriority = 5) {
  try {
    console.log('Job Extractor Background: Calling unified server for JSON extraction');
    
    const response = await fetch('http://localhost:3000/extract', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        type: 'json',
        data: jobData,
        reminderPriority: reminderPriority
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout for JSON processing
    });
    
    console.log('Job Extractor Background: Unified server response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Unified server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Job Extractor Background: Unified server response data:', data);
    
    if (!data.success) {
      throw new Error(data.error || 'Unified server JSON extraction failed');
    }
    
    return {
      jobId: data.jobId,
      filePath: data.filePath,
      jobData: data.jobData
    };
    
  } catch (error) {
    console.error('Job Extractor Background: Failed to call unified server with JSON:', error);
    
    // Provide a helpful error message
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      throw new Error('JSON processing timed out');
    } else if (error.message.includes('fetch')) {
      throw new Error('Could not connect to unified server. Make sure to run: npm run unified-server');
    } else {
      throw error;
    }
  }
}

// Handle opening Teal tab and filling form
async function handleOpenTealAndFill(request, sendResponse) {
  try {
    console.log('Job Extractor Background: Opening Teal tab and filling form');
    console.log('Job info:', request.jobInfo);
    
    // Create new tab for Teal
    const tab = await chrome.tabs.create({
      url: 'https://app.tealhq.com/job-tracker',
      active: true
    });
    
    // Wait for tab to load, then inject the form-filling script
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        // Remove listener to avoid multiple executions
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Add delay before injection to ensure tab is fully loaded
        setTimeout(() => {
          console.log('Job Extractor Background: Attempting to inject form filling script...');
          
          // Inject the Teal form-filling script
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillTealForm,
            args: [request.jobInfo]
          }).then((results) => {
            console.log('Job Extractor Background: Form filling script injected successfully');
            console.log('Job Extractor Background: Injection results:', results);
            if (results && results[0] && results[0].error) {
              console.error('Job Extractor Background: Script execution error:', results[0].error);
            }
          }).catch((error) => {
            console.error('Job Extractor Background: Failed to inject script:', error);
            console.error('Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
          });
        }, 1000); // Wait 1 second after page complete
      }
    });
    
    sendResponse({
      success: true,
      message: 'Teal tab opened and automation started'
    });
    
  } catch (error) {
    console.error('Job Extractor Background: Failed to open Teal tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Function to be injected into Teal tab for form filling
function fillTealForm(jobInfo) {
  // Immediate test log
  console.log('🎯 TEAL FORM FILLER: Script successfully injected and executing!');
  console.log('🎯 TEAL FORM FILLER: Received normalized job data:', jobInfo);
  console.log('🎯 TEAL FORM FILLER: Job fields:', {
    title: jobInfo.title,
    company: jobInfo.company,
    location: jobInfo.location,
    url: jobInfo.url,
    hasDescription: !!jobInfo.description
  });
  console.log('🎯 TEAL FORM FILLER: Current URL:', window.location.href);
  console.log('🎯 TEAL FORM FILLER: Document ready state:', document.readyState);
  
  try {
    console.log('Teal Form Filler: Starting automation with job info:', jobInfo);
  
  // Function to wait for element to appear
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      function checkForElement() {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
          return;
        }
        
        setTimeout(checkForElement, 100);
      }
      
      checkForElement();
    });
  }
  
  // Function to find add button by text content
  function findAddJobButton() {
    const buttons = document.querySelectorAll('button');
    console.log(`Teal Form Filler: Found ${buttons.length} buttons on page`);
    
    for (const button of buttons) {
      const text = button.textContent.toLowerCase();
      console.log(`Teal Form Filler: Button text: "${text}"`);
      
      if ((text.includes('add') && text.includes('job')) || 
          (text.includes('new') && text.includes('job')) ||
          text.includes('add a new job')) {
        console.log(`Teal Form Filler: Found matching button: "${button.textContent}"`);
        return button;
      }
    }
    
    // Also check for buttons with + symbols or icons
    for (const button of buttons) {
      if (button.textContent.includes('+') || 
          button.querySelector('svg') || 
          button.classList.toString().toLowerCase().includes('add')) {
        console.log(`Teal Form Filler: Found potential add button (icon/class): "${button.textContent}"`);
        return button;
      }
    }
    
    return null;
  }
  
  // Wait longer for page to be fully loaded and interactive
  setTimeout(async () => {
    try {
      console.log('Teal Form Filler: Page should be loaded, starting button search...');
      console.log('Teal Form Filler: Current URL:', window.location.href);
      console.log('Teal Form Filler: Document ready state:', document.readyState);
      
      // Wait a bit more for any dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Look for and click the "Add a new job" button
      console.log('Teal Form Filler: Looking for "Add a new job" button...');
      
      let addButton = findAddJobButton();
      
      // If still not found, try waiting a bit more and search again
      if (!addButton) {
        console.log('Teal Form Filler: Button not found on first attempt, waiting and retrying...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        addButton = findAddJobButton();
      }
      
      if (!addButton) {
        console.log('Teal Form Filler: Could not find "Add a new job" button');
        console.log('Teal Form Filler: Available buttons:');
        document.querySelectorAll('button').forEach((btn, i) => {
          console.log(`  ${i + 1}. "${btn.textContent.trim()}" (classes: ${btn.className})`);
        });
        return;
      }
      
      // Click the button
      console.log('Teal Form Filler: Clicking add job button...');
      addButton.click();
      
      // Also try triggering other events in case click doesn't work
      addButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      addButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      // Wait for modal to appear
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fill in the form fields
      console.log('Teal Form Filler: Attempting to fill job information...');
      
      const formFieldMappings = [
        // Job Title field (name="role")
        {
          selectors: ['input[name="role"]', 'input[placeholder="Job Title"]', 'input[placeholder*="title" i]'],
          value: jobInfo.title,
          name: 'Job Title'
        },
        // URL field (name="url")
        {
          selectors: ['input[name="url"]', 'input[placeholder="URL for Original Posting"]', 'input[placeholder*="url" i]'],
          value: jobInfo.url || window.location.href,
          name: 'Job URL'
        },
        // Company field (name="company_name")
        {
          selectors: ['input[name="company_name"]', 'input[placeholder="Company Name"]', 'input[placeholder*="company" i]'],
          value: jobInfo.company,
          name: 'Company Name'
        },
        // Location field (name="location")
        {
          selectors: ['input[name="location"]', 'input[placeholder="Location"]', 'input[placeholder*="location" i]'],
          value: jobInfo.location,
          name: 'Location'
        },
        // Description field (contenteditable div with TipTap editor)
        {
          selectors: ['.tiptap.ProseMirror', '[contenteditable="true"]', 'textarea[placeholder*="description" i]'],
          value: jobInfo.description,
          name: 'Job Description',
          isContentEditable: true
        }
      ];
      
      for (const field of formFieldMappings) {
        if (!field.value) continue; // Skip empty fields
        
        let fieldFilled = false;
        for (const selector of field.selectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              if (field.isContentEditable) {
                // Handle contenteditable TipTap editor for job description
                element.click();
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait for editor to focus
                
                // Clear existing content and add new content
                element.focus();
                
                // Try multiple approaches to clear and fill the contenteditable element
                try {
                  // Method 1: Simple textContent replacement (most reliable)
                  element.textContent = field.value;
                } catch (e1) {
                  try {
                    // Method 2: innerHTML approach
                    element.innerHTML = field.value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  } catch (e2) {
                    try {
                      // Method 3: Selection API approach (if available)
                      const range = document.createRange();
                      range.selectNodeContents(element);
                      const selection = window.getSelection();
                      selection.removeAllRanges();
                      selection.addRange(range);
                      document.execCommand('insertText', false, field.value);
                    } catch (e3) {
                      console.error('Teal Form Filler: All methods failed for contenteditable:', e3);
                    }
                  }
                }
              } else {
                // Handle regular input fields
                element.focus();
                element.select();
                element.value = field.value;
                
                // Trigger input events to notify React/Vue of the change
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
              
              fieldFilled = true;
              console.log(`Teal Form Filler: Filled ${field.name}: ${field.value.substring(0, 50)}${field.value.length > 50 ? '...' : ''}`);
              break;
            }
          } catch (error) {
            console.error(`Teal Form Filler: Error filling ${field.name}:`, error);
          }
        }
        
        if (!fieldFilled) {
          console.log(`Teal Form Filler: Could not find field for ${field.name}`);
        }
        
        // Small delay between fields
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log('Teal Form Filler: Form filling completed!');
      
    } catch (error) {
      console.error('Teal Form Filler: Error during form filling:', error);
    }
  }, 5000); // Wait 5 seconds for page to load
  } catch (globalError) {
    console.error('Teal Form Filler: Critical error in fillTealForm:', globalError);
  }
}

// Handle creating reminder for saved LinkedIn posts
async function handleCreateLinkedInPostReminder(request, sendResponse) {
  try {
    console.log('LinkedIn Feed Background: Creating reminder for saved post');
    console.log('Post info:', request.postInfo);
    
    // Test if local unified server is running
    const unifiedServerRunning = await testUnifiedServerConnection();
    
    if (!unifiedServerRunning) {
      console.error('LinkedIn Feed Background: Unified server not running on localhost:3000');
      sendResponse({
        success: false,
        error: 'Unified server not running. Start with: npm run unified-server'
      });
      return;
    }
    
    // Create reminder data matching the MacOS reminder format
    const reminderData = {
      title: request.postInfo.title,
      notes: `LinkedIn Post by ${request.postInfo.author}\n\n${request.postInfo.content}\n\nSaved from: ${request.postInfo.url}`,
      priority: 5, // Medium priority
      dueDate: null, // No due date for saved posts
      listName: 'LinkedIn Saved Posts' // Create a specific list for LinkedIn posts
    };
    
    // Call unified server to create reminder via CLI
    const reminderResponse = await callUnifiedServerForLinkedInReminder(reminderData);
    
    sendResponse({
      success: true,
      reminderId: reminderResponse.reminderId,
      message: 'Reminder created for LinkedIn post'
    });
    
  } catch (error) {
    console.error('LinkedIn Feed Background: Failed to create reminder:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Call unified server to create LinkedIn post reminder
async function callUnifiedServerForLinkedInReminder(reminderData) {
  try {
    console.log('LinkedIn Feed Background: Calling unified server for reminder creation');
    
    const response = await fetch('http://localhost:3000/linkedin-reminder', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reminderData),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    console.log('LinkedIn Feed Background: Unified server response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Unified server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('LinkedIn Feed Background: Unified server response data:', data);
    
    if (!data.success) {
      throw new Error(data.error || 'Unified server reminder creation failed');
    }
    
    return {
      reminderId: data.reminderId || 'created'
    };
    
  } catch (error) {
    console.error('LinkedIn Feed Background: Failed to call unified server for reminder:', error);
    
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      throw new Error('Reminder creation timed out');
    } else if (error.message.includes('fetch')) {
      throw new Error('Could not connect to unified server. Make sure to run: npm run unified-server');
    } else {
      throw error;
    }
  }
}

console.log('Job Extractor Assistant: Background script loaded');