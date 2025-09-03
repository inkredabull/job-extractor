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
      
      <div class="job-information-section">
        <h4>📄 Job Information</h4>
        <p>Auto-extracted job details (editable):</p>
        
        <div class="form-field">
          <label for="job-title">Job Title:</label>
          <input type="text" id="job-title" class="job-input" placeholder="Job title will be extracted automatically...">
        </div>
        
        <div class="form-field">
          <label for="company-name">Company:</label>
          <input type="text" id="company-name" class="job-input" placeholder="Company name will be extracted automatically...">
        </div>
        
        <div class="form-field">
          <label for="job-location">Location:</label>
          <input type="text" id="job-location" class="job-input" placeholder="Job location will be extracted automatically...">
        </div>
        
        <div class="form-field salary-range">
          <label>Salary Range:</label>
          <div class="salary-inputs">
            <input type="text" id="min-salary" class="job-input salary-input" placeholder="Min (e.g., 120000)">
            <span class="salary-separator">to</span>
            <input type="text" id="max-salary" class="job-input salary-input" placeholder="Max (e.g., 160000)">
          </div>
        </div>
        
        <div class="form-field">
          <label for="job-url">Job URL:</label>
          <input type="text" id="job-url" class="job-input" placeholder="Current page URL">
        </div>
        
        <div class="form-field">
          <label for="job-description">Description:</label>
          <textarea id="job-description" class="job-description-textarea" placeholder="Job description will be extracted automatically..."></textarea>
        </div>
        
        <div class="form-field">
          <label class="radio-label">
            <input type="checkbox" id="track-in-teal-checkbox" class="teal-checkbox" checked>
            <span class="checkmark"></span>
            Track in Teal?
          </label>
        </div>
        
        <div class="button-group">
          <button id="track-job-info" class="track-btn">Track</button>
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
  
  
  // Add track job from form fields functionality
  document.getElementById('track-job-info').addEventListener('click', handleTrackFromForm);
  
  
  // Extract job information automatically when gutter opens (with slight delay for DOM)
  setTimeout(() => {
    extractJobInformation();
  }, 100);
  
  // Analyze page content for questions
  analyzePageContent();
  
  console.log('Job Extractor: Gutter created');
}

// Extract comprehensive job information from the current page
function extractJobInformation() {
  console.log('🔍 Job Extractor: Starting comprehensive job information extraction');
  console.log('🔍 Current page URL:', window.location.href);
  console.log('🔍 Page title:', document.title);
  
  // Debug: Check what H1 elements exist
  const h1Elements = document.querySelectorAll('h1');
  console.log('🔍 Found H1 elements:', Array.from(h1Elements).map(el => el.textContent?.trim()));
  
  // Debug: Check what elements have "job" or "title" in their attributes
  const jobElements = document.querySelectorAll('[class*="job"], [data-testid*="job"], [class*="title"]');
  console.log('🔍 Found job-related elements:', jobElements.length);
  
  // Extract job title
  const jobTitle = extractJobTitle();
  const titleField = document.getElementById('job-title');
  if (titleField) {
    titleField.value = jobTitle;
    titleField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Extract company name
  const companyName = extractCompanyName();
  const companyField = document.getElementById('company-name');
  if (companyField) {
    companyField.value = companyName;
    companyField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Extract location
  const location = extractJobLocation();
  const locationField = document.getElementById('job-location');
  if (locationField) {
    // Only set value if it's actually visible text
    const cleanedLocation = location && location.trim().length > 0 ? location : '';
    locationField.value = cleanedLocation;
    locationField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Extract job description
  extractJobDescription();
  const descriptionField = document.getElementById('job-description');
  if (descriptionField) descriptionField.value = extractedJobDescription;
  
  // Set the current URL
  const urlField = document.getElementById('job-url');
  if (urlField) urlField.value = window.location.href;
  
  console.log('Job Extractor: Job information extracted:', {
    title: jobTitle,
    company: companyName,
    location: location,
    url: window.location.href,
    hasDescription: extractedJobDescription.length > 0
  });
  
  // Debug: Check if fields exist and were populated
  console.log('Job Extractor: Field population check:', {
    titleField: !!document.getElementById('job-title'),
    titleValue: document.getElementById('job-title')?.value,
    companyField: !!document.getElementById('company-name'),
    companyValue: document.getElementById('company-name')?.value,
    locationField: !!document.getElementById('job-location'),
    locationValue: document.getElementById('job-location')?.value,
    urlField: !!document.getElementById('job-url'),
    urlValue: document.getElementById('job-url')?.value
  });
}

// Extract job title from the current page
function extractJobTitle() {
  const titleSelectors = [
    'h1[data-testid*="job"]',
    'h1[data-testid*="title"]',
    '[data-testid*="job-title"]',
    '[data-testid*="jobTitle"]',
    '.job-title',
    '.position-title',
    '.role-title',
    'h1:first-of-type',
    '.job-header h1',
    '.job-post-title',
    '[class*="job"][class*="title"]',
    '[data-automation-id*="title"]'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return cleanText(element.textContent);
    }
  }
  
  // Fallback: try to extract from page title
  const pageTitle = document.title.split('|')[0].split('-')[0].split('at')[0].trim();
  if (pageTitle && pageTitle.length > 3) {
    return pageTitle;
  }
  
  return '';
}

// Extract company name from the current page
function extractCompanyName() {
  const companySelectors = [
    '[data-testid*="company"]',
    '.company-name',
    '.employer-name',
    '.job-company',
    '[class*="company"][class*="name"]',
    '[data-automation-id*="company"]',
    '.company',
    '[class*="employer"]'
  ];
  
  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return cleanText(element.textContent);
    }
  }
  
  // Linear/Ashby specific: Check for company in URL or page structure
  if (window.location.href.includes('linear.app/careers')) {
    return 'Linear';
  }
  
  // Check for company logo or branding elements
  const logoSelectors = ['[alt*="logo" i]', '[class*="logo"]', 'img[src*="logo"]'];
  for (const selector of logoSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const alt = element.getAttribute('alt');
      if (alt && alt.toLowerCase().includes('logo')) {
        return alt.replace(/logo/gi, '').trim();
      }
    }
  }
  
  // Fallback: try to extract from page title or meta tags
  const metaCompany = document.querySelector('meta[property="og:site_name"]');
  if (metaCompany && metaCompany.content) {
    return metaCompany.content;
  }
  
  // Try extracting from page title (after "at")
  const titleParts = document.title.split(' at ');
  if (titleParts.length > 1) {
    return titleParts[1].split('|')[0].split('-')[0].trim();
  }
  
  // Try extracting from URL subdomain
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length >= 2 && parts[0] !== 'www') {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }
  
  return '';
}

