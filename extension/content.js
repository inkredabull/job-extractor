// Job Extractor Assistant - Content Script
let gutterElement = null;
let isGutterOpen = false;
let extractedJobDescription = '';

// Create the right gutter
function createGutter() {
  if (gutterElement) return;
  
  gutterElement = document.createElement('div');
  gutterElement.id = 'job-extractor-gutter';
  gutterElement.innerHTML = `
    <div class="gutter-header">
      <h3>🎯 Job Extractor Assistant</h3>
      <button id="close-gutter">×</button>
    </div>
    <div class="gutter-content">
      <div class="job-description-section">
        <h4>📄 Job Description</h4>
        <p>Auto-extracted job description (editable):</p>
        <textarea id="job-description" class="job-description-textarea" placeholder="Job description will be extracted automatically...">${extractedJobDescription}</textarea>
        <button id="refresh-job-description" class="refresh-btn">🔄 Re-extract</button>
      </div>
      
      <div class="llm-interface">
        <h4>AI Assistant</h4>
        <p>Ask a question to get AI-powered insights:</p>
        
        <div class="input-section">
          <input type="text" id="llm-input" placeholder="Enter your question here...">
          <button id="submit-query" class="submit-btn">Submit</button>
        </div>
        
        <div id="llm-response" class="response-section" style="display: none;">
          <div class="response-header">
            <span class="status-indicator success">✓</span>
            <strong>AI Response:</strong>
          </div>
          <div class="response-content"></div>
        </div>
        
        <div class="current-url">
          <strong>Current URL:</strong><br>
          <span id="current-url-display">${window.location.href}</span>
        </div>
        
        <div id="page-questions" class="page-analysis" style="display: none;">
          <h5>Questions Found on Page:</h5>
          <ul id="questions-list"></ul>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(gutterElement);
  
  // Add close button functionality
  document.getElementById('close-gutter').addEventListener('click', closeGutter);
  
  // Add submit button functionality
  document.getElementById('submit-query').addEventListener('click', handleLLMQuery);
  
  // Add Enter key functionality for input
  document.getElementById('llm-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLLMQuery();
    }
  });
  
  // Add refresh job description functionality
  document.getElementById('refresh-job-description').addEventListener('click', function() {
    extractJobDescription();
    const textarea = document.getElementById('job-description');
    textarea.value = extractedJobDescription;
  });
  
  // Extract job description automatically when gutter opens
  extractJobDescription();
  
  // Analyze page content for questions
  analyzePageContent();
  
  console.log('Job Extractor: Gutter created');
}

// Extract job description from the current page
function extractJobDescription() {
  try {
    console.log('Job Extractor: Extracting job description from page');
    
    // Strategy 1: Look for JSON-LD structured data first (similar to CLI tool)
    const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
    for (const element of jsonLdElements) {
      try {
        const data = JSON.parse(element.textContent);
        if (data['@type'] === 'JobPosting' && data.description) {
          extractedJobDescription = cleanText(data.description);
          console.log('Job Extractor: Found job description in JSON-LD');
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Strategy 2: Look for common job description patterns
    const jobDescriptionSelectors = [
      // Common job site patterns
      '[data-testid*="job-description"]',
      '[data-testid*="jobDescription"]',
      '.job-description',
      '.job-content',
      '.job-details',
      '.job-summary',
      '.position-description',
      '.role-description',
      '#job-description',
      '#job-content',
      '#job-details',
      
      // Workday patterns
      '[data-automation-id*="jobPostingDescription"]',
      '[data-automation-id*="job-description"]',
      
      // Greenhouse patterns
      '#content .section:first-of-type',
      '.job-post__content',
      
      // LinkedIn patterns
      '.jobs-description-content__text',
      '.jobs-description__container',
      
      // Generic patterns
      '[class*="job"][class*="description"]',
      '[class*="position"][class*="description"]',
      '[id*="job"][id*="description"]'
    ];
    
    for (const selector of jobDescriptionSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 100) {
        extractedJobDescription = cleanText(element.textContent);
        console.log(`Job Extractor: Found job description using selector: ${selector}`);
        return;
      }
    }
    
    // Strategy 3: Look for main content areas and extract the longest text block
    const mainContentSelectors = ['main', '[role="main"]', '.main-content', '#main-content', '.content'];
    for (const selector of mainContentSelectors) {
      const mainElement = document.querySelector(selector);
      if (mainElement) {
        const textBlocks = Array.from(mainElement.querySelectorAll('p, div'))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 200)
          .sort((a, b) => b.length - a.length);
        
        if (textBlocks.length > 0) {
          extractedJobDescription = cleanText(textBlocks[0]);
          console.log('Job Extractor: Found job description in main content area');
          return;
        }
      }
    }
    
    // Strategy 4: Fallback - get the longest paragraph on the page
    const allParagraphs = Array.from(document.querySelectorAll('p, div'))
      .filter(el => !el.closest('#job-extractor-gutter')) // Exclude our own content
      .map(el => el.textContent.trim())
      .filter(text => text.length > 150 && !isNavigationalText(text))
      .sort((a, b) => b.length - a.length);
    
    if (allParagraphs.length > 0) {
      extractedJobDescription = cleanText(allParagraphs[0]);
      console.log('Job Extractor: Found job description using fallback method');
      return;
    }
    
    // If nothing found, set a helpful message
    extractedJobDescription = 'No job description could be automatically extracted from this page. Please paste the job description manually.';
    console.log('Job Extractor: No job description found');
    
  } catch (error) {
    console.error('Job Extractor: Error extracting job description:', error);
    extractedJobDescription = 'Error extracting job description. Please paste manually.';
  }
}

// Clean extracted text
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[\r\n]+/g, '\n') // Normalize line breaks
    .trim()
    .substring(0, 2000); // Limit length to avoid overly long descriptions
}

// Check if text looks like navigation/header/footer content
function isNavigationalText(text) {
  const navPatterns = [
    /^(home|about|contact|login|register|sign in|menu)/i,
    /^(copyright|privacy|terms|cookies)/i,
    /^(search|filter|sort by)/i,
    /^(next|previous|page \d+)/i,
    /(navigation|breadcrumb|footer|header)/i
  ];
  
  return navPatterns.some(pattern => pattern.test(text)) || text.length < 50;
}

// Handle LLM query submission
async function handleLLMQuery() {
  const input = document.getElementById('llm-input');
  const submitBtn = document.getElementById('submit-query');
  const responseDiv = document.getElementById('llm-response');
  const responseContent = responseDiv.querySelector('.response-content');
  
  const query = input.value.trim();
  if (!query) return;
  
  // Show loading state
  submitBtn.textContent = 'Processing...';
  submitBtn.disabled = true;
  responseDiv.style.display = 'block';
  responseContent.innerHTML = '<div class="loading">🤔 Thinking...</div>';
  
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Try to get CV-aware response first, fallback to mock
    let response = await generateCVAwareResponse(query);
    let isRealResponse = false;
    if (!response) {
      response = generateMockResponse(query);
      console.log('Job Extractor: Using fallback mock response');
    } else {
      console.log('Job Extractor: Using CV-aware response');
      isRealResponse = true;
    }
    
    // Display successful response with appropriate metadata
    const metadata = isRealResponse 
      ? '<small>✅ CV-aware response from Claude 3.5 Sonnet</small>'
      : '<small>⚠️ Mock response (MCP server not available)</small>';
    
    responseContent.innerHTML = `
      <div class="api-metadata">
        ${metadata}
      </div>
      <div class="response-text">${response}</div>
    `;
    
    console.log('Job Extractor: Mock LLM API call successful');
    
  } catch (error) {
    // Display error state
    responseContent.innerHTML = `
      <div class="error-message">
        <span class="status-indicator error">✗</span>
        <strong>Error:</strong> Failed to connect to AI service
      </div>
    `;
    console.error('Job Extractor: LLM API call failed', error);
  }
  
  // Reset button state
  submitBtn.textContent = 'Submit';
  submitBtn.disabled = false;
}

// Generate mock AI response based on input
function generateMockResponse(query) {
  const responses = {
    job: "This appears to be a job posting for a software engineering role. Key requirements include experience with JavaScript, React, and Node.js. The company offers competitive compensation and remote work options.",
    salary: "Based on the job description, this role likely offers a salary range of $90k-$140k annually, depending on experience level and location.",
    company: "This company appears to be a mid-stage startup in the fintech space. They have strong growth metrics and recent Series B funding.",
    interview: "For this role, expect technical interviews covering algorithms, system design, and behavioral questions. I'd recommend preparing examples of your React projects and distributed systems experience.",
    default: "I can help you analyze job postings, salary ranges, company research, and interview preparation. Feel free to ask specific questions about the current page or career advice!"
  };
  
  const lowerQuery = query.toLowerCase();
  for (const [key, response] of Object.entries(responses)) {
    if (lowerQuery.includes(key)) {
      return response;
    }
  }
  
  return responses.default;
}

// Analyze page content for questions
function analyzePageContent() {
  try {
    const questions = findQuestionsOnPage();
    const questionsDiv = document.getElementById('page-questions');
    const questionsList = document.getElementById('questions-list');
    
    if (questions.length > 0) {
      questionsList.innerHTML = '';
      questions.forEach(question => {
        const li = document.createElement('li');
        li.textContent = question;
        li.classList.add('clickable-question');
        li.addEventListener('click', function() {
          populateQuestionInput(question);
        });
        questionsList.appendChild(li);
      });
      questionsDiv.style.display = 'block';
      console.log(`Job Extractor: Found ${questions.length} questions on page`);
    } else {
      questionsDiv.style.display = 'none';
      console.log('Job Extractor: No questions found on page');
    }
  } catch (error) {
    console.error('Job Extractor: Error analyzing page content:', error);
  }
}

// Find questions on the current page
function findQuestionsOnPage() {
  const questions = [];
  const questionPatterns = [
    /\b[A-Z][^.!?]*\?/g, // Basic question pattern
    /What\s+[^?]+\?/gi,
    /How\s+[^?]+\?/gi,
    /Why\s+[^?]+\?/gi,
    /When\s+[^?]+\?/gi,
    /Where\s+[^?]+\?/gi,
    /Who\s+[^?]+\?/gi,
    /Which\s+[^?]+\?/gi,
    /Can\s+you\s+[^?]+\?/gi,
    /Do\s+you\s+[^?]+\?/gi,
    /Are\s+you\s+[^?]+\?/gi,
    /Have\s+you\s+[^?]+\?/gi,
    /Would\s+you\s+[^?]+\?/gi,
    /Could\s+you\s+[^?]+\?/gi
  ];
  
  // Get all text content from the page
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, span, div:not(script):not(style)');
  const seenQuestions = new Set();
  
  textElements.forEach(element => {
    // Skip our own extension content
    if (element.closest('#job-extractor-gutter')) return;
    
    const text = element.textContent || '';
    
    questionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanQuestion = match.trim();
          // Filter out very short questions, duplicates, and common non-questions
          if (cleanQuestion.length > 10 && 
              cleanQuestion.length < 200 && 
              !seenQuestions.has(cleanQuestion.toLowerCase()) &&
              !isCommonNonQuestion(cleanQuestion)) {
            questions.push(cleanQuestion);
            seenQuestions.add(cleanQuestion.toLowerCase());
          }
        });
      }
    });
  });
  
  // Limit to first 10 questions to avoid overwhelming the UI
  return questions.slice(0, 10);
}

// Filter out common patterns that aren't real questions
function isCommonNonQuestion(text) {
  const nonQuestionPatterns = [
    /^(what|how|why|when|where|who)\s*(is|are|was|were)?\s*$/i, // Too short
    /\b(username|password|email|phone|name|address)\b/i, // Form fields
    /\b(search|find|looking for)\b/i, // Search queries
    /^\s*\?\s*$/,  // Just question marks
    /\d+\s*\?\s*\d+/,  // Math expressions
    /\$\d+/,  // Price questions
    /\b(faq|q&a)\b/i  // FAQ headers
  ];
  
  return nonQuestionPatterns.some(pattern => pattern.test(text));
}

// Populate question into input field for user review
function populateQuestionInput(question) {
  const input = document.getElementById('llm-input');
  if (input) {
    input.value = question;
    input.focus();
    console.log('Job Extractor: Question populated into input:', question);
  }
}

// Generate CV-aware response using local MCP server
async function generateCVAwareResponse(query) {
  try {
    console.log('Job Extractor: Requesting CV-aware response for:', query);
    
    // Get current job description from textarea
    const jobDescriptionTextarea = document.getElementById('job-description');
    const jobDescription = jobDescriptionTextarea ? jobDescriptionTextarea.value.trim() : '';
    
    // Make request to local MCP server (through background script)
    const response = await chrome.runtime.sendMessage({
      action: 'callMCPServer',
      tool: 'answer_cv_question',
      args: { 
        question: query,
        jobDescription: jobDescription
      }
    });
    
    console.log('Job Extractor: Background response:', response);
    
    if (response && response.success && response.data) {
      console.log('Job Extractor: CV-aware response received:', response.data);
      return response.data;
    }
    
    console.log('Job Extractor: No CV-aware response available, falling back to mock');
    return null;
  } catch (error) {
    console.warn('Job Extractor: Failed to get CV-aware response:', error);
    return null;
  }
}

// Open the gutter
function openGutter() {
  if (isGutterOpen) return;
  
  createGutter();
  
  // Animate in
  setTimeout(() => {
    gutterElement.classList.add('open');
    document.body.classList.add('job-extractor-gutter-open');
    document.documentElement.classList.add('job-extractor-gutter-open');
    isGutterOpen = true;
  }, 10);
  
  console.log('Job Extractor: Gutter opened');
}

// Close the gutter
function closeGutter() {
  if (!isGutterOpen || !gutterElement) return;
  
  gutterElement.classList.remove('open');
  document.body.classList.remove('job-extractor-gutter-open');
  document.documentElement.classList.remove('job-extractor-gutter-open');
  
  setTimeout(() => {
    if (gutterElement && gutterElement.parentNode) {
      gutterElement.parentNode.removeChild(gutterElement);
      gutterElement = null;
    }
  }, 300);
  
  isGutterOpen = false;
  console.log('Job Extractor: Gutter closed');
}

// Toggle gutter
function toggleGutter() {
  if (isGutterOpen) {
    closeGutter();
  } else {
    openGutter();
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'toggleGutter':
      toggleGutter();
      sendResponse({
        success: true,
        isOpen: isGutterOpen
      });
      break;
      
    case 'getGutterState':
      sendResponse({
        isOpen: isGutterOpen
      });
      break;
      
    default:
      sendResponse({success: false, error: 'Unknown action'});
  }
});

// Keyboard shortcut (Ctrl+Shift+J or Cmd+Shift+J)
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
    e.preventDefault();
    toggleGutter();
  }
});

console.log('Job Extractor Assistant: Content script loaded');