// Job Extractor Assistant - Content Script
let gutterElement = null;
let isGutterOpen = false;

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
      <div class="llm-interface">
        <h4>AI Assistant</h4>
        <p>Ask a question to get AI-powered insights:</p>
        
        <div class="input-section">
          <textarea id="llm-input" placeholder="Enter your question here..." rows="3"></textarea>
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
      </div>
    </div>
  `;
  
  document.body.appendChild(gutterElement);
  
  // Add close button functionality
  document.getElementById('close-gutter').addEventListener('click', closeGutter);
  
  // Add submit button functionality
  document.getElementById('submit-query').addEventListener('click', handleLLMQuery);
  
  // Add Enter key functionality for textarea
  document.getElementById('llm-input').addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleLLMQuery();
    }
  });
  
  console.log('Job Extractor: Gutter created');
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
    
    // Mock successful LLM response
    const mockResponse = generateMockResponse(query);
    
    // Display successful response
    responseContent.innerHTML = `
      <div class="api-metadata">
        <small>Model: claude-3.5-sonnet | Response time: 1.2s | Tokens: 156</small>
      </div>
      <div class="response-text">${mockResponse}</div>
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

// Open the gutter
function openGutter() {
  if (isGutterOpen) return;
  
  createGutter();
  
  // Animate in
  setTimeout(() => {
    gutterElement.classList.add('open');
    document.body.classList.add('job-extractor-gutter-open');
    isGutterOpen = true;
  }, 10);
  
  console.log('Job Extractor: Gutter opened');
}

// Close the gutter
function closeGutter() {
  if (!isGutterOpen || !gutterElement) return;
  
  gutterElement.classList.remove('open');
  document.body.classList.remove('job-extractor-gutter-open');
  
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