// Extract job location from the current page
function extractJobLocation() {
  const locationSelectors = [
    '[data-testid*="location"]',
    '.job-location',
    '.location',
    '[class*="location"]',
    '[data-automation-id*="location"]',
    '.job-info .location',
    '[class*="job"][class*="location"]'
  ];
  
  for (const selector of locationSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      const cleaned = cleanText(element.textContent);
      if (cleaned && cleaned.length > 0) {
        return cleaned;
      }
    }
  }
  
  // Look for common location text patterns
  const textContent = document.body.textContent || '';
  const locationPatterns = [
    /(?:Location|Based in|Office|Work from):\s*([^\.]+)/i,
    /(Remote|Hybrid|On-site)\s*[-,]?\s*([A-Za-z\s,]+)/i,
    /(San Francisco|New York|London|Berlin|Remote|Hybrid)/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = textContent.match(pattern);
    if (match) {
      const locationText = cleanText(match[1] || match[0]);
      if (locationText && locationText.length > 0 && locationText.length < 100) {
        return locationText;
      }
    }
  }
  
  // Check for specific text content that might indicate location
  const allText = Array.from(document.querySelectorAll('*'))
    .map(el => el.textContent?.trim())
    .filter(text => text && text.length < 50 && text.length > 2);
    
  const locationKeywords = ['Remote', 'Hybrid', 'San Francisco', 'New York', 'London', 'Berlin', 'Austin', 'Seattle', 'Boston'];
  
  for (const keyword of locationKeywords) {
    const found = allText.find(text => 
      text.includes(keyword) && 
      !text.includes('Experience') && 
      !text.includes('Requirements') &&
      !text.includes('Skills')
    );
    if (found) {
      const cleaned = cleanText(found);
      if (cleaned && cleaned.length > 0 && cleaned.length < 100) {
        return cleaned;
      }
    }
  }
  
  return '';
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
  if (!text) return '';
  
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/[\r\n\t]+/g, ' ') // Replace line breaks and tabs with space
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
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

// Handle Teal tracking functionality
async function handleTealTracking() {
  const trackBtn = document.getElementById('track-in-teal');
  const statusDiv = document.getElementById('teal-status');
  
  // Show loading state
  trackBtn.textContent = 'Extracting...';
  trackBtn.disabled = true;
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<div class="loading">🚀 Extracting job data...</div>';
  statusDiv.className = 'teal-status loading';
  
  try {
    // First, extract job data server-side to get normalized JSON
    statusDiv.innerHTML = '<div class="loading">🚀 Extracting job data from page...</div>';
    
    const extractResponse = await chrome.runtime.sendMessage({
      action: 'extractJob',
      url: window.location.href
    });
    
    if (!extractResponse.success) {
      throw new Error(extractResponse.error || 'Failed to extract job data');
    }
    
    // Update status to show we're opening Teal
    statusDiv.innerHTML = '<div class="loading">🔖 Opening Teal and filling form...</div>';
    trackBtn.textContent = 'Opening...';
    
    // Use the extracted job data for Teal form filling, with fallback to form fields
    const jobInfo = extractResponse.jobData || {
      title: document.getElementById('job-title')?.value || 'Unknown Title',
      company: document.getElementById('company-name')?.value || 'Unknown Company',
      location: document.getElementById('job-location')?.value || 'Unknown Location',
      url: document.getElementById('job-url')?.value || window.location.href,
      description: document.getElementById('job-description')?.value || 'No description available',
      minSalary: document.getElementById('min-salary')?.value || '',
      maxSalary: document.getElementById('max-salary')?.value || ''
    };
    
    // Send extracted job info to background script to handle the new tab and automation
    const response = await chrome.runtime.sendMessage({
      action: 'openTealAndFill',
      jobInfo: jobInfo
    });
    
    if (response.success) {
      // Show success message
      statusDiv.innerHTML = `
        <div class="success-message">
          <span class="status-indicator success">✓</span>
          <strong>Success!</strong> Job extracted and Teal opened
          <br><small>Job ID: ${extractResponse.jobId}</small>
          <br><small>Form being auto-filled in new tab</small>
        </div>
      `;
      statusDiv.className = 'teal-status success';
    } else {
      statusDiv.innerHTML = `
        <div class="error-message">
          <span class="status-indicator error">✗</span>
          <strong>Error:</strong> ${response.error || 'Failed to open Teal'}
        </div>
      `;
      statusDiv.className = 'teal-status error';
    }
    
  } catch (error) {
    statusDiv.innerHTML = `
      <div class="error-message">
        <span class="status-indicator error">✗</span>
        <strong>Error:</strong> ${error.message}
        <br><small>Failed to extract job or open Teal</small>
      </div>
    `;
    statusDiv.className = 'teal-status error';
    console.error('Job Extractor: Teal tracking failed', error);
  }
  
  // Reset button state
  trackBtn.textContent = 'Extract & Track';
  trackBtn.disabled = false;
  
  // Hide status after 8 seconds if successful (longer to show job ID)
  if (statusDiv.className.includes('success')) {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 8000);
  }
}

// Handle tracking job using form field values
async function handleTrackFromForm() {
  const trackBtn = document.getElementById('track-job-info');
  
  // Show loading state
  trackBtn.textContent = 'Processing...';
  trackBtn.disabled = true;
  
  try {
    // Get values directly from form fields
    const jobInfo = {
      title: document.getElementById('job-title')?.value?.trim() || '',
      company: document.getElementById('company-name')?.value?.trim() || '',
      location: document.getElementById('job-location')?.value?.trim() || '',
      url: document.getElementById('job-url')?.value?.trim() || window.location.href,
      description: document.getElementById('job-description')?.value?.trim() || '',
      minSalary: document.getElementById('min-salary')?.value?.trim() || '',
      maxSalary: document.getElementById('max-salary')?.value?.trim() || ''
    };
    
    // Validate that we have at least title and company
    if (!jobInfo.title) {
      alert('Please enter a job title before tracking');
      return;
    }
    
    if (!jobInfo.company) {
      alert('Please enter a company name before tracking');
      return;
    }
    
    // Check if Teal tracking is enabled
    const shouldTrackInTeal = document.getElementById('track-in-teal-checkbox')?.checked || false;
    
    console.log('Job Extractor: Tracking job from form fields:', jobInfo);
    console.log('Job Extractor: Track in Teal enabled:', shouldTrackInTeal);
    
    // Send JSON payload to extract functionality server-side
    const extractResponse = await chrome.runtime.sendMessage({
      action: 'extractFromJson',
      jobData: jobInfo
    });
    
    if (extractResponse.success) {
      console.log('✅ Successfully saved job data server-side:', extractResponse.jobId);
      
      // Conditionally open Teal tab based on checkbox state
      if (shouldTrackInTeal) {
        trackBtn.textContent = 'Opening Teal...';
        const tealResponse = await chrome.runtime.sendMessage({
          action: 'openTealAndFill',
          jobInfo: jobInfo
        });
        
        if (tealResponse.success) {
          console.log('✅ Successfully opened Teal tab with job information');
        } else {
          console.error('❌ Failed to open Teal:', tealResponse.error);
          alert(`Failed to open Teal: ${tealResponse.error}`);
        }
      } else {
        console.log('📝 Job data saved successfully (Teal tracking disabled)');
        alert('Job data saved successfully!');
      }
    } else {
      console.error('❌ Failed to save job data:', extractResponse.error);
      alert(`Failed to save job data: ${extractResponse.error}`);
    }
    
  } catch (error) {
    console.error('Job Extractor: Track from form failed', error);
    alert(`Error: ${error.message}`);
  } finally {
    // Reset button state
    trackBtn.textContent = 'Track';
    trackBtn.disabled = false;
  }
}

// Handle extract job functionality
async function handleExtractJob() {
  const extractBtn = document.getElementById('extract-job');
  const statusDiv = document.getElementById('extract-status');
  
  // Show loading state
  extractBtn.textContent = 'Extracting...';
  extractBtn.disabled = true;
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<div class="loading">🚀 Running extraction...</div>';
  statusDiv.className = 'extract-status loading';
  
  try {
    // Send message to background script to execute CLI command
    const response = await chrome.runtime.sendMessage({
      action: 'extractJob',
      url: window.location.href
    });
    
    if (response.success) {
      statusDiv.innerHTML = `
        <div class="success-message">
          <span class="status-indicator success">✓</span>
          <strong>Success!</strong> Job extracted successfully
          <br><small>Job ID: ${response.jobId}</small>
          <br><small>Saved to: ${response.filePath}</small>
        </div>
      `;
      statusDiv.className = 'extract-status success';
      
      // Update the job description textarea if data is available
      if (response.jobData && response.jobData.description) {
        const textarea = document.getElementById('job-description');
        textarea.value = response.jobData.description;
        extractedJobDescription = response.jobData.description;
      }
      
    } else {
      statusDiv.innerHTML = `
        <div class="error-message">
          <span class="status-indicator error">✗</span>
          <strong>Error:</strong> ${response.error || 'Extraction failed'}
        </div>
      `;
      statusDiv.className = 'extract-status error';
    }
    
  } catch (error) {
    statusDiv.innerHTML = `
      <div class="error-message">
        <span class="status-indicator error">✗</span>
        <strong>Error:</strong> Failed to execute extraction
        <br><small>${error.message}</small>
      </div>
    `;
    statusDiv.className = 'extract-status error';
    console.error('Job Extractor: Extract job failed', error);
  }
  
  // Reset button state
  extractBtn.textContent = 'Extract';
  extractBtn.disabled = false;
  
  // Hide status after 5 seconds if successful
  if (statusDiv.className.includes('success')) {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
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

// LinkedIn connection extraction functionality
function detectLinkedInCompanyPeople() {
  const url = window.location.href;
  return url.includes('linkedin.com/company/') && url.includes('/people/');
}

function runLinkedInConnectionExtraction() {
  console.log("LinkedIn Connection Extractor - Starting profile clicks...");

  // Try multiple selectors to find LinkedIn profile cards
  var clickableElements = [];
  
  // Multiple selector patterns to try
  var selectorPatterns = [
    // Standard company people page
    ".org-people-profile-card a[href*='/in/']",
    ".org-people-profile-card__profile-info a[href*='/in/']",
    // Alternative patterns
    "[data-control-name='people_profile_card'] a[href*='/in/']",
    ".people-card a[href*='/in/']",
    ".entity-result a[href*='/in/']",
    // More generic LinkedIn profile links
    "a[href*='linkedin.com/in/']",
    "a[href*='/in/'][href*='linkedin']"
  ];
  
  // Track unique URLs to avoid duplicates
  var seenUrls = new Set();
  
  // Try each selector pattern
  for (let pattern of selectorPatterns) {
    var foundElements = document.querySelectorAll(pattern);
    console.log(`Trying selector "${pattern}": found ${foundElements.length} elements`);
    
    if (foundElements.length > 0) {
      for (let i = 0; i < foundElements.length; i++) {
        var profileLink = foundElements[i];
        var profileUrl = profileLink.href;
        
        // Skip if we've already seen this URL
        if (seenUrls.has(profileUrl)) {
          continue;
        }
        seenUrls.add(profileUrl);
        
        var card = profileLink.closest('.org-people-profile-card, .entity-result, .people-card, [data-control-name="people_profile_card"]');
        
        var nameElement = card ? card.querySelector('.t-black, .entity-result__title-text, .t-16, .t-bold') : null;
        var headlineElement = card ? card.querySelector('.t-14, .entity-result__primary-subtitle, .t-12') : null;
        
        var name = nameElement ? nameElement.innerText.trim() : `Profile ${clickableElements.length + 1}`;
        var headline = headlineElement ? headlineElement.innerText.trim() : "";
        
        console.log(`Found unique connection: ${name} - ${headline}`);
        clickableElements.push({
            element: profileLink,
            name: name,
            headline: headline
        });
      }
      break; // Stop trying other patterns if we found some elements
    }
  }

  console.log(`Found ${clickableElements.length} connection profiles. Starting clicks...`);

  // Function to click profiles with random delays
  function clickProfilesWithDelay(elements, index = 0) {
      if (index >= elements.length) {
          console.log("Finished clicking all connection profiles!");
          linkedInExtractionRunning = false; // Reset flag when done
          return;
      }
      
      // Random delay between 1500-3000ms
      var delay = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
      
      function clickNextProfile() {
          var connection = elements[index];
          console.log(`Opening profile ${index + 1}/${elements.length} in new tab: ${connection.name}`);
          
          // Open in new tab instead of clicking
          window.open(connection.element.href, '_blank');
          
          clickProfilesWithDelay(elements, index + 1);
      }
      
      setTimeout(clickNextProfile, delay);
  }

  // Open only the first profile for now
  if (clickableElements.length > 0) {
      var firstConnection = clickableElements[0];
      console.log(`Opening first profile in new tab: ${firstConnection.name}`);
      
      // Open the profile and set up mutual connections detection
      var profileWindow = window.open(firstConnection.element.href, '_blank');
      
      // Monitor the new window for mutual connections
      if (profileWindow) {
        setTimeout(() => {
          try {
            // Inject mutual connections detector into the profile page
            profileWindow.postMessage({
              action: 'detectMutualConnections',
              profileName: firstConnection.name
            }, '*');
          } catch (error) {
            console.log('Could not communicate with profile window:', error);
          }
        }, 3000); // Wait 3 seconds for profile page to load
      }
      
      linkedInExtractionRunning = false; // Reset flag when done
  } else {
      console.log("No clickable connection profiles found with any selector pattern.");
      console.log("Available elements on page:");
      // Debug: log what elements are actually on the page
      var allLinks = document.querySelectorAll('a[href*="linkedin.com"], a[href*="/in/"]');
      console.log(`Found ${allLinks.length} LinkedIn-related links total`);
      linkedInExtractionRunning = false; // Reset flag if no elements found
  }
}

// Track if extraction is already running to avoid duplicates
let linkedInExtractionRunning = false;

// Auto-detect LinkedIn company people pages and run extraction
function checkForLinkedInExtraction() {
  if (detectLinkedInCompanyPeople() && !linkedInExtractionRunning) {
    linkedInExtractionRunning = true;
    console.log('LinkedIn company people page detected - waiting 5 seconds before extraction...');
    function startExtraction() {
      runLinkedInConnectionExtraction();
    }
    setTimeout(startExtraction, 5000);
  }
}

// Run check when page loads - handle multiple scenarios
if (document.readyState === 'loading') {
  // DOM is still loading
  document.addEventListener('DOMContentLoaded', checkForLinkedInExtraction);
} else {
  // DOM is already loaded
  checkForLinkedInExtraction();
}

// Also listen for window load event as fallback
window.addEventListener('load', checkForLinkedInExtraction);

// Also run check when URL changes (for SPA navigation)
let currentUrl = window.location.href;
function checkUrlChange() {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    function delayedCheck() {
      checkForLinkedInExtraction();
    }
    setTimeout(delayedCheck, 1000); // Wait for page content to load
  }
}
setInterval(checkUrlChange, 1000);

// Run initial check immediately in case we missed the load events
checkForLinkedInExtraction();

// LinkedIn Profile Mutual Connections Handler
function detectLinkedInProfile() {
  const url = window.location.href;
  return url.includes('linkedin.com/in/');
}

function findAndClickMutualConnections() {
  console.log('Looking for mutual connections link...');
  
  // Don't run on search results pages
  if (window.location.href.includes('/search/results/')) {
    console.log('Skipping mutual connections search - already on search results page');
    return;
  }
  
  // Get the current profile person's name from the page
  var profileName = getProfilePersonName();
  console.log(`Profile person name: "${profileName}"`);
  
  // If we're getting "Unknown Profile", let's debug what's available on the page
  if (profileName === 'Unknown Profile') {
    console.log('Profile name detection failed, debugging available elements:');
    
    // Check all h1 elements
    var allH1s = document.querySelectorAll('h1');
    console.log(`Found ${allH1s.length} h1 elements:`);
    allH1s.forEach((h1, index) => {
      console.log(`  H1 ${index}: "${h1.innerText.trim()}" (classes: ${h1.className})`);
    });
    
    // Check page title
    console.log(`Document title: "${document.title}"`);
    
    // Check for text-heading-xlarge specifically
    var headingElements = document.querySelectorAll('.text-heading-xlarge');
    console.log(`Found ${headingElements.length} .text-heading-xlarge elements:`);
    headingElements.forEach((el, index) => {
      console.log(`  Heading ${index}: "${el.innerText.trim()}"`);
    });
    
    // Check ALL elements with text that might contain names
    var allTextElements = document.querySelectorAll('h1, h2, .pv-text-details__left-panel *, .top-card *, [data-test-id*="name"] *, [data-anonymize="person-name"]');
    console.log(`Found ${allTextElements.length} potential name elements:`);
    allTextElements.forEach((el, index) => {
      var text = el.innerText ? el.innerText.trim() : '';
      if (text.length > 0 && text.length < 100) {
        console.log(`  Element ${index}: "${text}" (tag: ${el.tagName}, classes: ${el.className})`);
      }
    });
  }
  
  // Look specifically for the main mutual connections link, not individual connection links
  var mutualConnectionLink = null;
  
  // Find elements that contain mutual connections text - be more specific
  var textElements = document.querySelectorAll('span.t-normal, span.hoverable-link-text');
  for (let textElement of textElements) {
    var text = textElement.innerText || textElement.textContent || '';
    // Look for text that says "X other mutual connections" or "and X other mutual connections"
    if (text.includes('mutual connection') && text.includes('other')) {
      // Found text like "Dawn Ho, Robert Monarch, and 5 other mutual connections"
      var linkElement = textElement.closest('a');
      if (linkElement && linkElement.href && linkElement.href.includes('facetConnectionOf')) {
        // Double check this isn't clicking on a name within the text
        var linkText = linkElement.innerText || linkElement.textContent || '';
        if (linkText.includes('other mutual connection')) {
          mutualConnectionLink = linkElement;
          console.log(`Found mutual connections link with full text: "${linkText.trim()}"`);
          console.log(`Link href: ${linkElement.href}`);
          break;
        }
      }
    }
  }
  
  // More specific fallback: look for the exact pattern
  if (!mutualConnectionLink) {
    var allLinks = document.querySelectorAll('a[href*="facetConnectionOf"]');
    console.log(`Found ${allLinks.length} links with facetConnectionOf`);
    
    for (let link of allLinks) {
      var linkText = link.innerText || link.textContent || '';
      console.log(`Checking link: "${linkText.trim()}" -> ${link.href}`);
      
      // Make sure it contains the full mutual connections text and not just a name
      if (linkText.includes('mutual connection') && linkText.includes('other') && !link.href.includes('/in/')) {
        mutualConnectionLink = link;
        console.log(`Selected mutual connections link: "${linkText.trim()}"`);
        break;
      }
    }
  }
  
  // Final fallback: find the link that has the most complete mutual connections text
  if (!mutualConnectionLink) {
    console.log('Using final fallback to find mutual connections link...');
    var allLinks = document.querySelectorAll('a[href*="facetConnectionOf"]');
    var bestLink = null;
    var maxNames = 0;
    
    for (let link of allLinks) {
      if (!link.href.includes('/in/')) {
        var linkText = link.innerText || link.textContent || '';
        // Count how many names are in the text (commas + 1)
        var nameCount = (linkText.match(/,/g) || []).length + 1;
        if (nameCount > maxNames && linkText.includes('mutual')) {
          maxNames = nameCount;
          bestLink = link;
          console.log(`Better link found with ${nameCount} names: "${linkText.trim()}"`);
        }
      }
    }
    
    mutualConnectionLink = bestLink;
    if (mutualConnectionLink) {
      console.log(`Final selected link: "${mutualConnectionLink.innerText.trim()}"`);
    }
  }
  
  if (mutualConnectionLink) {
    console.log('Found mutual connections link, clicking...');
    console.log(`Link URL: ${mutualConnectionLink.href}`);
    
    // Store the profile person's name and URL in localStorage for persistence across page navigation
    var currentUrl = window.location.href;
    console.log(`Storing in localStorage - URL: "${currentUrl}", Name: "${profileName}"`);
    
    // Ensure we store the actual name, not "Unknown Profile"
    var nameToStore = profileName;
    if (profileName === 'Unknown Profile') {
      // Try to extract name from URL as fallback during storage
      var urlMatch = currentUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (urlMatch) {
        var urlSlug = urlMatch[1];
        nameToStore = urlSlug
          .replace(/-/g, ' ')
          .replace(/\d+/g, '')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        console.log(`Using URL-extracted name for storage: "${nameToStore}"`);
      }
    }
    
    localStorage.setItem('linkedin_target_profile_url', currentUrl);
    localStorage.setItem('linkedin_target_profile_name', nameToStore);
    localStorage.setItem('linkedin_extraction_timestamp', Date.now().toString());
    
    // Verify storage worked
    console.log(`Verification - stored name: "${localStorage.getItem('linkedin_target_profile_name')}"`);
    console.log(`Verification - stored URL: "${localStorage.getItem('linkedin_target_profile_url')}"`);
    
    mutualConnectionLink.click();
    
    // Don't set up extraction timer here - it will be handled by the URL change detection
  } else {
    console.log('No mutual connections link found on this profile');
  }
}

// Helper function to get the profile person's name from the profile page
function getProfilePersonName() {
  try {
    // Try multiple selectors for the profile name
    var nameSelectors = [
      'h1.inline.t-24.v-align-middle.break-words',  // New LinkedIn profile name selector
      'h1[class*="inline"][class*="t-24"][class*="v-align-middle"][class*="break-words"]', // Fallback for dynamic classes
      '.text-heading-xlarge',
      '.pv-text-details__left-panel h1',
      '.top-card-layout__title',
      'h1[data-anonymize="person-name"]',
      '.top-card__title',
      '.ph5 .text-heading-xlarge',
      '.pv-text-details__left-panel .text-heading-xlarge'
    ];
    
    for (let selector of nameSelectors) {
      var nameElement = document.querySelector(selector);
      if (nameElement && nameElement.innerText.trim()) {
        var name = nameElement.innerText.trim();
        console.log(`Found potential name with selector "${selector}": "${name}"`);
        // Less restrictive filtering - just avoid obvious non-names
        if (!name.toLowerCase().includes('search') && 
            !name.toLowerCase().includes('results') && 
            name.length > 2 && 
            !name.match(/^\(\d+\)/)) {
          return name;
        }
      }
    }
    
    // Fallback: try to get from page title, but clean it up
    var pageTitle = document.title;
    console.log(`Page title: "${pageTitle}"`);
    var titleMatch = pageTitle.match(/^([^|(-]+)/);
    if (titleMatch) {
      var name = titleMatch[1].trim();
      console.log(`Extracted from title: "${name}"`);
      // Less restrictive filtering
      if (!name.toLowerCase().includes('search') && 
          !name.toLowerCase().includes('results') && 
          name.length > 2) {
        return name;
      }
    }
    
    // Final fallback: extract name from URL
    var currentUrl = window.location.href;
    var urlMatch = currentUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (urlMatch) {
      var urlSlug = urlMatch[1];
      // Convert URL slug to readable name
      var nameFromUrl = urlSlug
        .replace(/-/g, ' ')           // Replace hyphens with spaces
        .replace(/\d+/g, '')         // Remove numbers
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
        .join(' ');
      
      console.log(`Extracted from URL: "${nameFromUrl}"`);
      if (nameFromUrl.length > 2) {
        return nameFromUrl;
      }
    }
    
    return 'Unknown Profile';
  } catch (error) {
    console.log('Could not determine profile person name:', error);
    return 'Unknown Profile';
  }
}

function extractMutualConnectionNames() {
  console.log('Extracting mutual connection names...');
  
  try {
    // Get the target profile URL from localStorage 
    var targetProfileUrl = localStorage.getItem('linkedin_target_profile_url') || '';
    console.log(`Target profile URL: "${targetProfileUrl}"`);
    
    // Extract first name directly from the URL
    var targetFirstName = 'Unknown';
    if (targetProfileUrl) {
      var urlMatch = targetProfileUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (urlMatch) {
        var urlSlug = urlMatch[1];
        // Convert URL slug to first name: "samuel-bigio-42918b128" -> "Samuel"
        var firstName = urlSlug
          .split('-')[0]                    // Get first part before hyphens
          .replace(/\d+/g, '')             // Remove any numbers
          .trim();
        
        if (firstName.length > 0) {
          targetFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        }
      }
    }
    
    console.log(`Extracted first name from URL: "${targetFirstName}"`);
    
    // Extract mutual connections
    var identifier = document.querySelectorAll('div.mb1 a')[0]?.className.trim();
    if (!identifier) {
      console.log('Could not find identifier for mutual connections');
      return;
    }
    
    var result = 'Full,PersonName,PersonURL\n'; // CSV headers
    var selector = '.t-16 a.' + identifier + '>span>span:not(.visually-hidden)';
    var nameElements = document.querySelectorAll(selector);
    
    console.log(`Found ${nameElements.length} mutual connections:`);
    console.log('Full,PersonName,PersonURL');
    
    nameElements.forEach((element) => {
      var mutualConnectionName = element.innerText.trim();
      if (mutualConnectionName) {
        // Output format: mutual connection full name, target profile first name, target profile URL
        var csvRow = `"${mutualConnectionName}","${targetFirstName}","${targetProfileUrl}"`;
        result += csvRow + '\n';
        console.log(csvRow);
      }
    });
    
    if (nameElements.length > 0) {
      console.log('\nComplete CSV output:');
      console.log(result);
      
      // Just log to console for now
      console.log('✓ CSV data extraction complete');
    } else {
      console.log('No mutual connection names extracted');
    }
    
  } catch (error) {
    console.error('Error extracting mutual connection names:', error);
  }
}

// Helper function to get the connection person's name
function getConnectionPersonName() {
  try {
    // Try to get from URL parameters first
    var urlParams = new URLSearchParams(window.location.search);
    var connectionId = urlParams.get('facetConnectionOf');
    
    // Try to get from the page breadcrumb or title
    var breadcrumbElement = document.querySelector('.search-results-container h1, .search-results__title');
    if (breadcrumbElement) {
      var titleText = breadcrumbElement.innerText;
      // Extract name from text like "People connected to John Doe"
      var nameMatch = titleText.match(/connected to (.+?)(?:\s|$)/i);
      if (nameMatch) {
        return nameMatch[1].trim();
      }
    }
    
    // Fallback: try to get from previous page context (if available)
    if (window.previousConnectionName) {
      return window.previousConnectionName;
    }
    
    return 'Unknown Connection';
  } catch (error) {
    console.log('Could not determine connection person name:', error);
    return 'Unknown Connection';
  }
}

// Track if we've already processed a search page to avoid duplicates
let searchPageProcessed = false;

// Auto-detect LinkedIn profile pages and find mutual connections
function checkForLinkedInProfile() {
  // Only run on individual profile pages, NOT on company people pages or search results pages
  var url = window.location.href;
  var isProfilePage = url.includes('linkedin.com/in/');
  var isCompanyPage = detectLinkedInCompanyPeople();
  var isSearchPage = url.includes('/search/results/');
  
  console.log(`checkForLinkedInProfile: isProfilePage=${isProfilePage}, isCompanyPage=${isCompanyPage}, isSearchPage=${isSearchPage}`);
  
  if (isProfilePage && !isCompanyPage && !isSearchPage) {
    console.log('LinkedIn profile page detected - waiting 5 seconds before looking for mutual connections...');
    searchPageProcessed = false; // Reset for new profile
    setTimeout(() => {
      findAndClickMutualConnections();
    }, 5000);
  } else if (isSearchPage && url.includes('facetConnectionOf') && !searchPageProcessed) {
    // This is a mutual connections search page - just extract the data ONCE
    console.log('LinkedIn mutual connections search page detected - waiting 4 seconds before extracting...');
    searchPageProcessed = true;
    setTimeout(() => {
      extractMutualConnectionNames();
    }, 4000);
  }
}

// Listen for messages from company people page
window.addEventListener('message', function(event) {
  if (event.data.action === 'detectMutualConnections') {
    console.log(`Received request to detect mutual connections for: ${event.data.profileName}`);
    checkForLinkedInProfile();
  }
});

// Also run profile check when page loads  
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForLinkedInProfile);
} else {
  checkForLinkedInProfile();
}

window.addEventListener('load', checkForLinkedInProfile);

// Monitor URL changes for profile pages too
let profileCurrentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== profileCurrentUrl) {
    profileCurrentUrl = window.location.href;
    setTimeout(checkForLinkedInProfile, 1000);
  }
}, 1000);

console.log('Job Extractor Assistant: Content script loaded');